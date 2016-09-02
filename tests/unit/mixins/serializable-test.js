import Ember from 'ember';
import SerializableMixin from 'ember-api-store/mixins/serializable';

module('SerializableMixin');

test('it creates', function() {
  var SerializableObject = Ember.Object.extend(SerializableMixin);
  var subject = SerializableObject.create();
  ok(subject, 'the subject is defined');
});

test('it serializes simple objects', function() {
  var SerializableObject = Ember.Object.extend(SerializableMixin);
  var subject = SerializableObject.create({
    hello: 'world',
    things: 42
  });

  var output = subject.serialize();
  ok(subject, 'The subject is defined');
  equal(output.hello,'world','String property exists');
  equal(output.things,42,'Number property exists');
});

test('it serializes arrays', function() {
  var SerializableObject = Ember.ArrayProxy.extend(SerializableMixin);
  var subject = SerializableObject.create({
    content: ['hello', 'world']
  });

  var output = subject.serialize();
  ok(subject, 'The subject is defined');
  ok(output, 'The output is defined');
  ok(Ember.isArray(output), true);
  equal(output.length, 2);
  equal(output[0], 'hello');
  equal(output[1], 'world');
});

test('it serializes nested simple properties', function() {
  var SerializableObject = Ember.Object.extend(SerializableMixin);
  var subject = SerializableObject.create({
    hello: 'world',
    things: {
      stuffs: 42
    },
    foo: [1, 2, 3]
  });

  var output = subject.serialize();
  ok(subject, 'The subject is defined');
  equal(output.hello, 'world', 'String property exists');
  equal(output.things.stuffs, 42, 'Number property exists');
  equal(output.foo.length, 3, 'Array property is the right length');
  deepEqual(output.foo, [1, 2, 3], 'Array property has the right stuff');
});

test('it serializes deeply nested simple properties', function() {
  var SerializableObject = Ember.Object.extend(SerializableMixin);
  var expect = {
    hello: 'world',
    things: {
      stuffs: [
        {name: 'a', size: 1},
        {name: 'b', size: 2},
        {name: 'c', size: 3},
      ]
    }
  };

  var subject = SerializableObject.create(expect);

  var output = subject.serialize();
  ok(subject, 'The subject is defined');
  equal(JSON.stringify(output), JSON.stringify(expect), 'The JSON matches');
});

test('it serializes deeply nested serializable properties', function() {
  var SerializableObject = Ember.Object.extend(SerializableMixin);
  var subject = SerializableObject.create({
    hello: 'world',
    things: {
      stuffs: [
        SerializableObject.create({name: 'a', size: 1}),
        SerializableObject.create({name: 'b', size: 2}),
        {name: 'c', size: 3},
      ]
    }
  });

  var expect = {
    hello: 'world',
    things: {
      stuffs: [
        {name: 'a', size: 1},
        {name: 'b', size: 2},
        {name: 'c', size: 3},
      ]
    }
  };

  var output = subject.serialize();
  ok(subject, 'The subject is defined');
  equal(JSON.stringify(output), JSON.stringify(expect), 'The JSON matches');
});

test('it serializes nested arrays', function() {
  var SerializableArray = Ember.ArrayProxy.extend(SerializableMixin);
  var SerializableObject = Ember.Object.extend(SerializableMixin);

  var subject = SerializableArray.create({
    content: [
      'hello',
      'world',
      SerializableObject.create({name: 'a', size: 1}),
      SerializableArray.create({
        extraProperty: 42,
        content: [
          SerializableObject.create({name: 'b', size: 2}),
          {name: 'c', size: 3},
        ]
      })
    ]
  });

  var expect = [
    'hello',
    'world',
    {name: 'a', size: 1},
    [
      {name: 'b', size: 2},
      {name: 'c', size: 3},
    ]
  ];

  var output = subject.serialize();
  ok(subject, 'The subject is defined');
  equal(JSON.stringify(output), JSON.stringify(expect), 'The JSON matches');
});

/*
test('it handles circular references', function() {
  var SerializableObject = Ember.Object.extend(SerializableMixin);
  var subject = SerializableObject.create({name: 'a'});
  var objB = SerializableObject.create({name: 'b', a: subject});
  subject.set('b', objB);

  var output = subject.serialize();
  var expect = {name: 'a', b: {name: 'b'}};

  ok(subject, 'The subject is defined');
  equal(JSON.stringify(output), JSON.stringify(expect), 'The JSON matches');
});
*/

test('allKeys', function() {
  var SerializableObject = Ember.Object.extend(SerializableMixin);
  var subject = SerializableObject.create({a: 1, b: 2, c: 3});
  var output = subject.allKeys();

  ok(subject, 'the subject is defined');
  ok(output, 'the output is defined');
  deepEqual(output,['a','b','c']);
});
test('eachKeys', function() {
  var SerializableObject = Ember.Object.extend(SerializableMixin);
  var subject = SerializableObject.create({a: 1, b: 2, c: 3});

  var keys = [];
  var values = [];
  subject.eachKeys(function(v,k) {
    keys.push(k);
    values.push(v);
  });

  ok(subject, 'the subject is defined');
  deepEqual(keys,['a','b','c'], 'it has the right keys');
  deepEqual(values,[1,2,3], 'it has the right values');
});

test('eachKeys maintains scope', function() {
  var SerializableObject = Ember.Object.extend(SerializableMixin);
  var subject = SerializableObject.create({a: 1, b: 2, c: 3});

  var inside;
  subject.eachKeys(function(/*v,k*/) {
    inside = this;
  });

  ok(subject, 'the subject is defined');
  equal(inside, subject, 'the inner scope is the subject');
});

