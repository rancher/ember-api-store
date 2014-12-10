export default function(container, application) {
  application.deferReadiness();

  container.lookup('store:main').find('schema',null,{url: 'schemas'}).then(function() {
    application.advanceReadiness();
  });
}
