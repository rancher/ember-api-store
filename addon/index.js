import VERSION from 'ember-api-store/version';

const EmberApiStore = Ember.Namespace.create({
  VERSION
});

if (Ember.libraries) {
  Ember.libraries.registerCoreLibrary('Ember API Store', EmberApiStore.VERSION);
}

export default EmberApiStore;

