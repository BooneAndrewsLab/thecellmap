(function($) {
    $.extend($.fn, {
        /**
         * Starting point, example:
         * $('#myelement').jBooneGraph({foo: bar});
         */
        booneGraph : function(o) {
            /* Default options */
            var DEFAULTS = {
                    defaultNodeColor: '#E8E8E8',
                    runningLayout: null,
                    layout: null,
                    datasets: [],
                    hideLayouts: false,
                    annotations: [],
                    layoutAlgo: ['fl'],
                    layoutButtonHide: true,
                    debug: false,
                    arrows: false,
                    highlight: false,
                    colorScheme: 'black',
                    slider: {
                        min : 0,
                        step : 1,
                        value : 200,
                        max : 1000,
                        filter: 'edges',
                        updateLimits: true,
                    },
                    graphProperties: {
                          minEdgeSize : 0,
                          maxEdgeSize : 1.5,
                          nodesPowRatio : 1,
                          edgesPowRatio : .5,
                          arrowRatio: 4,
                          safe : false,
                    },
                    nodeInfo: function(node, strain) {
                        var table = $('<table class="table"><tbody>');
                        var url = 'http://www.yeastgenome.org/cgi-bin/locus.fpl?locus=' + strain.orf;
                        
                        table.find('tbody').append('<tr><td>ORF</td><td>' + strain.orf + '</td></tr>');
                        table.find('tbody').append('<tr><td>Name</td><td>' + strain.name + '</td></tr>');
                        table.find('tbody').append('<tr><td>Allele</td><td>' + strain.alel + '</td></tr>');
                        table.find('tbody').append('<tr><td>SGD url</td><td><a href="' + url + '">' + url + '</a></td></tr>');
                        
                        return table.wrap('<div>').parent().html();
                    },
                    modifiedCallback: null,
                    uiUrl: "url/"
            };
            
            var sliderProperties = $.extend({}, DEFAULTS.slider, o.slider || {});
            var graphProperties = $.extend({}, DEFAULTS.graphProperties, o.graphProperties || {});
            
            /* Runtime options */
            var opts = $.extend({}, DEFAULTS, o);
            opts.datasetsCutoffs = {};
            
            var rootElement = $(this)[0];
            
            /* Common vars */
            var Link = $.noUiSlider.Link;
            var sigInst = null;
            var vizdata = {};
            var mouseX, mouseY;
            var hoveredTargets = null;
            var clicking = {
                    wasDragging: false,
                    modifierKey: null
            };
            
            var state = {
                    selection: [],
                    cutoff: {
                        0: sliderProperties.value
                    },
                    style: {
                        node: {
                            nsize: 2,
                            lsize: 14,
                            lthr: 6,
                            lcol: "ffffff"
                        },
                        edge: {
                            width: 1
                        },
                        global: {
                            background: "222222"
                        }
                    },
                    layout: {
                        attraction: 50,
                        repulsion: 1
                    },
                    annotation: 'None',
                    dataset: 0
            };
            var undo = null;
            var autoState = false;
            var isInitializing = true;
            var noPulse = false;
            
            function _updateNavigation() {
                $(".undo-network").toggleClass('disabled', !undo.hasUndo());
                $(".redo-network").toggleClass('disabled', !undo.hasRedo());
            };
            
            function _showNavigation() {
                if (!$(".changed-network").is(":visible")) {
                    $(".changed-network").fadeIn(2000);
                }
                _updateNavigation();
            }
            
            function setState(newState) {
                autoState = true;
                var ns = newState.style, reapplyCutoff = false;
                
                if (!($(ns.selection).not(state.selection).length == 0 && $(state.selection).not(ns.selection).length == 0)) {
                    $("input.gene-search-input").select2("val", ns.selection, true);
                } if (ns.style.node.nsize != state.style.node.nsize) {
                    $('#style-slider-nsize').val(ns.style.node.nsize, true);
                } if (ns.style.node.lsize != state.style.node.lsize) {
                    $('#style-slider-lsize').val(ns.style.node.lsize, true);
                } if (ns.style.node.lthr != state.style.node.lthr) {
                    $('#style-slider-lthresh').val(ns.style.node.lthr, true);
                } if (ns.style.node.lcol != state.style.node.lcol) {
                    $('#style-label-color').val(ns.style.node.lcol).focus().blur().change(); // Stupid but effective
                } if (ns.style.edge.width != state.style.edge.width) {
                    $('#style-slider-esize').val(ns.style.edge.width, true);
                } if (ns.style.global.background != state.style.global.background) {
                    $('#canvas-background-color').val(ns.style.global.background).focus().blur().change(); // Stupid but effective
                } if (ns.dataset != state.dataset) {
                    $("#btn-group-datasets a[data-id=\"" + ns.dataset + "\"]").click();
                    reapplyCutoff = true;
                } if (ns.annotation != state.annotation) {
                    loadAnnotation(ns.annotation);
                }
                
                for (var key in ns.cutoff) {
                    if (ns.cutoff[key] != state.cutoff[key]) {
                        state.cutoff[key] = ns.cutoff[key];
                        reapplyCutoff = true;
                    }
                }
                
                if (newState.nodes != null) {
                    var node, n;
                    for (n in newState.nodes) {
                        if (newState.nodes.hasOwnProperty(n)) {
                            node = getNode(n);
                            n = newState.nodes[n];
                            node.x = n.x;
                            node.y = n.y;
                            node.hidden = n.hidden;
                            node._hidden = n.hidden;
                            node.color = n.color;
                        }
                    }
                    
                    reapplyCutoff = true;
//                    $("input.gene-search-input").select2("val", ns.selection, true);
                    sigInst.draw();
                }
                
                if (reapplyCutoff) {
                    console.log("reapplying", state.dataset, state.cutoff, state.cutoff[state.dataset]);
                    applyCutoff(state.cutoff[state.dataset]);
                    
                    if (state.dataset == 0) { // TEMPORARY HACK
                        $(".cutoff-bar[data-dataset=\"" + state.dataset + "\"]").val(opts.datasets[0].min + (opts.datasets[0].max-opts.datasets[0].min) / 2); // HAAAAAAAAAAAAACK BUGZ IN nouislider...
                    }
                    $(".cutoff-bar[data-dataset=\"" + state.dataset + "\"]").val(state.cutoff[state.dataset], {update: true});
                }
                
                autoState = false;
            };
            
            function changeState() {
                if (!isInitializing && !autoState && undo != null) {
                    undo.addChange($.extend(true, {}, state));
                    _showNavigation();
                }
            };
            
            function changeNodesState() {
                if (!autoState && undo != null) {
                    var nodeState = {};
                    sigInst._core.graph.nodes.filter(function(node) {
                        nodeState[node.id] = {x: node.x, y: node.y, hidden: node._hidden, color: node.color};
                    });
                    
                    undo.addChange($.extend(true, {}, state), nodeState);
                    _showNavigation();
                }
            };
            
            function log(msg) {
                if (opts.debug) console.log(msg);
            };
            
            function getCutoff() {
                return state.cutoff[state.dataset];
            }
            
            function setCutoff(cutoff) {
                return state.cutoff[state.dataset] = cutoff;
            }
            
            function countVisibleNodes() {
                return sigInst._core.graph.nodes.filter(function(node) {
                    return !node.hidden;
                }).length;
            };
            
            function iterVisibleNodes(func, ids) {
                sigInst._core.graph.nodes.filter(function(node) {
                    return !node.hidden;
                }).forEach(func, ids);
            };

            function iterVisibleEdges(func, ids) {
                sigInst._core.graph.edges.filter(function(edge) {
                    return !edge.hidden;
                }).forEach(func, ids);
            };
            
            function iterShownEdges(func, ids) {
                sigInst._core.graph.edges.filter(function(edge) {
                    return !edge.hidden && !edge.source.hidden && !edge.target.hidden;
                }).forEach(func, ids);
            };

            function getStrain(id) {
                return vizdata.strains[vizdata.index[id]];
            }

            function getNode(id) {
                return sigInst._core.graph.nodesIndex[id];
            };
            
            function nodeExists(id) {
                return !!sigInst._core.graph.nodesIndex[id];
            }
            
            function clearEdges() {
                sigInst._core.graph.edges = [];
                sigInst._core.graph.edgesIndex = {};
            }
            
            function messageUser(text) {
                var alert = $('<div class="alert alert-warning fade in"> \
                        <button class="close" aria-hidden="true" data-dismiss="alert" type="button">x</button> \
                        ' + text + ' \
                      </div>');
                $('#alerts-panel').append(alert);
                alert.alert();
                setTimeout(function() { alert.alert('close') }, 3000);
            }
            
            function updateMissingMessage() {
                if (autoState) return;
                
                var missing = [];
                getSelected().forEach(function(sel) {
                    if (getNode(sel) === undefined) {
                        var strain = getStrain(sel);
                        missing.push(strain.verboseName);
                    }
                });
                
                if (missing.length > 0) {
                    var message = 'Correlations for gene' + (missing.length == 1 ? '' : 's') + ' \
                        <strong>' + missing.join(', ') + '</strong> \
                        are below the chosen threshold and, as a result, they do not appear on the correlation network. \
                        You can, however, download the direct genetic interactions for them.'
                    
                    if ($('#alert-missing').length == 0) {
                        var alert = $('<div id="alert-missing" class="alert alert-warning fade in"> \
                                <button class="close" aria-hidden="true" data-dismiss="alert" type="button">x</button> \
                                <span class="message">' + message + '</span> \
                              </div>');
                        $('#alerts-panel').append(alert);
                        alert.alert();
                    } else {
                        $('#alert-missing .message').html(message);
                    }
                }
            }
            
            function editNode(id) {
                var modal = $('#edit-node-modal'), node = getNode(id);
                modal.find('.modal-title').html('Edit node "' + node.label + '"');
                modal.find('#edit-node-id').attr("value", id);
                modal.find('#edit-node-label').attr("value", node.label);
                modal.find('#edit-node-color').val(node.color).focus().blur().change();
                modal.modal('show');
            }
            
            function modalInput(title, text, label, type, callback) {
                var inputElement;
                if (type == 'color') {
                    inputElement = '<input id="modal-input-value" class="pick-a-color">';
                } else {
                    inputElement = '<input type="' + type + '" id="modal-input-value">';
                }
                
                $('body').append('<div class="modal fade" id="modal-input" tabindex="-1" role="dialog" aria-labelledby="modal-input-label" aria-hidden="true"> \
                        <div class="modal-dialog"> \
                        <div class="modal-content"> \
                          <div class="modal-header"> \
                            <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button> \
                            <h4 class="modal-title" id="modal-input-label">' + title + '</h4> \
                          </div> \
                          <div class="modal-body"> \
                            <p>' + text + '</p> \
                            <p>' + label + inputElement + '</p> \
                          </div> \
                          <div class="modal-footer"> \
                            <button type="button" class="btn btn-default" data-dismiss="modal">Close</button> \
                            <button id="modal-input-confirm" type="button" class="btn btn-primary">Confirm</button> \
                          </div> \
                        </div> \
                      </div> \
                    </div>');
                
                $('#modal-input .pick-a-color').pickAColor();
                
                $('#modal-input').modal().on('hidden.bs.modal', function () {
                    $(this).remove();
                });
                $('#modal-input-confirm').click(function() {
                    if (!callback($('#modal-input input').val())) {
                        $('#modal-input').modal('hide');
                    }
                });
            }
            
            function alertUser(title, text) {
                $('body').append('<div class="modal fade" id="modal-alert" tabindex="-1" role="dialog" aria-labelledby="modal-alert-label" aria-hidden="true"> \
                        <div class="modal-dialog"> \
                        <div class="modal-content"> \
                          <div class="modal-header"> \
                            <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button> \
                            <h4 class="modal-title" id="modal-alert-label">' + title + '</h4> \
                          </div> \
                          <div class="modal-body"> \
                            <p>' + text + '</p> \
                          </div> \
                          <div class="modal-footer"> \
                            <button type="button" class="btn btn-default" data-dismiss="modal">Close</button> \
                          </div> \
                        </div><!-- /.modal-content --> \
                      </div><!-- /.modal-dialog --> \
                    </div><!-- /.modal -->');
                
                $('#modal-alert').modal().on('hidden.bs.modal', function () {
                    $(this).remove();
                });
            }

            function setNodeColor(node, color) {
                if (color == undefined) {
                    var annot = vizdata[state.annotation].map[node.id];
                    if (annot != undefined) {
                        color = vizdata[state.annotation].colorPalette[vizdata[state.annotation].terms[annot[0]].idx];
                    } else {
                        color = vizdata[state.annotation].defaultColor;
                    }
                }
                
                if (node != undefined) {
                    node.color = color;
                }
            }

            function updateMousePosition(event) {
                mouseX = event.pageX;
                mouseY = event.pageY;
            }
            
            function getSelected() {
                return $("input.gene-search-input").select2('val');
            }
            
            function clearSelection() {
                $("input.gene-search-input").select2('val', "", true);
                state.selection = [];
            }
            
            function getParser(type) {
                if (isFunction(type)) {
                    return type;
                } else if (isString(type)) {
                    switch (type.toLowerCase()) {
                    case 'gexf':
                        return sigInst.parseBooneGexf;
                    case 'json':
                        return sigInst.parseJson;
                    case 'gml':
                        return sigInst.parseGml;
                    }
                }
                
                return sigInst.parseBooneGexf;
            };
            
            function switchDataset(dsid) {
                if (undo == null) return;
                var value = dsid || parseInt($(this).val());
                var dataset = opts.datasets[value];
                var dsEle = $("#btn-group-datasets a[data-id=\"" + value + "\"]");
                $("#btn-group-datasets a").removeClass('active');
                
                if (value == 0) { // Correlations
                    dsEle.addClass('active');
                    $("#selected-dataset").html("Correlations");
                    updateEdges(value);
                } else { // Interactions
                    var newVisible = [];
                    sigInst._core.graph.nodes.filter(function(node) {
                        if (!node.hidden && dataset.fetched.indexOf(node.id) == -1) newVisible.push(node.id);
                    });
                    
                    if (newVisible.length > 50) {
                        alertUser('Too many nodes', 'Too many nodes are visible to switch to genetic interaction data.');
                        $("#btn-group-datasets a[data-id=\"0\"]").addClass('active');
                        $("#selected-dataset").html("Correlations");
                        return;
                    }
                    
                    dataset.fetched = dataset.fetched.concat(newVisible);
                    
                    dsEle.addClass('active');
                    $("#selected-dataset").html("Genetic interactions");
                    
                    if (!newVisible.length) {
                        updateEdges(value);
                    } else {
                        loadDataset(value, {csrfmiddlewaretoken: $.cookie('csrftoken'), nodes: newVisible});
                    }
                }
                
                state.dataset = value;
            };
            
            function updateEdges(ds) {
                var minWeight = null;
                var maxWeight = null;
                var ele = $(".cutoff-bar[data-dataset=\"" + ds + "\"]");
                var visibleCount = 0;
                
                sigInst._core.graph.edges.forEach(function(edge) {
                    if (!edge.hasOwnProperty('ds')) {
                        edge.ds = ds;
                        edge.absweight = Math.abs(edge.weight);
                    }
                    
                    if (edge.ds == ds) {
                        minWeight = Math.min(minWeight || edge.absweight, edge.absweight);
                        maxWeight = Math.max(maxWeight || edge.absweight, edge.absweight);
                    }
                    
                    edge.hidden = edge.ds != ds;
                    if (!edge.hidden) visibleCount++;
                });
                
                opts.datasets[ds].min = minWeight;
                opts.datasets[ds].max = maxWeight;
                
                if (sliderProperties.updateLimits) {
                    if (ds == 0) {
                        ele.noUiSlider({range: {min: minWeight, max: maxWeight}, start: minWeight}, true);
                        ele.val(minWeight + (maxWeight-minWeight) / 2); // HAAAAAAAAAAAAACK BUGZ IN nouislider...
                        ele.val([state.cutoff[ds] || minWeight]) //, {set: true, update: true})
                    } else {
                        ele.val([-0.08, 0.08]) //, {set: true, update: true});
                    }
                }
                
                if (ds == 0) {
                    $("#cutoff-label-max").css('visibility', 'hidden');
                } else {
                    $("#cutoff-label-max").css('visibility', 'visible');
                }
                
                $(".cutoff-bar").css('display', 'none');
                ele.css('display', 'block');
                
                changeState();
                sigInst.draw();
                isInitializing = false;
            }
            
            function loadDataset(dsid, data, preloaded) {
                var dataset = opts.datasets[dsid];
                
                var loadDatasetCallback = function (nodes, edges, extraContext) {
                    var edgesAdded = 0;
                    edges = edges || [];
                    edges.forEach(function(edge){
                        if (nodeExists(edge.source) && nodeExists(edge.target) && !sigInst._core.graph.edgesIndex[edge.id]) {
                            sigInst.addEdge(edge.id, edge.source, edge.target, edge);
                            edgesAdded++;
                        }
                    });
                    
                    updateEdges(dsid);
                };
                
                if (preloaded == undefined) {
                    getParser(dataset.parser)({
                            jq: $, sigInst: sigInst, url: dataset.url, vizdata: vizdata, cb: loadDatasetCallback,
                            data: data, method: dataset.method, state: state
                        });
                } else {
                    loadDatasetCallback(null, preloaded.edges);
                }
            }
            
            function loadLayout(e) {
                var layout = opts.layout;
                var dataset = opts.datasets[0];
                
                opts.loadedDataset = null;
                opts.loadedLayout = null;
                
                var layoutCallback = function (nodes, edges, extraContext) {
                    nodes.forEach(function(node) {
                        var strain = getStrain(node.id);
                        if (strain != undefined) {
                            if (strain.color != undefined) 
                                node.color = strain.color;
                            sigInst.addNode(node.id, node); 
                        }
                    });
                    
                    var nodesState = {};
                    sigInst._core.graph.nodes.forEach(function(node) {
                        node.size_init = node.size;
                        node._hidden = node.hidden; // Our internal way to know if user hid the node manually or not
                        nodesState[node.id] = {
                             x: node.x,
                             y: node.y,
                             color: node.color,
                             label: node.label,
                             hidden: node.hidden
                        }
                    });
                    
                    undo = new Undo($.extend(true, {}, state), nodesState);
                    
                    if (edges.length > 0) {
                        loadDataset(0, null, {edges: edges, dataset: extraContext});
                    } else {
                        // LOAD DEFAULT DATASET
                        loadDataset(0);
                    }
                    
                    vizdata['edges'] = {};
                }
                getParser(layout.parser)({
                    jq: $, sigInst: sigInst, url: layout.url, vizdata: vizdata, cb: layoutCallback, state: state
                });
            }

            function loadAnnotation(id) {
                state.annotation = id;
                
                if (vizdata[id] == undefined) {
                    if (id == 'None') {
                        vizdata[id] = {
                                map : {},
                                defaultColor : opts.defaultNodeColor,
                                terms: []
                        }
                    } else {
                        opts.annotations.forEach(function(annotation) {
                            if (annotation.name === id) {
                                $.ajax({
                                    url : annotation.url,
                                    dataType : 'json',
                                    async : false,
                                    success : function(data) {
                                        vizdata[id] = data;
                                        if (vizdata['defaultColor'] == undefined) {
                                            vizdata.defaultColor = opts.defaultNodeColor;
                                        }
                                        
                                        var i = 0, n;
                                        for (n in vizdata[id].terms) {
                                            vizdata[id].terms[n] = {
                                                    idx : i++,
                                                    name : vizdata[id].terms[n]
                                            }
                                        }
                                        
                                        var colors = paletteGenerator.generate(
                                                i, // Colors
                                                function(color){ // This function filters valid colors
                                                    var hcl = color.hcl();
                                                    return hcl[0]>=0 && hcl[0]<=360
                                                        && hcl[1]>=0 && hcl[1]<=3
                                                        && hcl[2]>=0 && hcl[2]<=1.5;
                                                    },
                                                true, // Using Force Vector instead of k-Means
                                                20 // Steps (quality)
                                            );
                                        colors = $.map(colors, function(c){return c.hex();});
                                        vizdata[id].colorPalette = colors;
                                    }
                                });
                            }
                        });
                    }
                }

                var data = vizdata[id];
                
                sigInst.iterNodes(function(n) {
                    var strain = getStrain(n.id);
                    var annot = data.map[strain.orf];
                    
                    if (annot != undefined && annot.length == 1) {
                        n.color = data.colorPalette[data.terms[annot[0]].idx];
                    } else {
                        // No annotation or multifunction
                        n.color = data.defaultColor;
                    }
                }).draw();
                
                changeState();
            }
            
            function onNodesContext(targets) {
                hoveredTargets = targets.content;
                $("#contextmenu-container").show().delay(2000).hide(200);
                $("#contextmenu-container").css({
                    left : mouseX,
                    top : mouseY,
                });
            }

            /**
             * Select nodes to isolate
             */
            function onNodesCtrlClick(targets) {
                // TODO: 
            }

            function onNodesClick(targets) {
                noPulse = true;
                switch(clicking.modifierKey) {
                case 'ctrl':
                    break;
                case 'shift':
                    $("input.gene-search-input").select2("val", getSelected().concat(targets.content), true);
                    break;
                default:
                    $("input.gene-search-input").select2("val", targets.content, true);
                    break;
                }
                noPulse = false;
//                var node = getNode(targets.content[0]);
//                var strain = getStrain(targets.content[0]);
//                setTimeout( function(){
//                    // HAACK
//                    log('Opening in SGD: ' + node.id + " " + strain.orf);
//                    window.open("http://www.yeastgenome.org/cgi-bin/locus.fpl?locus=" + strain.orf);
//                }, 200); // delay 500 ms
            }
            
            function onNodeClick(targets) {
                $("input.gene-search-input").select2("val", targets.content, true);
            }
            
            function onNodesShiftClick(targets) {
                $("input.gene-search-input").select2("val", getSelected().concat(targets.content), true);
            }
            
            function _setRunningLayout(bool) {
                opts.runningLayout = bool;
                $('#btn-layout').toggleClass('btn-primary', !bool);
                $('#btn-layout').toggleClass('btn-danger', bool);
                if (!bool) {
                    changeNodesState();
                }
            }
            
            function arangeNodes() {
                var selected = getSelected(), xmin, xmax, ymin, ymax, n = 0;
                if (selected.length == 0) return;
                
                selected.forEach(function(node){
                    node = getNode(node);
                    xmin = xmin ? Math.min(xmin, node.x) : node.x;
                    xmax = xmax ? Math.max(xmax, node.x) : node.x;
                    ymin = ymin ? Math.min(ymin, node.y) : node.y;
                    ymax = ymax ? Math.max(ymax, node.y) : node.y;
                });
                
                switch($(this).attr('id')) {
                case "tool-arange-circle":
                    var node, cx, cy, r, theta, alpha = Math.PI * 2 / selected.length, i = -1;
                    cx = xmin + ((xmax - xmin) / 2);
                    cy = ymin + ((ymax - ymin) / 2);
                    r = (Math.abs(xmax - xmin) < Math.abs(ymax - ymin) ? Math.abs(xmax - xmin) : Math.abs(ymax - ymin)) / 2;
                    
                    while (++i < selected.length) {
                        node = getNode(selected[i]);
                        theta = alpha * i;
                        node.x = cx + (Math.cos(theta) * r);
                        node.y = cy + (Math.sin(theta) * r);
                    }
                    
                    changeNodesState();
                    break;
                case "tool-arange-crescent-right":
                    n += selected.length / 2;
                case "tool-arange-crescent-top":
                    n += selected.length / 2;
                case "tool-arange-crescent-left":
                    n += selected.length / 2;
                case "tool-arange-crescent-bottom":
                    var node, cx, cy, r, theta, alpha = Math.PI * 2 / (selected.length * 2), i = n - 1;
                    cx = xmin + ((xmax - xmin) / 2);
                    cy = ymin + ((ymax - ymin) / 2);
                    r = (Math.abs(xmax - xmin) > Math.abs(ymax - ymin) ? Math.abs(xmax - xmin) : Math.abs(ymax - ymin)) / 2;
                    
                    while (++i < selected.length + n) {
                        node = getNode(selected[i - n]);
                        theta = alpha * i;
                        node.x = cx + (Math.cos(theta) * r);
                        node.y = cy + (Math.sin(theta) * r);
                    }
                    
                    changeNodesState();
                    break;
                default: return;
                }
                
                sigInst.draw();
            }
            
            function toggleLayout(justStop) {
                if (countVisibleNodes() > 500) {
                    alertUser('Too many nodes', 'Too many nodes are visible for the layout algorithm to run efficiently.');
                    return;
                }
                
                if (opts.runningLayout) {
                    sigInst.stopForceLayout();
                    _setRunningLayout(false);
                } else if (justStop !== true) {
                    var lopts, annotations, data, strain, annot, key;
                    
                    lopts = {
                        callback: function() {
                                _setRunningLayout(false);
                            },
                        attraction_multiplier: $("#layout-slider-att").val() || 50,
                        repulsion_multiplier: $("#layout-slider-rep").val() || 1,
                        edgeFilter: function(edge) { return edge.weight > 0; },
                    };
                    
                    switch($(this).attr('data-layout-type') || 'force') {
                    case 'annotation':
                        annotations = {};
                        data = vizdata[state.annotation];
                        
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
                                source: x[0],
                                target: x[1]
                            })
                        });
                        
                        for (key in annotations) {
                            k_combinations(annotations[key], 2).forEach(function(x) {
                                lopts.edges.push({
                                    weight: 1,
                                    source: x[0],
                                    target: x[1]
                                })
                            });
                        }
                        break;
                    }
                    
                    sigInst.startForceLayout(lopts);
                    _setRunningLayout(true);
                }
            }
            
            function applyNeighbourhood(level) {
                /* Resets big red nodes */
                var selected = getSelected(), localSelected = {}, tmpSelected;
                selected.forEach(function (id){
                    localSelected[id] = null;
                });
                
                for (var l = 0; l < level; l++) {
                    tmpSelected = {};
                    sigInst.iterEdges(function(edge) {
                        if ((!edge.source._hidden && !edge.target._hidden) && 
                            (localSelected.hasOwnProperty(edge.source.id) || localSelected.hasOwnProperty(edge.target.id))) {
                            tmpSelected[edge.source.id] = null;
                            tmpSelected[edge.target.id] = null;
                        }
                    });
                    localSelected = $.extend({}, localSelected, tmpSelected);
                }
                
                sigInst.iterNodes(function(node) {
                    if (!localSelected.hasOwnProperty(node.id)) {
                        node._hidden = node.hidden = true;
                    }
                });
                
                applyCutoff(getCutoff());
            };
            
            function applyCutoff(cutoff) {
                console.log('applying cutoff', cutoff);
                setCutoff(cutoff);
                
                var isArray = $.isArray(cutoff);
                
                sigInst.iterNodes(function(node) {
                    node.visibleDegree = node.degree;
                }).iterEdges(function(edge) {
                    if (isArray) {
                        edge.hidden = (-cutoff[1] < edge.weight && edge.weight < -cutoff[0]) || edge.ds != state.dataset;
                    } else {
                        edge.hidden = Math.abs(edge.weight) < cutoff || edge.ds != state.dataset;
                    }
                    
                    if (edge.hidden || edge.source._hidden || edge.target._hidden) {
                        edge.source.visibleDegree--;
                        edge.target.visibleDegree--;
                    }
                }).iterNodes(function(node) {
                    node.hidden = node._hidden || node.visibleDegree <= 0; // either we manually hid the node or it's not connected to anything
                });
                
                sigInst.draw();
            };
            
            function downloadCanvasSnapshot() {
                var canvas = $('canvas:first').clone(), ctx = canvas[0].getContext("2d"), cx;
                
                $('canvas').each(function(){
                    if (canvas.height() === 0) {
                        canvas.height($(this).height());
                        canvas.width($(this).width());
                        
                        ctx.fillStyle = rgbToHex($('#network-container').css('backgroundColor'));
                        ctx.fillRect(0,0,canvas.width(),canvas.height());
                    }
                    
                    ctx.drawImage(this, 0, 0);
                });
                
                canvas[0].toBlob(function(blob) {
                    saveAs(blob, "boonelab_network.png");
                });
            }
            
            function downloadShownData() {
                var data = ['Gene A ORF\tGene A allele\tGene B ORF\tGene B allele\tCorrelation\n'];
                var src, trg;
                
                iterShownEdges(function(edge) {
                    src = getStrain(edge.source.id);
                    trg = getStrain(edge.target.id);
                    data.push([src.orf, src.a || src.n || src.orf.toLowerCase(), trg.orf, trg.a || trg.n || trg.orf.toLowerCase(), edge.weight.toFixed(3)].join('\t') + '\n');
                });
                
                var blob = new Blob(data, {type: "text/tab-separated-values;charset=utf-8"});
                saveAs(blob, 'network_data.tsv');
            };
            
            function downloadXGMML() {
                var v = new  XMLWriter();
                v.writeStartDocument();
                
                v.writeStartElement('graph');
                v.writeAttributeString('directed','0');
                v.writeAttributeString('id','test');
                v.writeAttributeString('xmlns', "http://www.cs.rpi.edu/XGMML");
                
                v.writeStartElement('graphics');
                v.writeStartElement('att');
                v.writeAttributeString('name', 'NETWORK_BACKGROUND_PAINT');
                v.writeAttributeString('value', '#000000');
                v.writeAttributeString('type', 'string');
                v.writeEndElement();
                v.writeEndElement();
                
                iterVisibleNodes(function(node) {
                    var strain = getStrain(node.id);
                    v.writeStartElement('node');
                    v.writeAttributeString('id', node.id);
                    v.writeAttributeString('label', node.label);
                    
                    v.writeStartElement('att');
                    v.writeAttributeString('name', 'ORF');
                    v.writeAttributeString('value', strain.orf);
                    v.writeAttributeString('type', 'string');
                    v.writeEndElement();
                    
                    v.writeStartElement('att');
                    v.writeAttributeString('name', 'Allele');
                    v.writeAttributeString('value', strain.a || strain.n || '');
                    v.writeAttributeString('type', 'string');
                    v.writeEndElement();
                    
                    v.writeStartElement('graphics');
                    v.writeAttributeString('x', node.x);
                    v.writeAttributeString('y', node.y);
                    v.writeAttributeString('type', 'ELLIPSE');
                    v.writeAttributeString('width', '0');
                    v.writeAttributeString('fill', '#ffffff');
                    
                    v.writeStartElement('att');
                    v.writeAttributeString('name', 'NODE_BORDER_TRANSPARENCY');
                    v.writeAttributeString('value', '0');
                    v.writeAttributeString('type', 'string');
                    v.writeEndElement();
                    
                    v.writeEndElement(); // graphics
                    v.writeEndElement(); // node
                });
                
                iterShownEdges(function(edge) {
                    v.writeStartElement('edge')
                    v.writeAttributeString('source', edge.source.id);
                    v.writeAttributeString('target', edge.target.id);
                    v.writeAttributeString('cy:directed', 0);
                    
                    v.writeStartElement('att');
                    v.writeAttributeString('name', 'interaction');
                    v.writeAttributeString('value', edge.weight);
                    v.writeAttributeString('type', 'string');
                    v.writeEndElement();
                    
                    v.writeEndElement();
                });
                
                v.writeEndElement();
                v.writeEndDocument();
                
                var blob = new Blob([v.flush()], {type: "application/xgmml;charset=utf-8"});
                saveAs(blob, 'network_data.xgmml');
            }
            
            function buildNewUI() {
                $.ajax(opts.uiUrl, {
                    async: false,
                    processData: false,
                    success: function(data) {
                        $(rootElement).append($('<div class="vizualization-ui" style="display: none;">').html(data));
                    }
                  });
                
                $('#btn-group-layout').toggleClass('hidden', opts.layoutButtonHide);
                
                if (opts.annotations.length > 0) {
                    opts.annotations.forEach(function(annotation) {
                        $('#btn-group-annotation .dropdown-menu').append('<li><a href="#">' + annotation.name + '</a></li>');
                    });
                }
                $(".changed-network").hide().removeClass('hidden');
                $("#modal-style").appendTo("body");
                $("#contextmenu-container").appendTo("body");
                $("#edit-node-modal").appendTo("body");
            }
            
            function initUI() {
                /*
                 * CLICK handlers
                 */
                $('#btn-group-neighbourhood a').click(function(evt) {
                    switch (evt.target.text) {
                    case "Selected genes only":
                        applyNeighbourhood(0);
                        changeNodesState();
                        break;
                    default:
                        applyNeighbourhood(parseInt(evt.target.text.charAt(0)));
                        changeNodesState();
                        break;
                    }
                    
                });
                
                $('#btn-group-annotation a').click(function(evt) {
                    $('#btn-group-annotation li').removeClass('active');
                    $(this).parent().addClass('active');
                    loadAnnotation(evt.target.text); 
                });
                $('#btn-layout, .tool-layout').click(toggleLayout);
                
                $("#btn-group-download a, #btn-group-download button").click(function() {
                    switch ($(this).attr('id')) {
                    case "download-visible":
                        downloadShownData();
                        break;
                    case "btn-view":
                    case "view-tabular":
                        var selected = getSelected();
                        if (selected.length > 0) 
                            window.open('tabular/?' + $.param({'n': selected}, true), '_blank');
                        else
                            alertUser('Selection required', 'Please select one ore more genes to view');
                        break;
                    case "download-selected":
                        var selected = getSelected();
                        if (selected.length > 0) 
                            window.location.href = 'dl/?' + $.param({'n': selected}, true);
                        else
                            alertUser('Selection required', 'Please select one ore more genes to download');
                        break;
                    case "download-dataset":
                        window.open('dl/','_blank');
                        break;
                    case "download-xgmml":
                        downloadXGMML();
                        break;
                    }
                });
                
//                $('#style-tabs a').click(function (e) {
//                    e.preventDefault();
//                    $(this).tab('show');
//                });
                
                /*
                 * Style modal stuff
                 */
                
                var styleSliders = {
                    nsize: {
                        range: {min: .1, max: 10},
                        step: .2,
                        start: 2,
                        connect: "lower",
                        set: function() {
                            sigInst.graphProperties({maxNodeSize: $(this).val()}).draw();
                            state.style.node.nsize = $(this).val();
                            changeState();
                        }
                    },
                    lsize: {
                        range: {min: 1, max: 30},
                        step: 1,
                        start: sigInst._core.plotter.p.defaultLabelSize,
                        connect: "lower",
                        set: function() {
                            sigInst.drawingProperties({defaultLabelSize: $(this).val()}).draw(-1, -1, 1);
                            state.style.node.lsize = $(this).val();
                            changeState();
                        }
                    },
                    lthresh: {
                        range: {min: 0, max: 20},
                        step: 1,
                        start: sigInst._core.plotter.p.labelThreshold,
                        connect: "lower",
                        set: function() {
                            sigInst.drawingProperties({labelThreshold: $(this).val()}).draw(-1, -1, 1);
                            state.style.node.lthr = $(this).val();
                            changeState();
                        }
                    },
                    esize: {
                        range: {min: 1, max: 30},
                        step: 1,
                        start: 1,
                        connect: "lower",
                        set: function() {
                            sigInst.graphProperties({maxEdgeSize: $(this).val()}).draw();
                            state.style.edge.width = $(this).val();
                            changeState();
                        }
                    }
                } 
                
                for (slider in styleSliders) {
                    $('#style-slider-' + slider).noUiSlider(styleSliders[slider]).on('set', styleSliders[slider].set);
                    $('#style-slider-' + slider).attr('data-slider-default', $('#style-slider-' + slider).val());
                }
                
                $('#btn-style-default').click(function() {
                    for (slider in styleSliders) {
                        $('#style-slider-' + slider).val($('#style-slider-' + slider).attr('data-slider-default'), true);
                    }
                    $('#canvas-background-color').val('#222222').change();
                });
                
                /*
                 * Other sliders
                 */
                
                var layoutSliders = {
                    att: {
                        range: {min: 1, max: 100},
                        step: 1,
                        start: 50,
                        handles: 1,
                        connect: "lower",
                        set: changeState
                    },
                    rep: {
                        range: {min: 1, max: 100},
                        step: 1,
                        start: 1,
                        handles: 1,
                        connect: "lower",
                        set: changeState
                    }
                }
                
                for (slider in layoutSliders) {
//                    $('#layout-slider-' + slider).noUiSlider(layoutSliders[slider]);
                }
                
                $("#cutoff-bar-cor").noUiSlider({
                    range: {min: sliderProperties.min, max: sliderProperties.max},
                    step: sliderProperties.step,
                    start: [sliderProperties.value],
                    direction: "rtl",
                    orientation: "vertical",
                    serialization: {
                        lower: [new Link({target: $("#cutoff-label-min")})]
                    }
                }).on('set', function() {
                    applyCutoff($(this).val());
                    changeState();
                });
                $("#cutoff-label-min").html(sliderProperties.value);
                
                $("#cutoff-bar-int").noUiSlider({
                    range: {
                        min: -1,
                        max: 1
                    },
                    step: sliderProperties.step,
                    start: [-0.08, 0.08],
                    orientation: "vertical",
                    serialization: {
                        lower: [new Link({target: function(val){$("#cutoff-label-max").html(-val);}})],
                        upper: [new Link({target: function(val){$("#cutoff-label-min").html(-val);}})]
                    }
                }).on('set', function() {
//                    var val = $(this).val();
                    applyCutoff($(this).val());
                    changeState();
                });
                
                $("#cutoff-label").click(function() {});
                
                $("#btn-group-datasets a").click(function(){
                    switchDataset($(this).attr('data-id'));
                });
                
                /*
                 * Buttons
                 */
                $('#btn-home').click(function() {
                    var mmx = {};
                    sigInst.iterNodes(function(node) {
                        if (!node.hidden) {
                            mmx.ax = Math.min(node.displayX, mmx.ax || node.displayX);
                            mmx.zx = Math.max(node.displayX, mmx.zx || node.displayX);
                            mmx.ay = Math.min(node.displayY, mmx.ay || node.displayY);
                            mmx.zy = Math.max(node.displayY, mmx.zy || node.displayY);
                        }
                    });
                    
                    var position = sigInst.position();
                    var size = sigInst.size();
                    
                    var x = -(mmx.ax + mmx.zx - (2 * position.stageX) - size.w) / 2;
                    var y = -(mmx.ay + mmx.zy - (2 * position.stageY) - size.h) / 2;
                    
                    sigInst.goTo(x, y).draw();
//                    
//                    position = sigInst.position();
//                    size = sigInst.size();
//                    console.log(size);
//                    
//                    sigInst.goTo(0, 0, 1).draw();
                });
                $('#btn-fullscreen').click(function() {
                    console.log($().isFullScreen());
                    if ($().isFullScreen()) {
                        $("#network-container").cancelFullScreen();
                    } else {
                        $("#network-container").requestFullScreen();
                    }
                });
                $('#download-snapshot').click(downloadCanvasSnapshot);
                
                $('#btn-zoom-in').click(function() {
                    var position = sigInst.position();
                    var size = sigInst.size();
                    
                    sigInst.goTo(size.w / 2, size.h / 2, position.ratio * 2).draw();
                });
                $('#btn-zoom-out').click(function() {
                    var position = sigInst.position();
                    var size = sigInst.size();
                    
                    sigInst.goTo(size.w / 2, size.h / 2, position.ratio / 2).draw();
                });
                
                $('#canvas-background-color').change(function() {
                    state.style.global.background = $(this).val();
                    $(rootElement).css('background-color', "#" + state.style.global.background);
                    changeState();
                });
                
                $('#style-label-color').change(function() {
                    state.style.node.lcol = $(this).val();
                    sigInst.drawingProperties({defaultLabelColor: "#" + state.style.node.lcol}).draw(-1, -1, 1);
                    changeState();
                });
                
                /*
                 * Prevent context menu, we want our own
                 * rightclick functionality
                 */
//                $("#network-container").contextmenu(function() {
//                    return false;
//                });
//                // sigh... disable context menu on context menu
//                // b/c its not in the other container
//                $("#contextmenu-container").contextmenu(function() {
//                    return false;
//                });
//                // Nice effects, stop any animations on enter,
//                // hide on leave, hide if not entered (code in
//                // callback above)
//                $("#contextmenu-container").mouseleave(function() {
//                    $(this).delay(500).hide();
//                }).mouseenter(function() {
//                    $(this).stop(true);
//                });
                
                $("#contextmenu a").click(function() {
                    switch ($(this).attr('id')) {
                    case "context-info":
                        var node = getNode(hoveredTargets[0]), strain = getStrain(node.id);
                        
                        console.log(opts.nodeInfo(node, strain));
                        
                        alertUser('Node info', opts.nodeInfo(node, strain));
                        break
                    case "context-dl":
                        var node = getNode(hoveredTargets[0]), strain = getStrain(node.id);
                        window.location.href = 'dl/?n=' + node.id;
                        break
                    case "context-hide":
                        hoveredTargets.forEach(function(node) {
                            node = getNode(node);
                            node.hidden = node._hidden = true;
                        });
                        sigInst.draw();
                        changeNodesState();
                        break
                    case "context-edit-node":
                        editNode(hoveredTargets[0]);
                        break;
                    }
                    
                    $("#contextmenu-container").hide();
                });
                
                $(".pick-a-color").pickAColor();
                
                $(".refresh-network").click(function() {
                    location.reload();
                });
                $(".undo-network").click(function() {
                    if (!$(this).hasClass('disabled'))
                        setState(undo.undo());
                    _updateNavigation();
                    return false;
                });
                $(".redo-network").click(function() {
                    if (!$(this).hasClass('disabled'))
                        setState(undo.redo());
                    _updateNavigation();
                    return false;
                });
                
                $('[data-toggle="tooltip"]').tooltip();
                
//                $("#cutoff-bar .noUi-handle").tooltip({
//                    placement: 'left',
//                    trigger: 'hover focus click',
//                    delay: 100,
//                    title: "FOOOOOOOOOOOO"
//                });
                
                var modal = $('#edit-node-modal');
                modal.modal({show: false});
                modal.find('.modal-confirm').click(function() {
                    var node = getNode(modal.find('#edit-node-id').val());
                    node.label = modal.find('#edit-node-label').val();
                    node.color = modal.find('#edit-node-color').val();
                    sigInst.draw();
                    modal.modal('hide');
                });
                
                $(".tool-arange a").click(arangeNodes);
                
                $("#tool-rotate").click(function() {
                    sigInst.rotateNodes({callback: function() {changeNodesState();}});
                });
                
                $(".disabled a").click(function(e) {
                    e.preventDefault();
                    return false;
                })
            };
            
            function showUI() {
                $(".vizualization-ui").fadeIn(1000);
            }
            
            function init() {
                sigInst = sigma.init(rootElement).drawingProperties({
                    defaultLabelSize: state.style.node.lsize,
                    defaultLabelHoverColor: '#000',
                    labelThreshold: state.style.node.lthr,
                    font: 'Arial',
                    edgeColor : 'white',
                    defaultLabelColor : "#" + state.style.node.lcol,
                    nodeColor : opts.defaultNodeColor,
                    defaultEdgeArrow: opts.arrows ? 'target' : 'none',
                }).graphProperties(graphProperties).mouseProperties({
                    drawHoverEdges: false,
                    maxRatio : 64
                }).bind('rightclicknodes', onNodesContext
                 ).bind('ctrlclicknodes', function () {
                    clicking.modifierKey = 'ctrl';
                }).bind('shiftclicknodes', function () {
                    clicking.modifierKey = 'shift';
                }).bind('upnodes', function(e) {
                    if (!clicking.wasDragging) {
                        onNodesClick(e);
                    }
                    clicking.wasDragging = false;
                    clicking.modifierKey = null;
                }).bind('upgraph', function(evt) {
                    if (!evt.content.dragged && !evt.content.targeted && !evt.content.selecting) { // Clear selection
                        clearSelection();
                    }
                }).bind('draggedNode', function() {
                    clicking.wasDragging = true;
                    changeNodesState()
                }).bind('selectionStop', function(nodes) {
                    noPulse = true;
                    $("input.gene-search-input").select2("val", getSelected().concat(nodes.content), true);
                    noPulse = false;
                }).bind('selectionStart', function() {
                });
                
                buildNewUI();
                initUI();
                
                if (opts.highlight) sigInst.hoverHighlight(opts);
                
                /* Loading spinner each time we hit the server */
                $("body").on({
                    ajaxStart: function() {
                        $('<div class="modal-backdrop fade in"></div>').appendTo(document.body);
//                        $(rootElement).append('<div id="modal-overlay" class="ui-widget-overlay ui-front"></div>');
                    },
                    ajaxStop: function() {
                        $('.modal-backdrop').remove();
//                        $("#modal-overlay").remove()
                    }
                });
                
                /* Add extra dataset */
                opts.datasets[1] = {
                        parser: 'json',
                        url: 'interactions/',
                        method: 'post',
                        fetched: []
                }
                
                state.cutoff[1] = [-0.08, 0.08];
                $('.cutoff-bar[data-dataset="1"]').val(state.cutoff[1], {update: true});
                
                /* Fetch all node info */
                $.getJSON(opts.nodesUrl, function(data) {
                    vizdata['strains'] = data.nodes;
                    vizdata['annotations'] = data.annotations;
                    vizdata['index'] = {};
                    autocomp = [];
                    
                    var strain;
                    var tokens;
                    for (i in data.nodes) {
                        strain = data.nodes[i];
                        strain.o = strain.orf.toLowerCase();
                        tokens = [strain.o];
                        strain.n = strain.name && strain.name.toLowerCase();
                        if (!!strain.n) tokens.push(strain.n);
                        strain.a = strain.alel && strain.alel.toLowerCase();
                        if (!!strain.a) tokens.push(strain.a);
                        
                        strain.verboseName = strain.label || strain.alel || strain.name || strain.orf;
                        strain.terms = strain.terms || tokens;
                        
                        vizdata.index[strain.id] = i;
                        
                        autocomp.push({
                            value: strain.verboseName,
                            tokens: strain.terms,
                            id: strain.id
                          });
                    }
                    
                    var tokenizing = false;
                    $("input.gene-search-input").select2({
                        multiple: true,
                        minimumInputLength: 2,
                        containerCssClass: 'form-control', 
                        placeholder: 'Start typing genes...',
                        allowClear: true,
                        width: '350px',
                        tokenSeparators: [",", " ", "\t", "\n"],
                        initSelection: function (element, callback) {
                            var id = $(element).val(), strain, result = [];
                            
                            id.split(",").forEach(function(x) {
                                if (x !== "") {
                                    strain = getStrain(x);
                                    result.push({
                                        text: strain.verboseName,
                                        id: strain.id
                                    });
                                }
                            });
                            callback(result);
                        },
                        tokenizer: function (input, selection, selectCallback, opts) {
                            var original = input, // store the original so we can compare and know if we need to tell the search to update its text
                            dupe = false, // check for whether a token we extracted represents a duplicate selected choice
                            token, // token
                            index, // position at which the separator was found
                            i, l, // looping variables
                            separator; // the matched separator
                            
                            if (!opts.createSearchChoice || !opts.tokenSeparators || opts.tokenSeparators.length < 1) return undefined;
                            
                            tokenizing = true;
                            var addedNew = false;
                            while (true) {
                                index = -1;
                                
                                for (i = 0, l = opts.tokenSeparators.length; i < l; i++) {
                                    separator = opts.tokenSeparators[i];
                                    index = input.indexOf(separator);
                                    if (index >= 0) break;
                                }
                                
                                if (index < 0) break; // did not find any token separator in the input string, bail
                                
                                token = input.substring(0, index);
                                input = input.substring(index + separator.length);
                                
                                if (token.length > 0) {
                                    var tokens = opts.createSearchChoice.call(this, token, selection);
                                    if (tokens !== undefined && tokens !== null) {
                                        if( Object.prototype.toString.call( tokens ) !== '[object Array]' ) {
                                            tokens = [tokens];
                                        }
                                        
                                        tokens.forEach(function(token) {
                                            if (opts.id(token) !== undefined && opts.id(token) !== null) {
                                                dupe = false;
                                                for (i = 0, l = selection.length; i < l; i++) {
                                                    if (opts.id(token) == opts.id(selection[i])) {
                                                        dupe = true; break;
                                                    }
                                                }
                                                
                                                if (!dupe) {
                                                    selectCallback(token);
                                                    addedNew = true;
                                                }
                                            }
                                        });
                                    }
                                }
                            }
                            
                            tokenizing = false;
                            if (addedNew) {
                                this.triggerChange({foo: "bar"});
                            }
                            if (original!==input) return input;
                        },
                        createSearchChoice: function(term) {
                            var wildcard = term.indexOf('*') != -1;
                            term = term.replace('*', '').toLowerCase();
                            
                            if (term.length > 0) {
                                var results = [], seen = {};
                                
                                autocomp.forEach(function(node) {
                                    node.tokens.forEach(function(token) {
                                        if (!seen.hasOwnProperty(node.id) && ((wildcard && token.toLowerCase().startsWith(term)) || token.toLowerCase() === term)) {
                                            results.push({id: node.id, text: node.value });
                                            seen[node.id] = 0;
                                            return;
                                        }
                                    });
                                });
                                
                                if (results.length !== 0) return results;
                            }
                        },
                        query: function(query) {
                            if (query.term === undefined) {
                                query.callback({results: []});
                                return;
                            }
                            
                            var data = {results: []};
                            var term = query.term.replace('*', '').toLowerCase();
                            
                            autocomp.forEach(function(node) {
                                if (query.term.length == 0){
                                    data.results.push({id: node.id, text: node.value });
                                } else {
                                    for (var x in node.tokens) {
                                        if (node.tokens[x].toLowerCase().indexOf(term) !== -1) {
                                            data.results.push({id: node.id, text: node.value });
                                            break;
                                        }
                                    }
                                }
                            });
                            
                            data.results = data.results.slice(0, 5);
                            query.callback(data);
                        },
                        data: autocomp,
                    }).on('select2-selecting', function(evt) {
//                        if (getNode(evt.val) === undefined) {
//                            var strain = getStrain(evt.val);
//                            messageUser('Gene <strong>' + strain.verboseName + '</strong> was screened but is below the lowest threshold');
//                            
//                            
//                        }
                    }).on('change', function(evt, a, b, c) {
                        var selected = getSelected();
                        
                        sigInst.iterNodes(function(node) {
                            if ($.inArray(node.id, selected) >= 0) {
                                node.selected = true;
                                
                                if (node.hidden) {
                                    messageUser('Gene you\'re looking for is below current threshold.')
                                }
                            } else {
                                node.selected = false;
                            }
                        });
                        
                        $('#btn-group-neighbourhood').toggleClass('hidden', selected.length == 0);
                        $('#btn-group-layout').toggleClass('hidden', opts.layoutButtonHide && selected.length == 0);
                        $('#download-selected').toggleClass('disabled', selected.length == 0);
                        
                        if (!tokenizing) {
                            updateMissingMessage();
                            sigInst.draw();
                            
                            if (!($(selected).not(state.selection).length == 0 && $(state.selection).not(selected).length == 0)) {
                                var diff = $(getSelected()).not(state.selection).get();
                                
                                state.selection = getSelected();
                                $(".tool-arange").toggleClass("disabled", state.selection.length == 0);
                                if (!noPulse) {
                                    sigInst.pulseNodes({nodes: sigInst._core.graph.nodes.filter(function(node) {
                                        return diff.indexOf(node.id) != -1;
                                    })});
                                }
                                changeState();
                            }
                        }
                    }).on('select2-blur', function() {
                    });
                    
                    showUI();
                    
                    // Load plot graph in Michael Jackson mode by
                    // default
                    loadAnnotation(state.annotation);
                    loadLayout();
                });
                
                
                $(document).mousemove(updateMousePosition);
            }
            
            /* Starting point */
            init();
        }
    });
})(jQuery);
