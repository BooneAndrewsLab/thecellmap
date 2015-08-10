define([
    'jquery',
    'underscore',
    'backbone',
    'noUISlider',
    
    'bootstrap',
    'sigma',
    
    'packer',
    'sigma.forcelayout',
    'sigma.move',
    'sigma.rotate'
], function($, _, Backbone, nouislider) {
    var sigInst, vizdata = {};
    
    var init = function() {
        var DEFAULTS = {
            arrows: false,
            colorScheme: 'black',
            debug: true,
            downloadLimit: 30,
            hideLayouts: false,
            highlight: false,
            layout: null,
            layoutAlgo: ['fl'],
            layoutButtonHide: true,
            minYear: null,
            maxYear: null,
            rootElement: '#network-container',
            runningLayout: null,
        };
        $.extend(opts, DEFAULTS);
        
        sigInst = sigma.init($(opts['rootElement'])[0]).configProperties({
            auto: false,
            drawEdges: 2,
        }).drawingProperties({
            defaultLabelSize: 14,
            defaultLabelHoverColor: '#000',
            labelThreshold: 6,
            font: 'Arial',
            fontStyle: 'bold ',
            defaultLabelColor : '#E3E3E3',
        }).graphProperties({
            type: 'network',
//            minEdgeSize : 1,
//            maxEdgeSize : 20,
            maxNodeSize: 2,
            nodesPowRatio : 1,
            edgesPowRatio : .5,
            margin: 50,
            arrowRatio: 4,
            safe : false,
        }).mouseProperties({
            drawHoverEdges: false,
            maxRatio : 64,
            blockScroll: false,
        });
        
        loadAuthors();
        sigInst.draw();
    }
    
    var buildUI = function() {
        $('.vizualization-ui').appendTo(opts['rootElement']);
        $('.vizualization-ui').ready(function() {
            $(window).resize(function() {
                var parent = $('.vizualization-ui').parent();
                $('.vizualization-ui').css('height', parent.innerHeight());
                $('.vizualization-ui').css('width', parent.innerWidth());
            }).resize();
        });
        $('#ui-placeholder').remove();
        
        var slider = $('#cutoff-bar-date')[0];
        nouislider.create(slider, {
            range: {
                min: timestamp(opts['minYear'] + ''),
                max: new Date().getTime(),
            },
            step: 7 * 24 * 60 * 60 * 1000,
            start: timestamp(opts['minYear']),
            orientation: 'horizontal',
            direction: 'ltr',
        });
        
        slider.noUiSlider.on('set', function() {
            var val = parseInt(slider.noUiSlider.get());
            sigInst.iterNodes(function(n) {
                n.visibleDegree = 0;
            });
            
            sigInst.iterEdges(function(e){e.weight = 1;});
            
            sigInst.iterEdges(function(e) {
//                sigInst.graphProperties({maxEdgeSize: }).draw();
                e.hidden = e.date > val;
                e.size = 1;
                
                if (!e.hidden) {
                    _.each(vizdata['edges'], function(edge) {
                        if (e.id == (edge.source + '+' + edge.target) && edge.date < val) {
                            e.weight++;
                            e.size++;
                        }
                    });
                    e.source.visibleDegree++;
                    e.target.visibleDegree++;
                }
            });
            
            months = ['January', 'February', 'March',
                      'April', 'May', 'June', 'July',
                      'August', 'September', 'October',
                      'November', 'December'];
            
            var date = new Date(val);
            $('#cutoff-label').html(months[date.getMonth()] + ', ' + date.getFullYear());
            
            toggleLayout();
            sigInst.draw();
        });
        
        setTimeout(function() {
            $('#ui').fadeIn(1000);
        }, 1000);
        
//        
//        slider.noUiSlider.on('update', function( values, handle ) {
//            $('.cutoff-label-min').html(values[0]);
//            $('.cutoff-label-max').html(values[1]);
//        });
    }
    
    var timestamp = function(str) {
        return new Date(str).getTime();
    }
    
    var loadAuthors = function() {
        $.ajax({
            url: opts['urls']['authors'], 
            dataType : 'json',
            success: function(nodes) {
                nodes.forEach(function(n) {
                    var node = {}
                    node.id = n.id;
                    node.label = n.name;
                    node.size = 2;
                    node.x = !isNaN(node.x) ? node.x : (Math.random() * 100);
                    node.y = !isNaN(node.y) ? node.y : (Math.random() * 100);
                    node.forceLabel = true;
                    node.color = '#01AEF0';
                    
                    sigInst.addNode(node.id, node);
                });
                
                loadArticles();
            },
        });
    }
    
    var loadArticles = function() {
        $.ajax({
            url: opts['urls']['articles'], 
            dataType : 'json',
            success: function(edges) {
                vizdata['edges'] = edges;
                edges.forEach(function(e) {
                    var edge = {}
                    edge.source = e.source;
                    edge.target = e.target;
                    edge.id = edge.source + '+' + edge.target;
                    
                    var date = new Date();
                    date.setFullYear(e.date.substring(0, 4), e.date.substring(4, 6));
                    opts['minYear'] = Math.min(opts['minYear'], parseInt(e.date.substring(0, 4))) || parseInt(e.date.substring(0, 4));
                    opts['maxYear'] = Math.max(opts['maxYear'], parseInt(e.date.substring(0, 4))) || parseInt(e.date.substring(0, 4));
                    e.date = date.getTime();
                    
                    edge.weight = 1;
                    edge.size = 1;
                    edge.color = '#FF9126'
                    
                    if (!sigInst._core.graph.edgesIndex[edge.id]) {
                        sigInst.addEdge(edge.id, edge.source, edge.target, edge);
                        sigInst._core.graph.edgesIndex[edge.id].date = date.getTime();
                    } else {
                        var addedEdge = sigInst._core.graph.edgesIndex[edge.id];
                        if (date.getTime() < addedEdge.date) {
                            addedEdge.date = date.getTime();
                        }
                        addedEdge.weight++;
                        addedEdge.size++;
                    }
                });
                
                buildUI();
                updateNetwork();
            },
        });
    }
    
    var updateNetwork = function() {
        sigInst._core.graph.nodes.forEach(function(node) {
            if (node.degree > 2) node.size = node.degree;
            node._hidden = node.hidden;
        });
        
        sigInst.iterEdges(function(e) {
            e.absweight = Math.abs(e.weight);
            //TODO: FIX THIS
            delete e.label;
        });
        
        $('#cutoff-bar-date')[0].noUiSlider.set(new Date('March, 2002'));
        sigInst.draw();
        toggleLayout();
    }
    
    var toggleLayout = function() {
        if (!!opts.runningLayout) {
            sigInst.stopForceAtlas2();
            opts.runningLayout = false;
        } else {
            sigInst.iterNodes(function(n) {
                n.hidden = n.visibleDegree <= 0
            });
            
            var lopts = {
                callback: function(n) {
                    stackNetworks();
                },
//                attraction_multiplier : .75,
//                repulsion_multiplier : 50,
//                gravity: 10,
            }
            sigInst.startForceAtlas2(lopts);
            opts.runningLayout = true;
        }
    }
    
    var traverseRec = function(node, netNum, len) {
        var nextNode;
        if (node.layout.subnetwork != null) return len;
        
        node.layout.subnetwork = netNum;
        for (nextNode in node.layout.connections) {
            nextNode = node.layout.connections[nextNode];
            len = traverseRec(nextNode, netNum, len);
        }
        return len + 1;
    }
    
    var stackNetworks = function() {
        var nodes = sigInst._core.graph.nodes.filter(function(node) { return !node.hidden; });
        var edges = sigInst._core.graph.edges.filter(function(e) { return !e.source.hidden && !e.target.hidden && !e.hidden; });
        var subnetwork = -1, offset, subnetworks = [], blocks = [], packer = new GrowingPacker();
        
        nodes.forEach(function(n) {
            n.layout = {
                connections : {},
                subnetwork : null
            };
        });
        
        edges.forEach(function(e) {
            e.source.layout.connections[e.target.id] = e.target;
            e.target.layout.connections[e.source.id] = e.source;
        });
        
        nodes.forEach(function(n) {
            if (n.layout.subnetwork == null) {
                subnetwork++;
                traverseRec(n, subnetwork, 0);
            }
            
            if (subnetworks[n.layout.subnetwork] == undefined) {
                subnetworks[n.layout.subnetwork] = [n];
            } else {
                subnetworks[n.layout.subnetwork].push(n);
            }
        });
        
        for (var i = 0; i < subnetworks.length; i++) {
            var xmax = xmin = subnetworks[i][0].x, ymax = ymin = subnetworks[i][0].y;
            for (var j = 0; j < subnetworks[i].length; j++) {
                xmax = Math.max(xmax, subnetworks[i][j].x);
                xmin = Math.min(xmin, subnetworks[i][j].x);
                ymax = Math.max(ymax, subnetworks[i][j].y);
                ymin = Math.min(ymin, subnetworks[i][j].y);
            }
            offset = Math.max(offset || (xmax-xmin)/10, (ymax-ymin)/10);
            blocks.push({x: xmin, y: ymin, w: xmax - xmin + offset, h: ymax - ymin + offset, area: Math.abs((xmax - xmin) * (ymax - ymin))});
        }
        
        for (var i = 0; i < blocks.length; i++) {
            blocks[i]["subnetwork"] = subnetworks[i];
        }
        
        blocks.sort(function (a, b) { return b.area - a.area; });
        packer.fit(blocks);
        
        var newPositions = [];
        for(var i = 0; i < blocks.length; i++) {
            for (var j = 0; j < blocks[i].subnetwork.length; j++) {
                var n = blocks[i].subnetwork[j], x = n.x, y = n.y;
                if ((x - blocks[i].x) < blocks[i].w) {
                    x += offset;
                } else {
                    x -= offset;
                }
                
                if ((y - blocks[i].y) < blocks[i].h) {
                    y += offset;
                } else {
                    y -= offset;
                }
                
                newPositions.push({x: x - blocks[i].x + blocks[i].fit.x,
                                  y: y - blocks[i].y + blocks[i].fit.y,
                                  node: n});
            }
        }
        
        nodes.forEach(function(n) {
            delete n.layout;
        });
        
        sigInst.moveNodes({destinations: newPositions, runtime: 3}, function() {
            var sx = sy = sxx = syy = sxy = 0.0;
            var n = sigInst._core.graph.nodes.length;
            sigInst.iterNodes(function(n) {
                if (n.degree > 0) {
                    sx += n.x;
                    sy += n.y;
                    sxx += n.x * n.x;
                    syy += n.y * n.y;
                    sxy += n.x * n.y;
                }
            });
            var theta = Math.atan2((sxy * n - sy * sx), (sxx * n - sx * sx)) * 180 / Math.PI;
            sigInst.rotateNodes({
                callback: function() {
                    opts.runningLayout = false;
                }, 
                degrees: theta, 
                nodes: sigInst._core.graph.nodes,
            });
        });
    }
    
    return {
        init: init
    };
});