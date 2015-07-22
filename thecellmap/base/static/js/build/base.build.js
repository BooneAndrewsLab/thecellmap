({
    paths: {
        'jquery': 'libs/jquery-2.1.4.min',
        'bootstrap': 'libs/bootstrap.min',
    },
    shim: {
        'bootstrap': ['jquery'],
    },
    name: 'base',
    out: 'base-built.js',
});