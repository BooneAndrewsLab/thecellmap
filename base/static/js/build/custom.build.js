({
    paths: {
        'jquery': 'libs/jquery-2.1.4.min',
        'backbone': 'libs/backbone-min',
        'underscore': 'libs/underscore-min',
        'bootstrap': 'libs/bootstrap.min',
        
        'jquery.cookie': 'libs/js.cookie',
        'underscore.strings': 'libs/underscore.string.min',
        
        'jszip': 'libs/jszip',
        'xls': 'libs/xls.min',
        'xlsx': 'libs/xlsx',
        
        'settingsModel': 'models/settingsModel',
        
        'customGraph': 'app/customGraph',
        'fileReader': 'libs/bootstrap.file-input',
        'jquery.parser': 'libs/jquery.parse',
        'load': 'app/load',
        'select2': 'libs/select2',
        'settings': 'app/settings',
        'wizard': 'libs/bootstrap-wizard',
    },
    shim: {
        'backbone': ['underscore', 'jquery'],
        'underscore.strings': ['underscore'],
        'bootstrap': ['jquery'],
        'fileReader': ['bootstrap'],
        'jquery.cookie': ['jquery'],
        'jquery.parser': ['jquery'],
        'load': ['jszip'],
        'select2': ['jquery'],
        'wizard': ['bootstrap'],
        'xlsx': ['load', 'jszip'],
    },
    name: 'custom',
    out: 'custom-built.js',
});
