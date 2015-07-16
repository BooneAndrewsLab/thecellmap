define([
    'jquery',
    'underscore',
    'backbone',
    
    'utils',
    
    'leap',
    'three',
], function($, _, Backbone, Utils) {
    var buildUI = function() {
        var cursorGeometry = new THREE.SphereGeometry(7, 32, 32);
        var cursorMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, visible: false, });
        three['cursor'] = new THREE.Mesh(cursorGeometry, cursorMaterial);
        three['cursor'].position.set(0, 0, 0);
        three['ui'].add(three['cursor']);
    }
    
    var buildNodes = function(stuff) {
        var sprite = three['sphereSprite'];
        
        var material = new THREE.PointCloudMaterial({ 
            map: sprite, size: 3000, alphaTest: opts['nodeOpacity'], transparent: true,
        });
        var sphereGeometries = new THREE.Geometry();
        sphereGeometries.vertices.push(new THREE.Vector3(0,0,0))
        
        var term = new THREE.PointCloud(sphereGeometries, material);
        three['scene'].add(term);
        
        
//        
//        var sphereGeometries = { 'default': new THREE.Geometry() };
//        console.log(sprite)
//        for (var i in vizdata['nodes']) {
//            var node = vizdata['nodes'][i], annot = vizdata['annotation'], terms = annot['map'][node.orf];
//            var coord = new THREE.Vector3(node.x - three['cloud'].center.x, node.y - three['cloud'].center.y, node.z - three['cloud'].center.z);
//            var boundConstant = 0.5;
//            if (coord.length()/three['cloud'].radius > boundConstant) {
//                coord.normalize().multiplyScalar(three['cloud'].radius * boundConstant);
//            }
//            
//            node.x = coord.x;
//            node.y = coord.y;
//            node.z = coord.z;
//            
//            if (terms && terms.length == 1) {
//                if (!sphereGeometries[terms[0]]) sphereGeometries[terms[0]] = new THREE.Geometry();
//                sphereGeometries[terms[0]].vertices.push(coord);
//            } else {
//                sphereGeometries['default'].vertices.push(coord);
//            }
//        }
//        three['cloud'].center.set(0, 0, 0);
//        for (var t in sphereGeometries) {
//            var color = (t == 'default') ? 0xE3E3E3 : parseInt('0x' + annot['terms'][t]['color']);
//            var material = new THREE.PointCloudMaterial({ 
//                map: sprite, size: 30, color: color, alphaTest: opts['nodeOpacity'], transparent: true,
//            });
//            var term = new THREE.PointCloud(sphereGeometries[t], material);
//            term.name = 'nodes' + t;
//            three['scene'].add(term);
//            
//            if (t != 'default') {
//                var clusters = createClusters(sphereGeometries[t].vertices);
//                var regionGeometry = new THREE.Geometry();
//                var regionMaterial = new THREE.MeshBasicMaterial({ /*color: color, */visible: false, });
//                
//                var clusterGeometry = new THREE.Geometry();
//                for (var i in clusters) {
//                    clusterGeometry.vertices = clusters[i];
//                    clusterGeometry.computeBoundingSphere();
//                    var area = new THREE.Mesh(new THREE.SphereGeometry(clusterGeometry.boundingSphere.radius, 16, 16), regionMaterial);
//                    area.position.set(clusterGeometry.boundingSphere.center.x, clusterGeometry.boundingSphere.center.y, clusterGeometry.boundingSphere.center.z);
//                    area.updateMatrix();
//                    regionGeometry.merge(area.geometry, area.matrix)
//                }
//                
//                var region = new THREE.Mesh(regionGeometry, regionMaterial);
//                region.name = 'regions' + t;
//                three['scene'].add(region);
//            }
//        }
        
    }
    
    var buildEdges = function() {
        var lineGeometries = { 'default': new THREE.Geometry() };
        for (var i in vizdata['edges']) {
            var e = vizdata['edges'][i], nodes = vizdata['nodes'], annot = vizdata['annotation'];
            var source = nodes[e['s']], target = nodes[e['t']]
            
            if (source && target) {
                var sterm = annot['map'][source.orf], tterm = annot['map'][target.orf], intersect;
                if (sterm && tterm) {
                    var intersect = sterm.filter(function(n) { return tterm.indexOf(n) != -1 });
                    if (intersect.length == 1 && sterm.length == 1 && tterm.length == 1) {
                        if (!lineGeometries[intersect[0]]) lineGeometries[intersect[0]] = new THREE.Geometry();
                        lineGeometries[intersect[0]].vertices.push(new THREE.Vector3(source.x, source.y, source.z));
                        lineGeometries[intersect[0]].vertices.push(new THREE.Vector3(target.x, target.y, target.z));
                    }
                } else {
                    lineGeometries['default'].vertices.push(new THREE.Vector3(source.x, source.y, source.z));
                    lineGeometries['default'].vertices.push(new THREE.Vector3(target.x, target.y, target.z));
                }
            }
        }
        
        for (t in lineGeometries) {
            var color = (t == 'default') ? 0xE3E3E3 : parseInt('0x' + annot['terms'][t]['color']);
            var term = new THREE.Line(lineGeometries[t], new THREE.LineBasicMaterial({
                    color: color, linewidth: opts['edgeWidth'], opacity: opts['edgeOpacity'], transparent: true,
                }), THREE.LinePieces);
            term.name = 'edges' + t;
            three['scene'].add(term);
        }
    }
    
    var buildSelect = function(term) {
        if (!!term) {
            var loader = new THREE.ImageLoader(), w, h;
//            var color = vizdata['annotation']['terms'][term]['color'];
            var color = 'E3E3E3';
            
            loader.load(opts['ui']['root'], function(image) {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                w = canvas.width = image.width;
                h = canvas.height = image.height;
                
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle'; 
                ctx.font = 'bold 30px Palatino Linotype';
                ctx.drawImage(image, 0, 0);
                
                var name = vizdata['annotation']['terms'][term]['name'].toUpperCase().split(' '), line = '';
                var numLines = Math.floor(name.length / 2), wordHeight = 25, j = 0;
                var initHeight = (name.length % 2 == 0) ? h/2 - (numLines - 1 / 2) * wordHeight : h/2 - (numLines - 1) * wordHeight;
                for (var i = 0; i < name.length; i++) {
                    var test = line + name[i] + ' ';
                    if (test.length > 17 && i > 0) {
                        ctx.fillText(line, w/2, initHeight + j++ * wordHeight);
                        line = name[i] + ' ';
                    } else {
                        line = test;
                    }
                }
                ctx.fillText(line, w/2, initHeight + j++ * wordHeight);
                
                var texture = new THREE.Texture(canvas);
                texture.needsUpdate = true;
                var sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                    color: parseInt('0x' + color), map: texture, useScreenCoordinates: false
                }));
                sprite.position.set(three['cursor'].position.x, three['cursor'].position.y, 0);
                sprite.scale.set(w * opts['uiScale'], h * opts['uiScale'], 1);
                sprite.name = 'termMenu';
                three['ui'].add(sprite);
                state['uiCoord'] = { 'x': three['cursor'].position.x, 'y': three['cursor'].position.y };
            });
            
            loader.load(opts['ui']['extract'], function(image) {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                canvas.width = image.width;
                canvas.height = image.height;
                
                ctx.drawImage(image, 0, 0);
                var texture = new THREE.Texture(canvas);
                texture.needsUpdate = true;
                var sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                    color: parseInt('0x' + color), map: texture, useScreenCoordinates: false, transparent: true, opacity: 0, 
                }));
                sprite.position.set(three['cursor'].position.x + 2/3 * w, three['cursor'].position.y - 1/2 * h, 0);
                sprite.scale.set(canvas.width * opts['uiScale'], canvas.height * opts['uiScale'], 1);
                sprite.name = 'extract';
                sprite.visible = false;
                three['ui'].add(sprite);
                state['uiCoord'] = { 'x': three['cursor'].position.x, 'y': three['cursor'].position.y };
            });
        }
    }
    
    function extractTerm(term) {
        var nodes = vizdata['nodes'], annot = vizdata['annotation'], termNodes = [];
        Utils.clearScene();
        Utils.clearUI();
        
        var termCloud = new THREE.Geometry();
        for (var i in nodes) {
            var n = nodes[i], terms = annot['map'][n.orf];
            if (terms && terms.indexOf(parseInt(term)) != -1) {
                termCloud.vertices.push(new THREE.Vector3(n.x, n.y, n.z));
            }
        }
        termCloud.computeBoundingSphere();
        termCloud = termCloud.boundingSphere;
        
        var sphereGeometry = new THREE.SphereGeometry(5, 32, 32);
        var sphereMaterial = new THREE.MeshLambertMaterial({ color: parseInt('0x' + annot['terms'][term]['color']) });
        
        for (var i in nodes) {
            var n = nodes[i], terms = vizdata['annotation']['map'][n.orf];
            if (terms && terms.indexOf(parseInt(term)) != -1) {
                var sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
                n.x = n.x - termCloud.center.x;
                n.y = n.y - termCloud.center.y;
                n.z = n.z - termCloud.center.z;
                sphere.position.set(n.x, n.y, n.z);
                three['scene'].add(sphere);
                termNodes.push(n.id);
            }
        }
        
        var lineMaterial = new THREE.LineBasicMaterial({ color: parseInt('0x' + annot['terms'][term]['color']), linewidth : 0.25, opacity: 0.3, transparent: true, });
        for (var i in vizdata['edges']) {
            var e = vizdata['edges'][i], s = nodes[e['s']], t = nodes[e['t']];
            if (s && t) {
                if ($.inArray(s.id, termNodes) != -1 && $.inArray(t.id, termNodes) != -1) {
                    var lineGeometry = new THREE.Geometry();
                    lineGeometry.vertices.push(new THREE.Vector3(s.x, s.y, s.z));
                    lineGeometry.vertices.push(new THREE.Vector3(t.x, t.y, t.z));
                    var line = new THREE.Line(lineGeometry, lineMaterial);
                    three['scene'].add(line);
                }
            }
        }
        
        three['light'] = new THREE.DirectionalLight(0xffffff, 1);
        three['scene'].add(three['light']);
    }
    
    var createClusters = function(data) {
        var maxDist = 90, minSize = 4;
        var clusters = [], points = [];
        for (var i in data) {
            points.push({ 'id' : i, 'p' : data[i], 'visted' : false, 'clustered': false, });
        }
        for (var i in points) {
            var pt = points[i];
            if (pt.visted) continue;
            pt.visted = true;
            
            var neighborPts = findRegion(pt, points, maxDist);
            if (neighborPts.length >= minSize) {
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
                                for (var k in diff) { neighborPts.push(diff[k]); }
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
            _.each(c, function(p) { r.push(p['p']); });
            result.push(r)
        });
        return result;
    }
    
    var findRegion = function(center, points, dist) {
        return _.filter(points, function(point) {
            return point['p'].distanceTo(center['p']) < dist;
        });
    }
    
    var init = function() {
        buildUI();
        buildNodes();
//        buildEdges();
    }
    
    return {
        init: init,
        buildNodes: buildNodes,
        buildEdges: buildEdges,
        buildSelect: buildSelect,
        extractTerm: extractTerm,
    };
});