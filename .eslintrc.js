'use strict';

module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    ecmaFeatures: {
      legacyDecorators: true
    }
  },
  extends: 'eslint:recommended',
  globals: {
    "document": true,
    "window": true,
    "-Promise": true,
    "jQuery": true,
    "$": true,
    "moment": true,
    "d3": true,
    "Terminal": true,
    "Prism": true,
    "Ui": true,
    "async": true,
    "AWS": true,
    "Identicon": true,
    "md5": true,
    "_": true,
    "commonmark": true,
    "Stripe": true,
    "jsondiffpatch": true
  },
  env: {
    browser: true,
    "es6": true
  },
  rules: {
    "no-cond-assign": [
      2,
      "except-parens"
    ],
    "curly": 2,
    "no-console": 0,
    "no-debugger": 0,
    "eqeqeq": 2,
    "no-eval": 2,
    "guard-for-in": 0,
    "wrap-iife": 0,
    "linebreak-style": 0,
    "new-cap": 0,
    "no-caller": 2,
    "no-empty": 0,
    "no-extra-boolean-cast": 0,
    "no-new": 0,
    "no-plusplus": 0,
    "no-undef": 2,
    "dot-notation": 0,
    "strict": 0,
    "no-eq-null": 2,
    "no-unused-vars": 2
  },
  overrides: [
    // node files
    {
      files: [
        '.eslintrc.js',
        '.template-lintrc.js',
        'ember-cli-build.js',
        'index.js',
        'testem.js',
        'blueprints/*/index.js',
        'config/**/*.js',
        'tests/dummy/config/**/*.js'
      ],
      excludedFiles: [
        'addon/**',
        'addon-test-support/**',
        'app/**',
        'tests/dummy/app/**'
      ],
      parserOptions: {
        sourceType: 'script'
      },
      env: {
        browser: false,
        node: true
      },
      plugins: ['node'],
      extends: ['plugin:node/recommended']
    }
  ]
};
