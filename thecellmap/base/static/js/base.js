require.config({
    paths: {
        'jquery': 'libs/jquery-2.1.4.min',
        'bootstrap': 'libs/bootstrap.min',
    },
    shim: {
        'bootstrap': ['jquery'],
    }
});

require(['jquery', 'bootstrap'], function($) {
});