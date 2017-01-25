define([
    'underscore',
    'backbone'
], function(_, Backbone) {
    var Annotation = Backbone.Model.extend({
        defaults: {
            id: 'None',
            map: {},
            smap: {},
            defaultColor : '#ffffff',
            terms: {"-1": {id: -1, idx: 0, name: 'Unannotated', orig_name: 'Unannotated', alias: 'Unannotated'}},
            colorPalette: ['#ffffff'],
        }
    });
    
    return Annotation;
});