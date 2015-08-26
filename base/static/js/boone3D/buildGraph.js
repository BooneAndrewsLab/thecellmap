define([
    'jquery',
    'underscore',
    'backbone',
    
    'utils',
    
    'three',
], function($, _, Backbone, Utils) {
    var buildNodes = function(stuff) {
        var sprite = three['sphereSprite'], sphereGeometries = { 'default': new THREE.Geometry() };
        var annotation = vizdata['annotations'][state['annotation']];
        var clusters = {};
        
        _.each(vizdata['nodes'], function(node) {
            var terms = annotation['map'][node.orf];
            var coord = new THREE.Vector3(node.x - three['cloud'].center.x, node.y - three['cloud'].center.y, node.z - three['cloud'].center.z);
            var boundConstant = 0.5;
            
            if (coord.length()/three['cloud'].radius > boundConstant) {
                coord.normalize().multiplyScalar(three['cloud'].radius * boundConstant);
            }
            
            node.x = coord.x;
            node.y = coord.y;
            node.z = coord.z;
            
            if (!!terms && terms.length == 1) {
                if (!sphereGeometries[terms[0]]) sphereGeometries[terms[0]] = new THREE.Geometry();
                sphereGeometries[terms[0]].vertices.push(coord);
            } else {
                sphereGeometries['default'].vertices.push(coord);
            }
        });
        
        three['cloud'].center.set(0, 0, 0);
        
        for (var t in sphereGeometries) {
            var color = (t == 'default') ? 0xFFFFFF : parseInt('0x' + annotation['terms'][t]['color']);
            var material = new THREE.PointCloudMaterial({
                map: sprite, size: 30, color: color, alphaTest: opts['nodeOpacity'], transparent: true,
            });
            var term = new THREE.PointCloud(sphereGeometries[t], material);
            term.name = 'nodes' + t;
            three['scene'].add(term);
            
            if (t == 'default') continue;
            
            var clusters = Utils.createClusters(sphereGeometries[t].vertices);
            var geometry = new THREE.Geometry();
            var material = new THREE.MeshBasicMaterial({ visible: false });
            
            _.each(clusters, function(vertices) {
                var cluster = new THREE.Geometry();
                cluster.vertices = vertices;
                cluster.computeBoundingSphere();
                
                var sphere = new THREE.Mesh(new THREE.SphereGeometry(cluster.boundingSphere.radius, 8, 8), material);
                sphere.position.set(cluster.boundingSphere.center.x, cluster.boundingSphere.center.y, cluster.boundingSphere.center.z);
                sphere.updateMatrix();
                geometry.merge(sphere.geometry, sphere.matrix);
            });
            
            var region = new THREE.Mesh(geometry, material);
            region.name = 'regions' + t;
            three['scene'].add(region);
        }
    }
    
    var buildEdges = function() {
        var lineGeometries = { 'default': new THREE.Geometry() };
        var nodes = vizdata['nodes'], annotation = vizdata['annotations'][state['annotation']];
        
        _.each(vizdata['edges'], function(edge) {
            var s = nodes[edge['s']], t = nodes[edge['t']];
            
            if (s && t) {
                var sterm = annotation['map'][s.orf] || [], tterm = annotation['map'][t.orf] || [];
                var intersect = sterm.filter(function(n) { return tterm.indexOf(n) != -1 });
                
                if (intersect.length == 1) {
                    if (!lineGeometries[intersect[0]]) lineGeometries[intersect[0]] = new THREE.Geometry();
                    lineGeometries[intersect[0]].vertices.push(new THREE.Vector3(s.x, s.y, s.z));
                    lineGeometries[intersect[0]].vertices.push(new THREE.Vector3(t.x, t.y, t.z));
                } else {
                    lineGeometries['default'].vertices.push(new THREE.Vector3(s.x, s.y, s.z));
                    lineGeometries['default'].vertices.push(new THREE.Vector3(t.x, t.y, t.z));
                }
            }
        });
        
        for (var t in lineGeometries) {
            var color = (t == 'default') ? 0xFFFFFF : parseInt('0x' + annotation['terms'][t]['color']);
            var term = new THREE.Line(lineGeometries[t], new THREE.LineBasicMaterial({
                    color: color, linewidth: opts['edgeWidth'], opacity: opts['edgeOpacity'], transparent: true,
                }), THREE.LinePieces);
            
            term.name = 'edges' + t;
            three['scene'].add(term);
        }
    }
    
    var buildUI = function() {
        var canvasMeas = document.createElement('canvas'), ctxMeas = canvasMeas.getContext('2d');
        var annotation = vizdata['annotations'][state['annotation']];
        var lineHeight = 36, maxLine = 0, paddingFactor = 1.14;
        
        ctxMeas.font = '29px Palatino Linotype';
        _.each(annotation['terms'], function(term) {
            var name = term['name'];
            if (name.length >= 36) {
                var words = name.split(' '), name = '';
                _.each(words, function(word) {
                    if (name.length < 36) name += name.length == 0 ? word : ' ' + word;
                });
                name += '...'
            }
            maxLine = Math.max(ctxMeas.measureText(name).width, maxLine);
            term['alias'] = name;
        });
        
        var canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
        canvas.width = maxLine * paddingFactor;
        canvas.height = lineHeight * 2;
        
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#e3e3e3';
        ctx.font = '50px Palatino Linotype';
        ctx.fillText(state['annotation'], 0, 30);
        
        var texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;
        var sprite = new THREE.Mesh(new THREE.BoxGeometry(maxLine, lineHeight * 2, 1), new THREE.MeshBasicMaterial({
            color: 0xFFFFFF, map: texture, transparent: true, opacity: 1, 
        }));
        
        var w = -$(opts['rootElement']).width()/2, h = $(opts['rootElement']).width()/4 - canvas.height;
        sprite.position.set(w, h, 0);
        sprite.rotation.set(0, Math.PI/8, 0);
        three['ui'].add(sprite);
        
        var i = 0, geometry = new THREE.BoxGeometry(maxLine, lineHeight, 1);
        for (var t in annotation['terms']) {
            var term = annotation['terms'][t];
            
            var canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
            canvas.width = maxLine * paddingFactor;
            canvas.height = lineHeight;
            
            ctx.fillStyle = ctx.strokeStyle = '#e3e3e3';
            ctx.textBaseline = 'top';
            ctx.font = '29px Palatino Linotype';
            
            ctx.globalAlpha = 1;
            ctx.fillText(term['alias'], 14, 0);
            ctx.fillStyle = '#' + term['color'];
            ctx.fillRect(maxLine * 1.07, (canvas.height - 25)/2, 25, 25);
            
            var texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            texture.minFilter = THREE.LinearFilter;
            var sprite = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
                color: 0xffffff, map: texture, transparent: true, opacity: 1, 
//                color: parseInt('0x' + term.color), transparent: true, opacity: 1, 
            }));
            
            sprite.position.set(w, h - canvas.height * i++ - lineHeight * 2, i * 2);
            sprite.rotation.set(0, Math.PI/8, 0);
            sprite.name = 'legend' + t;
            three['ui'].add(sprite);
        }
    }
    
    var buildTerm = function() {
        
    }
    
    var init = function() {
        buildUI();
        buildNodes();
        buildEdges();
        buildTerm();
    }
    
    return {
        init: init,
    };
});