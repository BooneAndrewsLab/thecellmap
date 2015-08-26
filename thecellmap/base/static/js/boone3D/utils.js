define([
    'jquery',
    'underscore',
    'backbone',
    
    'three',
], function($, _, Backbone) {
    var clearScene = function() {
        for (var i = three['scene'].children.length - 1; i >= 0; i--) {
            three['scene'].remove(three['scene'].children[i]);
        }
    }
    
    var clearUI = function() {
        for (var i = three['ui'].children.length - 1; i >= 0; i--) {
            three['ui'].remove(three['ui'].getObjectByName('extract'));
            three['ui'].remove(three['ui'].getObjectByName('termMenu'));
        }
    }
    
    var resetScene = function(all) {
        for (var i = three['scene'].children.length - 1; i >= 0; i--) {
            if (three['scene'].children[i].name.indexOf('edges') != -1) {
                three['scene'].children[i].material.opacity = opts['edgeOpacity'];
            }
        }
        
        for (var i = three['ui'].children.length - 1; i >= 0; i--) {
            if (three['ui'].children[i].name.indexOf('legend') != -1) {
                three['ui'].children[i].material.color.set(0xffffff);
            }
        }
    }
    
    var createClusters = function(vertices) {
        var maxDist = 90, minSize = 7;
        var clusters = [], points = [];
        
        _.each(vertices, function(pt) {
            points.push({ 'p' : pt, 'visted' : false, 'clustered': false, });
        });
        
        _.each(points, function(pt) {
            if (pt.visted) return;
            pt.visted = true;
            
            var neighbors = findRegion(pt, points, maxDist);
            if (neighbors.length >= minSize) {
                var c = [];
                c.push(pt);
//                pt.clustered = true;
                _.each(neighbors, function(npt) {
                    if (npt.visted) return;
                    npt.visted = true;
                    
                    var nNeighbors = findRegion(npt, points, maxDist);
                    if (nNeighbors.length >= minSize) {
                        var diff = _.uniq(_.difference(neighbors, nNeighbors));
                        if (_.isArray(diff)) {
                            neighbors.concat(diff);
                        } else {
                            neighbors.push(diff);
                        }
                    }
                    if (!npt.visited) {
                        c.push(npt);
                        npt.visited = true;
                    }
                });
                clusters.push(c);
            }
        });
        
        var result = [];
        _.each(clusters, function(c) {
            result.push(_.pluck(c, 'p'))
        });
        return result;
    }
    
    var findRegion = function(center, points, dist) {
        return _.filter(points, function(point) {
            return point['p'].distanceTo(center['p']) < dist;
        });
    }
    
    var stripLetters = function(s) {
        return s.match(/\d/g).join('');
    }
    
    return {
        clearScene: clearScene,
        clearUI: clearUI,
        resetScene: resetScene,
        
        createClusters: createClusters,
        stripLetters: stripLetters,
    }
});