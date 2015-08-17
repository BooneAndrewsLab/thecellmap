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
        var cursorMaterial = new THREE.MeshBasicMaterial({ color: 0xE3E3E3, visible: false, });
        three['cursor'] = new THREE.Mesh(cursorGeometry, cursorMaterial);
        three['cursor'].position.set(0, 0, 0);
        three['ui'].add(three['cursor']);
    }
    
    var buildSelect = function(term) {
        if (!!term) {
            var loader = new THREE.ImageLoader(), w, h;
            
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
                    color: 0xE3E3E3, map: texture, useScreenCoordinates: false
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
        
        three['termCloud'] = new THREE.Geometry();
        for (var i in nodes) {
            var n = nodes[i], terms = annot['map'][n.orf];
            if (terms && terms.indexOf(parseInt(term)) != -1) {
                three['termCloud'].vertices.push(new THREE.Vector3(n.x, n.y, n.z));
            }
        }
        three['termCloud'].computeBoundingSphere();
        three['termCloud'] = three['termCloud'].boundingSphere;
        
        var sphereGeometry = new THREE.SphereGeometry(5, 32, 32);
        var sphereMaterial = new THREE.MeshLambertMaterial({ color: parseInt('0x' + annot['terms'][term]['color']) });
        
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        ctx.font = '30px Arial';
        ctx.fillStyle = "E3E3E3";
        
        for (var i in nodes) {
            var n = nodes[i], terms = vizdata['annotation']['map'][n.orf];
            if (terms && terms.indexOf(parseInt(term)) != -1) {
                var sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
                sphere.type = 'Node';
                n.x = n.x - three['termCloud'].center.x;
                n.y = n.y - three['termCloud'].center.y;
                n.z = n.z - three['termCloud'].center.z;
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
        
        three['camera'].position.set(0, 0, three['termCloud']['radius'] * 4);
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
        buildEdges();
    }
    
    return {
        init: init,
        buildNodes: buildNodes,
        buildEdges: buildEdges,
        buildSelect: buildSelect,
        extractTerm: extractTerm,
    };
});