define([
  'underscore',
  'backbone',
  'strainModel'
], function(_, Backbone, Strain) {
    var StrainCollection = Backbone.Collection.extend({
        model: Strain
    });
    
    return StrainCollection;
});