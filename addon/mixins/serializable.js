import Ember from 'ember';

var Serializable = Ember.Mixin.create({
  serialize: function(depth) {
    depth = depth || 0;
    var output;

    if ( depth > 10 )
    {
      return null;
    }

    if ( Ember.isArray(this) )
    {
      output = this.map(function(item) {
        return recurse(item,depth+1);
      });
    }
    else
    {
      output = {};
      this.eachKeys(function(v,k) {
        output[k] = recurse(v,depth+1);
      });
    }

    return output;

    function recurse(obj,depth) {
      depth = depth || 0;
      if ( depth > 5 )
      {
        return null;
      }

      if ( Ember.isArray(obj) )
      {
        return obj.map(function(item) {
          return recurse(item, depth+1);
        });
      }
      else if ( Serializable.detect(obj) )
      {
        return obj.serialize(depth+1);
      }
      else if ( obj && typeof obj === 'object' )
      {
        var out = {};
        var keys = Object.keys(obj);
        keys.forEach(function(k) {
          out[k] = recurse(obj[k], depth+1);
        });
        return out;
      }
      else
      {
        return obj;
      }
    }
  },

  // Properties to ignore because they're built-in to ember, ember-debug, or the store
  concatenatedProperties: ['reservedKeys'],
  reservedKeys: ['reservedKeys','__nextSuper','constructor','container','store','isInstance','isDestroyed','isDestroying','concatenatedProperties','_debugContainerKey'],

  allKeys: function() {
    var out = [];
    var reserved = this.get('reservedKeys');
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
});

export default Serializable;
