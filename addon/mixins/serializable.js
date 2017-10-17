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
      if ( depth > 10 )
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
  reservedKeys: ['reservedKeys','includedKeys','constructor','container','store','isInstance','isDestroyed','isDestroying','concatenatedProperties','cache','factoryCache','validationCache','store'],

  allKeys: function(withIncludes) {
    var reserved = this.get('reservedKeys');

    var alwaysIncluded = [];
    if ( withIncludes === false )
    {
      alwaysIncluded = this.constructor.alwaysInclude || [];
    }

    var thisIncluded = this.get('includedKeys')||[];

    var out = Object.keys(this).filter((k) => {
      return k.charAt(0) !== '_' &&
        reserved.indexOf(k) === -1 &&
        alwaysIncluded.indexOf(k) === -1 &&
        thisIncluded.indexOf(k) === -1 &&
        Ember.typeOf(Ember.get(this,k)) !== 'function';
    });

    return out;
  },

  eachKeys: function(fn, withIncludes) {
    var self = this;
    this.allKeys(withIncludes).forEach(function(k) {
      fn.call(self, self.get(k), k);
    });
  },
});

export default Serializable;
