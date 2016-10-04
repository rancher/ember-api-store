import Ember from 'ember';

export function denormalizeIdArray(field, type=null) {
  if (!type ) {
    type = field.replace(/Ids$/,'');
  }

  return Ember.computed(field+'.[]', function() {
    let out = [];
    let store = this.get('store');
    (this.get(field)||[]).forEach((id) => {
      let obj = store.getById(type, id);
      if ( obj ) {
        out.push(obj);
      }
    });

    return out;
  });
}

export function denormalizeId(field, type=null) {
  if (!type ) {
    type = field.replace(/Id$/,'');
  }

  return Ember.computed(field, function() {
    let id = this.get(field);
    if ( id )
    {
      return this.get('store').getById(type, id);
    }
  });
}
