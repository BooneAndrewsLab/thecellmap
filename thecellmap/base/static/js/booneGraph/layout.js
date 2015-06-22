define([
    'jquery',
    'underscore',
    'backbone',
    'ladda',
    
    'utils',
    
    'combinations',
    'spin',
    'sigma.forcelayout',
], function($, _, Backbone, Ladda, Utils) {
    var ladda;
    var setRunningLayout = function(bool) {
        var button = $('#btn-layout');
        opts.runningLayout = bool;
        button.toggleClass('btn-primary', !bool);
        button.toggleClass('btn-danger', bool);
        
        if (!bool) {
            ladda.stop();
            button.siblings('.dropdown-toggle').removeClass('disabled');
        } else {
            button.siblings('.dropdown-toggle').addClass('disabled');
            ladda.start();
            button.removeAttr("disabled");
        }
    }
    
    var toggleLayout = function(layoutType) {
        if (((layoutType == 'annotation' || layoutType == 'force+' || layoutType == 'gi+') && state.get('annotation') == 'None') 
                || (layoutType == 'gi' && state.get('dataset') == 0)) return;
        
        if (Utils.countVisibleEdges() > 7000) {
            Utils.alertUser('Too many edges', 'Too many edges are visible for the layout algorithm to run efficiently.<br>Edge count: ' + Utils.countVisibleEdges());
            return;
        }
        
        ladda = Ladda.create($('#btn-layout')[0]);
        state.set('showRegions', false);
        
        if (opts.runningLayout) {
            sigInst.stopForceLayout();
            setRunningLayout(false);
        } else {
            var lopts, annotations, data, strain, annot, key;
            
            lopts = {
                callback: function(n) {
                        if (Object.keys(n).length - 1 > 1) Utils.stackNetworks();
                        Utils.graphCenter();
                        setRunningLayout(false);
                    },
                progress_callback: function(p) {
                    setTimeout(function(){ladda.setProgress(p);}, 0);
                },
                attraction_multiplier: $('#layout-slider-att').val() || 50,
                repulsion_multiplier: $('#layout-slider-rep').val() || 1,
                edgeFilter: function(edge) { return edge.weight > 0.2; },
            };
            
            
            switch(layoutType || 'force') {
            case 'gi':
                lopts.edges = [];
                groups = {};
                var etmp = sigInst._core.graph.edges.filter(function(e) {return !e.hidden && !e.source.hidden && !e.target.hidden;});
                var ntmp = sigInst._core.graph.nodes.filter(function(n) {return !n.hidden;});
                var other, weight;
                
                etmp.forEach(function(e) {
                    lopts.edges.push(e);
                });
                
                ntmp.forEach(function(n) {
                    var tmp = [], tmpkey;
                    etmp.forEach(function(e) {
                        if (e.source.id == n.id || e.target.id == n.id) {
                            // try excluding nodes driving this correlation
                            other = e.source.id == n.id ? e.target : e.source;
                            tmp.push(e.weight < 0 ? "-" + other.id : other.id);
                        }
                    });
                    
                    if (tmp.length > 100) {
                        return;
                    }
                    
                    tmp = tmp.sort();
                    tmpkey = tmp.join();
                    if (!groups.hasOwnProperty(tmpkey)) {
                        groups[tmpkey] = {nodes: [], keylen: tmp.length};
                    }
                    
                    if (tmpkey != '') {
                        groups[tmpkey].nodes.push(n);
                    } else {
                        n.hidden = true;
                    }
                });
                
                for (key in groups) {
                    if (groups[key].keylen == 0) continue; // No edges whatsoever... would make weight=infinity
                    weight = Math.log(groups[key].keylen)/Math.log(7) + 0.01;
                    
                    k_combinations(groups[key].nodes, 2).forEach(function(x) {
                        lopts.edges.push({
                            weight: weight,
                            absweight: weight,
                            source: x[0],
                            target: x[1]
                        })
                    });
                }
                break;
            case 'annotation':
                annotations = {};
                data = vizdata['annotations'].get(state.get("annotation"));
                
                iterVisibleNodes(function(n) {
                    strain = getStrain(n.id);
                    annot = data.map[strain.orf] || [-1];
                    
                    annot.forEach(function(a) {
                        if (!annotations.hasOwnProperty(a)) {
                            annotations[a] = [];
                        }
                        annotations[a].push(n);
                    })
                });
                
                lopts.edges = [];
                k_combinations(sigInst._core.graph.nodes.filter(function(node) {
                    return !node.hidden;
                }), 2).forEach(function(x) {
                    lopts.edges.push({
                        weight: .01,
                        absweight: .01,
                        source: x[0],
                        target: x[1]
                    })
                });
                
                for (key in annotations) {
                    k_combinations(annotations[key], 2).forEach(function(x) {
                        lopts.edges.push({
                            weight: 1,
                            absweight: 1,
                            source: x[0],
                            target: x[1]
                        })
                    });
                }
                break;
            case 'attribute':
                var attribute = $(this).data('layout-attribute');
                
                lopts.edges = [];
                groups = {'noattr': []};
                var etmp = sigInst._core.graph.edges.filter(function(e) {return !e.hidden && !e.source.hidden && !e.target.hidden;});
                var ntmp = sigInst._core.graph.nodes.filter(function(n) {return !n.hidden;});
                
                etmp.forEach(function(e) {
                    lopts.edges.push(e);
                });
                
                ntmp.forEach(function(n) {
                    strain = getStrain(n.id);
                    
                    if (strain.attributes && strain.attributes.hasOwnProperty(attribute)) {
                        if (!groups.hasOwnProperty(strain.attributes[attribute])) groups[strain.attributes[attribute]] = [];
                        groups[strain.attributes[attribute]].push(n);
                    } else {
                        groups['noattr'].push(n);
                    }
                });
                
                for (key in groups) {
                    k_combinations(groups[key], 2).forEach(function(x) {
                        lopts.edges.push({
                            weight: 0.1,
                            absweight: 0.1,
                            source: x[0],
                            target: x[1]
                        })
                    });
                }
                break;
            case 'force+':
                if (state.get("annotation") == 'None') break;
                
                lopts.edges = [];
                groups = {};
                var etmp = sigInst._core.graph.edges.filter(function(e) {return !e.hidden && !e.source.hidden && !e.target.hidden;});
                var ntmp = sigInst._core.graph.nodes.filter(function(n) {return !n.hidden;});
                var other, weight;
                
                etmp.forEach(function(e) {
                    lopts.edges.push(e);
                });
                
                ntmp.forEach(function(n) {
                    var tmp = [], tmpkey;
                    etmp.forEach(function(e) {
                        if (e.source.id == n.id || e.target.id == n.id) {
                            // try excluding nodes driving this correlation
                            other = e.source.id == n.id ? e.target : e.source;
                            tmp.push(e.weight < 0 ? "-" + other.id : other.id);
                        }
                    });
                    
                    if (tmp.length > 100) {
                        return;
                    }
                    
                    tmp = tmp.sort();
                    tmpkey = tmp.join();
                    if (!groups.hasOwnProperty(tmpkey)) {
                        groups[tmpkey] = {nodes: [], keylen: tmp.length};
                    }
                    
                    groups[tmpkey].nodes.push(n);
                });
                
                data = vizdata['annotations'].get(state.get("annotation"));
                
                for (key in groups) {
                    if (groups[key].keylen == 0) continue; // No edges whatsoever... would make weight=infinity
                    
                    annotations = {};
                    
                    groups[key].nodes.forEach(function(n) {
                        strain = getStrain(n.id);
                        annot = data.map[strain.orf] || [-1];
                        
                        annot.forEach(function(a) {
                            if (!annotations.hasOwnProperty(a)) {
                                annotations[a] = [];
                            }
                            annotations[a].push(n);
                        })
                    });
                    
                    for (key in annotations) {
                        k_combinations(annotations[key], 2).forEach(function(x) {
                            lopts.edges.push({
                                weight: .01,
                                absweight: .01,
                                source: x[0],
                                target: x[1]
                            })
                        });
                    }
                }
                break;
            case 'gi+':
                if (state.get("annotation") == 'None') break;
                
                lopts.edges = [];
                groups = {};
                var etmp = sigInst._core.graph.edges.filter(function(e) {return !e.hidden && !e.source.hidden && !e.target.hidden;});
                var ntmp = sigInst._core.graph.nodes.filter(function(n) {return !n.hidden;});
                var other, weight;
                
                etmp.forEach(function(e) {
                    lopts.edges.push(e);
                });
                
                ntmp.forEach(function(n) {
                    var tmp = [], tmpkey;
                    etmp.forEach(function(e) {
                        if (e.source.id == n.id || e.target.id == n.id) {
                            // try excluding nodes driving this correlation
                            other = e.source.id == n.id ? e.target : e.source;
                            tmp.push(e.weight < 0 ? "-" + other.id : other.id);
                        }
                    });
                    
                    if (tmp.length > 100) {
                        return;
                    }
                    
                    tmp = tmp.sort();
                    tmpkey = tmp.join();
                    if (!groups.hasOwnProperty(tmpkey)) {
                        groups[tmpkey] = {nodes: [], keylen: tmp.length};
                    }
                    
                    groups[tmpkey].nodes.push(n);
                });
                
                data = vizdata['annotations'].get(state.get("annotation"));
                
                for (key in groups) {
                    if (groups[key].keylen == 0) continue; // No edges whatsoever... would make weight=infinity
                    
                    annotations = {};
                    weight = Math.log(groups[key].keylen) + 0.01;
                    
                    groups[key].nodes.forEach(function(n) {
                        strain = Utils.getStrain(n.id);
                        annot = data.get('map')[strain.get('orf')] || [-1];
                        
                        annot.forEach(function(a) {
                            if (!annotations.hasOwnProperty(a)) {
                                annotations[a] = [];
                            }
                            annotations[a].push(n);
                        })
                    });
                    
                    
                    k_combinations(groups[key].nodes, 2).forEach(function(x) {
                        lopts.edges.push({
                            weight: weight,
                            absweight: weight,
                            source: x[0],
                            target: x[1]
                        })
                    });
                    
                    for (key in annotations) {
                        k_combinations(annotations[key], 2).forEach(function(x) {
                            lopts.edges.push({
                                weight: .02,
                                absweight: .02,
                                source: x[0],
                                target: x[1]
                            })
                        });
                    }
                }
                break;
            }
            
            sigInst.startForceLayout(lopts);
            setRunningLayout(true);
        }
    }
    
    return {
        toggleLayout: toggleLayout,
    };
});