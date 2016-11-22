import Ember from 'ember';

export function denormalizeIdArray(field, type=null) {
  if (!type ) {
    type = field.replace(/Ids$/,'');
  }

  let computed = Ember.computed(field+'.[]', {
    get(key) {
      let out = [];
      let store = this.get('store');
      (this.get(field)||[]).forEach((id) => {
        let obj = store.getById(type, id);
        if ( obj ) {
          out.push(obj);
        } else {
          store._missing(type, id, this, key);
        }
      });

      return out;
    }
  });

  return computed;
}

export function denormalizeId(field, type=null) {
  if (!type ) {
    type = field.replace(/Id$/,'');
  }

  return Ember.computed(field, {
    get(key) {
      let id = this.get(field);
      let store = this.get('store');
      if ( id ) {
        return this.get('store').getById(type, id);
      }
      else {
        store._missing(type, id, this, key);
      }
    }
  });
}
