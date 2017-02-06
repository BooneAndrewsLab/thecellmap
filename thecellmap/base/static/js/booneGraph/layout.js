define([
    'jquery',
    'underscore',
    'backbone',
    'ladda',
    
    'utils',
    
    'graham_scan',
    'combinations',
    'spin',
    'sigma.forcelayout',
], function($, _, Backbone, Ladda, Utils) {
    var ladda;
    var setRunningLayout = function(bool) {
        opts.runningLayout = bool;
        $('#dataset-toggle').children().attr('disabled', bool);
        
        if (bool) {
//            $('.introjs-nextbutton').addClass('disabled');
        } else {
            $('.introjs-nextbutton').removeClass('disabled');
        }
        
//        For advanced UI, enable/disable the spinner on button
//        if ($('#btn-layout').length == 0) return;
//        
//        var button = $('#btn-layout');
//        button.toggleClass('btn-primary', !bool);
//        button.toggleClass('btn-danger', bool);
//        
//        if (!bool) {
//            ladda.stop();
//            button.siblings('.dropdown-toggle').removeClass('disabled');
//            console.log($('.introjs-nextbutton'))
//        } else {
//            button.siblings('.dropdown-toggle').addClass('disabled');
//            ladda.start();
//            button.removeAttr("disabled");
//        }
    }
    
    var toggleLayout = function(layoutType) {
        if (((layoutType == 'annotation' || layoutType == 'force+' || layoutType == 'gi+') && state.get('annotation') == 'None') 
                || (layoutType == 'gi' && state.get('dataset') == 0) || state.get('showCircular')) return;
        
        if (Utils.countVisibleEdges() > 7000) {
            Utils.alertUser('Too many edges', 'Too many edges are visible for the layout algorithm to run efficiently.<br>Edge count: ' + Utils.countVisibleEdges());
            return;
        }
        
        if ($('#btn-layout').length != 0) ladda = Ladda.create($('#btn-layout')[0]);
        state.set('showRegions', false);
        
        if (opts.runningLayout) {
            sigInst.stopForceLayout();
            setRunningLayout(false);
        } else {
            var lopts, annotations, data, strain, annot, key, groups;
            
            lopts = {
                callback: function(n) {
//                        if (Object.keys(n).length - 1 > 1)
//                            Utils.stackNetworks();
                        
                        var convexHull = new ConvexHullGrahamScan();
                        var xmax, xmin, ymax, ymin;
                        
                        sigInst._core.graph.nodes.filter(function(n) {return !n.hidden;}).forEach(function(n){
                            convexHull.addPoint(n.x, n.y);
                            xmax = !xmax ? n.x : Math.max(xmax, n.x);
                            xmin = !xmin ? n.x : Math.min(xmin, n.x);
                            ymax = !ymax ? n.y : Math.max(ymax, n.y);
                            ymin = !ymin ? n.y : Math.min(ymin, n.y);
                        });
                        
                        
                        var hullPoints = convexHull.getHull();
                        hullPoints.push(hullPoints[0]);
                        var minh = Number.MAX_VALUE, mindeg;
                        var cx = xmin + ((xmax - xmin) / 2);
                        var cy = ymin + ((ymax - ymin) / 2);
                        
                        for (var i = 1; i < hullPoints.length; i++) {
                            var p1 = hullPoints[i-1];
                            var p2 = hullPoints[i];
                            
                            var rad = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                            var deg = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
                            
                            var tmplx = null, tmphx = null;
                            
                            var rotated = [];
                            sigInst._core.graph.nodes.filter(function(n) {return !n.hidden;}).forEach(function(n) {
                                rotated.push({
                                    x: (n.x - cx) * Math.cos(rad) - (n.y - cy) * Math.sin(rad) + cx,
                                    y: (n.y - cy) * Math.cos(rad) + (n.x - cx) * Math.sin(rad) + cy
                                })
                            });
                            
                            bbox = Utils.boundingBox(rotated);
                            if (bbox.h < minh) {
                                minh = bbox.h;
                                mindeg = deg;
                            }
                        }
                        
                        if (mindeg > 90) mindeg = mindeg - 180;
                        else if (mindeg < -90) mindeg = mindeg + 180;
                        
                        sigInst.rotateNodes({degrees: mindeg, runtime: 3, callback: function(){
                            Utils.graphCenter();
                        }});
                        
                        setRunningLayout(false);
                    },
                progress_callback: function(p) {
                    if (!!ladda) setTimeout(function(){ladda.setProgress(p);}, 0);
                },
                attraction_multiplier: $('#layout-slider-att').val() || 50,
                repulsion_multiplier: $('#layout-slider-rep').val() || 1,
                edgeFilter: function(edge) { return edge.weight > 0.2; },
                groups: {}
            };
            console.log('Starting layout', layoutType);
            
            switch(layoutType || 'force') {
            case 'gi':
                lopts.edges = [];
                var groups = {}, common = {};
                var etmp = sigInst._core.graph.edges.filter(function(e) {return !e.hidden && !e.source.hidden && !e.target.hidden;});
                var ntmp = sigInst._core.graph.nodes.filter(function(n) {return !n.hidden;});
                var other, weight;
                
                ntmp.forEach(function(n) {
                    var tmp = [], repTmp = [], tmpkey, repKey;
                    etmp.forEach(function(e) {
                        if (e.source.id == n.id || e.target.id == n.id) {
                            // try excluding nodes driving this correlation
                            other = e.source.id == n.id ? e.target : e.source;
                            tmp.push(e.weight < 0 ? "-" + other.id : other.id);
                            repTmp.push(other.id);
                        }
                    });
                    
                    if (tmp.length > 6) return;
                    if (tmp.length > 1) {
                        common[n.id] = null; // this is a node in common to more than one hub
                    }
                    
                    tmp = tmp.sort();
                    repTmp = repTmp.sort();
                    
                    tmpkey = tmp.join();
                    repKey = repTmp.join();
                    
                    if (!groups.hasOwnProperty(tmpkey)) {
                        groups[tmpkey] = {nodes: [], keylen: tmp.length, key: repKey};
                    }
                    
                    if (tmpkey != '') {
                        groups[tmpkey].nodes.push(n);
                    } else {
                        n.hidden = true;
                    }
                });
                
                etmp.forEach(function(e) {
                    // Reduce edge weight for edges connecting nodes to multiple hubs
                    if (common.hasOwnProperty(e.source.id) || common.hasOwnProperty(e.target.id)) {
                        lopts.edges.push({
                            weight: 0.10,
                            absweight: 0.10,
                            source: e.source,
                            target: e.target
                        });
                    } else {
                        lopts.edges.push(e);
                    }
                });
                
                // Add attraction within groups
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
                
                if (state.get("annotation") != 'None') {
                    // Add annotation attraction component
                    data = vizdata['annotations'].get(state.get("annotation"));
                    
                    for (key in groups) {
                        if (groups[key].keylen == 0) continue; // No edges whatsoever... would make weight=infinity
                        weight = groups[key].keylen * 0.01 - Math.min(groups[key]['nodes'].length * 0.00001, 0.009);
                        
                        annotations = {};
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
                        
                        for (key in annotations) {
                            k_combinations(annotations[key], 2).forEach(function(x) {
                                lopts.edges.push({
                                    weight: weight * 5,
                                    absweight: weight * 5,
                                    source: x[0],
                                    target: x[1]
                                })
                            });
                        }
                    }
                }
                
                lopts['groups'] = groups; // for stacking shared groups
                
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
                        var weight = Math.floor(Math.sqrt(_.size(annotations[key]))) * 0.01; 
                        lopts.edges.push({
                            weight: weight,
                            absweight: weight,
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
                if (state.get('annotation') == 'None') break;
                
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
                            tmp.push(other.id);
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
                
                data = vizdata['annotations'].get(state.get('annotation'));
                addedEdge = []
                
                for (key in groups) {
                    if (groups[key].keylen == 0) continue; // No edges whatsoever... would make weight=infinity
                    
                    annotations = {};
                    
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
                    
                    for (key in annotations) {
                        weight = annotations[key].length * 0.05;
                        k_combinations(annotations[key], 2).forEach(function(x) {
                            lopts.edges.push({
                                weight: weight,
                                absweight: weight,
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
    
    var selectLayer = function(layers) {
        var l = 0, i = 1;
        for (; i < layers.length; i++) {
            cl = layers[i];
            pl = layers[l];
            if ((cl.c / cl.n) > (pl.c / pl.n)) {
                l = i;
            }
        }
        return l;
    };
    
    var circularFunc = function(nid) {
        state.set('showCircular', true);
        state.set('centerNode', nid);
        
        sigInst.graphProperties({margin: 75});
        
        var node = Utils.getNode(nid), groups = {'-': [], '+': []}, draw = [], addedNode = false;
        var etmp = sigInst._core.graph.edges.filter(function(e) {return !e.source.hidden && !e.target.hidden && !e.hidden;});
        var chunks = {'-': {}, '+': {}}, g;
        
        if (!Utils.nodeExists('tmp_' + node.id)) sigInst.addNode('tmp_' + node.id, node);
        
        var tmpN = Utils.getNode('tmp_' + node.id);
        tmpN.selected = true;
        tmpN.hidden = tmpN._hidden = false;
        
        // sort edges ascending
//        etmp.sort(function(e1, e2) {
//            return e1.weight - e2.weight;
//        });
        
        // split up positive/negative edges to the original and temporary node
        var tmpkey, outNode, newEdgeId;
        etmp.forEach(function(e) {
            tmpkey = '+';
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
                newEdgeId = tmpN.id + '-' + outNode.id
                if (!sigInst._core.graph.edgesIndex[newEdgeId]) {
                    sigInst.addEdge(newEdgeId, tmpN.id, outNode.id, e);
                    e._hidden = e.hidden = true; //hide the edges to the original node
                    sigInst._core.graph.edgesIndex[newEdgeId].ds = e.ds;
                    sigInst._core.graph.edgesIndex[newEdgeId].absweight = e.size;
                }
            }
            
            groups[tmpkey].push(outNode);
            if (!chunks[tmpkey].hasOwnProperty(outNode.color)) {
                chunks[tmpkey][outNode.color] = [];
            }
            chunks[tmpkey][outNode.color].push(outNode);
        });
        
        // sort positive interactions descending
        if (groups.hasOwnProperty('+')) groups['+'] = groups['+'].reverse();
        
        // sort the edges for each spoke in order of annotation
        for (var i in groups) {
            groups[i].sort(function(a, b) {
                var diff = chunks[i][a.color].length - chunks[i][b.color].length;
                
                if (diff == 0) {
                    diff = parseInt(a.color.substring(1), 16) - parseInt(b.color.substring(1), 16);
                }
                if (diff == 0) {
                    if (a.label.toLowerCase() < b.label.toLowerCase()) return -1;
                    if (a.label.toLowerCase() > b.label.toLowerCase()) return 1;
                    return 0;
                }
                return diff;
            });
        }
        
        var size = 2;
        for (var s in groups) {
            var numNodes = groups[s].length;
            var numLayers = 0, l = 0, n, i, j;
            var layerCounts = [];
            var layers = [];
            while (numNodes > 0) {
                n = (2 + l++) * 10;
                numNodes -= n;
                numLayers++;
                if (numNodes < (n / 2)) {
                    n += numNodes;
                    numNodes = 0;
                }
                
                layerCounts.push({n: n, c: n});
                layers.push([]);
                size++;
            }
            
            for (n in groups[s]) {
                var i = selectLayer(layerCounts);
                layers[i].push(groups[s][n]);
                layerCounts[i].c--;
            }
            
            groups[s] = layers;
        }
        
        var radius = 200;
        tmpN.x = node.x - (size + 4) * radius;
        tmpN.y = node.y;
        
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