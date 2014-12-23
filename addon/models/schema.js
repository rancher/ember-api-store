import Resource from './resource';

export default Resource.extend({
  getFieldNames: function() {
    return Object.keys(this.get('resourceFields'));
  },

  getCreateDefaults: function(more) {
    var out = {};
    var fields = this.get('resourceFields');

    Object.keys(fields).forEach(function(key) {
      var field = fields[key];
      var def = field['default'];

      if ( field.create && def !== null )
      {
        if ( typeof def !== 'undefined' )
        {
          out[key] = def;
        }
      }
    });

    if ( more )
    {
      Object.keys(more).forEach(function(key) {
        out[key] = more[key];
      });
    }

    return out;
  }
});
