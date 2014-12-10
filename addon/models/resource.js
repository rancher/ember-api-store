import Ember from 'ember';
import TypeMixin from '../mixins/type';

export default Ember.Object.extend(TypeMixin, {
  toString: function() {
    var str = 'resource:'+this.get('type');
    var id = this.get('id');
    if ( id )
    {
      str += ':' + id;
    }

    return str;
  }
});
