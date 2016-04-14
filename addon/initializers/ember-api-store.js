import Store from '../store';
import Resource from '../models/resource';
import Collection from '../models/collection';
import ApiError from '../models/error';
import Schema from '../models/schema';

export default function(name,variable) {
  return function(application) {
    application.register('store:'+name, Store);
    application.register('model:resource', Resource);
    application.register('model:collection', Collection);
    application.register('model:schema', Schema);
    application.register('model:error', ApiError);

    application.inject('controller', variable, 'store:'+name);
    application.inject('route',      variable, 'store:'+name);
    application.inject('component',  variable, 'store:'+name);
    application.inject('service',    variable, 'store:'+name);
  };
}
