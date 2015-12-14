define([
    'jquery',
    'underscore',
    'backbone',
], function($, _, Backbone, Utils) {
    var parseBool = function(bool) {
        if (typeof bool == 'boolean') return bool;
        return bool == 'true';
    }
    
    var Settings = Backbone.Model.extend({
        defaults: {
            selectedUi: localStorage.getItem('selectedUi') || 'simple',
            showLabel: parseBool(localStorage.getItem('showLabel')) || true,
            showBgSvg: parseBool(localStorage.getItem('showBgSvg')) || true,
            showLegendSvg: parseBool(localStorage.getItem('showLegendSvg')) || true,
            disableScroll: parseBool(localStorage.getItem('disableScroll')) || false,
            
            isPrivate: parseBool(localStorage.getItem('isPrivate')) || false,
            
            autoRemove: parseBool(localStorage.getItem('autoRemove')) || false,
            downloadType: localStorage.getItem('downloadType') || "xls",
        }
    });
    
    return Settings;
});