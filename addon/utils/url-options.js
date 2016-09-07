export function urlOptions(url,opt,cls) {
  opt = opt || {};

  // Filter
  // @TODO friendly support for modifiers
  if ( opt.filter )
  {
    var keys = Object.keys(opt.filter);
    keys.forEach(function(key) {
      var vals = opt.filter[key];
      if ( !Ember.isArray(vals) )
      {
        vals = [vals];
      }

      vals.forEach(function(val) {
        url += (url.indexOf('?') >= 0 ? '&' : '?') + encodeURIComponent(key) + '=' + encodeURIComponent(val);
      });
    });
  }
  // End: Filter

  // Include
  let include = []
  if ( opt.include )
  {
    if ( Ember.isArray(opt.include) )
    {
      include.addObject(opt.include);
    }
    else
    {
      include.addObjects(opt.include);
    }
  }

  if ( cls && cls.constructor.alwaysInclude )
  {
    include.addObjects(cls.constructor.alwaysInclude);
  }

  include.forEach(function(key) {
    url += (url.indexOf('?') >= 0 ? '&' : '?') + 'include=' + encodeURIComponent(key);
  });
  // End: Include


  // Limit
  let limit = opt.limit
  if ( !limit && cls ) {
    limit = cls.constructor.defaultLimit;
  }

  if ( limit )
  {
    url += (url.indexOf('?') >= 0 ? '&' : '?') + 'limit=' + limit;
  }
  // End: Limit


  // Sort
  var sortBy = opt.sortBy;
  if ( !sortBy && cls )
  {
    sortBy = cls.constructor.defaultSortBy;
  }

  if ( sortBy )
  {
    url += (url.indexOf('?') >= 0 ? '&' : '?') + 'sort=' + encodeURIComponent(sortBy);
  }

  var orderBy = opt.sortOrder;
  if ( !orderBy && cls )
  {
    orderBy = cls.constructor.defaultSortOrder;
  }

  if ( orderBy )
  {
    url += (url.indexOf('?') >= 0 ? '&' : '?') + 'order=' + encodeURIComponent(orderBy);
  }
  // End: Sort

  return url;
};

export default urlOptions;
