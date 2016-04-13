import Ember from 'ember';
import Serializable from './mixins/serializable';
import ApiError from './models/error';
import { normalizeType } from './utils/normalize';
import { applyHeaders } from './utils/apply-headers';
import { ajaxPromise } from './utils/ajax-promise';

const { getOwner } = Ember;

export const defaultMetaKeys = ['actions','createDefaults','createTypes','filters','links','pagination','resourceType','sort','sortLinks','type'];
export const defaultSkipTypeifyKeys = [];

var Store = Ember.Object.extend({
  defaultTimeout: 30000,
  defaultPageSize: 1000,
  baseUrl: '/v1',
  metaKeys: null,
  skipTypeifyKeys: null,

  init: function() {
    this._super();

    if (!this.get('metaKeys') )
    {
      this.set('metaKeys', defaultMetaKeys.slice());
    }

    if (!this.get('skipTypeifyKeys') )
    {
      this.set('skipTypeifyKeys', defaultSkipTypeifyKeys.slice());
    }

    this.reset();

  },


  promiseQueue: null,

  // true: automatically remove from store after a record.delete() succeeds.  You might want to disable this if your API has a multi-step deleted vs purged state.
  removeAfterDelete: true,

  // Synchronously get record from local cache by [type] and [id].
  // Returns undefined if the record is not in cache, does not talk to API.
  getById: function(type, id) {
    type = normalizeType(type);
    var group = this._group(type);
    return group.filterBy('id',id)[0];
  },

  // Synchronously returns whether record for [type] and [id] is in the local cache.
  hasRecordFor: function(type, id) {
    return !!this.getById(type,id);
  },

  // Synchronously returns whether this exact record object is in the local cache
  hasRecord: function(obj) {
    var type = normalizeType(obj.get('type'));
    var group = this._group(type);
    return group.indexOf(obj) >= 0;
  },

  isCacheable: function(opt) {
    return !opt || (opt.depaginate && !opt.filter && !opt.include);
  },

  // Asynchronous, returns promise.
  // find(type[,null, opt]): Query API for all records of [type]
  // find(type,id[,opt]): Query API for record [id] of [type]
  // opt:
  //  filter: Filter by fields, e.g. {field: value, anotherField: anotherValue} (default: none)
  //  include: Include link information, e.g. ['link', 'anotherLink'] (default: none)
  //  forceReload: Ask the server even if the type+id is already in cache. (default: false)
  //  depaginate: If the response is paginated, retrieve all the pages. (default: true)
  //  headers: Headers to send in the request (default: none).  Also includes ones specified in the model constructor.
  //  url: Use this specific URL instead of looking up the URL for the type/id.  This should only be used for bootstraping schemas on startup.
  find: function(type, id, opt) {
    var self = this;
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
    var isForAll = !id && isCacheable;

    // See if we already have this resource, unless forceReload is on.
    if ( opt.forceReload !== true )
    {
      if ( isForAll && self.get('_foundAll').get(type) )
      {
        return Ember.RSVP.resolve(self.all(type),'Cached find all '+type);
      }
      else if ( isCacheable && id )
      {
        var existing = self.getById(type,id);
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
      return findWithUrl(opt.url);
    }
    else
    {
      // Otherwise lookup the schema for the type and generate the URL based on it.
      return self.find('schema', type, {url: 'schemas/'+encodeURIComponent(type)}).then(function(schema) {
        var url = schema.linkFor('collection') + (id ? '/'+encodeURIComponent(id) : '');
        return findWithUrl(url);
      });
    }

    function findWithUrl(url) {
      var promises = self.get('promiseQueue');
      // Filter
      // @TODO friendly support for modifiers
      if ( opt.filter )
      {
        var keys = Object.keys(opt.filter);
        keys.forEach(function(key) {
          var vals = opt.filter[key];
          if ( !Ember.isArray(vals) )
          {
            vals = [vals];
          }

          vals.forEach(function(val) {
            url += (url.indexOf('?') >= 0 ? '&' : '?') + encodeURIComponent(key) + '=' + encodeURIComponent(val);
          });
        });
      }
      // End: Filter

      // Include
      if ( opt.include )
      {
        if ( !Ember.isArray(opt.include) )
        {
          opt.include = [opt.include];
        }
      }
      else
      {
        opt.include = [];
      }

      if ( opt.limit )
      {
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'limit=' + opt.limit;
      }

      var cls = getOwner(self).lookup('model:'+type);
      if ( cls && cls.constructor.alwaysInclude )
      {
        opt.include.addObjects(cls.constructor.alwaysInclude);
      }

      opt.include.forEach(function(key) {
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'include=' + encodeURIComponent(key);
      });
      // End: Include

      // Sort
      var sortBy = opt.sortBy;
      if ( !sortBy && cls)
      {
        sortBy = cls.constructor.defaultSortBy;
      }

      if ( sortBy )
      {
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'sort=' + encodeURIComponent(sortBy);
      }

      if ( opt.sortOrder && opt.sortOrder )
      {
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'order=' + encodeURIComponent(opt.sortOrder);
      }
      // End: Sort

      // Headers
      var newHeaders = {};
      if ( cls && cls.constructor.headers )
      {
        applyHeaders(cls.constructor.headers, newHeaders, true);
      }
      applyHeaders(opt.headers, newHeaders, true);

      var later;
      var promiseKey = JSON.stringify(newHeaders) + url;

      // check to see if the request is in the promiseQueue (promises)
      if (promises[promiseKey]) {
        // get the filterd promise object
        var filteredPromise = promises[promiseKey];

        later = Ember.RSVP.defer();

        filteredPromise.push(later);

        later = later.promise;

      } else { // request is not in the promiseQueue

        opt.url = url;
        opt.headers = newHeaders;

        later = self.request(opt).then((result) => {
          if ( isForAll )
          {
            self.get('_foundAll').set(type,true);
          }

          resolvePromisesInQueue(promiseKey, result, 'resolve');
          return result;
        }, (reason) => {
          resolvePromisesInQueue(promiseKey, reason, 'reject');
          return Ember.RSVP.reject(reason);
        });

        // set the promises array to empty indicating we've had 1 promise already
        promises[promiseKey] = [];
      }

      return later;
    }

    function resolvePromisesInQueue(key, result, type) {
      var localPromises = self.get('promiseQueue')[key];

      if (localPromises && localPromises.length >= 1) {

        while (localPromises.length >= 1) {
          var itemToResolve = localPromises.pop();

          if (type === 'resolve') {
            itemToResolve.resolve(result);
          } else if (type === 'reject') {
            itemToResolve.reject(result);
          }

        }
      }

      // this resolution is done, does it have any queued promies? no so delete it
      delete self.get('promiseQueue')[key];
    }
  },

  // Returns a 'live' array of all records of [type] in the cache.
  all: function(type) {
    type = normalizeType(type);
    var group = this._group(type);
    var proxy = Ember.ArrayProxy.create({
      content: group
    });

    return proxy;
  },

  haveAll: function(type) {
    type = normalizeType(type);
    return this.get('_foundAll').get(type);
  },

  // find(type) && return all(type)
  findAll: function(type) {
    type = normalizeType(type);
    var self = this;

    if ( self.haveAll(type) )
    {
      return Ember.RSVP.resolve(self.all(type),'All '+ type + ' already cached');
    }
    else
    {
      return this.find(type).then(function() {
        return self.all(type);
      });
    }
  },

  // Create a collection
  createCollection: function(input, key='data') {
    var cls = getOwner(this).lookup('model:collection');
    var output = cls.constructor.create({
      content: input[key],
      store: this,
    });

    output.setProperties(Ember.getProperties(input, this.get('metaKeys')));
    return output;
  },

  // Create a record, but do not insert into the cache
  createRecord: function(data, type) {
    type = normalizeType(type||data.type||'');
    var cls, schema;

    if ( type )
    {
      cls = getOwner(this).lookup('model:'+type);
      schema = this.getById('schema',type);
    }

    if ( !cls )
    {
      cls = getOwner(this).lookup('model:resource');
    }

    var cons = cls.constructor;

    var input;
    if ( schema )
    {
      input = schema.getCreateDefaults(data);
    }
    else
    {
      input = data;
    }

    // actions is very unhappy property name for Ember...
    if ( input.actions )
    {
      input.actionLinks = input.actions;
      delete input.actions;
    }

    if ( cons.mangleIn && typeof cons.mangleIn === 'function' )
    {
      input = cons.mangleIn(input,this);
    }

    input.store = this;

    var output = cons.create(input);
    return output;
  },

  headers: null,
  _headers: function(perRequest) {
    var out = {
      'accept': 'application/json',
    };

    var csrf = Ember.$.cookie('CSRF');
    if ( csrf )
    {
      out['x-api-csrf'] = csrf;
    }

    applyHeaders(this.get('headers'), out);
    applyHeaders(perRequest, out);

    return out;
  },

  normalizeUrl: function(url, includingAbsolute=false) {
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

  // Makes an AJAX request and returns a promise that resolves to an object with xhr, textStatus, and [err]
  // This is separate from request() so it can be mocked for tests, or if you just want a basic AJAX request.
  rawRequest: function(opt) {
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

    var promise = ajaxPromise(opt);
    return promise;
  },

  // Makes an AJAX request that resolves to a resource model
  request: function(opt) {
    var self = this;
    opt.url = this.normalizeUrl(opt.url);
    opt.depaginate = opt.depaginate !== false;
    var boundTypeify = this._typeify.bind(this);

    if ( this.mungeRequest ) {
      opt = this.mungeRequest(opt);
    }

    var promise = new Ember.RSVP.Promise(function(resolve,reject) {
      self.rawRequest(opt).then(success,fail);

      function success(obj) {
        var xhr = obj.xhr;

        if ( xhr.status === 204 )
        {
          resolve();
        }
        else if ( (xhr.getResponseHeader('content-type')||'').toLowerCase().indexOf('/json') !== -1 )
        {
          var response = JSON.parse(xhr.responseText, boundTypeify);

          if ( opt.include && opt.include.length && response.forEach )
          {
            // Note which keys were included
            response.forEach((obj) => {
              obj.includedKeys = obj.includedKeys || [];
              obj.includedKeys.pushObjects(opt.include.slice());
              obj.includedKeys = obj.includedKeys.uniq();
            });
          }

          Object.defineProperty(response, 'xhr', { value: obj.xhr, configurable: true, writable: true});
          Object.defineProperty(response, 'textStatus', { value: obj.textStatus, configurable: true, writable: true});

          if ( opt.depaginate && typeof response.depaginate === 'function' )
          {
            response.depaginate().then(function() {
              resolve(response);
            }).catch(fail);
          }
          else
          {
            resolve(response);
          }
        }
        else
        {
          resolve(xhr.responseText);
        }
      }

      function fail(obj) {
        reject(self._requestFailed(obj,opt));
      }

    },'Request: '+ opt.url);

    return promise;
  },

  _requestFailed: function(obj,opt) {
    var response, body;
    var xhr = obj.xhr;
    var err = obj.err;
    var textStatus = obj.textStatus;

    if ( (xhr.getResponseHeader('content-type')||'').toLowerCase().indexOf('/json') !== -1 )
    {
      body = JSON.parse(xhr.responseText, this._typeify.bind(this));
    }
    else if ( err )
    {
      if ( err === 'timeout' )
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
        body = {status: xhr.status, message: err};
      }
    }
    else
    {
      body = {status: xhr.status, message: xhr.responseText};
    }

    if ( ApiError.detectInstance(body) )
    {
      response = body;
    }
    else
    {
      response = ApiError.create(body);
    }

    Object.defineProperty(response, 'xhr', { value: xhr, configurable: true, writable: true});
    Object.defineProperty(response, 'textStatus', { value: textStatus, configurable: true, writable: true});

    return response;
  },

  // You can observe this to make sure you know when the store is reset
  generation: 1,

  // Forget about all the resources that hae been previously remembered.
  reset: function() {
    var cache = this.get('_cache');
    if ( cache )
    {
      Object.keys(cache).forEach((key) => {
        cache[key].clear();
      });
    }
    else
    {
      this.set('_cache', Ember.Object.create());
    }

    var foundAll = this.get('_foundAll');
    if ( foundAll )
    {
      Object.keys(foundAll).forEach((key) => {
        foundAll[key] = false;
      });
    }
    else
    {
      this.set('_foundAll', Ember.Object.create());
    }

    this.set('promiseQueue', {});
    this.incrementProperty('generation');
  },

  resetType: function(type) {
    type = normalizeType(type);
    var group = this._group(type);
    this.get('_foundAll').set(type,false);
    group.clear();
  },

  // ---------

  _cache: null,
  _foundAll: null,

  // Get the cache group for [type]
  _group: function(type) {
    type = normalizeType(type);
    var cache = this.get('_cache');
    var group = cache.get(type);
    if ( !group )
    {
      group = [];
      cache.set(type,group);
    }

    return group;
  },

  // Add a record instance of [type] to cache
  _add: function(type, obj) {
    type = normalizeType(type);
    var group = this._group(type);
    group.pushObject(obj);
    if ( obj.wasAdded && typeof obj.wasAdded === 'function' )
    {
      obj.wasAdded();
    }
  },

  // Add a lot of instances of the same type quickly.
  //   - There must be a model for the type already defined.
  //   - Instances cannot contain any nested other types (e.g. include or subtypes),
  //     they will not be deserialzed into their correct type.
  // Basically this is just for loading schemas faster.
  _bulkAdd: function(type, pojos) {
    var self = this;
    type = normalizeType(type);
    var group = this._group(type);
    var cls = getOwner(this).lookup('model:'+type);
    group.pushObjects(pojos.map(function(input) {
      // actions is very unhappy property name for Ember...
      if ( input.actions )
      {
        input.actionLinks = input.actions;
        delete input.actions;
      }
      input.store = self;
      return cls.constructor.create(input);
    }));
  },

  // Remove a record of [type] form cache, given the id or the record instance.
  _remove: function(type, obj) {
    type = normalizeType(type);
    var group = this._group(type);
    group.removeObject(obj);
    if ( obj.wasRemoved && typeof obj.wasRemoved === 'function' )
    {
      obj.wasRemoved();
    }
  },

  // JSON.parse() will call this for every key and value when parsing a JSON document.
  // It does a recursive descent so the deepest keys are processed first.
  // The value in the output for the key will be the value returned.
  // If no value is returned, the key will not be included in the output.
  _typeify: function(key, input) {
    if (  this.get('skipTypeifyKeys').indexOf(key) >= 0 ||
          typeof input !== 'object' ||
          Ember.isArray(input) ||
          !input ||
          !input.type || typeof input.type !== 'string'
       )
    {
      // Basic values can be returned unmodified
      return input;
    }

    var output = this._createObject(input);

    // Actual resorces should be added or updated in the store
    var type = normalizeType(input.type);
    if (output.id)
    {
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
      return output;
    }
  },

  _createObject: function(input) {
    // Basic values can be returned unmodified
    if ( !input || typeof input !== 'object' || Ember.isArray(input) )
    {
      return input;
    }

    var type = input.type;
    if ( !type || typeof type !== 'string' )
    {
      return Ember.Object.create(input);
    }

    type = normalizeType(type);
    if ( type === 'collection' )
    {
      return this.createCollection(input);
    }
    else
    {
      return this.createRecord(input);
    }
  }
});

export default Store;
