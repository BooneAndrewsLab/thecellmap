({
    paths: {
        'jquery': 'libs/jquery-2.1.4.min',
        'backbone': 'libs/backbone-min',
        'underscore': 'libs/underscore-min',
        'bootstrap': 'libs/bootstrap.min',
        
        'three': '//cdnjs.cloudflare.com/ajax/libs/three.js/r71/three',
        'noUISlider': 'libs/nouislider-8.0.1.min',
        'sigma': 'libs/isigma',
        
        'mouse': 'boone3D/mouseControls',
        
        'scrollbar': 'libs/jquery.mCustomScrollbar.concat.min',
        
        'sigma.forcelayout': 'libs/plugins/sigma.fa2',
        'sigma.highlight': 'libs/plugins/sigma.highlight',
        'sigma.move': 'libs/plugins/sigma.move',
        'sigma.rotate': 'libs/plugins/sigma.rotate',
        
        'ccbrGraph': 'app/ccbrGraph',
    },
    shim: {
        'backbone': ['underscore', 'jquery'],
        'bootstrap': ['jquery'],
        
        'noUISlider': ['jquery'],
        'scrollbar': ['jquery'],
        
        'mouse' : ['three'],
        
        'sigma.forcelayout': ['sigma'],
        'sigma.highlight': ['sigma'],
        'sigma.move': ['sigma'],
        'sigma.rotate': ['sigma'],
    },
    name: 'collaboration',
    out: 'collaboration-built.js',
});
