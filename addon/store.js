import Ember from 'ember';
import Serializable from 'ember-api-store/mixins/serializable';
import ApiError from 'ember-api-store/models/error';

var Store = Ember.Object.extend({
  baseUrl: '/v1',
  metaKeys: ['actions','createDefaults','createTypes','filters','links','pagination','sort','sortLinks'],

  // Synchronously get record from local cache by [type] and [id].
  // Returns undefined if the record is not in cache, does not talk to API. 
  getById: function(type, id) {
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
  find: function(type, id, opt) {
    opt = opt || {};
    var url = type + (id ? '/'+encodeURIComponent(id) : '');

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

    if ( opt.include )
    {
      if ( !Ember.isArray(opt.include) )
      {
        opt.include = [opt.include];
      }

      opt.include.forEach(function(key) {
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'include=' + encodeURIComponent(key);
      });
    }

    return this.request({
      url: url
    });
  },

  // Returns a 'live' array of all records of [type] in the cache.
  all: function(type) {
    var group = this._group(type);
    var proxy = Ember.ArrayProxy.create({
      content: group
    });

    return proxy;
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
    var kind = (data.kind||'').dasherize();
    var type = (data.type||'').dasherize();
    var container = this.get('container');
    var cls;

    if ( kind )
    {
      cls = container.lookup('model:'+kind);
    }

    if ( !cls && type )
    {
      cls = container.lookup('model:'+type);
    }

    if ( !cls )
    {
      cls = container.lookup('model:resource');
    }

    var output = cls.constructor.create(data);
    output.set('store', this);

    // If the new record has an ID and self link, add it to the store.
    // Otherwise, don't and save() will add it later if it's ever persisted.
    if ( output.get('id') && output.hasLink('self') )
    {
      this._add(type, output);
    }

    return output;
  },

  removeRecord: function(type, id) {
    var self = this;
    var obj = this.getById(type, id);

    if ( !obj )
    {
      return Ember.RSVP.reject(new ApiError('Record not found'));
    }

    return obj.delete().then(function() {
      self._remove(type, id);
      return obj;
    });
  },

  // Makes an AJAX request and returns a promise that resolves to an object with xhr, textStatus, and [err]
  // This is separate from request() so it can be mocked for tests.
  rawRequest: function(opt) {
    var url = opt.url;
    if ( url.indexOf('http') !== 0 && url.indexOf('/') !== 0 )
    {
      url = this.get('baseUrl').replace(/\/\+$/,'') + '/' + url;
    }

    opt.url = url;
    opt.headers = opt.headers || {};
    opt.headers['Accept'] = 'application/json';
    opt.processData = false;
    opt.dataType = 'text'; // Don't let jQuery JSON parse

    var csrf = Ember.$.cookie('CSRF');
    if ( csrf )
    {
      opt.headers['X-API-CSRF'] = csrf;
    }

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
          resolve({xhr: xhr, textStatus: textStatus});
        }
      }

      function fail(xhr, textStatus, err) {
        reject({xhr: xhr, textStatus: textStatus, err: err});
      }
    });

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

        if ( xhr.status === 401 )
        {
          self.get('container').lookup('controller:application').send('timedOut');
        }
      }
    });

    return promise;
  },

  // ---------

  _cache: null,

  init: function() {
    this.set('_cache', Ember.Object.create());
  },

  // Get the cache group for [type]
  _group: function(type) {
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
    var group = this._group(type);
    group.pushObject(obj);
  },

  // Remove a record of [type] form cache, given the id or the record instance.
  _remove: function(type, obj) {
    var group = this._group(type);
    group.removeObject(obj);
  },

  // JSON.parse() will call this for every key and value when parsing a JSON document.
  // It does a recursive descent so the deepest keys are processed first.
  // The value in the output for the key will be the value returned.
  // If no value is returned, the key will not be included in the output.
  _typeify: function(key, input) {
    // Basic values can be returned unmodified
    if ( !input || typeof input !== 'object' || Ember.isArray(input) )
    {
      return input;
    }

    var type = input.type;
    if ( !type )
    {
      return Ember.Object.create(input);
    }

    var self = this;
    var output;

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
