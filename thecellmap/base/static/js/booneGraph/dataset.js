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
            edge.hidden = (ds == 0) ? edge.ds != ds : 
                (edge.ds != ds) || (selected.indexOf(edge.source.id) == -1 && selected.indexOf(edge.target.id) == -1);
        });
        sigInst.draw();
    }
    
    var switchCutoffBars = function(ds) {
        var ele = $('.cutoff-bar-simple[data-dataset=\"' + ds + '\"], .cutoff-bar[data-dataset=\"' + ds + '\"]');
        
        if (ds == 0) {
            $('.cutoff-label-min').html(state.get('cutoffCorrelation'));
            $('.cutoff-label-max').css('visibility', 'hidden');
            $('.cutoff-label-min').removeClass('btn-danger').addClass('btn-default');
        } else {
            $('.cutoff-label-max').html(state.get('cutoffInteraction')[1]);
            $('.cutoff-label-min').html(state.get('cutoffInteraction')[0]);
            $('.cutoff-label-max').css('visibility', 'visible');
            $('.cutoff-label-min').removeClass('btn-default').addClass('btn-danger');
        }
        
        $('.cutoff-bar-simple').css('display', 'none');
        $('.cutoff-bar').css('display', 'none');
        ele.css('display', 'block');
    }
    
    var updateLabels = function(ds) {
        switchCutoffBars(ds);
        var cutoffs = ds == 0 ? state.get('cutoffCorrelation') : state.get('cutoffInteraction');
        Node.applyCutoff(cutoffs, true);
//        sigInst.draw(); // Unnecessary draw here, applycutoff already calls it
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
                        
                        node.label = strain.get('verboseName').toLowerCase();
                        node.size = 2;
                        node.color = color;
                        node.x = !isNaN(node.x) ? node.x : (Math.random() * 100);
                        node.y = !isNaN(node.y) ? node.y : (Math.random() * 100);
                        
                        if (strain.color != undefined) node.color = strain.color;
                        sigInst.addNode(node.id, node);
                    }
                });
                
                sigInst._core.graph.nodes.forEach(function(node) {
                    strain = strains.get(node.id);
                    node.dubious = strain.get('isdu');
                    node.size_init = node.size;
//                    if (node.dubious) node.label += ' - dubious';
                    node._hidden = node.hidden; // Our internal way to know if user hid the node manually or not
                });
                
                loadDataset(opts.dataset || 0, {}, function () {
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
    
    var addMissing = function(nodes) {
        $.post('correlations/', {
                    csrfmiddlewaretoken: Cookies.get('csrftoken'), 
                    nodes: nodes, 
                    cutoff: 0.1
            }, function(data) {
                var added = false, num_nodes = 0;
                var pin_node;
                
                data['edges'].sort(function(a, b){ return b.w-a.w; }).forEach(function(e) {
                    strain = Utils.getStrain(e.t);
                    pin_node = Utils.getNode(e.t);
                    if (!!pin_node && num_nodes < 5) {
                        pin_node.type = 'pin';
                        pin_node.color = 'red';
                        num_nodes++;
                        console.log(pin_node.label, e.w, pin_node.x, pin_node.y);
                    }
                });
                
                $('input.gene-search-input').select2('val', nodes, true);
                sigInst.draw();
                
//                sigInst.startPinLayout();
            });
    }
    
    var loadDataset = function(dsid, data, callback) {
        var datasetType = dsid == 0 ? 'correlations' : 'interactions';
        var method = dsid == 0 ? 'get' : 'post';
        state.set('dataset', dsid);
        
        $.ajax({
            url: opts.urls[datasetType], 
            dataType : 'json',
            method: method,
            data: data,
            success: function(data) {
                edges = data.edges;
                var e, edge, node, annotation = vizdata['annotations'].get(state.get('annotation'));
                
                for (e in edges) {
                    edge = edges[e];
                    edge.source = edge.source || edge.s; // s == source
                    edge.target = edge.target || edge.t; // t == target
                    edge.weight = edge.weight || edge.w; // w == weight
                    edge.id = edge.source + '+' + edge.target; // We can ommit ids, can be auto generated here
                    edge.size = Math.abs(edge.weight) * 10;
//                    console.log(edge.size);
                    if (!!edge.c) { // color defined
                        edge.color = edge.c;
                    } else if (dsid == 1 || opts.interaction_on) {
                        edge.color = edge.weight < 0. ? "blue" : "yellow";
//                        edge.size = .5;
                    }
                    
                    if (dsid == 1) {
                        // TODO: make this more efficient
                        node = edge.source, strain = Utils.getStrain(node);
                        if (!Utils.nodeExists(node)) {
                            var n = {}, annot = annotation.get('map')[strain.get('id')];
                            
                            if (annot != undefined) {
                                var color = annotation.get('colorPalette')[annotations.get('terms')[annot[0]].idx];
                            } else {
                                color = annotation.get('defaultColor');
                            }
                            
                            n.label = strain.get('verboseName');
                            n.color = color;
                            n.size = 2;
                            n.x = n.y = Math.random() * 100;
                            
                            sigInst.addNode(node, n);
                        }
                        node = edge.target, strain = Utils.getStrain(node);
                        if (!Utils.nodeExists(node)) {
                            var n = {}, annot = annotation.get('map')[strain.get('id')];
                            
                            if (annot != undefined) {
                                var color = annotation.get('colorPalette')[annotations.get('terms')[annot[0]].idx];
                            } else {
                                color = annotation.get('defaultColor');
                            }
                            
                            n.label = strain.get('verboseName');
                            n.color = color;
                            n.size = 2;
                            n.x = n.y = Math.random() * 100;
                            
                            sigInst.addNode(node, n);
                        }
                    }
                    
                    if (!!sigInst._core.graph.nodesIndex[edge.source] && !!sigInst._core.graph.nodesIndex[edge.target] && !sigInst._core.graph.edgesIndex[edge.id]) {
                        sigInst.addEdge(edge.id, edge.source, edge.target, edge);
                        sigInst._core.graph.edgesIndex[edge.id].ds = dsid;
                        sigInst._core.graph.edgesIndex[edge.id].absweight = edge.size;
                    }
                }
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
            // TODO: test this a bit more
//            for (var i = sigInst._core.graph.edges.length - 1; i > 0; i--) {
//                if (sigInst._core.graph.edges[i]['ds'] == 1) sigInst.dropEdge(sigInst._core.graph.edges[i]['id']);
//            }
            sigInst.graphProperties({margin: graphProperties['margin']}); //.draw(-1, -1, 1);
            
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
    
    var tmpNetworks = {before: [], current: []};
    var toggleDataset = function(dsid) {
        var selection = Utils.getSelectedNodes();
        if (selection.length < 1 || selection.length > 7 || state.get('dataset') == dsid) return;
        if (dsid == 0) tmpNetworks['before'] = tmpNetworks['current'];
        
        tmpNetworks['current'] = [];
        sigInst._core.graph.nodes.filter(function(node) {
            if (!node.hidden && !node._hidden) {
                tmpNetworks['current'].push(node.id)
            };
        });
        
        if (dsid == 0) {
            sigInst.iterNodes(function(node) {
                node.hidden = node._hidden = tmpNetworks['before'].indexOf(node.id) == -1;
            });
        }
        
        switchDataset(dsid);
    }
    
    return {
        updateEdges: updateEdges,
        switchCutoffBars: switchCutoffBars,
        loadLayout: loadLayout,
        toggleDataset: toggleDataset,
        switchDataset: switchDataset,
        addMissing: addMissing,
    };
});
