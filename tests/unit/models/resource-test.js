import Resource from 'ember-api-store/models/resource';
import mockRequest from 'ember-api-store/helpers/mock-request';

var qunit = this;

module('Resource');

test('it exists', function() {
  qunit.ok(!!Resource, 'the class is is defined');
});

test('it creates', function() {
  var subject = Resource.create();
  qunit.ok(!!subject, 'the subject is defined');
});

test('it stores properties', function() {
  var subject = Resource.create({
    a: 1,
    b: 'two',
  });

  qunit.equal(subject.get('a'), 1, 'it stores a number');
  qunit.equal(subject.get('b'), 'two', 'it stores a string');
});

test('it has a toString', function() {
  var subject = Resource.create({
    id: 42,
    type: 'thing',
  });

  qunit.equal(subject+'', 'resource:thing:42', 'implicit string works');
  qunit.equal(subject.toString(),'resource:thing:42', 'explicit string works');
});

test('it merges', function() {
  var subject = Resource.create({
    id: 42,
    type: 'resource',
    a: 4,
    c: 'stuff'
  });

  var another = Resource.create({
    a: 5,
    b: 'things',
    c: 'stuff2',
    d: 'foo'
  });

  subject.merge(another);

  qunit.equal(subject.get('id'), 42, 'the id is still set');
  qunit.equal(subject.get('type'), 'resource', 'the type is still set');
  qunit.equal(subject.get('a'), 5, 'properties in new override old ones');
  qunit.equal(subject.get('b'), 'things', 'properties in new override old ones');
  qunit.equal(subject.get('c'), 'stuff2', 'properties in new override old ones');
  qunit.equal(subject.get('d'), 'foo', 'properties in old are still set');
});

test('it clones', function() {
  var subject = Resource.create({
    id: 42,
    type: 'resource',
    a: 4,
    b: 'stuff'
  });

  var another = subject.clone();

  qunit.notEqual(subject,another, 'the objects are different');
  qunit.equal(JSON.stringify(subject.serialize()), JSON.stringify(another.serialize()), 'they serialize to the same thing');

  another.set('b','things');

  qunit.notEqual(JSON.stringify(subject.serialize()), JSON.stringify(another.serialize()), "they don't serialize to the same thing after change");
  qunit.equal(subject.get('id'), another.get('id'), 'the ids are equal');
  qunit.equal(subject.get('a'), another.get('a'), 'unchanged properties are equal');
  qunit.notEqual(subject.get('b'), another.get('b'), 'changed properties are not equal');
});

test('it replaceWiths', function() {
  var subject = Resource.create({
    id: 42,
    type: 'resource',
    a: 4,
    b: 'stuff'
  });

  var another = Resource.create({
    id: 42,
    type: 'resource',
    a: 5,
    c: 'things'
  });

  qunit.notEqual(subject,another);

  subject.replaceWith(another);

  qunit.equal(JSON.stringify(subject.serialize()), JSON.stringify(another.serialize()));
  qunit.equal(subject.get('a'), 5);
  qunit.equal(subject.get('b'), undefined);
  qunit.equal(subject.get('c'), 'things');
  qunit.equal(subject.get('d'), undefined);
});

test('it follows links', function() {
  var subject = Resource.create({
    id: 42,
    type: 'resource',
    links: {
      things: '/resources/42/things'
    },
  });

  qunit.ok(subject, 'the subject is defined');
  qunit.equal(typeof subject.followLink, 'function', 'the function is defined');

  qunit.stop();

  mockRequest(subject, {type: 'collection', data: [{id: 1, type: 'thing'}]});
  subject.followLink('things').then(function(data) {
    qunit.ok(data, 'there is a response');
    qunit.equal(data+'', 'collection:thing[1]', 'the response toString is right');
    qunit.equal(data.get('type'), 'collection', 'the response is the right type');
    qunit.equal(data.get('firstObject.id'), 1, 'the response is a normal object');
  }).catch(function(err) {
    // Shouldn't get here
    console.dir('followLink', err);
  }).finally(function() {
    qunit.start();
  });
});

test('it imports links', function() {
  var subject = Resource.create({
    id: 42,
    type: 'resource',
    links: {
      things: '/resources/42/things'
    }
  });

  qunit.ok(subject, 'the subject is defined');
  qunit.equal(typeof subject.importLink, 'function', 'the function is defined');

  qunit.stop();
  mockRequest(subject, {type: 'collection', data: [{id: 1, type: 'thing'}]});
  subject.importLink('things').then(function(data) {
    qunit.ok(data, 'there is a response');
    qunit.equal(data, subject, 'the response is the subject');
    qunit.equal(subject.get('things')+'', 'collection:thing[1]', 'the response toString is right');
    qunit.equal(subject.get('things.type'), 'collection', 'the response is the right type');
    qunit.equal(subject.get('things.firstObject.id'), 1, 'the response is a normal object');
  }).catch(function(err) {
    // Shouldn't get here
    console.dir('importLink',err);
    //qunit.empty(err);
  }).finally(function() {
    qunit.start();
  });
});

test('it has actions', function() {
  var subject = Resource.create({
    id: 42,
    type: 'resource',
    actions: {
      things: '/resources/42/things'
    }
  });

  qunit.ok(subject, 'the subject is defined');
  qunit.equal(typeof subject.hasAction, 'function', 'the function is defined');
  qunit.ok(subject.hasAction('things'), 'a defined action says true');
  qunit.ok(!subject.hasAction('stuff'), 'a undefined action says false');
});

test('it does actions', function() {
  var subject = Resource.create({
    id: 42,
    type: 'resource',
    actions: {
      things: '/resources/42/things'
    }
  });

  qunit.ok(subject, 'the subject is defined');
  qunit.equal(typeof subject.doAction, 'function', 'the function is defined');
  qunit.stop();
  mockRequest(subject, {type: 'thing', id: 42});

  subject.doAction('things').then(function(result) {
    qunit.ok(result, 'the result is defined');
    qunit.equal(result.get('id'), 42, 'the result has properties');
  }).catch(function(err) {
    console.dir('doAction',err);
  }).finally(function() {
    qunit.start();
  });
});

test('it saves', function() {
  // @TODO
  expect(0);
});

test('it deletes', function() {
  // @TODO
  expect(0);
});
