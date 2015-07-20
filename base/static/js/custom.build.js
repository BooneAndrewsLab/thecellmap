({
    paths: {
        'jquery': 'libs/jquery-2.1.4.min',
        'backbone': 'libs/backbone-min',
        'underscore': 'libs/underscore-min',
        'bootstrap': 'libs/bootstrap.min',
        'text': 'libs/text',
        
        'jquery.cookie': 'libs/js.cookie',
        'underscore.strings': 'libs/underscore.string.min',
        
        'jszip': '//cdnjs.cloudflare.com/ajax/libs/jszip/2.5.0/jszip.min',
        'xls': '//cdnjs.cloudflare.com/ajax/libs/xls/0.7.5/xls.min',
        'xlsx': '//cdnjs.cloudflare.com/ajax/libs/xlsx/0.8.0/xlsx',
        
        'settingsModel': "{% static 'js/models/settingsModel' %}",
        
        'customGraph': "{% static 'js/app/customGraph' %}",
        'fileReader': "{% static 'js/libs/bootstrap.file-input' %}",
        'jquery.parser': "{% static 'js/libs/jquery.parse' %}",
        'load': "{% static 'js/app/load' %}",
        'select2': "{% static 'js/libs/select2' %}",
        'settings': "{% static 'js/app/settings' %}",
        'wizard': "{% static 'js/libs/bootstrap-wizard' %}",
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
        'xlsx': ['jszip', 'load'],
    }
    name: 'custom',
    out: 'custom-build.js',
});
