require.config({
    paths: {
        'jquery': 'libs/jquery-2.1.4.min',
        'bootstrap': 'libs/bootstrap.min',
        'select2': 'libs/select2',
    },
    shim: {
        'bootstrap': ['jquery'],
        'select2': ['jquery'],
    }
});

require(['jquery', 'select2', 'bootstrap'], function($) {
    $('#action').select2({
        placeholder: 'Action', 
        minimumResultsForSearch: -1,
        width: '300px'
    });
    
    $('#main-checkbox').change(function() {
        $('.body-checkbox').prop('checked', this.checked);
    });
    
    $('#action').change(function() {
        $('#sumbit-button').removeClass('hidden');
    });
});