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
        opts.runningLayout = bool;
        if ($('#btn-layout').length == 0) return;
        
        var button = $('#btn-layout');
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
//            return;
        }
        
        if ($('#btn-layout').length != 0) ladda = Ladda.create($('#btn-layout')[0]);
        state.set('showRegions', false);
        Utils.clearSelectionCanvas();
        
        if (opts.runningLayout) {
            sigInst.stopForceLayout();
            setRunningLayout(false);
        } else {
            var lopts, annotations, data, strain, annot, key, groups;
            
            lopts = {
                callback: function(n) {
                        if (Object.keys(n).length - 1 > 1) Utils.stackNetworks();
                        Utils.graphCenter();
                        setRunningLayout(false);
                    },
                progress_callback: function(p) {
                    if (!!ladda) setTimeout(function(){ladda.setProgress(p);}, 0);
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
                    
                    if (tmp.length > 6) return;
                    
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
                    weight = groups[key].keylen * 0.01 - Math.min(groups[key]['nodes'].length * 0.00001, 0.009);
                    
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
                
                Utils.iterVisibleNodes(function(n) {
                    strain = Utils.getStrain(n.id);
                    annot = data.get('map')[strain.get('orf')] || [-1];
                    
                    annot.forEach(function(a) {
                        if (!annotations.hasOwnProperty(a)) {
                            annotations[a] = [];
                        }
                        annotations[a].push(n);
                    })
                });
                
                lopts.edges = [];
//                k_combinations(sigInst._core.graph.nodes.filter(function(node) {
//                    return !node.hidden;
//                }), 2).forEach(function(x) {
//                    lopts.edges.push({
//                        weight: .01,
//                        absweight: .01,
//                        source: x[0],
//                        target: x[1]
//                    })
//                });
                
                for (key in annotations) {
                    k_combinations(annotations[key], 2).forEach(function(x) {
                        lopts.edges.push({
                            weight: 0.01,
                            absweight: 0.01,
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
                    strain = Utisl.getStrain(n.id);
                    
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
                    
                    if (tmp.length > 6) return;
                    
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
                        strain = Utils.getStrain(n.id);
                        annot = data.get('map')[strain.orf] || [-1];
                        
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
                    
                    if (tmp.length > 6) return;
                    
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
                    weight = groups[key].keylen * 0.01 - Math.min(groups[key]['nodes'].length * 0.00001, 0.009);
                    
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
    
    var circularFunc = function(nid) {
        state.set('showCircular', true);
        state.set('centerNode', nid);
        
        sigInst.graphProperties({margin: 75});
        
        var node = Utils.getNode(nid), groups = {}, draw = [], addedNode = false;
        var etmp = sigInst._core.graph.edges.filter(function(e) {return !e.source.hidden && !e.target.hidden && !e.hidden;});
        
        if (!Utils.nodeExists('tmp_' + node.id)) {
            addedNode = true;
            sigInst.addNode('tmp_' + node.id, node);
        }
        var tmpN = Utils.getNode('tmp_' + node.id);
        tmpN.hidden = tmpN._hidden = false;
        
        etmp.sort(function(e1, e2) {
            if (e1.weight < e2.weight) return -1;
            if (e1.weight > e2.weight) return 1;
            return 0;
        });
        
        etmp.forEach(function(e) {
            var tmpkey = '+', outNode;
            if (Utils.stripLetters(e.source.id) == node.id) {
                outNode = e.target;
            } else if (Utils.stripLetters(e.target.id) == node.id) {
                outNode = e.source;
            } else {
                e.hidden = true;
                return;
            }
            
            if (e.weight < 0) {
                tmpkey = '-';
                if (!sigInst._core.graph.edgesIndex[tmpN.id + '-' + outNode.id]) {
                    sigInst.addEdge(tmpN.id + '-' + outNode.id, tmpN.id, outNode.id, e);
                    e._hidden = e.hidden = true; //hide the edges to the original node
                }
            }
            
            if (!groups.hasOwnProperty(tmpkey)) groups[tmpkey] = [];
            groups[tmpkey].push(outNode);
        });
        
        if (groups.hasOwnProperty('+'))
            groups['+'] = groups['+'].reverse();
        
        var size = 2;
        for (var s in groups) {
            var numNodes = groups[s].length;
            var pass = true;
            var layers = [[]], l = 0;
            
            for (var n in groups[s]) {
                var count = (l + 2) * 10;
                layers[l].push(groups[s][n]);
                
                if (layers[l].length >= count) {
                    numNodes -= layers[l].length;
                    if (pass && numNodes < count /2) {
                        pass = false;
                    } else if (pass) {
                        layers[++l] = [];
                        size++;
                    }
                }
            }
            groups[s] = layers;
        }
        
        for (var i in groups) {
            for (var j in groups[i]) {
                groups[i][j].sort(function(a, b) {
                    var diff = parseInt(a.color.substring(1), 16) - parseInt(b.color.substring(1), 16);
                    if (diff == 0) {
                        if (a.label.toLowerCase() < b.label.toLowerCase()) return -1;
                        if (a.label.toLowerCase() > b.label.toLowerCase()) return 1;
                        return 0;
                    }
                    return diff;
                });
            }
        }
        
        var radius = 200;
        if (addedNode) {
            tmpN.x = node.x - (size + 4) * radius;
            tmpN.y = node.y;
        }
        
        for (var s in groups) {
            var r = radius*2;
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
            sigInst.drawingProperties({labelThreshold: 0}).draw(-1, -1, 1);
            Utils.graphCenter();
            
            sigInst.iterEdges(function(e) {
                if (!e.hidden && (Utils.stripLetters(e.source.id) != parseInt(node.id) && Utils.stripLetters(e.target.id) != parseInt(node.id))) {
                    e.hidden = true;
                }
            });
        });
    }
    
    return {
        toggleLayout: toggleLayout,
        circularFunc: circularFunc,
    };
});