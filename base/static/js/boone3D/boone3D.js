define([
    'jquery',
    'underscore',
    'backbone',
    
    'build',
    
    'utils',
    'three',
    'stats',
    'mouse',
], function($, _, Backbone, Build, Utils) {
    var DEFAULTS = {
        rootElement: $('#network-container'),
        
        nodeOpacity: 0.5,
        
        edgeOpacity: 0.3,
        edgeWidth: 0.25,
        
        zoomMin: 25,
        zoomMax: 10000,
    }
    
    window.vizdata = { nodes: {}, edges: {}, annotations: {} };
    $.extend(window.opts, DEFAULTS);
    window.three = {};
    window.state = {
        annotation: 'SAFE',
    };
    
    var init = function () {
        three['scene'] = new THREE.Scene();
        three['ui'] = new THREE.Scene();
        
        three['mouse'] = new THREE.Vector2();
        three['raycaster'] = new THREE.Raycaster();
        three['selected'] = null;
        three['cloud'] = new THREE.Geometry();
        
        var windowWidth = opts['rootElement'].width(), windowHeight = opts['rootElement'].height();
        three['renderer'] = new THREE.WebGLRenderer({antialias: true, alpha: true});
        three['renderer'].setSize(windowWidth, windowHeight);
        three['renderer'].setClearColor(0x222222, 1);
        opts['rootElement'].append(three['renderer'].domElement);
        
        three['uiRender'] = new THREE.WebGLRenderer({antialias: true, alpha: true});
        three['uiRender'].setSize(windowWidth, windowHeight);
        three['uiRender'].setClearColor(0x222222, 0);
        opts['rootElement'].append(three['uiRender'].domElement);
        three['uiRender'].domElement.id = 'scene-ui';
        
        three['camera'] = new THREE.PerspectiveCamera(opts['zoomMin'], windowWidth/windowHeight, 0.1, opts['zoomMax']);
        three['uiCamera'] = new THREE.PerspectiveCamera(opts['zoomMin'], windowWidth/windowHeight, 0.1, opts['zoomMax']);
        
        three['control'] = new THREE.TrackballControls(three['camera']);
        three['control'].damping = 0.2;
        three['control'].addEventListener('change', render);
        
        three['stats'] = new Stats();
        opts['rootElement'].append(three['stats'].domElement);
        
        loadSprites('sphereSprite', opts['urls']['node']);
        for (var png in opts['ui']) {
            loadSprites(png + 'Sprite', opts['ui'][png]);
        }
        
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
//                TODO: FIX THE DISTANCE
                three['uiCamera'].position.setZ(2880);
            },
        });
        
        for (var annot in opts['annotations']) {
            var annotation = opts['annotations'][annot];
            $.ajax({
                url : annotation['url'],
                dataType : 'json',
                success : function(data) {
                    vizdata['annotations'][annotation['name']] = data;
                    
                    if (annot == opts['annotations'].length - 1) {
                        Build.init();
//                        LeapControls.init();
                    }
                },
            });
        }
        
        document.addEventListener('mousemove', onDocumentMouseMove, false);
        document.addEventListener('click', checkClick, false)
        window.addEventListener('resize', onWindowResize, false);
        render();
    };
    
    var loadSprites = function(name, url) {
        var loader = new THREE.TextureLoader();
        loader.load(url, function(image) {
            three[name] = image;
        });
    }
    
    var animate = function() {
        requestAnimationFrame(animate);
        render();
        three['stats'].update();
        three['control'].update();
        checkHover();
        
        if (!!three['light']) three['light'].position.set(three['camera'].position.x, three['camera'].position.y, three['camera'].position.z);
    }
    
    var render = function() {
        three['renderer'].render(three['scene'], three['camera']);
        three['uiRender'].render(three['ui'], three['uiCamera']);
    };
    
    var onDocumentMouseMove = function(e) {
        e.preventDefault();
        var x = event.offsetX == undefined ? event.layerX : event.offsetX;
        var y = event.offsetY == undefined ? event.layerY : event.offsetY;
        three['mouse'].x = (x/opts['rootElement'].width()) * 2 - 1;
        three['mouse'].y = -(y/opts['rootElement'].height()) * 2 + 1;
    }
    
    var onWindowResize = function() {
        var windowWidth = opts['rootElement'].width(), windowHeight = opts['rootElement'].height();
        three['camera'].aspect = windowWidth/windowHeight;
        three['camera'].updateProjectionMatrix();
        three['uiCamera'].aspect = windowWidth/windowHeight;
        three['uiCamera'].updateProjectionMatrix();
        three['renderer'].setSize(windowWidth, windowHeight);
        three['uiRender'].setSize(windowWidth, windowHeight)
        render();
    };
    
    var runFrame = function() {
        init();
        animate();
        
//        window.controller = Leap.loop({enableGestures: true}, function(frame) {
//            if (!state['isInitializing']) {
//                render();
//                
//                LeapControls.update(frame);
//                three['stats'].update();
//            }
//        });
    };
    
    var checkHover = function() {
//        if (state['showTerms']) {
//            three['raycaster'].setFromCamera(three['mouse'], three['camera']);
//            
//            var intersects = three['raycaster'].intersectObjects(three['scene'].children);
//            if (intersects.length > 0 && intersects[0].object.name.length > 0) {
//                Build.buildLabel(Utils.stripLetters(intersects[0].object.name));
//            } else {
//                Utils.clearLabels();
//            }
//        }
        
        three['raycaster'].setFromCamera(three['mouse'], three['uiCamera']);
        
        var intersects = three['raycaster'].intersectObjects(Utils.getSceneObjects(three['ui'], 'legend'));
        if (intersects.length > 0 && intersects[0].object.name.length > 0) {
            opts['rootElement'].css('cursor', 'pointer');
            if (state['selected'] != intersects[0].object) {
                Utils.resetScene();
                
                state['selected'] = intersects[0].object;
                var termId = Utils.stripLetters(state['selected'].name);
                intersects[0].object.material.color.setHex(parseInt('0x' + vizdata['annotations'][state['annotation']]['terms'][termId]['color']));
                
                var edges = three['scene'].getObjectByName('edges' + termId);
                if (!!edges) edges.material.opacity = 1;
            }
        } else {
            opts['rootElement'].css('cursor', 'default');
            state['selected'] = null;
            Utils.resetScene();
        }
    }
    
    var checkClick = function() {
        if (state['showTerms']) {
            three['raycaster'].setFromCamera(three['mouse'], three['camera']);
            
            var intersects = three['raycaster'].intersectObjects(Utils.getSceneObjects(three['scene'], 'node'));
            if (intersects.length > 0 && intersects[0].object.name.length > 0) {
                cleanUIScene();
                Build.buildNodeUI(Utils.stripLetters(intersects[0].object.name));
            }
        }
        
        three['raycaster'].setFromCamera(three['mouse'], three['uiCamera']);
        var intersects = three['raycaster'].intersectObjects(Utils.getSceneObjects(three['ui'], 'legend'));
        
        if (intersects.length > 0 && intersects[0].object.name.length > 0) {
            var termId = Utils.stripLetters(intersects[0].object.name);
            state['showTerms'] = true;
            Build.buildTerm(termId);
        }
    }
    
    var cleanUIScene = function() {
        three['ui'].remove(three['ui'].getObjectByName('nodeUI'));
        Utils.clearLabels
    }
    
    return {
        runFrame: runFrame,
    };
});