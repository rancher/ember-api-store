import Resource from './resource';
import { normalizeType } from '../utils/normalize';

var Schema = Resource.extend({
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

Schema.reopenClass({
  mangleIn: function(data) {
    // Pass IDs through the type normalizer so they will match the case in other places like store.find('schema',normalizeType('thing'))
    data.id = normalizeType(data.id);
    return data;
  },
});

export default Schema;
