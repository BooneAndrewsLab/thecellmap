({
    paths: {
        'jquery': 'libs/jquery-2.1.4.min',
        'bootstrap': 'libs/bootstrap.min',
        'bootstrap-sortable': 'libs/bootstrap-sortable',
        'bootstrap-tabdrop': 'libs/bootstrap-tabdrop',
        'select2': 'libs/select2',
        'mmenu': 'libs/jquery.mmenu.all.min',
        'hammer':'libs/hammer.min',
        'spinner': 'libs/spin',
        'ladda': 'libs/ladda',
        'spin': 'libs/ladda-spin',
        'filedownload': 'libs/jquery.fileDownload'
    },
    shim: {
        'bootstrap': ['jquery'],
        'select2': ['jquery'],
        'bootstrap-sortable': ['bootstrap'],
        'bootstrap-tabdrop': ['bootstrap'],
        'mmenu':['jquery'],
        'ladda':['spin'],
        'filedownload': ['jquery'],
    },
    name: 'tabular',
    out: 'tabular-built.js'
});