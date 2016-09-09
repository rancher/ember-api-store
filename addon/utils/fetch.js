import _fetch from "ember-network/fetch";
import Ember from 'ember';

export function fetch(url,opt) {
  opt = opt || {};
  if (!opt.credentials) {
    opt.credentials = 'same-origin';
  }

  if ( opt.data && !opt.body ) {
    opt.body = opt.data;
    delete opt.data;
  }

  return _fetch(url, opt).then((res) => {
    let out = null;

    let ct = res.headers.get("content-type");
    if (ct && ct.toLowerCase().indexOf("application/json") >= 0) {
      return res.json().then((data) => {
        Object.defineProperty(data, '_fetch', {value: res});
        if (res.ok) {
          return data;
        } else {
          return Ember.RSVP.reject(data);
        }
      });
    }
    else {
      Object.defineProperty(out, '_fetch', {value: res});

      if (res.ok) {
        return out;
      } else {
        return Ember.RSVP.reject(out);
      }
    }
  });
}

export default fetch;
