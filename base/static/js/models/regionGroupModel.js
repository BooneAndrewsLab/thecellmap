define([
    'underscore',
    'backbone'
], function(_, Backbone) {
    var RegionGroup = Backbone.Model.extend({
        defaults: {
            id: 'None',
            regions: [],
            colorPalette: [],
        }
    });
    
    return RegionGroup;
});