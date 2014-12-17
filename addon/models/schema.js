import Resource from './resource';

export default Resource.extend({
  getCreateDefaults: function(more) {
    var out = {};
    var fields = this.get('resourceFields');

    Object.keys(fields).forEach(function(key) {
      var field = fields[key];
      var def = field['default'];

      if ( field.create && def !== null )
      {
        if ( typeof def !== 'null' && typeof def !== 'undefined' )
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
