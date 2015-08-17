define([
    'jquery',
    'underscore',
    'backbone',
    
    'build',
    'leapControls',
    'module',
    
    'leap',
    'three',
    
    'stats',
], function($, _, Backbone, Build, LeapControls, module) {
    var DEFAULTS = {
        rootElement: $('#network-container'),
        
        uiScale: 0.8,
        
        nodeOpacity: 0.5,
        edgeOpacity: 0.3,
        edgeWidth: 0.25,
        
        rotateSpeed: 1.0,
        rotateHands: 1,
        rotateFingers: [2, 3], 
        rotateRightHanded: true,
        rotateHandPosition: true,
        rotateStabilized: true,
        rotateMin: 0,
        rotateMax: Math.PI,
        
        zoomSpeed: 1.0,
        zoomHands: 2,
        zoomFingers: [6, 12],
        zoomRightHanded: true,
        zoomHandPosition: true,
        zoomStabilized: true,
        zoomMin: 25,
        zoomMax: 10000,
        
        selectHands: 1,
        selectFingers: 1,
        selectRightHanded: true,
        selectHandPosition: false,
        selectStabilized: true,
        
        timeGesture:      600000,
        timeSelect:       700000,
        timeUIShow:      1400000,
        timeUIHide:       900000,
        timeUIExtract:   2000000,
    }
    
    window.vizdata = { nodes: {}, edges: {}, annotation: null };
    window.opts = $.extend({}, DEFAULTS, module.config());
    window.three = {};
    window.state = {
        'isInitializing': true,
        'showUI': false,
        'showTerm': false,
        'uiCoord' : {},
    };
    
    var init = function () {
        var windowWidth = opts['rootElement'].width(), windowHeight = opts['rootElement'].height();
        
        three['scene'] = new THREE.Scene();
        three['ui'] = new THREE.Scene();
        three['cloud'] = new THREE.Geometry();
        
        three['renderer'] = new THREE.WebGLRenderer({antialias: true, alpha: true});
        three['renderer'].setSize(windowWidth, windowHeight);
        three['renderer'].setClearColor(0x222222, 1);
        opts['rootElement'].append(three['renderer'].domElement);
        
        three['uiRender'] = new THREE.WebGLRenderer({antialias: true, alpha: true});
        three['uiRender'].setSize(windowWidth, windowHeight);
        three['uiRender'].setClearColor(0x222222, 0);
        opts['rootElement'].append(three['uiRender'].domElement);
        three['uiRender'].domElement.id = 'scene-gui';
        
        three['camera'] = new THREE.PerspectiveCamera(opts['zoomMin'], windowWidth/windowHeight, 0.1, opts['zoomMax']);
        three['uiCamera'] = new THREE.PerspectiveCamera(opts['zoomMin'], windowWidth/windowHeight, 0.1, opts['zoomMax']);
        
        three['stats'] = new Stats();
        opts['rootElement'].append(three['stats'].domElement);
        
        var loader = new THREE.TextureLoader();
        loader.load(opts['urls']['node'], function(image) {
            three['sphereSprite'] = image;
        });
        
        $.ajax({
            url: opts['urls']['layout'], 
            dataType : 'json', 
            success: function(data) {
                _.each(data['nodes'], function(n) {
                    vizdata['nodes'][n.id] = n;
                    three['cloud']['vertices'].push(new THREE.Vector3(n.x, n.y, n.z));
                });
                _.each(data['edges'], function(e) { vizdata['edges'][e.id] = e; });
                
                three['cloud'].computeBoundingSphere();
                three['cloud'] = three['cloud'].boundingSphere;
                
                three['camera'].position.setZ(Math.PI * three['cloud'].radius);
                three['uiCamera'].position.setZ(2880)
            },
        });
        
        $.ajax({
            url : opts['urls']['annotation'],
            dataType : 'json',
            success : function(data) {
                vizdata['annotation'] = data;
                Build.init();
                LeapControls.init();
            },
        });
        
        window.addEventListener('resize', onWindowResize, false);
        render();
    };
    
    var render = function() {
        three['renderer'].render(three['scene'], three['camera']);
        three['uiRender'].render(three['ui'], three['uiCamera']);
        if (!!three['light']) three['light'].position.set(three['camera'].position.x, three['camera'].position.y, three['camera'].position.z);
    };
    
    var onWindowResize = function() {
        var windowWidth = opts['rootElement'].width(), windowHeight = opts['rootElement'].height();
        
        three['camera'].aspect = windowWidth/windowHeight;
        three['camera'].updateProjectionMatrix();
        three['renderer'].setSize(windowWidth, windowHeight);
        three['uiRender'].setSize(windowWidth, windowHeight)
        render();
    };
    
    var runFrame = function() {
        init();
        window.controller = Leap.loop({enableGestures: true}, function(frame) {
            if (!state['isInitializing']) {
                render();
                
                LeapControls.update(frame);
                three['stats'].update();
            }
        });
    };
    
    return {
        runFrame: runFrame,
    };
});