import Ember from 'ember';
import Serializable from './serializable';
import { normalizeType } from '../utils/normalize';
import { copyHeaders } from '../utils/apply-headers';
import { urlOptions } from '../utils/url-options';

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
    let store = this.get('store');
    let output = store.createRecord(JSON.parse(JSON.stringify(this.serialize())), {updateStore: false});
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

    url = urlOptions(url, opt);

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
    opt.url = opt.url || url;
    if ( data )
    {
      opt.data = data;
    }

    // Note: The response object may or may not be this same object, depending on what the action returns.
    return this.request(opt);
  },

  save: function(opt) {
    var self = this;
    var store = this.get('store');
    opt = opt || {};

    var id = this.get('id');
    var type = normalizeType(this.get('type'));
    if ( id )
    {
      // Update
      opt.method = opt.method || 'PUT';
      opt.url = opt.url || this.linkFor('self');
    }
    else
    {
      // Create
      if ( !type )
      {
        return Ember.RSVP.reject(new Error('Cannot create record without a type'));
      }

      opt.method = opt.method || 'POST';
      opt.url = opt.url || type;
    }

    if ( opt.qp ) {
      for (var k in opt.qp ) {
        opt.url += (opt.url.indexOf('?') >= 0 ? '&' : '?') + encodeURIComponent(k) + '=' + encodeURIComponent(opt.qp[k]);
      }
    }

    var json = this.serialize();

    delete json['links'];
    delete json['actions'];
    delete json['actionLinks'];

    if ( typeof opt.data === 'undefined' )
    {
      opt.data = json;
    }

    return this.request(opt).then(function(newData) {
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

        // And also for the base type
        var baseType = self.get('baseType');
        if ( baseType )
        {
          baseType = normalizeType(baseType);
          if ( baseType !== type )
          {
            existing = store.getById(baseType,newId);
            if ( existing )
            {
              store._remove(baseType, existing);
            }
            store._add(baseType, self);
          }
        }

        Ember.endPropertyChanges();
      }

      return self;
    });
  },

  delete: function(opt) {
    var self = this;
    var store = this.get('store');
    var type = this.get('type');

    opt = opt || {};
    opt.method = 'DELETE';
    opt.url = opt.url || this.linkFor('self');

    return this.request(opt).then(function(newData) {
      if ( store.get('removeAfterDelete') || opt.forceRemove || opt.responseStatus === 204 ) {
        store._remove(type, self);
      }
      return newData;
    });
  },

  reload: function(opt) {
    if ( !this.hasLink('self') )
    {
      return Ember.RSVP.reject('Resource has no self link');
    }

    var url = this.linkFor('self');

    opt = opt || {};
    if ( typeof opt.method === 'undefined' )
    {
      opt.method = 'GET';
    }

    if ( typeof opt.url === 'undefined' )
    {
      opt.url = url;
    }

    var self = this;
    return this.request(opt).then(function(/*newData*/) {
      return self;
    });
  },

  isInStore: function() {
    var store = this.get('store');
    return store && this.get('id') && this.get('type') && store.hasRecord(this);
  }
});

export default Type;
