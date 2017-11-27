import Ember from 'ember';

export function denormalizeIdArray(field, type=null, storeName="store") {
  if (!type ) {
    type = field.replace(/Ids$/,'');
  }

  let computed = Ember.computed(field+'.[]', {
    get(key) {
      let out = [];
      let store = this.get(storeName);
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

export function denormalizeId(field=null, type=null, storeName="store") {
  if (!type ) {
    type = field.replace(/Id$/,'');
  }

  return Ember.computed(field, {
    get(/*key*/) {
      let id = this.get(field);
      let store = this.get(storeName);
      if ( id ) {
        return store.getById(type, id);
      }
    }
  });
}

export function reference(field=null, referencedType=null, storeName="store") {
  if (!referencedType ) {
    referencedType = field.replace(/Id$/,'');
  }

  return Ember.computed(field, {
    get(computedKey) {
      const store = this.get(storeName);
      const thisType = this.get('type');
      const thisId = this.get('id');
      const referencedId = this.get(field);
      const watchKey = referencedType+':'+referencedId;

      if ( !referencedId ) {
        return null;
      }

      const result = store.getById(referencedType, referencedId);

      // Register for watches for when the references resource is removed
      let list = store._state.watchReference[watchKey];
      if ( !list ) {
        list = [];
        store._state.watchReference[watchKey] = list;
      }

      list.push({
        type: thisType,
        id: thisId,
        field: computedKey
      });

      if ( result ) {
        return result;
>>>>>>> More efficient hasMany() and references() relationships
      }

      // The referenced value isn't found, so note it so the computed property can be updated if it comes in later
      list = store._state.missingReference[watchKey];
      if ( !list ) {
        list = [];
        store._state.missingReference[watchKey] = list;
      }

      //console.log('Missing reference from', thisType, thisId, field, 'to', computedKey);
      list.push({
        type: thisType,
        id: thisId,
        field: computedKey
      });

      return null;
    }
  });
}

// workload ... pods: hasMany('id', 'pod', 'workloadId')
export function hasMany(matchField, targetType, targetField, storeName="store") {
  let registered = false;

  return Ember.computed({
    get(computedKey) {
      let store = this.get(storeName);
      const thisType = this.get('type');

      if ( !registered ) {
        let watch = store._state.watchHasMany[targetType];
        if ( !watch ) {
          watch = [];
          store._state.watchHasMany[targetType] = watch;
        }

        watch.push({
          thisField: computedKey,
          thisType,
          matchField,
          targetField
        });

        //console.log('Registered hasMany for', thisType, matchField, 'to', targetType, targetField, 'in', storeName);
        registered = true;
      }

      //console.log('get hasMany for', thisType, matchField, 'to', targetType, targetField, 'in', storeName);
      return store.all(targetType).filterBy(targetField, this.get(matchField));
    }
  });
}

export function reference(field=null, referencedType=null, storeName="store") {
  if (!referencedType ) {
    referencedType = field.replace(/Id$/,'');
  }

  return Ember.computed(field, {
    get(computedKey) {
      const store = this.get(storeName);
      const thisType = this.get('type');
      const thisId = this.get('id');
      const referencedId = this.get(field);
      const watchKey = referencedType+':'+referencedId;

      if ( !referencedId ) {
        return null;
      }

      const result = store.getById(referencedType, referencedId);

      // Register for watches for when the references resource is removed
      let list = store._state.watchReference[watchKey];
      if ( !list ) {
        list = [];
        store._state.watchReference[watchKey] = list;
      }

      list.push({
        type: thisType,
        id: thisId,
        field
      });

      if ( result ) {
        return result;
      }

      // The referenced value isn't found, so note it so the computed property can be updated if it comes in later
      list = store._state.missingReference[watchKey];
      if ( !list ) {
        list = [];
        store._state.missingReference[watchKey] = list;
      }

      //console.log('Missing reference from', thisType, thisId, field, 'to', computedKey);
      list.push({
        type: thisType,
        id: thisId,
        field
      });

      return null;
    }
  });
}

// workload ... pods: hasMany('id', 'pod', 'workloadId')
export function hasMany(matchField, targetType, targetField, storeName="store") {
  let registered = false;

  return Ember.computed({
    get(computedKey) {
      let store = this.get(storeName);
      const thisType = this.get('type');

      if ( !registered ) {
        let watch = store._state.watchHasMany[targetType];
        if ( !watch ) {
          watch = [];
          store._state.watchHasMany[targetType] = watch;
        }

        watch.push({
          thisField: computedKey,
          thisType,
          matchField,
          targetField
        });

        //console.log('Registered hasMany for', thisType, matchField, 'to', targetType, targetField, 'in', storeName);
        registered = true;
      }

      //console.log('get hasMany for', thisType, matchField, 'to', targetType, targetField, 'in', storeName);
      return store.all(targetType).filterBy(targetField, this.get(matchField));
    }
  });
}
