import Resource from './resource';
import { normalizeType } from '../utils/normalize';

export const SCHEMA = {
  SIMPLE: ['string','password','masked','multiline','float','int','date','blob','boolean','enum','reference','json'],
//  NESTED: ['array','map'],
};

function parseType(type) {
  return type.replace(/]/g,'').split('[');
}

var Schema = Resource.extend({
  getFieldNames() {
    return Object.keys(this.get('resourceFields'));
  },

  typeifyFields: function() {
    // Schemas are special..
    if ( this.get('id') === 'schema' ) {
      return [];
    }

    let fields = this.get('resourceFields');
    let keys = Object.keys(fields);

    let out = keys.filter(function(k) {
      let parts = parseType(fields[k].type);
      for ( let i = 0 ; i < parts.length ; i++ ) {
        if ( SCHEMA.SIMPLE.includes(parts[i]) ) {
          return false;
        }
      }

      return true;
    });

    out.addObjects(this.get('includeableLinks')||[]);

    return out;
  }.property(),

  getCreateDefaults(more) {
    var out = {};
    var fields = this.get('resourceFields');

    Object.keys(fields).forEach(function(key) {
      var field = fields[key];
      var def = field['default'];

      if ( field.create && def !== null )
      {
        if ( typeof def !== 'undefined' )
        {
          out[key] = JSON.parse(JSON.stringify(def));
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
  },

  optionsFor(field) {
    let obj = this.get('resourceFields')[field];
    if ( obj && obj.options ) {
      return (obj.options||[]).slice();
    }

    return [];
  },

  typesFor(fieldName) {
    const field = this.get('resourceFields')[fieldName];
    if ( !field || !field.type ) {
      return [];
    }

    return field.type.replace(/\]/g,'').split('[');
  },

  primaryTypeFor(field) {
    const types = this.typesFor(field);
    if ( types ) {
      return types[0];
    }
  },

  subTypeFor(field) {
    const types = this.typesFor(field);

    if ( types.length < 2 ) {
      return null;
    } else if ( types.length === 2 ) {
      return types[1];
    } else {
      let out = types[types.length-1];
      for ( let i = types.length - 2 ; i >= 1 ; i-- ) {
        out = types[i] + '[' + out + ']';
      }
      return out;
    }
  },

  referencedTypeFor(field) {
    const obj = this.get('resourceFields')[field];
    const type = obj.type;
    const match = type.match(/^reference\[([^\]]*)\]$/);

    if ( match ) {
      return match[1];
    }
  },
});

Schema.reopenClass({
  mangleIn(data) {
    // Pass IDs through the type normalizer so they will match the case in other places like store.find('schema',normalizeType('thing'))
    data._id = data.id;
    data.id = normalizeType(data.id);
    return data;
  },
});

export default Schema;
