define([
    'underscore',
    'backbone'
], function(_, Backbone) {
    var Annotation = Backbone.Model.extend({
        defaults: {
            id: 'None',
            map: {},
            smap: {},
            defaultColor : '#E8E8E8',
            terms: {"-1": {id: -1, idx: 0, name: 'Unannotated', orig_name: 'Unannotated', alias: 'Unannotated'}},
            colorPalette: ['#E8E8E8'],
        }
    });
    
    return Annotation;
});