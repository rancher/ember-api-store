## Module Report
### Unknown Global

**Global**: `Ember.libraries`

**Location**: `addon/index.js` at line 9

```js
});

if (Ember.libraries) {
  Ember.libraries.registerCoreLibrary('Ember API Store', EmberApiStore.VERSION);
}
```

### Unknown Global

**Global**: `Ember.libraries`

**Location**: `addon/index.js` at line 10

```js

if (Ember.libraries) {
  Ember.libraries.registerCoreLibrary('Ember API Store', EmberApiStore.VERSION);
}

```

### Unknown Global

**Global**: `Ember.beginPropertyChanges`

**Location**: `addon/mixins/type.js` at line 189

```js
      var newType = normalizeType(newData.get('type'), store);
      if ( !id && newId && type === newType ) {
        Ember.beginPropertyChanges();

        // A new record was created.  Typeify will have put it into the store,
```

### Unknown Global

**Global**: `Ember.endPropertyChanges`

**Location**: `addon/mixins/type.js` at line 213

```js
        }

        Ember.endPropertyChanges();
      }

```

### Unknown Global

**Global**: `Ember.ActionHandler`

**Location**: `addon/models/resource.js` at line 26

```js
];

var Actionable = EmberObject.extend(Ember.ActionHandler);
var Resource = Actionable.extend(TypeMixin, {
  // You should probably override intl with a real translator...
```

### Unknown Global

**Global**: `Ember.beginPropertyChanges`

**Location**: `addon/services/store.js` at line 516

```js

    if ( xhr.body && typeof xhr.body === 'object' ) {
      Ember.beginPropertyChanges();
      let response = this._typeify(xhr.body);
      delete xhr.body;
```

### Unknown Global

**Global**: `Ember.endPropertyChanges`

**Location**: `addon/services/store.js` at line 520

```js
      delete xhr.body;
      Object.defineProperty(response, 'xhr', {value: xhr, configurable: true});
      Ember.endPropertyChanges();

      // Depaginate
```

### Unknown Global

**Global**: `Ember.beginPropertyChanges`

**Location**: `addon/services/store.js` at line 558

```js
      return finish(body);
    } else if ( xhr.body && typeof xhr.body === 'object' ) {
      Ember.beginPropertyChanges();
      let out = finish(this._typeify(xhr.body));
      Ember.endPropertyChanges();
```

### Unknown Global

**Global**: `Ember.endPropertyChanges`

**Location**: `addon/services/store.js` at line 560

```js
      Ember.beginPropertyChanges();
      let out = finish(this._typeify(xhr.body));
      Ember.endPropertyChanges();

      return out;
```

### Unknown Global

**Global**: `Ember.beginPropertyChanges`

**Location**: `addon/services/store.js` at line 857

```js
  // Create a collection: {key: 'data'}
  createCollection(input, opt) {
    Ember.beginPropertyChanges();
    let key = (opt && opt.key ? opt.key : 'data');
    var cls = getOwner(this).lookup('model:collection');
```

### Unknown Global

**Global**: `Ember.endPropertyChanges`

**Location**: `addon/services/store.js` at line 866

```js

    output.setProperties(getProperties(input, this.metaKeys));
    Ember.endPropertyChanges();
    return output;
  },
```
