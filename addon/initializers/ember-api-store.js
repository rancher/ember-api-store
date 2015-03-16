import Store from '../store';
import Resource from '../models/resource';
import Collection from '../models/collection';
import ApiError from '../models/error';
import Schema from '../models/schema';

export default function(container, application) {
  container.register('store:main', Store);
  container.register('model:resource', Resource);
  container.register('model:collection', Collection);
  container.register('model:schema', Schema);
  container.register('model:error', ApiError);

  application.inject('controller','store', 'store:main');
  application.inject('route',     'store', 'store:main');
  application.inject('model',     'store', 'store:main');
  application.inject('component', 'store', 'store:main')
}
