define([
    'jquery',
    'underscore',
    'backbone',
    
    'jquery.cookie',
    
    'annotation',
    'dataset',
    'layout',
    'node',
    'settings',
    'utils',
    
    'strainModel',
    
    'sigma.pinlayout',
], function($, _, Backbone, Cookies, Annotation, Dataset, Layout, Node, Settings, Utils, StrainModel) {
    var updateEdges = function(ds) {
        var selected = state.get('missingNodes').length ? state.get('missingNodes') : Utils.getSelectedNodes() || [];
        sigInst._core.graph.edges.forEach(function(edge) {
            if (!edge.hasOwnProperty('ds')) {
                edge.ds = ds;
                edge.absweight = Math.abs(edge.weight);
            }
            edge.hidden = (ds == 0) ? edge.ds != ds : 
                (edge.ds != ds) || (selected.indexOf(edge.source.id) == -1 && selected.indexOf(edge.target.id) == -1);
        });
        sigInst.draw();
    }
    
    var updateLabels = function(ds) {
        var ele = $('.cutoff-bar-simple[data-dataset=\"' + ds + '\"], .cutoff-bar[data-dataset=\"' + ds + '\"]');
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
        
        Node.applyCutoff(cutoffs, true);
        sigInst.draw();
    }
    
    var loadLayout = function() {
        var nodes, edges;
        var strains = vizdata['strains'], annotation = vizdata['annotations'].get(state.get('annotation'));
        
        $.ajax({
            url: opts.urls['layout'], 
            dataType : 'json',
            success: function(data) {
                var strain, annot, color;
                nodes = data.nodes || [];
                edges = data.edges || [];
                var xmax, xmin, ymax, ymin;
                
                nodes.forEach(function (node) {
                    strain = strains.get(node.id);
                    if (strain == undefined) {
                        console.log('Strain not found: ', node.id);
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
                
                loadDataset(0, {}, function () {
                    if (!!opts['extra']) loadPin();
                    updateEdges(0);
                    
                    state.set('isInitializing', false);
                });
            },
        }).fail(function(e) { 
            // TODO: Some meaningful message to user here
        });
    }
    
    var loadPin = function() {
        $.ajax({
            url: opts['extra']['static_url'], 
            dataType : 'json',
            success: function(data) {
                var added = false, max_edges = 1;
                var pin_node;
                
                data.sort(function(a, b){ return b.w-a.w; }).forEach(function(e) {
                    if (e.w < 0.2 || max_edges == 0) return;
                    
                    pin_node = Utils.getNode(e.t);
                    pin_node.type = 'pin';
                    
                    max_edges--;
                    
                    //For adding multiple edges that correlates with the pin
                    
                    /*if (!added && !sigInst._core.graph.nodesIndex[e.s]) {
                        var end_node = Utils.getNode(e.t);
                        
                        var node = {};
                        node.size = 3;
                        node.color = '#FF0000';
                        node.x = end_node ? end_node.x : Math.random() * 100;
                        node.y = end_node ? end_node.y : Math.random() * 100;
                        
                        sigInst.addNode(e.s, node);
                        pin_node = Utils.getNode(e.s);
                        pin_node.type = 'pin';
                        added = true;
                    }
                    
                    var edge = {};
                    edge.source = e.s;
                    edge.target = e.t;
                    edge.weight = e.w;
                    edge.id = edge.source + '+' + edge.target; // We can ommit ids, can be auto generated here
                    edge.absweight = Math.abs(edge.weight);
                    
                    if (!!sigInst._core.graph.nodesIndex[edge.source] && !!sigInst._core.graph.nodesIndex[edge.target] && !sigInst._core.graph.edgesIndex[edge.id]) {
                        sigInst.addEdge(edge.id, edge.source, edge.target, edge);
                        
                        var addedEdge = Utils.getEdge(edge.id);
                        addedEdge.type = 'pin';
                        addedEdge.absweight = Math.abs(edge.weight)
                        
                        Utils.getNode(edge.target).type = 'pin_connect';
                        max_edges--;
                    }*/
                });
                
                $('input.gene-search-input').select2('val', [pin_node.id], true);
                sigInst.draw();
                
//                sigInst.startPinLayout();
            },
        });
    }
    
    var loadDataset = function(dsid, data, callback) {
        var datasetType = dsid == 0 ? 'correlations' : 'interactions';
        var method = dsid == 0 ? 'get' : 'post';
        
        $.ajax({
            url: opts.urls[datasetType], 
            dataType : 'json',
            method: method,
            data: data,
            success: function(data) {
                edges = data.edges;
                
                edges.forEach(function(edge) {
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
                    }
                });
            },
        }).always(function() {
            if (callback) {
                callback(edges);
            } else {
                updateEdges(dsid);
            }
        }).fail(function(e) {
            console.log('failed', e);
        });
    }
    
    var switchDataset = function(dsid) {
        state.set('dataset', dsid);
        state.set('showRegions', false);
        $('.sigma_mouse_canvas')[0].getContext('2d').clearRect(0, 0, $(document).width(), $(document).height());
        
        if (dsid == 0) { // Correlations
            state.set('showCircular', false);
            for (var i = sigInst._core.graph.edges.length - 1; i > 0; i--) {
                if (sigInst._core.graph.edges[i]['ds'] == 1) sigInst.dropEdge(sigInst._core.graph.edges[i]['id']);
            }
            sigInst.graphProperties({margin: graphProperties['margin']}).draw(-1, -1, 1);
            
            updateEdges(dsid);
            updateLabels(dsid);
            Utils.graphCenter();
            Annotation.rebuildLegend();
            Settings.updateLabels();
        } else if (dsid == 1) { //Interactions
            var selected = Utils.getSelectedNodes();
            loadDataset(dsid, {csrfmiddlewaretoken: Cookies.get('csrftoken'), nodes: selected}, function(edges) {
                var nodes = [];
                edges.forEach(function(e) {
                    if (nodes.indexOf(e.source) == -1) nodes.push(e.source);
                    if (nodes.indexOf(e.target) == -1) nodes.push(e.target);
                });
                
                sigInst.iterNodes(function(node) {
                    node._hidden = node.hidden = nodes.indexOf(parseInt(node.id)) == -1;
                });
                updateEdges(dsid);
                
                if (selected.length == 1) {
                    Layout.circularFunc(selected[0]);
                } else {
                    var layoutType = state.get('annotation') != 'None' ? 'gi+' : 'gi';
                    Layout.toggleLayout(layoutType);
                    Settings.updateLabels();
                }
                
                state.set('missingNodes', []);
                updateLabels(dsid);
                Annotation.rebuildLegend();
            });
        }
    }
    
    var tmpNetworks = {before: {}, current: {}};
    var toggleDataset = function(dsid) {
        var missingNodes = $(Utils.getSelection()).not(Utils.getSelectedNodes()).get();
        if (missingNodes.length >= 1 && missingNodes.length <= 7) {
            state.set('missingNodes', missingNodes);
            return;
        }
        
        var selection = Utils.getSelectedNodes();
        if (selection.length < 1 || selection.length > 7) return;
        
        $('.image-datasets').toggleClass('hidden');
        
        tmpNetworks['before'] = $.extend({}, tmpNetworks['current']);
        var ntmp = sigInst._core.graph.nodes.filter(function(node) {
            return !node.hidden && !node._hidden;
        });
        
        tmpNetworks['current'] = {};
        for (var n in ntmp) {
            var node = ntmp[n];
            tmpNetworks['current'][node.id] = {x: node.x, y: node.y};
        }
        tmpNetworks['current']['showRegions'] = state.get('showRegions');
        
        if (dsid == 0) {
            if (!$.isEmptyObject(tmpNetworks['before'])) {
                sigInst.iterNodes(function(node) {
                    if (tmpNetworks['before'][node.id]) {
                        node.x = tmpNetworks['before'][node.id].x;
                        node.y = tmpNetworks['before'][node.id].y;
                        node.hidden = node._hidden = false;
                    } else {
                        node.hidden = node._hidden = true;
                    }
                });
                state.set('showRegions', tmpNetworks['before']['showRegions']);
            }
            
            switchDataset(dsid);
            Annotation.drawRegions();
        } else {
            switchDataset(dsid);
        }
    }
    
    return {
        updateEdges: updateEdges,
        loadLayout: loadLayout,
        toggleDataset: toggleDataset,
        switchDataset: switchDataset,
    };
});
