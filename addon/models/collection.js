import Ember from 'ember';
import TypeMixin from '../mixins/type';

export default Ember.ArrayProxy.extend(Ember.SortableMixin, TypeMixin, {
  type: 'collection',
  createDefaults: null,
  createTypes: null,
  filters: null,
  pagination: null,
  sort: null,
  sortLinks: null,

  toString: function() {
    return 'collection:'+ this.get('firstObject.type') + '[' + this.get('length') + ']';
  },

  depaginate: function(depth) {
    var self = this;

    depth = depth || 1;
    /*
    if ( depth > 5 )
    {
      console.log('Depaginate, max depth reached');
      return new Ember.RSVP.Promise(function(resolve,reject) {
        resolve();
      });
    }
    */

    var promise = new Ember.RSVP.Promise(function(resolve,reject) {
      var next = self.get('pagination.next');
      if ( next )
      {
        console.log('Depaginate, requesting', next);
        this.get('store').request({
          method: 'GET',
          url: next,
          depaginate: false,
        }).then(gotPage, fail);
      }
      else
      {
        resolve();
      }

      function gotPage(body)
      {
        //console.log('Depaginate, got page');
        self.set('pagination', body.get('pagination'));
        body.forEach(function(obj) {
          var existing = self.findById(obj.get('id'));
          if ( existing )
          {
            // This is an addition to a partial object we got on a previous page
            //console.log('Depaginate, merging into', obj.get('id'));
            existing.merge(obj,true);
          }
          else
          {
            //console.log('Depaginate, pushing new object');
            // This is a new object we don't have already.
            self.pushObject(obj);
          }
        });

        if ( self.get('pagination.next') )
        {
          //console.log('Depaginate, more pages');
          // 98 bottles of beer on the wall...
          resolve( self.depaginate(depth+1));
        }
        else
        {
          //console.log('Depaginate, no more pages');
          resolve();
        }
      }

      function fail(body)
      {
        //console.log('Depaginate fail',body);
        reject(body);
      }
    },'Depaginating, depth='+depth);

    return promise;
  },

  findById: function(id) {
    var matches = this.filterProperty('id',id);
    return matches[0];
  },

  findNestedById: function(key, id) {
    var out = null;
    this.forEach(function(item) {
      var subItems = item.get(key);
      if ( subItems && subItems.get('length') )
      {
        var matches = subItems.filterProperty('id', id);
        if ( matches.length )
        {
          out = matches.objectAt(0);
        }
      }
    });

    return out;
  }
});
