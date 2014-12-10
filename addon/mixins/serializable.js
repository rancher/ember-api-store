import Ember from 'ember';

// Properties to ignore because they're built-in to ember or the store
var reserved = ['constructor','store','isInstance','isDestroyed','isDestroying','concatenatedProperties'];

var Serializable = Ember.Mixin.create({
  serialize: function() {
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

    var output;
    if ( Ember.isArray(this) )
    {
      output = this.map(recurse);
    }
    else
    {
      output = {};
      this.eachKeys(function(v,k) {
        output[k] = recurse(v);
      });
    }

    return output;
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
});

export default Serializable;
