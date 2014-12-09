import Ember from 'ember';
import mockStore from 'ember-api-store/helpers/mock-store';

export default function(obj, data, isError, status)
{
  var res = {
    textStatus: 'OK',
    xhr: {
      status: status||200,
      responseText: (typeof data === 'string' ? data : JSON.stringify(data)),
      getResponseHeader: function(name) {
        switch (name.toLowerCase()) {
          case 'content-type': return 'application/json';
        }
      }
    }
  };

  var store = obj._store = mockStore();

  store.rawRequest = function() {
    if ( isError )
    {
      return Ember.RSVP.reject(res);
    }
    else
    {
      return Ember.RSVP.resolve(res);
    }
  };
}
