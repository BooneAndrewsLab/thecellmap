define([
    'jquery',
    'underscore',
    'backbone',
], function($, _, Backbone) {
    var parseBool = function(bool) {
        if (typeof bool == 'boolean') return bool;
        return bool == 'true';
    }
    
    var Settings = Backbone.Model.extend({
        defaults: {
            enableIntro: localStorage.getItem('enableIntro') ? parseBool(localStorage.getItem('enableIntro')) : true,
            selectedUi: localStorage.getItem('selectedUi') || 'simple',
            showLabel: localStorage.getItem('showLabel') ? parseBool(localStorage.getItem('showLabel')) : true,
            showBgSvg: localStorage.getItem('showBgSvg') ? parseBool(localStorage.getItem('showBgSvg')) : true,
            showLegendSvg: localStorage.getItem('showLegendSvg') ? parseBool(localStorage.getItem('showLegendSvg')) : true,
            disableScroll: localStorage.getItem('disableScroll') ? parseBool(localStorage.getItem('disableScroll')) : false,
            
            isPrivate: localStorage.getItem('isPrivate') ? parseBool(localStorage.getItem('isPrivate')) : false,
            
            autoRemove: localStorage.getItem('autoRemove') ? parseBool(localStorage.getItem('autoRemove')) : false,
            downloadType: localStorage.getItem('downloadType') || "xls",
        }
    });
    
    return Settings;
});