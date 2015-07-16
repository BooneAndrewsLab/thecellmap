define([
    'jquery',
    'underscore',
    'backbone',
    
    'leap',
    'three',
], function($, _, Backbone) {
    var clearScene = function() {
        for (var i = three['scene'].children.length - 1; i >= 0; i--) {
            three['scene'].remove(three['scene'].children[i]);
        }
    }
    
    var clearUI = function() {
        for (var i = three['ui'].children.length - 1; i >= 0; i--) {
            three['ui'].remove(three['ui'].getObjectByName('extract'));
            three['ui'].remove(three['ui'].getObjectByName('termMenu'));
        }
    }
    
    var iterFingers = function(frame) {
        var fl = 0, f = [];
        for (p in frame.pointables) {
            if (frame.pointables[p].extended) {
                f[fl++] = p;
            }
        }
        return { 'count': fl, 'extended': f }
    }
    
    return {
        clearScene: clearScene,
        clearUI: clearUI,
        
        iterFingers: iterFingers,
    }
});