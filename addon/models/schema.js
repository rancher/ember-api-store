import Resource from './resource';

export default Resource.extend({
  getCreateDefaults: function(more) {
    var out = {};
    var fields = this.get('resourceFields');

    Object.keys(fields).forEach(function(key) {
      var field = fields[key];
      var def = field['default'];

      if ( field.create )
      {
        if ( typeof def !== 'null' && typeof def !== 'undefined' )
        {
          out[key] = def;
        }
      }
    });

    Object.keys(more).forEach(function(key) {
      out[key] = more[key];
    });

    return out;
  }
});
