import Ember from 'ember';

const { getOwner } = Ember;

export default function(application) {
  application.deferReadiness();

  // Attempt to preload schemas...
  getOwner(this).lookup('store:main').find('schema',null,{url: 'schemas'})
  .catch(function(err) {
    application.set('error', err);
  })
  .finally(function() {
    application.advanceReadiness();
  });
}
