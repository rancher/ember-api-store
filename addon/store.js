import Ember from 'ember';
import Serializable from './mixins/serializable';
import ApiError from './models/error';

var Store = Ember.Object.extend({
  baseUrl: '/v1',
  metaKeys: ['actions','createDefaults','createTypes','filters','links','pagination','sort','sortLinks'],

  // true: automatically remove from store after a record.delete() succeeds.  You might want to disable this if your API has a multi-step deleted vs purged state.
  removeAfterDelete: true,

  normalizeType: function(type) {
    return type.toLowerCase();
  },

  // Synchronously get record from local cache by [type] and [id].
  // Returns undefined if the record is not in cache, does not talk to API. 
  getById: function(type, id) {
    type = this.normalizeType(type);
    var group = this._group(type);
    return group.filterProperty('id',id)[0];
  },

  // Synchronously returns whether record for [type] and [id] is in the local cache.
  hasRecordFor: function(type, id) {
    return !!this.getById(type,id);
  },

  // Asynchronous, returns promise.
  // find(type[,opt]): Query API for all records of [type]
  // find(type,id[,opt]): Query API for record [id] of [type]
  // opt:
  //  filter: Filter by fields, e.g. {field: value, anotherField: anotherValue} (default: none)
  //  include: Include link information, e.g. ['link', 'anotherLink'] (default: none)
  //  forceReload: Ask the server even if the type+id is already in cache. (default: false)
  //  depaginate: If the response is paginated, retrieve all the pages. (default: true)
  //  url: Use this specific URL instead of looking up the URL for the type/id.  This should only be used for bootstraping schemas on startup.
  find: function(type, id, opt) {
    var self = this;
    type = this.normalizeType(type);
    opt = opt || {};
    opt.depaginate = opt.depaginate !== false;

    if ( !type )
    {
      return Ember.RSVP.reject(new ApiError('type not specified'));
    }

    // If this is a request for all of the items of [type], then we'll remember that and not ask again for a subsequent request
    var isForAll = !id && opt.depaginate && !opt.filter && !opt.include;

    // See if we already have this resource, unless forceReload is on.
    if ( opt.forceReload !== true )
    {
      if ( isForAll && self.get('_foundAll').get(type) )
      {
        return Ember.RSVP.resolve(self.all(type),'Cached find all '+type);
      }
      else if ( !isForAll && id )
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

      var cls = self.get('container').lookup('model:'+type);
      if ( cls && cls.constructor.alwaysInclude )
      {
        opt.include.addObjects(cls.constructor.alwaysInclude);
      }

      opt.include.forEach(function(key) {
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'include=' + encodeURIComponent(key);
      });
      // End: Include

      return self.request({
        url: url,
        depaginate: opt.depaginate
      }).then(function(result) {
        if ( isForAll )
        {
          self.get('_foundAll').set(type,true);
        }
        return result;
      });
    }
  },

  // Returns a 'live' array of all records of [type] in the cache.
  all: function(type) {
    type = this.normalizeType(type);
    var group = this._group(type);
    var proxy = Ember.ArrayProxy.create({
      content: group
    });

    return proxy;
  },

  haveAll: function(type) {
    type = this.normalizeType(type);
    return this.get('_foundAll').get(type);
  },

  // find(type) && return all(type)
  findAll: function(type) {
    type = this.normalizeType(type);
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
  createCollection: function(input) {
    var cls = this.get('container').lookup('model:collection');
    var output = cls.constructor.create({
      content: input.data,
      store: this,
    });

    output.setProperties(Ember.getProperties(input, this.get('metaKeys')));
    return output;
  },

  // Create a record, but do not insert into the cache
  createRecord: function(data) {
    var kind = this.normalizeType(data.kind||'');
    var type = this.normalizeType(data.type||'');
    var container = this.get('container');
    var cls, schema;

    if ( kind )
    {
      cls = container.lookup('model:'+kind);
      schema = this.getById('schema',kind);
    }

    if ( !cls && type )
    {
      cls = container.lookup('model:'+type);
      schema = this.getById('schema',type);
    }

    if ( !cls )
    {
      cls = container.lookup('model:resource');
    }


    var input;
    if ( schema )
    {
      input = schema.getCreateDefaults(data);
    }
    else
    {
      input = data;
    }

    if ( typeof cls.constructor.mangleIn === 'function' )
    {
      input = cls.constructor.mangleIn(input);
    }

    var output = cls.constructor.create(input);
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

    var more = this.get('headers');
    if ( more )
    {
      Object.keys(more).forEach(function(key) {
        var val = Ember.get(more,key);
        if ( val === undefined )
        {
          delete out[key.toLowerCase()];
        }
        else
        {
          out[key.toLowerCase()] = val;
        }
      });
    }

    if ( perRequest )
    {
      Object.keys(perRequest).forEach(function(key) {
        var val = Ember.get(perRequest,key);
        if ( val === undefined )
        {
          delete out[key.toLowerCase()];
        }
        else
        {
          out[key.toLowerCase()] = val;
        }
      });
    }

    return out;
  },

  // Makes an AJAX request and returns a promise that resolves to an object with xhr, textStatus, and [err]
  // This is separate from request() so it can be mocked for tests, or if you just want a basic AJAX request.
  rawRequest: function(opt) {
    var url = opt.url;
    if ( url.indexOf('http') !== 0 && url.indexOf('/') !== 0 )
    {
      url = this.get('baseUrl').replace(/\/\+$/,'') + '/' + url;
    }

    opt.url = url;
    opt.headers = this._headers(opt.headers);
    opt.processData = false;
    opt.dataType = 'text'; // Don't let jQuery JSON parse

    if ( opt.data )
    {
      opt.contentType = 'application/json';

      if ( Serializable.detect(opt.data) )
      {
        opt.data = JSON.stringify(opt.data.serialize());
      }
      else
      {
        opt.data = JSON.stringify(opt.data);
      }
    }

    var promise = new Ember.RSVP.Promise(function(resolve,reject) {
      Ember.$.ajax(opt).then(success,fail);

      function success(body, textStatus, xhr) {
        if ( (xhr.getResponseHeader('content-type')||'').toLowerCase().indexOf('/json') !== -1 )
        {
          resolve({xhr: xhr, textStatus: textStatus},'AJAX Reponse: '+url + '(' + xhr.status + ')');
        }
      }

      function fail(xhr, textStatus, err) {
        reject({xhr: xhr, textStatus: textStatus, err: err}, 'AJAX Error:' + url + '(' + xhr.status + ')');
      }
    },'Raw AJAX Request: '+url);

    return promise;
  },

  // Makes an AJAX request that resolves to a resource model
  request: function(opt) {
    //debugger;
    var self = this;
    opt.depaginate = opt.depaginate !== false;
    var boundTypeify = this._typeify.bind(this);

    var promise = new Ember.RSVP.Promise(function(resolve,reject) {
      self.rawRequest(opt).then(success,fail);

      function success(obj) {
        var xhr = obj.xhr;

        if ( (xhr.getResponseHeader('content-type')||'').toLowerCase().indexOf('/json') !== -1 )
        {
          var response = JSON.parse(xhr.responseText, boundTypeify);
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
        var response, body;
        var xhr = obj.xhr;
        var err = obj.err;
        var textStatus = obj.textStatus;

        if ( err )
        {
          body = {status: xhr.status, message: err};
        }
        else if ( (xhr.getResponseHeader('content-type')||'').toLowerCase().indexOf('/json') !== -1 )
        {
          body = JSON.parse(xhr.responseText, boundTypeify);
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

        Object.defineProperty(response, 'xhr', { value: xhr });
        Object.defineProperty(response, 'textStatus', { value: textStatus });

        reject(response);
      }
    },'Request: '+ opt.url);

    return promise;
  },

  // Forget about all the resources that hae been previously remembered.
  reset: function() {
    this.set('_cache', Ember.Object.create());
    this.set('_foundAll', Ember.Object.create());
  },

  // ---------

  _cache: null,
  _foundAll: null,

  init: function() {
    this.reset();
  },

  // Get the cache group for [type]
  _group: function(type) {
    type = this.normalizeType(type);
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
    type = this.normalizeType(type);
    var group = this._group(type);
    group.pushObject(obj);
  },

  // Remove a record of [type] form cache, given the id or the record instance.
  _remove: function(type, obj) {
    type = this.normalizeType(type);
    var group = this._group(type);
    group.removeObject(obj);
  },

  // JSON.parse() will call this for every key and value when parsing a JSON document.
  // It does a recursive descent so the deepest keys are processed first.
  // The value in the output for the key will be the value returned.
  // If no value is returned, the key will not be included in the output.
  _typeify: function(key, input) {

    // Basic values can be returned unmodified
    if ( !input || typeof input !== 'object' || Ember.isArray(input) || !input.links )
    {
      return input;
    }

    var type = input.type;
    if ( !type || typeof type !== 'string' )
    {
      return Ember.Object.create(input);
    }

    var self = this;
    var output;
    type = this.normalizeType(type);

    if ( type === 'collection' )
    {
      output = self.createCollection(input);
      return output;
    }

    output = self.createRecord(input);

    if (input.id)
    {
      var cacheEntry = self.getById(type, input.id);
      if ( cacheEntry )
      {
        cacheEntry.replaceWith(output);
        return cacheEntry;
      }
      else
      {
        self._add(type, output);
        return output;
      }
    }
    else
    {
      return output;
    }
  }
});

export default Store;
