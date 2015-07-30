define([
    'jquery',
    'underscore',
    'backbone',
    'settingsModel',
    'jquery.cookie',
    'utils',
    
    'select2',
], function($, _, Backbone, SettingsModel, Cookies, Utils) {
    window.settings = new SettingsModel();
    
    var initialize = function() {
        $('#tools-settings').parent().removeClass('disabled')
        
        $('#tools-settings').on('click', function(e) {
            $('#modal-settings').modal('show');
            $('.settings-selects').each(function() {
                $(this).select2('val', settings.get($(this).attr('id')));
            });
            $('.settings-checkboxes').each(function() {
                this.checked = settings.get($(this).attr('id'));
            });
            e.preventDefault();
        });
        
        $('.settings-selects').select2({
            minimumResultsForSearch: -1
        });
        
        $('#modal-settings .nav-pills').click(function(e) {
            e.preventDefault();
        });
        
        $('#modal-settings #ui').on('change', function() {
            if ($(this).val() != state.get('ui')) Utils.messageUser('Change in UI will result in network being refreshed on confirm', 'alerts-panel-settings');
        });
        
        $('#modal-settings .modal-confirm').click(function(e) {
            $('.settings-checkboxes').each(function() {
                var id = $(this).attr('id'), value = this.checked;
                if (value != settings.get(id)) {
                    localStorage.setItem(id, value);
                    settings.set(id, parseBool(value));
                }
            });
            $('.settings-selects').each(function() {
                var id = $(this).attr('id'), value = $(this).val();
                if (value != settings.get(id) && id.indexOf('_') == -1) {
                    localStorage.setItem(id, value);
                    settings.set(id, value);
                }
            });
            $('#modal-settings').modal('hide');
            e.preventDefault();
        });
        
        settings.on('change:ui', function() {
            Cookies.set('ui', settings.get('ui'));
            location.reload();
        });
        
        settings.on('change:disableScroll', function() {
            sigInst.mouseProperties({blockScroll: settings.get('disableScroll')});
        });
    }
    
    var updateLabels = function() {
        var val = settings.get('showLabel') && (Utils.countVisibleNodes() <= 100 || state.get('showCircular')) ? 0 : state.get('labelThreshold');
        sigInst.drawingProperties({labelThreshold: val}).draw(-1, -1, 1);
    }
    
    return {
        initialize: initialize,
        updateLabels: updateLabels,
    }
});