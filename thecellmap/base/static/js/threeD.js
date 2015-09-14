require.config({
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
    }
});

require(['boone3D'], function(boone3D) {
    $(window).resize(function() {
        $('#network-container').css('height', $(window).height() - $('.navbar').height() - 30);
        $('#network-container').css('width', $(window).width() - 30);
    }).resize();
    //     $.cookie('csrftoken', $("{% csrf_token %}").attr('value'));
    boone3D.runFrame();
});