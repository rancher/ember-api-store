import Ember from 'ember';
import Serializable from './serializable';
import { normalizeType } from '../utils/normalize';
import { copyHeaders } from '../utils/apply-headers';

var Type = Ember.Mixin.create(Serializable,{
  id: null,
  type: null,
  links: null,

  toString: function() {
    return '(generic type mixin)';
  },

  // unionArrays=true will append the new values to the existing ones instead of overwriting.
  merge: function(newData, unionArrays) {
    var self = this;
    newData.eachKeys(function(v, k) {
      if ( newData.hasOwnProperty(k) )
      {
        var curVal = self.get(k);
        if ( unionArrays && Ember.isArray(curVal) && Ember.isArray(v) )
        {
          curVal.addObjects(v);
        }
        else
        {
          self.set(k, v);
        }
      }
    });

    return self;
  },

  replaceWith: function(newData) {
    var self = this;
    // Add/replace values that are in newData
    newData.eachKeys(function(v, k) {
      self.set(k, v);
    });

    // Remove values that are in current but not new.
    var newKeys = newData.allKeys();
    this.eachKeys(function(v, k) {
      // If the key is a valid link name and
      if ( newKeys.indexOf(k) === -1 && !this.hasLink(k) )
      {
        self.set(k, undefined);
      }
    });

    return self;
  },

  clone: function() {
    var store = this.get('store');
    var output = JSON.parse(JSON.stringify(this.serialize()), function(key, input) {
      return store._createObject(input);
    });
    //var output = this.constructor.create(this.serialize());
    //output.set('store', this.get('store'));
    return output;
  },

  linkFor: function(name) {
    var url = this.get('links.'+name);
    return url;
  },

  pageFor: function(name) {
    return this.get(`pagination.${name}`);
  },

  hasLink: function(name) {
    return !!this.linkFor(name);
  },

  headers: null,
  request: function(opt) {
    if ( !opt.headers )
    {
      opt.headers = {};
    }

    copyHeaders(this.constructor.headers, opt.headers);
    copyHeaders(this.get('headers'), opt.headers);

    return this.get('store').request(opt);
  },

  followPagination: function(name) {
    var url = this.pageFor(name);

    if (!url)
    {
      throw new Error('Unknown link');
    }

    return this.request({
      method: 'GET',
      url: url,
      depaginate: false,
    });
  },

  followLink: function(name, opt) {
    var url = this.linkFor(name);
    opt = opt || {};

    if (!url)
    {
      throw new Error('Unknown link');
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

    if ( opt.sort )
    {
      if ( !Ember.isArray(opt.sort) )
      {
        opt.sort = [opt.sort];
      }

      opt.sort.forEach(function(key) {
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'sort=' + encodeURIComponent(key);
      });
    }

    return this.request({
      method: 'GET',
      url: url
    });
  },

  importLink: function(name, opt) {
    var self = this;
    opt = opt || {};

    return new Ember.RSVP.Promise(function(resolve,reject) {
      self.followLink(name, opt).then(function(data) {
        self.set(opt.as||name,data);
        resolve(self);
      }).catch(function(err) {
        reject(err);
      });
    },'Import Link: '+name);
  },

  hasAction: function(name) {
    var url = this.get('actionLinks.'+name);
    return !!url;
  },

  computedHasAction: function(name) {
    return Ember.computed('actionLinks.'+name, function() {
      return this.hasAction(name);
    });
  },

  doAction: function(name, data, opt) {
    var url = this.get('actionLinks.'+name);
    if (!url)
    {
      return Ember.RSVP.reject(new Error('Unknown action: ' + name));
    }

    opt = opt || {};
    opt.method = 'POST';
    opt.url = url;
    if ( data )
    {
      opt.data = data;
    }

    // Note: The response object may or may not be this same object, depending on what the action returns.
    return this.request(opt);
  },

  save: function() {
    var self = this;
    var store = this.get('store');


    var method, url;
    var id = this.get('id');
    var type = normalizeType(this.get('type'));
    if ( id )
    {
      // Update
      method = 'PUT';
      url = this.linkFor('self');
    }
    else
    {
      // Create
      if ( !type )
      {
        return Ember.RSVP.reject(new Error('Cannot create record without a type'));
      }

      method = 'POST';
      url = type;
    }

    var json = this.serialize();
    delete json['links'];
    delete json['actions'];
    delete json['actionLinks'];

    return this.request({
      method: method,
      url: url,
      data: json,
    }).then(function(newData) {
      if ( !newData || !Type.detect(newData) )
      {
        return newData;
      }

      var newId = newData.get('id');
      var newType = normalizeType(newData.get('type'));
      if ( !id && newId && type === newType )
      {
        Ember.beginPropertyChanges();

        // A new record was created.  Typeify will have put it into the store,
        // but it's not the same instance as this object.  So we need to fix that.
        self.merge(newData);
        var existing = store.getById(type,newId);
        if ( existing )
        {
          store._remove(type, existing);
        }
        store._add(type, self);
        Ember.endPropertyChanges();
      }

      return self;
    });
  },

  delete: function() {
    var self = this;
    var store = this.get('store');
    var type = this.get('type');

    return this.request({
      method: 'DELETE',
      url: this.linkFor('self')
    }).then(function(newData) {
      if ( store.get('removeAfterDelete') )
      {
        store._remove(type, self);
      }
      return newData;
    });
  },

  reload: function() {
    if ( !this.hasLink('self') )
    {
      return Ember.RSVP.reject('Resource has no self link');
    }

    var url = this.linkFor('self');
    if ( this.constructor && this.constructor.alwaysInclude )
    {
      this.constructor.alwaysInclude.forEach(function(key) {
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'include=' + encodeURIComponent(key);
      });
    }

    var self = this;
    return this.request({
      method: 'GET',
      url: url,
    }).then(function(/*newData*/) {
      return self;
    });
  },

  isInStore: function() {
    var store = this.get('store');
    return store && this.get('id') && this.get('type') && store.hasRecord(this);
  }
});

export default Type;
