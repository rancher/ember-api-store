import Store from '../store';
import Resource from '../models/resource';
import Collection from '../models/collection';
import ApiError from '../models/error';
import Schema from '../models/schema';

export default function(registry, application) {
  registry.register('store:main', Store);
  registry.register('model:resource', Resource);
  registry.register('model:collection', Collection);
  registry.register('model:schema', Schema);
  registry.register('model:error', ApiError);

  application.inject('controller','store', 'store:main');
  application.inject('route',     'store', 'store:main');
  application.inject('model',     'store', 'store:main');
  application.inject('component', 'store', 'store:main');
  application.inject('service',   'store', 'store:main');
}
