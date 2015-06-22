define([
    'jquery',
    'underscore',
    'backbone',
    'settingsModel',
    
    'select2',
], function($, _, Backbone, SettingsModel, Utils) {
    window.settings = new SettingsModel();
    
    var parseBool = function(bool) {
        if (typeof bool == 'boolean') return bool;
        return bool == 'true';
    }
    
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
    }
    
    return {
        initialize: initialize,
    }
});