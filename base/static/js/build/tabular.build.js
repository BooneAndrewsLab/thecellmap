({
    paths: {
        'jquery': 'libs/jquery-2.1.4.min',
        'bootstrap': 'libs/bootstrap.min',
        'bootstrap-sortable': 'libs/bootstrap-sortable',
        'bootstrap-tabdrop': 'libs/bootstrap-tabdrop',
        'select2': 'libs/select2',
    },
    shim: {
        'bootstrap': ['jquery'],
        'select2': ['jquery'],
        'bootstrap-sortable': ['bootstrap'],
        'bootstrap-tabdrop': ['bootstrap'],
    },
    name: 'tabular',
    out: 'tabular-built.js'
});