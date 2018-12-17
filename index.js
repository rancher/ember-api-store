/* eslint-env node */
'use strict';

var pkg         = require('./package.json');
//var merge       = require('broccoli-merge-trees');
//var createFile  = require('broccoli-file-creator');

module.exports = {
  name: pkg.name,

/*
  included() {
    this._super.included.apply(this, arguments);
    this._ensureThisImport();
    this.import('vendor/ember-api-store/register-version.js');
  },

  treeForVendor() {
    var content = "Ember.libraries.register('Ember API Store', '" + pkg.version + "');";
    var registerVersionTree = createFile(
      'ember-api-store/register-version.js',
      content
    );

    return merge([registerVersionTree]);
  },

  _ensureThisImport: function() {
    if (!this.import) {
      this._findHost = function findHostShim() {
        var current = this;
        var app;
        do {
          app = current.app || app;
        } while (current.parent.parent && (current = current.parent));
        return app;
      };
      this.import = function importShim(asset, options) {
        var app = this._findHost();
        app.import(asset, options);
      };
    }
  }
*/
};
