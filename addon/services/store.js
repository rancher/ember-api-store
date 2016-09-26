import Ember from 'ember';
import Serializable from '../mixins/serializable';
import ApiError from '../models/error';
import { normalizeType } from '../utils/normalize';
import { applyHeaders } from '../utils/apply-headers';
import fetch from 'ember-api-store/utils/fetch';
import { urlOptions } from './utils/url-options';

const { getOwner } = Ember;

export const defaultMetaKeys = ['actionLinks','createDefaults','createTypes','filters','links','pagination','resourceType','sort','sortLinks','type'];

var Store = Ember.Service.extend({
  defaultTimeout: 30000,
  defaultPageSize: 1000,
  baseUrl: '/v1',
  metaKeys: null,
  replaceActions: 'actionLinks',
  dropKeys: null,
  shoeboxName: 'ember-api-store',
  headers: null,

  arrayProxyClass: Ember.ArrayProxy,
  arrayProxyKey: 'content',
  arrayProxyOptions: null,

  // true: automatically remove from store after a record.delete() succeeds.  You might want to disable this if your API has a multi-step deleted vs purged state.
  removeAfterDelete: true,


  fastboot: Ember.computed(function() {
    return Ember.getOwner(this).lookup('service:fastboot');
  }),

  init() {
    this._super();

    if (!this.get('metaKeys') )
    {
      this.set('metaKeys', defaultMetaKeys.slice());
    }

    this._state = {
      cache: null,
      cacheMap: null,
      classCache: null,
      foundAll: null,
      findQueue: null,
    };

    let fastboot = this.get('fastboot');
    if ( fastboot )
    {
      let name = this.get('shoeboxName');
      if ( fastboot.get('isFastBoot') )
      {
        fastboot.get('shoebox').put(name, this._state);
      }
      else
      {
        let box = fastboot.get('shoebox').retrieve(name);
        if ( box )
        {
          this._state = box;
        }
      }
    }

    this.reset();
  },

  // All the saved state goes in here
  _state: null,

  // You can observe this to tell when a reset() happens
  generation: 0,

  // Synchronously get record from local cache by [type] and [id].
  // Returns undefined if the record is not in cache, does not talk to API.
  getById(type, id) {
    type = normalizeType(type);
    var group = this._groupMap(type);
    return group[id];
  },

  // Synchronously returns whether record for [type] and [id] is in the local cache.
  hasRecordFor(type, id) {
    return !!this.getById(type,id);
  },

  // Synchronously returns whether this exact record object is in the local cache
  hasRecord(obj) {
    var type = normalizeType(obj.get('type'));
    var group = this._groupMap(type);
    return typeof group[id] !== 'undefined';
  },

  isCacheable(opt) {
    return !opt || (opt.depaginate && !opt.filter && !opt.include);
  },

  // Asynchronous, returns promise.
  // find(type[,null, opt]): Query API for all records of [type]
  // find(type,id[,opt]): Query API for record [id] of [type]
  // opt:
  //  filter: Filter by fields, e.g. {field: value, anotherField: anotherValue} (default: none)
  //  include: Include link information, e.g. ['link', 'anotherLink'] (default: none)
  //  forceReload: Ask the server even if the type+id is already in cache. (default: false)
  //  limit: Number of reqords to return per page (default: 1000)
  //  depaginate: If the response is paginated, retrieve all the pages. (default: true)
  //  headers: Headers to send in the request (default: none).  Also includes ones specified in the model constructor.
  //  url: Use this specific URL instead of looking up the URL for the type/id.  This should only be used for bootstraping schemas on startup.
  find(type, id, opt) {
    type = normalizeType(type);
    opt = opt || {};
    opt.depaginate = opt.depaginate !== false;

    if ( !id && !opt.limit )
    {
      opt.limit = this.defaultPageSize;
    }

    if ( !type )
    {
      return Ember.RSVP.reject(new ApiError('type not specified'));
    }

    // If this is a request for all of the items of [type], then we'll remember that and not ask again for a subsequent request
    var isCacheable = this.isCacheable(opt);
    opt.isForAll = !id && isCacheable;

    // See if we already have this resource, unless forceReload is on.
    if ( opt.forceReload !== true )
    {
      if ( opt.isForAll && this._state.foundAll[type] )
      {
        return Ember.RSVP.resolve(this.all(type),'Cached find all '+type);
      }
      else if ( isCacheable && id )
      {
        var existing = this.getById(type,id);
        if ( existing )
        {
          return Ember.RSVP.resolve(existing,'Cached find '+type+':'+id);
        }
      }
    }

    // If URL is explicitly given, go straight to making the request.  Do not pass go, do not collect $200.
    // This is used for bootstraping to load the schema initially, and shouldn't be used for much else.
    if ( opt.url )
    {
      return this._findWithUrl(opt.url, type, opt);
    }
    else
    {
      // Otherwise lookup the schema for the type and generate the URL based on it.
      return this.find('schema', type, {url: 'schemas/'+encodeURIComponent(type)}).then((schema) => {
        var url = schema.linkFor('collection') + (id ? '/'+encodeURIComponent(id) : '');
        return this._findWithUrl(url, type, opt);
      });
    }
  },

  // Returns a 'live' array of all records of [type] in the cache.
  all(type) {
    type = normalizeType(type);
    var group = this._group(type);
    return this._createArrayProxy(group);
  },

  haveAll(type) {
    type = normalizeType(type);
    return this._state.foundAll[type];
  },

  // find(type) && return all(type)
  findAll(type) {
    type = normalizeType(type);

    if ( this.haveAll(type) )
    {
      return Ember.RSVP.resolve(this.all(type),'All '+ type + ' already cached');
    }
    else
    {
      return this.find(type).then(() => {
        return this.all(type);
      });
    }
  },

  normalizeUrl(url, includingAbsolute=false) {
    var origin = window.location.origin;

    // Make absolute URLs to ourselves root-relative
    if ( includingAbsolute && url.indexOf(origin) === 0 )
    {
      url = url.substr(origin.length);
    }

    // Make relative URLs root-relative
    if ( !url.match(/^https?:/) && url.indexOf('/') !== 0 )
    {
      url = this.get('baseUrl').replace(/\/\+$/,'') + '/' + url;
    }

    return url;
  },

  // Makes an AJAX request and returns a promise that resolves to an object
  // This is separate from request() so it can be mocked for tests, or if you just want a basic AJAX request.
  rawRequest(opt) {
    opt.url = this.normalizeUrl(opt.url);
    opt.headers = this._headers(opt.headers);
    opt.processData = false;
    if ( typeof opt.dataType === 'undefined' )
    {
      opt.dataType = 'text'; // Don't let jQuery JSON parse
    }

    if ( opt.timeout !== null && !opt.timeout )
    {
      opt.timeout = this.defaultTimeout;
    }

    if ( opt.data )
    {
      if ( !opt.contentType )
      {
        opt.contentType = 'application/json';
      }

      if ( Serializable.detect(opt.data) )
      {
        opt.data = JSON.stringify(opt.data.serialize());
      }
      else if ( typeof opt.data === 'object' )
      {
        opt.data = JSON.stringify(opt.data);
      }
    }

    return fetch(opt.url, opt);
  },

  // Makes an AJAX request that resolves to a resource model
  request(opt) {
    var self = this;
    opt.url = this.normalizeUrl(opt.url);
    opt.depaginate = opt.depaginate !== false;

    if ( this.mungeRequest ) {
      opt = this.mungeRequest(opt);
    }

    return this.rawRequest(opt).then((xhr) => {
      return this._requestSuccess(xhr,opt);
    }).catch((xhr) => {
      return this._requestFailed(xhr,opt);
    });
  },

  // Forget about all the resources that hae been previously remembered.
  reset() {
    var cache = this._state.cache;
    if ( cache )
    {
      Object.keys(cache).forEach((key) => {
        if ( cache[key] && cache[key].clear ) {
          cache[key].clear();
        }
      });
    }
    else
    {
      this._state.cache = {};
    }

    var foundAll = this._state.foundAll;
    if ( foundAll )
    {
      Object.keys(foundAll).forEach((key) => {
        foundAll[key] = false;
      });
    }
    else
    {
      this._state.foundAll = {};
    }

    this._state.cacheMap = {};
    this._state.findQueue = {};
    this._state.classCache = [];
    this.incrementProperty('generation');
  },

  resetType(type) {
    type = normalizeType(type);
    var group = this._group(type);
    this._state.foundAll[type] = false;
    this._state.cacheMap[type] = {};
    group.clear();
  },

  // ---------
  // Below here be dragons
  // ---------
  _createArrayProxy(content) {
    let data = {
      [this.arrayProxyKey]: content
    };

    let opt = this.get('arrayProxyOptions')||{};
    Object.keys(opt).forEach((key) => {
      data[key] = opt[key];
    });

    return this.arrayProxyClass.create(data);
  },

  _headers(perRequest) {
    let out = {
      'accept': 'application/json',
      'content-type': 'application/json',
    };

    applyHeaders(this.get('headers'), out);
    applyHeaders(perRequest, out);
    return out;
  },

  _findWithUrl(url, type, opt) {
    var queue = this._state.findQueue;
    var cls = getOwner(this).lookup('model:'+type);
    url = urlOptions(url,opt,cls);

    // Collect Headers
    var newHeaders = {};
    if ( cls && cls.constructor.headers )
    {
      applyHeaders(cls.constructor.headers, newHeaders, true);
    }
    applyHeaders(opt.headers, newHeaders, true);
    // End: Collect headers

    var later;
    var queueKey = JSON.stringify(newHeaders) + url;

    // check to see if the request is in the findQueue
    if (queue[queueKey]) {
      // get the filterd promise object
      var filteredPromise = queue[queueKey];
      let defer = Ember.RSVP.defer();
      filteredPromise.push(defer);
      later = defer.promise;

    } else { // request is not in the findQueue

      opt.url = url;
      opt.headers = newHeaders;

      later = this.request(opt).then((result) => {
        if ( opt.isForAll ) {
          this._state.foundAll[type] = true;
        }

        this._finishFind(queueKey, result, 'resolve');
        return result;
      }, (reason) => {
        this._finishFind(queueKey, reason, 'reject');
        return Ember.RSVP.reject(reason);
      });

      // set the queue array to empty indicating we've had 1 promise already
      queue[queueKey] = [];
    }

    return later;

  },

  _finishFind(key, result, type) {
    var queue = this._state.findQueue;
    var promises = queue[key];

    if (promises) {
      while (promises.length) {
        if (type === 'resolve') {
          promises.pop().resolve(result);
        } else if (type === 'reject') {
          promises.pop().reject(result);
        }
      }
    }

    delete queue[key];
  },

  _requestSuccess(xhr,opt) {
    if ( xhr.status === 204 )
    {
      return;
    }

    if ( xhr.body && typeof xhr.body === 'object' )
    {
      Ember.beginPropertyChanges();
      let response = this._typeify(xhr.body);
      delete xhr.body;
      Object.defineProperty(response, 'xhr', {value: xhr});
      Ember.endPropertyChanges();

      // Note which keys were included in each object
      if ( opt.include && opt.include.length && response.forEach )
      {
        response.forEach((obj) => {
          obj.includedKeys = obj.includedKeys || [];
          obj.includedKeys.pushObjects(opt.include.slice());
          obj.includedKeys = obj.includedKeys.uniq();
        });
      }

      // Depaginate
      if ( opt.depaginate && typeof response.depaginate === 'function' )
      {
        return response.depaginate().then(function() {
          return response;
        }).catch((xhr) => {
          return this._requestFailed(xhr,opt);
        });
      }
      else
      {
        return response;
      }
    }
    else
    {
      return xhr.body;
    }
  },

  _requestFailed(xhr,opt) {
    var response, body;

    if ( xhr.err )
    {
      if ( xhr.err === 'timeout' )
      {
        body = {
          code: 'Timeout',
          status: xhr.status,
          message: `API request timeout (${opt.timeout/1000} sec)`,
          detail: (opt.method||'GET') + ' ' + opt.url,
        };
      }
      else
      {
        body = {status: xhr.status, message: xhr.err};
      }

      return finish(body);
    }
    else if ( xhr.body && typeof xhr.body === 'object' )
    {
      Ember.beginPropertyChanges();
      let out = finish(this._typeify(xhr.body));
      Ember.endPropertyChanges();
      return out;
    }
    else
    {
      body = {status: xhr.status, message: xhr.body};
      return finish(body);
    }

    function finish(body) {
      if ( !ApiError.detectInstance(body) )
      {
        body = ApiError.create(body);
      }

      delete xhr.body;
      Object.defineProperty(body, 'xhr', {value: xhr});
      return Ember.RSVP.reject(body);
    }
  },

  // Get the cache array group for [type]
  _group(type) {
    type = normalizeType(type);
    var cache = this._state.cache;
    var group = cache[type];
    if ( !group )
    {
      group = [];
      cache[type] = group;
    }

    return group;
  },

  // Get the cache map group for [type]
  _groupMap(type) {
    type = normalizeType(type);
    var cache = this._state.cacheMap
    var group = cache[type];
    if ( !group )
    {
      group = {};
      cache[type] = group;
    }

    return group;
  },

  // Add a record instance of [type] to cache
  _add(type, obj) {
    type = normalizeType(type);
    var group = this._group(type);
    var groupMap = this._groupMap(type);
    group.pushObject(obj);
    groupMap[obj.id] = obj;

    if ( obj.wasAdded && typeof obj.wasAdded === 'function' )
    {
      obj.wasAdded();
    }
  },

  // Add a lot of instances of the same type quickly.
  //   - There must be a model for the type already defined.
  //   - Instances cannot contain any nested other types (e.g. include or subtypes),
  //     (they will not be deserialzed into their correct type.)
  //   - wasAdded hooks are not called
  // Basically this is just for loading schemas faster.
  _bulkAdd(type, pojos) {
    type = normalizeType(type);
    var group = this._group(type);
    var groupMap = this._groupMap(type);
    var cls = getOwner(this).lookup('model:'+type);
    group.pushObjects(pojos.map((input)=>  {

      // actions is very unhappy property name for Ember...
      if ( this.replaceActions && typeof input.actions !== 'undefined')
      {
        input[this.replaceActions] = input.actions;
        delete input.actions;
      }

      // Schemas are special
      if ( type === 'schema' ) {
        input._id = input.id;
        input.id = normalizeType(input.id);
      }

      input.store = this;
      let obj =  cls.constructor.create(input);
      groupMap[obj.id] = obj;
      return obj;
    }));
  },

  // Remove a record of [type] from cache, given the id or the record instance.
  _remove(type, obj) {
    type = normalizeType(type);
    var group = this._group(type);
    var groupMap = this._groupMap(type);
    group.removeObject(obj);
    delete groupMap[obj.id];

    if ( obj.wasRemoved && typeof obj.wasRemoved === 'function' )
    {
      obj.wasRemoved();
    }
  },

  // Turn a POJO into a Model: {updateStore: true}
  _typeify(input, opt=null) {
    if ( !input || typeof input !== 'object')
    {
      // Simple values can just be returned
      return input;
    }

    if ( !opt ) {
      opt = {};
    }

    if ( Ember.isArray(input) )
    {
      // Recurse over arrays
      return input.map(x => this._typeify(x, opt));
    }
    else if ( !input.type )
    {
      // If it doesn't have a type then there's no sub-fields to typeify
      return input;
    }

    var type = normalizeType(input.type);
    if ( type === 'collection')
    {
      return this.createCollection(input, opt);
    }
    else if ( type )
    {
      var output = this.createRecord(input, opt);
      if ( !input.id || opt.updateStore === false ) {
        return output;
      }

      var cacheEntry = this.getById(type, output.id);
      if ( cacheEntry )
      {
        cacheEntry.replaceWith(output);
        return cacheEntry;
      }
      else
      {
        this._add(type, output);
        return output;
      }
    }
    else
    {
      return input;
    }
  },

  // Create a collection: {key: 'data'}
  createCollection(input, opt) {
    Ember.beginPropertyChanges();
    let key = (opt && opt.key ? opt.key : 'data');
    var cls = getOwner(this).lookup('model:collection');
    var boundTypeify = this._typeify.bind(this);
    var content = input[key].map(x => this._typeify(x, opt));
    var output = cls.constructor.create({ content: content });

    Object.defineProperty(output, 'store', { value: this });

    output.setProperties(Ember.getProperties(input, this.get('metaKeys')));
    Ember.endPropertyChanges();
    return output;
  },

  getClassFor(type) {
    let cls = this._state.classCache[type];
    if ( cls ) {
      return cls;
    }

    let owner = getOwner(this);
    if ( type ) {
      cls = owner.lookup('model:'+type);
    }

    if ( !cls ) {
      cls = owner.lookup('model:resource');
    }

    this._state.classCache[type] = cls;
    return cls;
  },

  // Create a record: {applyDefaults: false}
  createRecord(data, opt) {
    opt = opt || {};
    let type = normalizeType(opt.type||data.type||'');

    let cls;
    if ( type ) {
      cls = this.getClassFor(type);
    }

    let schema = this.getById('schema',type);
    let input = data;
    if ( opt.applyDefaults && schema ) {
      input = schema.getCreateDefaults(data);
    }

    // actions is very unhappy property name for Ember...
    if ( this.replaceActions && typeof input.actions !== 'undefined')
    {
      input[this.replaceActions] = input.actions;
      delete input.actions;
    }

    let drop = this.dropKeys;
    if ( drop )
    {
      for ( let i = drop.length-1 ; i >= 0 ; i-- ) {
        delete input[drop[i]];
      }
    }

    let cons = cls.constructor;
    if ( cons.mangleIn && typeof cons.mangleIn === 'function' )
    {
      input = cons.mangleIn(input,this);
    }

    if ( schema ) {
      let fields = schema.get('typeifyFields');
      for ( let i = fields.length-1 ; i >= 0 ; i-- ) {
        let k = fields[i];
        if ( input[k] ) {
          input[k] = this._typeify(input[k], opt);
        }
      }
    }

    var output = cons.create(input);

    Object.defineProperty(output, 'store', { value: this, configurable: true});
    return output;
  },
});

export default Store;
