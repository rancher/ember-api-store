import Ember from 'ember';
import TypeMixin from '../mixins/type';

var Resource = Ember.Object.extend(TypeMixin, {
  toString: function() {
    var str = 'resource:'+this.get('type');
    var id = this.get('id');
    if ( id )
    {
      str += ':' + id;
    }

    return str;
  },

  serialize: function() {
    var data = this._super.apply(this,arguments);
    if ( this.constructor.mangleOut )
    {
      return this.constructor.mangleOut(data);
    }
    else
    {
      return data;
    }
  },
});

Resource.reopenClass({
  // You can provide an array of link names to always include when retrieving resources of this type
  defaultSortBy: '',

  // You can provide an array of link names to always include when retrieving resources of this type
  alwaysInclude: null,

  // You can provide a function here to mangle data before it is passed to store.createRecord() for purposes of evil.
  mangleIn: null,

  // You can provide a function here to mangle data after it is serialized for purposes of even more evil.
  mangleOut: null,
});

export default Resource;
