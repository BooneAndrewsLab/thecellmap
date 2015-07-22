({
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
    },
    name: 'annotation',
    out: 'annotation-built.js'
});
