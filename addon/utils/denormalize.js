import Ember from 'ember';
import { normalizeType } from '../utils/normalize';

function _getReference(store, referencedType, referencedId, thisType, thisId, computedKey) {
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

export function reference(field, referencedType=null, storeName="store") {
  if ( !field ) {
    throw new Error('reference must specify the field that it refers to');
  }

  if (!referencedType ) {
    referencedType = field.replace(/Id$/,'');
  }

  return Ember.computed(field, {
    get(computedKey) {
      const store = this.get(storeName);
      const thisType = this.get('type');
      const thisId = this.get('id');
      const referencedId = this.get(field);

      return _getReference(store, referencedType, referencedId, thisType, thisId, computedKey);
    }
  });
}


export function arrayOfReferences(field=null, referencedType=null, storeName="store") {
  if (!referencedType ) {
    referencedType = field.replace(/Id$/,'');
  }

  return Ember.computed(field+'.[]', {
    get(computedKey) {
      const store = this.get(storeName);
      const thisType = this.get('type');
      const thisId = this.get('id');
      const idArray = this.get(field)||[];

      const out = [];
      let entry;
      for ( let i = 0 ; i < idArray.get('length') ; i++ ) {
        entry = _getReference(store, referencedType, idArray.objectAt(i), thisType, thisId, computedKey);
        if ( entry ) {
          out.push(entry);
        }
      }

      return out;
    }
  });
}

// workload ... pods: hasMany('id', 'pod', 'workloadId')
export function hasMany(matchField, targetType, targetField, storeName="store", additionalFilter=null, sourceStoreName=null) {
  targetType = normalizeType(targetType);

  return Ember.computed({
    get(computedKey) {
      let store = this.get(storeName);
      let sourceStore;
      if ( sourceStoreName ) {
        sourceStore = this.get(sourceStoreName);
      }
      const thisType = normalizeType(this.get('type'));

      let watch = store._state.watchHasMany[targetType];
      if ( !watch ) {
        watch = [];
        store._state.watchHasMany[targetType] = watch;
      }

      const key = `${computedKey}/${thisType}/${matchField}/${targetField}`
      if ( !watch.findBy('key', key) ) {
        watch.push({
          key,
          thisField: computedKey,
          thisType,
          matchField,
          targetField,
          sourceStore,
        });
      }

      // console.log('get hasMany for', thisType, matchField, 'to', targetType, targetField, 'in', storeName);
      let out = store.all(targetType).filterBy(targetField, this.get(matchField));
      if ( additionalFilter ) {
        out = out.filter(additionalFilter);
      }

      return out;
    }
  });
}
