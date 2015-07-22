({
    paths: {
        'jquery': 'libs/jquery-2.1.4.min',
        'bootstrap': 'libs/bootstrap.min',
        'select2': 'libs/select2',
    },
    shim: {
        'bootstrap': ['jquery'],
        'select2': ['jquery'],
    },
    name: 'edit',
    out: 'edit-built.js'
});