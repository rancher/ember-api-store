import Ember from 'ember';
import Store from 'ember-api-store/store';
import Collection from 'ember-api-store/models/collection';
import Resource from 'ember-api-store/models/resource';

var _store = null;

export default function()
{
  if ( !_store)
  {
    var container = new Ember.Container();
    container.register('model:collection', Collection);
    container.register('model:resource', Resource);

    _store = Store.create({
      container: container
    });
  }

  return _store;
}
