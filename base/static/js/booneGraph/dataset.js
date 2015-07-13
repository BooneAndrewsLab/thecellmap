define([
    'jquery',
    'underscore',
    'backbone',
    
    'annotation',
    'dataset',
    'layout',
    'node',
    'settings',
    'utils',
    
    'strainModel',
], function($, _, Backbone, Annotation, Dataset, Layout, Node, Settings, Utils, StrainModel) {
    var updateEdges = function(ds) {
        var ele = $(".cutoff-bar-simple[data-dataset=\"" + ds + "\"], .cutoff-bar[data-dataset=\"" + ds + "\"]");
        sigInst._core.graph.edges.forEach(function(edge) {
            if (!edge.hasOwnProperty('ds')) {
                edge.ds = ds;
                edge.absweight = Math.abs(edge.weight);
            }
            
            edge.hidden = edge.ds != ds;
        });
        
        sigInst.draw();
    }
    
    var updateLabels = function(ds) {
        var ele = $(".cutoff-bar-simple[data-dataset=\"" + ds + "\"], .cutoff-bar[data-dataset=\"" + ds + "\"]");
        var cutoffs = ds == 0 ? state.get('cutoffCorrelation') : state.get('cutoffInteraction');
        
        if (ds == 0) {
            $('.cutoff-label-min').html(state.get('cutoffCorrelation'));
        } else {
            $('.cutoff-label-max').html(state.get('cutoffInteraction')[1]);
            $('.cutoff-label-min').html(state.get('cutoffInteraction')[0]);
        }
        
        if (ds == 0) {
            $('.cutoff-label-max').hide();
            $('.cutoff-label-min').removeClass('btn-danger').addClass('btn-default');
        } else {
            $('.cutoff-label-max').show();
            $('.cutoff-label-min').removeClass('btn-default').addClass('btn-danger');
        }
        
        $('.cutoff-bar-simple').css('display', 'none');
        $('.cutoff-bar').css('display', 'none');
        ele.css('display', 'block');
        
        Node.applyCutoff(cutoffs);
        sigInst.draw();
    }
    
    var loadLayout = function() {
        var nodes, edges;
        var strains = vizdata['strains'], annotation = vizdata['annotations'].get(state.get('annotation'));
        
        $.ajax({
            url: opts.urls['layout'], 
            dataType : 'json',
            async : false,
            success: function(data) {
                var strain, annot, color;
                nodes = data.nodes || [];
                edges = data.edges || [];
                
                nodes.forEach(function (node) {
                    strain = strains.get(node.id);
                    if (strain == undefined) {
                        console.log("Strain not found:", node.id);
                        strain = {};
                    } else {
                        annot = annotation.get('map')[strain.get('id')];
                        if (annot != undefined) {
                            color = annotation.get('colorPalette')[annotations.get('terms')[annot[0]].idx];
                        } else {
                            color = annotation.get('defaultColor');
                        }
                        
                        node.label = strain.get('verboseName');
                        node.size = 2;
                        node.color = color;
                        node.x = !isNaN(node.x) ? node.x : (Math.random() * 100);
                        node.y = !isNaN(node.y) ? node.y : (Math.random() * 100);
                        if (strain.color != undefined) node.color = strain.color;
                        sigInst.addNode(node.id, node);
                    }
                });
                
                sigInst._core.graph.nodes.forEach(function(node) {
                    node.size_init = node.size;
                    node._hidden = node.hidden; // Our internal way to know if user hid the node manually or not
                });
            },
        }).always(function() {
//                opts.cb(nodes, edges, extraData); 
        }).fail(function(e) { 
            console.log('failed', e);
        });
        
        loadDataset(0);
        updateEdges(0);
        state.set('isInitializing', false);
    }
    
    var loadDataset = function(dsid, data, callback) {
        var datasetType = dsid == 0 ? 'correlations' : 'interactions';
        var method = dsid == 0 ? 'get' : 'post';
        
        $.ajax({
            url: opts.urls[datasetType], 
            dataType : 'json',
            method: method,
            data: data,
            async : false,
            success: function(data) {
                edges = data.edges;
                
                edges.forEach(function (edge, edgeIdx) {
                    edge.source = edge.source || edge.s; // s == source
                    edge.target = edge.target || edge.t; // t == target
                    edge.weight = edge.weight || edge.w; // w == weight
                    edge.id = edge.source + '+' + edge.target; // We can ommit ids, can be auto generated here
                    edge.absweight = Math.abs(edge.weight);
                    edge.color = edge.color || edge.c; // c == color
                    edge.size = edge.absweight;
                    
                    if (edge.color == undefined && dsid == 1) {
                        edge.color = edge.weight < 0. ? "red" : "green";
                        edge.size = 1;
                    }
                    
                    switch (edge.color) {
                    case "w": edge.color = 'white'; break;
                    case "b": edge.color = 'blue'; break;
                    case "r": edge.color = 'red'; break;
                    }
                    
                    if (edge.color == undefined) delete edge.color;
                    
                    edge.label = edge.weight; // Sets the thickness of the edge
                });
                
                edges.forEach(function(edge){
                    if (!!sigInst._core.graph.nodesIndex[edge.source] && !!sigInst._core.graph.nodesIndex[edge.target] && !sigInst._core.graph.edgesIndex[edge.id]) {
                        sigInst.addEdge(edge.id, edge.source, edge.target, edge);
//                            edgesAdded++;
                    }
                });
            },
        }).always(function() {
            updateEdges(dsid);
            
            if (callback) callback(edges);
        }).fail(function(e) { 
            console.log('failed', e);
        });
    }
    
    var switchDataset = function(dsid, single, fromEdges) {
        state.set('dataset', dsid);
        
        if (dsid == 0) { // Correlations
            state.set('showCircular', false);
            
            sigInst._core.graph.nodes.filter(function(node) {
                if (!node.hidden && node._hidden) node._hidden = false;
            });
            
            updateEdges(dsid);
            Utils.graphCenter();
            Annotation.rebuildLegend();
        } else if (dsid == 1) { //Interactions
            var selected = [];
            
            if (fromEdges) {
                state.get('hoveredTargets').forEach(function(e) {
                    e = Utils.getEdge(e);
                    if (selected.indexOf(e.source.id) == -1) selected.push(e.source.id);
                    if (selected.indexOf(e.target.id) == -1) selected.push(e.target.id);
                });
            } else if (single) {
                selected.push(Utils.getNode(state.get('hoveredTargets')[0]).id);
            } else {
                selected = Utils.getSelectedNodes();
            }
            
            loadDataset(1, {csrfmiddlewaretoken: $.cookie('csrftoken'), nodes: selected}, function(edges) {
                var nodes = [];
                edges.forEach(function(e) {
                    if (nodes.indexOf(e.source) == -1) nodes.push(e.source);
                    if (nodes.indexOf(e.target) == -1) nodes.push(e.target);
                });
                
                sigInst.iterNodes(function(node) {
                    node._hidden = node.hidden = nodes.indexOf(parseInt(node.id)) == -1;
                });
                
                if (selected.length == 1) {
                    circularFunc(selected[0]);
                } else {
                    var layoutType = state.get('annotation') != 'None' ? 'gi+' : 'gi';
                    Layout.toggleLayout(layoutType);
                }
                
            });
        }
        
        updateLabels(dsid);
        Annotation.rebuildLegend();
        Settings.updateLabels();
    }
    
    var tmpNetworks = {before: {}, current: {}};
    var toggleDataset = function(dsid) {
        var selection = Utils.getSelectedNodes();
        if (selection.length < 1 || selection.length > 7) return;
        
        $('.image-datasets').toggleClass('hidden');
        
        tmpNetworks['before'] = $.extend({}, tmpNetworks['current']);
        var ntmp = sigInst._core.graph.nodes.filter(function(node) {
            return !node.hidden;
        });
        
        tmpNetworks['current'] = {};
        for (n in ntmp) {
            var node = ntmp[n];
            tmpNetworks['current'][node.id] = {x: node.x, y: node.y};
        }
        tmpNetworks['current']['showRegions'] = state.get('showRegions');
        
        if (dsid == 0) {
            if (!$.isEmptyObject(tmpNetworks['before'])) {
                sigInst.iterNodes(function(node) {
                    if (tmpNetworks['before'][node.id]) {
                        node.hidden = false;
                        node.x = tmpNetworks['before'][node.id].x;
                        node.y = tmpNetworks['before'][node.id].y;
                    } else {
                        node.hidden = true;
                    }
                });
                state.set('showRegions', tmpNetworks['before']['showRegions']);
            }
            
            switchDataset(dsid);
            Annotation.drawRegions();
        } else {
            state.set('showRegions', false);
            switchDataset(dsid);
        }
    }
    
    var circularFunc = function(nid) {
        state.set('showCircular', true);
        
        var node = Utils.getNode(nid), groups = {}, draw = [];
        var etmp = sigInst._core.graph.edges.filter(function(e) {return !e.hidden && !e.source.hidden && !e.target.hidden;});
        var ntmp = sigInst._core.graph.nodes.filter(function(n) {return !n.hidden && n.id != parseInt(nid);});
        
        if (!Utils.nodeExists('tmp_' + node.id)) sigInst.addNode('tmp_' + node.id, node);
        var tmpN = Utils.getNode('tmp_' + node.id);
        tmpN.hidden = tmpN._hidden = false;
        tmpN.x = node.x;
        tmpN.y = node.y;
        
        etmp.sort(function(e1, e2) {
            if (e1.weight < e2.weight) return -1;
            if (e1.weight > e2.weight) return 1;
            return 0;
        });
        
        etmp.forEach(function(e) {
            var tmpkey = '+', centerNode, outNode;
            if (e.source.id == node.id) {
                centerNode = e.source;
                outNode = e.target;
            } else if (e.target.id == node.id) {
                centerNode = e.target;
                outNode = e.source;
            } else {
                e.hidden = true;
                return;
            }
            
            if (e.weight < 0) {
                tmpkey = "-";
                sigInst.addEdge(tmpN.id + '-' + outNode.id, tmpN.id, outNode.id, e);
                e._hidden = e.hidden = true; //hide the edges to the original node
            }
            
            if (!groups.hasOwnProperty(tmpkey)) groups[tmpkey] = [];
            groups[tmpkey].push(outNode);
        });
        
        ntmp.forEach(function(n) {
            var connected = false;
            etmp.forEach(function (e) {
                if (e.source.id == n.id || e.target.id == n.id) {
                    connected = true;
                }
            });
            n.hidden = !connected;
        });
        
        var size = 2;
        for (var s in groups) {
            var layers = [[]], l = 0;
            for (var n in groups[s]) {
                var count = (l + 2) * 20;
                layers[l].push(groups[s][n]);
                if (layers[l].length >= count) {
                    layers[++l] = [];
                    size++;
                }
            }
            groups[s] = layers;
        }
        
        var radius = 300;
        tmpN.x -= (size + 1) * radius;
        for (var s in groups) {
            var r = radius;
            var center = s == '+' ? node : tmpN;
            for (var l in groups[s]) {
                var sides = [], theta;
                sides[0] = sides[1] = groups[s][l].length/2;
                if (groups[s][l].length % 2 != 0) {
                    sides[0] = Math.floor(sides[0]);
                    sides[1] = Math.ceil(sides[1]);
                }
                var i = j = 0;
                for (var k in sides) {
                    theta = 2/3 * Math.PI / sides[k];
                    while (i < sides[k]) {
                        var n = groups[s][l][j];
                        var initTheta = k == 0 ? 5/3 : 2/3
                        draw.push({
                            x: center.x + r * Math.cos(i*theta + initTheta * Math.PI), 
                            y: center.y + r * Math.sin(i*theta + initTheta * Math.PI), 
                            node: n,
                        });
                        i++;
                        j++;
                    }
                    i = 0;
                }
                r += radius;
            }
        }
        
        sigInst.moveNodes({destinations: draw, runtime: 3}, function() {
            Settings.updateLabels();
            Utils.graphCenter();
        });
    }
    
    return {
        updateEdges: updateEdges,
        loadLayout: loadLayout,
        toggleDataset: toggleDataset,
    };
});
