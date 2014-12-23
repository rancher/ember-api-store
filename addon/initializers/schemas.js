export default function(container, application) {
  application.deferReadiness();

  // Attempt to preload schemas...
  container.lookup('store:main').find('schema',null,{url: 'schemas'})
  .catch(function(err) {
    application.set('error', err);
  })
  .finally(function() {
    application.advanceReadiness();
  });
}
