({
    paths: {
        'jquery': 'libs/jquery-2.1.4.min',
        'backbone': 'libs/backbone-min',
        'underscore': 'libs/underscore-min',
        
        'three': 'libs/three.min',
        'stats': 'libs/stats.min',
        
        'boone3D': 'boone3D/boone3D',
        'build': 'boone3D/buildGraph',
        
        'mouse': 'boone3D/mouseControls',
        'utils': 'boone3D/utils',
        
        //'leapControls': 'boone3D/leapControls',
    },
    shim: {
        'backbone' : ['jquery', 'underscore'],
        'stats' : ['three'],
        'mouse' : ['three'],
    },
    name: 'threeD',
    out: 'threeD-built.js',
});
