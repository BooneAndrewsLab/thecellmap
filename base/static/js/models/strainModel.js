define([
    'underscore',
    'backbone'
], function(_, Backbone) {
    var Strain = Backbone.Model.extend({
        defaults: {
            alel: null,
            id: -1,
            label: '',
            name: null,
            orf: '',
            a: null,
            n: null,
            o: '',
            verboseName: '',
            terms: null,
            isdu: false,
            isnf: false
        }
    });
    
    return Strain;
});