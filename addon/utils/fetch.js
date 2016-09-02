import _fetch from "ember-network/fetch";
import Ember from 'ember';

export default function fetch(url,opt) {
  opt = opt || {};
  if (!opt.credentials) {
    opt.credentials = 'same-origin';
  }

  return _fetch(url, opt).then((res) => {
    let out = null;

    let ct = res.headers.get("content-type");
    if (ct && ct.toLowerCase().indexOf("application/json") >= 0) {
      out = res.json();
    }

    if (res.ok) {
      return out;
    } else {
      Object.defineProperty(out, '_fetch', res);
      return Ember.RSVP.reject(out);
    }
  });
}
