define([
    'underscore',
    'backbone'
], function(_, Backbone) {
    var State = Backbone.Model.extend({
        defaults: {
            annotation: 'None',
            background: '222222',
            cutoffCorrelation: 0.20,
            cutoffInteraction: [-0.08, 0.08],
            cutoffLow: 0.20,
            dataset: 0,
            edgeWidth: 1,
            hoverTarget: [],
            isInitializing: true,
            labelColor: 'ffffff',
            labelSize: 14,
            labelThreshold: 6,
            layoutAttraction: 50,
            layoutRepulsion: 1,
            missingNodes: [],
            nodeSize: 2,
            preselect: [],
            selection: [],
            showCircular: false,
            showRegions: true,
            subnetworks: false,
            ui: localStorage.getItem('ui') || 'simple',
        }
    });
    
    return State;
});