import Ember from 'ember';

// Properties to ignore because they're built-in to ember, ember-debug, or the store
var reserved = ['__nextSuper','constructor','container','store','isInstance','isDestroyed','isDestroying','concatenatedProperties','_debugContainerKey'];

var Serializable = Ember.Mixin.create({
  serialize: function() {
    var output;
    if ( Ember.isArray(this) )
    {
      output = this.map(recurse);
    }
    else
    {
      output = {};
      this.eachSerializableKeys(function(v,k) {
        output[k] = recurse(v);
      });
    }

    return output;

    function recurse(obj) {
      if ( Ember.isArray(obj) )
      {
        return obj.map(recurse);
      }
      else if ( Serializable.detect(obj) )
      {
        return obj.serialize();
      }
      else
      {
        return obj;
      }
    }
  },

  allKeys: function() {
    var out = [];
    for ( var k in Ember.$.extend(true, {}, this) )
    {
      if ( reserved.indexOf(k) === -1 && Ember.typeOf(this[k]) !== 'function' )
      {
        out.push(k);
      }
    }
    return out;
  },

  eachKeys: function(fn) {
    var self = this;
    this.allKeys().forEach(function(k) {
      fn.call(self, self.get(k), k);
    });
  },

  serializableKeys: function() {
    var links = Object.keys(this.get('links')||{});
    return this.allKeys().filter(function(item) {
      return links.indexOf(item) === -1;
    });
  },

  eachSerializableKeys: function(fn) {
    var self = this;
    this.serializableKeys().forEach(function(k) {
      fn.call(self, self.get(k), k);
    });
  },
});

export default Serializable;
