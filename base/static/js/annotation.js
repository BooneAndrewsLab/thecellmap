require.config({
    paths: {
        'jquery': 'libs/jquery-2.1.4.min',
        'underscore': 'libs/underscore-min',
        'bootstrap': 'libs/bootstrap.min',
        'backbone': 'libs/backbone-min',
        'select2': 'libs/select2',
        
        'settingsModel': 'models/settingsModel',
        'settings': 'app/settings',
    },
    shim: {
        'backbone': ['underscore', 'jquery'],
        'select2': ['jquery'],
        'bootstrap': ['jquery'],
    }
});

require(['jquery', 'settings', 'bootstrap'], function($, Settings) {
    Settings.initialize();
    $('#id_downloadType').val(localStorage.getItem('downloadType') || 'xls');
    $('#id_autoRemove').val(localStorage.getItem('autoRemove') || true);
});