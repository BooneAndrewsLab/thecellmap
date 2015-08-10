require.config({
    paths: {
        'jquery': 'libs/jquery-2.1.4.min',
        'backbone': 'libs/backbone-min',
        'underscore': 'libs/underscore-min',
        'bootstrap': 'libs/bootstrap.min',
        
        'noUISlider': 'libs/nouislider-8.0.1.min',
        'sigma': 'libs/isigma',
        
        'packer': 'libs/packer.growing',
        
        'sigma.forcelayout': 'libs/plugins/sigma.fa2',
        'sigma.move': 'libs/plugins/sigma.move',
        'sigma.rotate': 'libs/plugins/sigma.rotate',
        
        'ccbrGraph': 'app/ccbrGraph',
    },
    shim: {
        'backbone': ['underscore', 'jquery'],
        'bootstrap': ['jquery'],
        
        'noUISlider': ['jquery'],
        
        'sigma.forcelayout': ['sigma'],
        'sigma.move': ['sigma'],
        'sigma.rotate': ['sigma'],
    },
});

require(['ccbrGraph'], function(ccbrGraph) {
    $(window).resize(function() {
        $('.sigma-parent').css('height', $(window).height() - $('.navbar').height() - 30);
    }).resize();
    ccbrGraph.init();
});