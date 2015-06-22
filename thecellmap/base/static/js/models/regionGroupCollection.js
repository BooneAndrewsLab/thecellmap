define([
  'underscore',
  'backbone',
  'regionGroupModel'
], function(_, Backbone, RegionGroup) {
    var RegionGroupCollection = Backbone.Collection.extend({
        model: RegionGroup
    });
    
    return RegionGroupCollection;
});