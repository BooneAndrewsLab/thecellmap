define([
    'jquery',
    'underscore',
    'backbone',
    'module',
    
    'leap',
    'three',
    'gui',
    'stats',
    'controls',
], function($, _, Backbone, module) {
    var opts = module.config();
    var camera, scene, renderer, projector, cloud, control, light, gui;
    var vizdata = { nodes: {}, edges: {}, annotation: null };
    
    var stats;
    
    var State = function() {
        this.display = 'Network';
        this.selection = '';
        this.opacity = 0.35;
    };
    var state = new State();
    
    function init() {
        stats = new Stats();
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.top = '100px';
        $('#network-container').append( stats.domElement );
        
        scene = new THREE.Scene();
//        scene.fog = new THREE.Fog(0x222222, 2000, 5000);
        
        cloud = new THREE.Geometry();
        $.ajax({
            url: opts['urls']['layout'], 
            dataType : 'json', 
            async : false, 
            success: function(data) {
                _.each(data['nodes'], function(n) {
                    vizdata['nodes'][n.id] = n;
                    cloud.vertices.push(new THREE.Vector3(n.x, n.y, n.z));
                });
                _.each(data['edges'], function(e) { vizdata['edges'][e.id] = e; });
            },
        });
        cloud.computeBoundingSphere();
        cloud = cloud.boundingSphere;
        
        renderer = new THREE.WebGLRenderer({antialias: true});
        renderer.setSize($('#network-container').width(), $('#network-container').height());
        renderer.setClearColor(0x222222, 1);
        $('#network-container').append(renderer.domElement);
        
        camera = new THREE.PerspectiveCamera(25, $('#network-container').width()/$('#network-container').height(), 0.1, 100000);
        camera.position.z = 5000;
        
        initNodes();
        initEdges();
        
        control = new THREE.LeapCameraControls(camera, scene);
//      control.zoomMin = cloud.radius;
        control.rotateSpeed = 1;
        control.zoomSpeed = 3;
        
        gui = new dat.GUI();
        
        $('#network-container').append(gui.domElement);
        gui.domElement.id = 'gui';
        
        var folder = gui.addFolder('Network')
        folder.add(state, 'display');
        folder.add(state, 'opacity', 0.0, 1.0, 0.001);
        
        folder.open();
        
        window.addEventListener('resize', onWindowResize, false);
        render();
    };
    
    function initNodes() {
        var sprite = THREE.ImageUtils.loadTexture(opts['urls']['sprite']);
        var sphereMaterials = { 'default': new THREE.PointCloudMaterial({ color: 0xE3E3E3, size: 30, map: sprite, alphaTest: 0.5, transparent: true, name: 'default' }) };
        var sphereGeometries = { 'default': new THREE.Geometry() };
        
        $.ajax({
            url : opts['urls']['annotation'],
            dataType : 'json',
            async : false,
            success : function(data) {
                vizdata['annotation'] = data;
            },
        });
        
        var iter = 0;
        for (var i in vizdata['nodes']) {
            var n = vizdata['nodes'][i], annot = vizdata['annotation'], terms = annot['map'][n.orf];
            var transVector = new THREE.Vector3(n.x - cloud.center.x, n.y - cloud.center.y, n.z - cloud.center.z);
            var boundConstant = 0.5, color = 0xE3E3E3;
            if (transVector.length()/cloud.radius > boundConstant) {
                transVector.normalize().multiplyScalar(cloud.radius * boundConstant);
                n.x = transVector.x;
                n.y = transVector.y;
                n.z = transVector.z;
            } else {
                n.x = n.x - cloud.center.x;
                n.y = n.y - cloud.center.y;
                n.z = n.z - cloud.center.z;
            }
            
            if (terms && terms.length == 1) {
                var t = terms[0];
                if (!sphereGeometries[t]) sphereGeometries[t] = new THREE.Geometry();
                if (!sphereMaterials[t]) sphereMaterials[t] = new THREE.PointCloudMaterial({ 
                    color: parseInt('0x' + annot['terms'][t].color), size: 30, map: sprite, alphaTest: 0.5, transparent: true,
                });
                sphereGeometries[t].vertices.push(new THREE.Vector3(n.x, n.y, n.z));
            } else {
                sphereGeometries['default'].vertices.push(new THREE.Vector3(n.x, n.y, n.z));
            }
            
            iter++;
        }
        
        for (t in sphereGeometries) {
            var term = new THREE.PointCloud(sphereGeometries[t], sphereMaterials[t]);
            term.name = t;
            scene.add(term);
            
            if (t != 'default') {
                var clusters = createClusters(sphereGeometries[t].vertices);
                var regionGeometry = new THREE.Geometry();
                var regionMaterial = new THREE.MeshBasicMaterial({ color: sphereMaterials[t].color, visible: false, });
                for (var i = 0; i < clusters.length; i++) {
                    var clusterGeometry = new THREE.Geometry();
                    clusterGeometry.vertices = clusters[i];
                    clusterGeometry.computeBoundingSphere();
                    var boundingSphere = clusterGeometry.boundingSphere;
                    clusterGeometry = new THREE.SphereGeometry(boundingSphere.radius, 16, 16);
                    
                    var wireframe = new THREE.Mesh(clusterGeometry, regionMaterial);
                    wireframe.position.x = boundingSphere.center.x;
                    wireframe.position.y = boundingSphere.center.y;
                    wireframe.position.z = boundingSphere.center.z;
                    wireframe.updateMatrix();
                    
                    regionGeometry.merge(wireframe.geometry, wireframe.matrix)
                }
                
                var region = new THREE.Mesh(regionGeometry, regionMaterial);
                region.name = t;
                scene.add(region);
            }
        }
    }
    
    function initEdges() {
        var lineMaterials = { 'default': new THREE.LineBasicMaterial({ color: 0xE3E3E3, linewidth : 0.25, opacity: 0.3, transparent: true, }) };
        var lineGeometries = { 'default': new THREE.Geometry() };
        var iter = 0;
        for (var i in vizdata['edges']) {
            var e = vizdata['edges'][iter], nodes = vizdata['nodes'], annot = vizdata['annotation'];
            var source = nodes[e['s']], target = nodes[e['t']]
            
            if (source && target) {
                var sterm = annot['map'][source.orf], tterm = annot['map'][target.orf], intersect;
                
                if (sterm && tterm) {
                    var intersect = sterm.filter(function(n) {
                        return tterm.indexOf(n) != -1
                    });
                    
                    if (intersect.length == 1 && sterm.length == 1 && tterm.length == 1) {
                        if (!lineGeometries[intersect[0]]) lineGeometries[intersect[0]] = new THREE.Geometry();
                        if (!lineMaterials[intersect[0]]) lineMaterials[intersect[0]] = new THREE.LineBasicMaterial({
                            color: parseInt('0x' + annot['terms'][intersect[0]]['color']), linewidth: 0.25, opacity: 0.3, transparent: true,
                        });
                        
                        var s = new THREE.Vector3(source.x, source.y, source.z), t = new THREE.Vector3(target.x, target.y, target.z);
                        lineGeometries[intersect[0]].vertices.push(s);
                        lineGeometries[intersect[0]].vertices.push(t);
                    }
                } else {
                    lineGeometries['default'].vertices.push(new THREE.Vector3(source.x, source.y, source.z));
                    lineGeometries['default'].vertices.push(new THREE.Vector3(target.x, target.y, target.z));
                }
            }
            
            iter++;
        }
        
        for (t in lineGeometries) {
            var term = new THREE.Line(lineGeometries[t], lineMaterials[t], THREE.LinePieces);
            term.name = t;
            scene.add(term);
        }
    }
    
    function initAnnotation(term) {
        for (var i = scene.children.length - 1; i >= 0; i--) {
            scene.remove(scene.children[i]);
        }
        
        var nodes = vizdata['nodes'], annot = vizdata['annotation'], network = [];
        var tmCloud = new THREE.Geometry();
        var sphereGeometry = new THREE.SphereGeometry( 5, 32, 32 );
        var sphereMaterial = new THREE.MeshLambertMaterial({ color: parseInt('0x' + annot['terms'][term]['color']) });
        for (var i in nodes) {
            var n = nodes[i], terms = annot['map'][n.orf];
            if ($.inArray(n.id, terms) != -1) {
                tmCloud.vertices.push(new THREE.Vector3(n.x, n.y, n.z));
            }
        }
        tmCloud.computeBoundingSphere();
        tmCloud = tmCloud.boundingSphere;
        
        for (var i in nodes) {
            var n = nodes[i], terms = vizdata['annotation']['map'][n.orf];
            if (terms && terms.indexOf(parseInt(term)) != -1) {
                var sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
                n.x = n.x - tmCloud.center.x;
                n.y = n.y - tmCloud.center.y;
                n.z = n.z - tmCloud.center.z;
                sphere.position.set(n.x, n.y, n.z);
                scene.add(sphere);
                network.push(n.id);
            }
        }
        
        var lineMaterial = new THREE.LineBasicMaterial({ color: parseInt('0x' + annot['terms'][term]['color']), linewidth : 0.25, opacity: 0.3, transparent: true, });
        for (var i in vizdata['edges']) {
            var e = vizdata['edges'][i], s = nodes[e['s']], t = nodes[e['t']];
            if (s && t) {
                if ($.inArray(s.id, network) != -1 && $.inArray(t.id, network) != -1) {
                    var lineGeometry = new THREE.Geometry();
                    lineGeometry.vertices.push(new THREE.Vector3(s.x, s.y, s.z));
                    lineGeometry.vertices.push(new THREE.Vector3(t.x, t.y, t.z));
                    var line = new THREE.Line(lineGeometry, lineMaterial);
                    scene.add(line);
                }
            }
        }
        
        light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(camera.position.x, camera.position.y, camera.position.z);
        scene.add(light);
    }
    
    function createClusters(data) {
        var maxDist = 90, minSize = 4;
        var clusters = [], points = [];
        
        for (var i in data) {
            points.push({
                'id' : i,
                'p' : data[i],
                'visted' : false,
                'noise': false,
                'clustered': false,
            });
        }
        
        for (var i in points) {
            var pt = points[i];
            if (pt.visted) continue;
            pt.visted = true;
            
            var neighborPts = findRegion(pt, points, maxDist);
            if (neighborPts.length < minSize) {
                pt.noise = true;
            } else {
                var c = [];
                c.push(pt);
                pt.clustered = true;
                for (var j = 0; j < neighborPts.length; j++) {
                    var npt = neighborPts[j];
                    if (!npt.visted) {
                        npt.visted = true;
                        var nNeighborPts = findRegion(npt, points, maxDist);
                        
                        if (nNeighborPts.length >= minSize) {
                            var diff = _.uniq(_.difference(neighborPts, nNeighborPts));
                            if (_.isArray(diff)) {
                                for (var k in diff) {
                                    neighborPts.push(diff[k]);
                                }
                            } else {
                                neighborPts.push(diff);
                            }
                        }
                    }
                    
                    if (!npt.clustered) {
                        c.push(npt);
                        npt.clustered = true;
                    }
                }
                clusters.push(c);
            }
        }
        
        var result = [];
        _.each(clusters, function(c) {
            var r = [];
            _.each(c, function(p) {
                r.push(p['p']);
            });
            result.push(r)
        });
        
        return result;
    }
    
    function findRegion(center, points, dist) {
        return _.filter(points, function(point) {
            return point['p'].distanceTo(center['p']) < dist;
        });
    }
    
    function render() {
        renderer.render(scene, camera);
    };

    function onWindowResize() {
        camera.aspect = $('#network-container').width()/$('#network-container').height();
        camera.updateProjectionMatrix();
        renderer.setSize($('#network-container').width(), $('#network-container').height());
        render();
    };

    function start() {
        init();
        window.controller = Leap.loop({enableGestures: true}, function(frame) {
            if (!!control.updateTerm) {
                initAnnotation(control.updateTerm);
                control.state = 'annotation';
                control.updateTerm = null;
            } else {
                control.update(frame);
            }
            
            if (light != null) {
                light.position.set(camera.position.x, camera.position.y, camera.position.z);
            }
            
            render();
            stats.update();
        });
    };
    
    return {
        start: start,
    };
});