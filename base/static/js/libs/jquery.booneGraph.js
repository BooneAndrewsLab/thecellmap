(function($) {
    if(!window.console) {window.console={}; window.console.log = function(){};}
 
    $.extend($.fn, {
        /**
         * Starting point, example:
         * $('#myelement').jBooneGraph({foo: bar});
         */
        booneGraph : function(o) {
            /* Default options */
            var DEFAULTS = {
                    defaultNodeColor: '#E8E8E8',
                    multifunctionNodeColor: '#E8E8E8',
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
                    modifiedCallback: null,
                    uiUrl: "url/",
                    downloadLimit: 30,
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
            
            var state = new State();
            state.setProperty("cutoff_0", sliderProperties.value);
            
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
                var reapplyCutoff = false;
                var difference = state.compareTo(newState.style);
                
                for (key in difference) {
                    switch (difference[key]) {
                    case 'selection':
                        $("input.gene-search-input").select2("val", newState.style.getProperty("selection"), true);
                        break;
                    case 'edgeSelection':
                        onEdgesClick({content: newState.style.getProperty("edgeSelection")});
                        break;
                    case 'nodeSize':
                        $('#style-slider-nsize').val(newState.style.getProperty("nodeSize"), true);
                        break;
                    case 'labelSize':
                        $('#style-slider-lsize').val(newState.style.getProperty("labelSize"), true);
                        break;
                    case 'labelThreshold':
                        $('#style-slider-lthresh').val(newState.style.getProperty("labelThreshold"), true);
                        break;
                    case 'labelColor':
                        $('#style-label-color').val(newState.style.getProperty("labelColor")).focus().blur().change(); // Stupid but effective
                        break;
                    case 'edgeWidth':
                        $('#style-slider-esize').val(newState.style.getProperty("edgeWidth"), true);
                        break;
                    case 'background':
                        $('#canvas-background-color').val(newState.style.getProperty("background")).focus().blur().change(); // Stupid but effective
                        break;
                    case 'annotation':
                        loadAnnotation(newState.style.getProperty("annotation"));
                        break;
                    case 'dataset':
                        $("#btn-group-datasets a[data-id=\"" + newState.style.getProperty("dataset") + "\"]").click();
                        reapplyCutoff = true;
                        break;
                    }
                }
                    
                for (var i = 0; i < newState.style.numOfCutoffs(); i++) {
                    if (newState.style.getProperty("cutoff_" + newState.style.getProperty("dataset")) != state.getProperty("cutoff_" + state.getProperty("dataset"))) {
                        state.setProperty(("cutoff_" + i), newState.style.getProperty("cutoff_" + i));
                        
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
                            node.forceLabel = n.forceLabel;
                        }
                    }
                    
                    reapplyCutoff = true;
                    $("input.gene-search-input").select2("val", newState.style.getProperty("selection"), true);
                    sigInst.draw();
                }
                
                if (reapplyCutoff) {
                    log("reapplying", state.getProperty("dataset"), state.getProperty("cutoff"), state.getProperty("cutoff_" + state.getProperty("dataset")));
                    applyCutoff(state.getProperty("cutoff_" + state.getProperty("dataset")));
                    
                    if (state.getProperty("dataset") == 0) { // TEMPORARY HACK
                        $(".cutoff-bar[data-dataset=\"" + state.getProperty("dataset") + "\"]").val(opts.datasets[0].min + (opts.datasets[0].max-opts.datasets[0].min) / 2); // HAAAAAAAAAAAAACK BUGZ IN nouislider...
                    }
                    $(".cutoff-bar[data-dataset=\"" + state.getProperty("dataset") + "\"]").val(state.getProperty("cutoff_" + state.getProperty("dataset")), {update: true});
                }
                
                autoState = false;
            };
            
            function changeState() {
                if (!isInitializing && !autoState && undo != null) {
                    undo.addChange(state.clone());
                    _showNavigation();
                }
            };
            
            function changeNodesState() {
                if (!autoState && undo != null) {
                    var nodeState = {};
                    sigInst._core.graph.nodes.filter(function(node) {
                        nodeState[node.id] = {x: node.x, y: node.y, hidden: node._hidden, color: node.color};
                    });
                    
                    undo.addChange(state.clone(), nodeState);
                    _showNavigation();
                }
            };
            
            function log() {
                if (opts.debug && window.console) console.log(arguments);
            };
            
            function getCutoff() {
                return state.getProperty("cutoff_" + state.getProperty("dataset"));
            }
            
            function setCutoff(cutoff) {
                return state.setProperty("cutoff_" + state.getProperty("dataset"), cutoff);
            }
            
            function countVisibleNodes() {
                return sigInst._core.graph.nodes.filter(function(node) {
                    return !node.hidden;
                }).length;
            };
            
            function countVisibleEdges() {
                return sigInst._core.graph.edges.filter(function(edge) {
                    return !edge.hidden && !edge.source.hidden && !edge.target.hidden;
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
            
            function getEdge(id) {
                return sigInst._core.graph.edgesIndex[id];
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
                setTimeout(function() { alert.alert('close'); }, 3000);
            }
            
            function updateMissingMessage() {
                if (autoState) return;
                var missing = [];
                getSelection().forEach(function(sel) {
                    if (!sel.startsWith('annot') && getNode(sel) === undefined) {
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
                } else {
                    $('#alert-missing').remove();
                }
            };
            
            function updateTooltips() {
                var nodes = getSelectedNodes(true);
                $('#download-selected').parent().tooltip('destroy');
                if ($('#download-selected').hasClass('disabled')) {
                    if (nodes.length > opts.downloadLimit)
                        $('#download-selected').parent().tooltip({title: 'Download limited to less than 30 nodes',
                            placement: 'right'});
                    else if (nodes.length == 0)
                        $('#download-selected').parent().tooltip({title: 'Select some nodes first',
                            placement: 'right'});
                }
                
                $('#view-tabular').parent().tooltip('destroy');
                if ($('#view-tabular').hasClass('disabled')) {
                    $('#view-tabular').parent().tooltip({title: 'Select some nodes first', placement: 'right'});
                }
            }
            
            function editNode(id) {
                var modal = $('#edit-node-modal'), node = getNode(id), strain = getStrain(id), data = vizdata[state.getProperty("annotation")];
                var url = 'http://www.yeastgenome.org/cgi-bin/locus.fpl?locus=' + strain.orf;
                var annot, term, color;
                
                modal.find('.modal-title').html('Node details: "' + node.label + '"');
                
                modal.find('#node-orf').html(strain.orf);
                modal.find('#node-name').html(strain.name);
                modal.find('#node-allele').html(strain.alel);
                modal.find('#node-sgd').html('<a href="' + url + '">' + url + '</a>');
                
                modal.find('#edit-node-id').val(id);
                modal.find('#edit-node-label').val(node.label);
                modal.find('#edit-node-color').val(node.color).focus().blur().change();
                modal.find('#edit-node-label-force').prop('checked', !!node.forceLabel);
                modal.find('#edit-node-size-multiplier').val(node.size_mult || 1);
                
                $('#node-annotation-table').empty();
                
                annot = data.map[strain.orf] || ["-1"];
                
                if (annot.length > 1) {
                    term = data.terms["-2"];
                    $('#node-annotation-table').append('<tr class="annotation-row" data-term="' + term.idx + '">\
                            <td><input class="form-control pick-a-color annotation-color" value="' + data.colorPalette[term.idx] + '"></td>\
                            <td>' + term.name + '</td>\
                            <td><input type="radio" name="dominant"></td></tr>');
                }
                
                annot.forEach(function(a) {
                    if (data.terms.hasOwnProperty(a)) {
                        term = data.terms[a];
                        color = data.colorPalette[term.idx];
                    }
                    
                    $('#node-annotation-table').append('<tr class="annotation-row" data-term="' + term.idx + '">\
                            <td><input class="form-control pick-a-color annotation-color" value="' + color + '"></td>\
                            <td>' + term.name + '</td>\
                            <td><input type="radio" name="dominant"></td></tr>');
                });
                
                var attributes = strain["attributes"];
                $('#attribute-head').empty();
                $('#attribute-body').empty();
                
                if (attributes != undefined || attributes != null) {
                    $('#attribute-head').append('<tr><th>Attribute</th><th style="width: 25%;">Attribute Details</th></tr>');
                    
                    for (var attr in attributes) {
                        $('#attribute-body').append('<tr class="attribute-row">\
                            <td>' + attr + '</td>\
                            <td>' + attributes[attr] + '</td></tr>');
                    }
                }
                $('#node-annotation-table .pick-a-color[value="' + node.color + '"]').closest('tr').find('input[type="radio"]').prop('checked', true);
                $('#node-annotation-table .pick-a-color').pickAColor({showHexInput: false}).on("change", function() {
                    if ($(this).closest('tr').find('input[name=dominant]').prop('checked')) {
                        modal.find('#edit-node-color').val($(this).val()).focus().blur().change();
                    }
                });
                
                $('#node-annotation-table input[name=dominant]').change(function() {
                    modal.find('#edit-node-color').val(
                            $('#node-annotation-table input[name=dominant]:checked').closest('tr').find('.pick-a-color').val()
                        ).focus().blur().change();
                });
                
                modal.modal('show');
            }
            
            function alertUser(title, text, preModalCallback) {
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
                
                if (preModalCallback != undefined) {
                    preModalCallback($('#modal-alert'));
                }
                
                $('#modal-alert').modal().on('hidden.bs.modal', function () {
                    $(this).remove();
                });
            }

            function setNodeColor(node, color) {
                if (color == undefined) {
                    var stateAnnot = state.getProperty("annotation");
                    var annot = vizdata[stateAnnot].map[node.id];
                    if (annot != undefined) {
                        color = vizdata[stateAnnot].colorPalette[vizdata[stateAnnot].terms[annot[0]].idx];
                    } else {
                        color = vizdata[stateAnnot].defaultColor;
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
            
            function getSelectedNodes(visible) {
                var selected = getSelection(), map, annotations = [], result;
                var i, j, selectedByAnnotation = {}, strain, node;
                
                result = selected.filter(function(sel) {
                    return !sel.startsWith('annot') && !sel.startsWith('action');
                });
                
                if (vizdata.hasOwnProperty(state.getProperty("annotation"))) {
                    map = vizdata[state.getProperty("annotation")].map;
                    
                    selected.forEach(function(sel) {
                        if (sel.startsWith('annot')) {
                            annotations.push(parseInt(sel.replace('annot', '')));
                        }
                    });
                    
                    // Some annotations are selected
                    if (annotations.length > 0) {
                        for (i in map) {
                            if (map.hasOwnProperty(i)) {
                                for (j in map[i]) {
                                    if ($.inArray(map[i][j], annotations) >= 0 && !selectedByAnnotation.hasOwnProperty(i)) {
                                        selectedByAnnotation[i] = null;
                                    }
                                }
                            }
                        }
                    }
                }
                
                vizdata.strains.forEach(function(strain) {
                    if (selectedByAnnotation.hasOwnProperty(strain.orf)) {
                        result.push(strain.id + "");
                    }
                });
                
                if (!!visible) {
                    return result.filter(function(strainid) {
                        node = getNode(strainid);
                        return !!node && !node.hidden;
                    });
                }
                
                return result;
            }
            
            function getSelection() {
                return $("input.gene-search-input").select2('val');
            }
            
            function clearSelection() {
                sigInst.iterEdges(function(e) {
                    e.selected = false;
                });
                
                if (state.getProperty("selection").length > 0) {
                    $("input.gene-search-input").select2('val', "", true);
                    state.setProperty("selection", []);
                } else {
                    sigInst.draw();
                }
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
            
            function showCorrelationDriving(fromNodes) {
                var nodes = [];
                autoState = true; // Prevent automatic state change on loadDataset
                
                $(".dataset-constraint").removeClass("disabled");
                
                if (fromNodes) {
                    nodes = getSelectedNodes(true);
                    console.log(nodes);
                } else {
                    hoveredTargets.forEach(function(e) {
                        e = getEdge(e);
                        if (nodes.indexOf(e.source.id) == -1) nodes.push(e.source.id);
                        if (nodes.indexOf(e.target.id) == -1) nodes.push(e.target.id);
                    });
                }
                
                loadDataset(1, {csrfmiddlewaretoken: $.cookie('csrftoken'), nodes: nodes}, undefined, function(edges) {
                    nodes = [];
                    edges.forEach(function(e) {
                        if (nodes.indexOf(e.source) == -1) nodes.push(e.source);
                        if (nodes.indexOf(e.target) == -1) nodes.push(e.target);
                    });
                    
                    sigInst.iterNodes(function(node) {
                        node._hidden = node.hidden = nodes.indexOf(parseInt(node.id)) == -1;
                    });
                    
                    $("#btn-group-datasets a").removeClass('active');
                    $("#btn-group-datasets a[data-id=1]").addClass('active');
                    $("#selected-dataset").html("Genetic interactions");
                    
                    state.setProperty("dataset", 1);
                    
                    sigInst.draw();
                    
                    autoState = false;
                    
                    changeNodesState();
                });
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
                    $(".dataset-constraint").addClass("disabled");
                    updateEdges(value);
                } else { // Interactions
                    var newVisible = [];
                    sigInst._core.graph.nodes.filter(function(node) {
                        if (!node.hidden && dataset.fetched.indexOf(node.id) == -1) newVisible.push(node.id);
                    });
                    
                    if (newVisible.length > 100 && !autoState) {
                        alertUser('Too many nodes', 'Too many nodes are visible to switch to genetic interaction data.\
                                Maximum number of nodes is 100 but you have ' + newVisible.length + ' visible.');
                        $("#btn-group-datasets a[data-id=\"0\"]").addClass('active');
                        $("#selected-dataset").html("Correlations");
                        return;
                    }
                    
                    dataset.fetched = dataset.fetched.concat(newVisible);
                    
                    dsEle.addClass('active');
                    $("#selected-dataset").html("Genetic interactions");
                    $(".dataset-constraint").removeClass("disabled");
                    
                    if (!newVisible.length) {
                        updateEdges(value);
                    } else {
                        loadDataset(value, {csrfmiddlewaretoken: $.cookie('csrftoken'), nodes: newVisible});
                    }
                }
                
                state.setProperty("dataset", value);
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
                
                if (ds == 0) {
                    ele.val(minWeight + (maxWeight-minWeight) / 2); // HAAAAAAAAAAAAACK BUGZ IN nouislider...
                    ele.val([state.getProperty("cutoff_" + ds) || minWeight]);
                } else {
                    $("#cutoff-label-max").html(state.getProperty("cutoff_" + ds)[1]);
                    $("#cutoff-label-min").html(state.getProperty("cutoff_" + ds)[0]);
                }
                
                if (sliderProperties.updateLimits) {
                    if (ds == 0) {
                        ele.noUiSlider({range: {min: minWeight, max: maxWeight}, start: minWeight}, true);
                        ele.val(minWeight + (maxWeight-minWeight) / 2); // HAAAAAAAAAAAAACK BUGZ IN nouislider...
                        ele.val([state.getProperty("cutoff_" + ds) || minWeight]);
                    } else {
                        ele.val([-0.08, 0.08]);
                    }
                }
                
                if (ds == 0) {
                    $("#cutoff-label-max").css('visibility', 'hidden');
                    $("#cutoff-label-min").removeClass('btn-danger').addClass('btn-default');
                } else {
                    $("#cutoff-label-max").css('visibility', 'visible');
                    $("#cutoff-label-min").removeClass('btn-default').addClass('btn-danger');
                }
                
                $(".cutoff-bar").css('display', 'none');
                ele.css('display', 'block');
                
                changeState();
                sigInst.draw();
                isInitializing = false;
            }
            
            function loadDataset(dsid, data, preloaded, callback) {
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
                    
                    if (callback != undefined) {
                        callback(edges);
                    }
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
                    rebuildLegend();
                }
                getParser(layout.parser)({
                    jq: $, sigInst: sigInst, url: layout.url, vizdata: vizdata, cb: layoutCallback, state: state
                });
            }

            function loadAnnotation(id) {
                state.setProperty("annotation", id);
                
                if (id == "None")
                    $(".annotation-constraint").addClass("disabled");
                else
                    $(".annotation-constraint").removeClass("disabled");
                
                if (vizdata[id] == undefined) {
                    if (id == 'None') {
                        vizdata[id] = {
                                map : {},
                                defaultColor : opts.defaultNodeColor,
                                terms: {"-1": {id: -1, idx: 0, name: 'Unannotated', orig_name: 'Unannotated'}},
                                colorPalette: [opts.defaultNodeColor]
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
                                        if (vizdata[id].defaultColor == undefined) {
                                            vizdata[id].defaultColor = opts.defaultNodeColor;
                                            vizdata[id].multifunctionColor = opts.multifunctionNodeColor;
                                        }
                                        
                                        var i = 0, n, colors = [];
                                        for (n in vizdata[id].terms) {
                                            colors.push(vizdata[id].terms[n].color);
                                            if(colors[i].indexOf("#" == -1)) {
                                                colors[i] = "#" + colors[i];
                                            }
                                            
                                            vizdata[id].terms[n] = {
                                                    idx : i++,
                                                    id : n,
                                                    name : vizdata[id].terms[n].name,
                                                    orig_name : vizdata[id].terms[n].name,
                                            }
                                        }
                                        
                                        $.extend(vizdata[id].terms, {
                                              "-1": {id: -1, idx: i, name: 'Unannotated', orig_name: 'Unannotated'},
                                              "-2": {id: -2, idx: i+1, name: 'Multi-function', orig_name: 'Multi-function'}
                                            }
                                          );
                                        
                                        vizdata[id].colorPalette = colors.concat([opts.defaultNodeColor, opts.multifunctionNodeColor]);
                                    }
                                });
                            }
                        });
                    }
                }
                
                /* Remove any selected annotations from a different annotation */
                var oldState = autoState;
                autoState = true;
                var selection = getSelection().filter(function(s) {return (!s.startsWith('annot'))});
                $("input.gene-search-input").select2("val", selection, true);
                
                autoState = oldState;
                applyAnnotationColors();
                rebuildLegend();
                
                changeNodesState();
            }
            
            function rebuildLegend() {
                var id = state.getProperty("annotation"), terms = {}, strain = [], mapStrain = {};
                //select only visible strains
                sigInst.iterNodes(function(node) {
                    if (!node.hidden) {
                        strain.push(getStrain(node.id));
                    }
                });
                
                //store terms of the visible strains into the variable terms
                for (var i = 0; i < strain.length; i++) {
                    mapStrain = vizdata[id].map[(strain[i].orf)];
                    if (typeof mapStrain !== 'undefined') {
                        if (mapStrain.length == 1) {
                            terms[mapStrain] = vizdata[id].terms[mapStrain];
                        }
                        //for multi-function strains
                        else
                            terms[-2] = vizdata[id].terms[-2];
                    }
                    //for unannotated strains
                    else
                        terms[-1] = vizdata[id].terms[-1];
                }
                
                $("#style-annotation").empty();
                $("#style-annotation").append('<table class="annotation-table"><thead><tr>\
                      <th style="width: 1%;"></th>\
                      <th>Annotation</th></tr></thead>\
                  <tbody id="style-annotation-table"></tbody></table>');
                
                for (n in terms) {
                    var term = terms[n];
                    var color;
                    if ($.cookie(term.name) == undefined)
                        color = vizdata[id].colorPalette[term.idx];
                    else
                        color = $.cookie(term.name);
                    $('#style-annotation-table').append('<tr class="annotation-row" data-term="' + term.idx + '">\
                            <td><input class="form-control pick-a-color annotation-color" value="' + color + '">\
                            <td>' + term.name + '</td></td></tr>');
                }
                
                $('#style-annotation-table').find(".pick-a-color").pickAColor({showHexInput: false, showSavedColors: false});
                $("#style-annotation-table .pick-a-color").on('change', function() {
                    var term, color = '#' + $(this).val(), a = $(this).closest("tr").data("term");
                    for (n in terms) {
                        term = vizdata[id].terms[n];
                        if(terms[n].idx == a) {
                            break
                        }
                    }
                    
                    if (n != -1 && n != -2){
                        $.cookie(term.name, color);
                    }
                    else
                        vizdata[id].colorPalette[term.idx] = color;
                    
                    $("#panel-annotation-" + term.id + " .panel-heading").css('background', '-webkit-linear-gradient(left, #f5f5f5, ' + color + ' 50%)');
                    $("#panel-annotation-" + term.id + " .panel-heading").css('background', '-moz-linear-gradient(right, #f5f5f5, ' + color + ' 50%)');
                    $("#panel-annotation-" + term.id + " .panel-heading").css('background', '-o-linear-gradient(right, #f5f5f5, ' + color + ' 50%)');
                    $("#panel-annotation-" + term.id + " .panel-heading").css('background', 'linear-gradient(to right, #f5f5f5, ' + color + ' 50%)');
                    applyAnnotationColors();
                    changeNodesState();
                });
            }
            
            function applyAnnotationColors() {
                var data = vizdata[state.getProperty("annotation")], strain, annot;
                sigInst.iterNodes(function(n) {
                    strain = getStrain(n.id);
                    annot = data.map[strain.orf];
                    if (annot != undefined) {
                        if (annot.length == 1 && $.cookie(data.terms[annot[0]].name) == undefined)
                            n.color = data.colorPalette[data.terms[annot[0]].idx];
                        else if (annot.length == 1)
                            n.color = $.cookie(data.terms[annot[0]].name)
                        else
                            n.color = data.colorPalette[data.terms["-2"].idx];
                    } else {
                        // No annotation or multifunction
                        n.color = data.colorPalette[data.terms["-1"].idx];
                    }
                }).draw();
            }
            
            function onNodesContext(targets) {
                hoveredTargets = targets.content;
                $("#contextmenu-container").show().delay(2000).hide(200);
                $("#contextmenu-container").css({
                    left : mouseX,
                    top : mouseY,
                });
            }

            function onEdgesContext(targets) {
                hoveredTargets = targets.content;
                $("#contextmenu-edge-count").html(state.getProperty("edgeSelection").length + ' edge' + (state.getProperty("edgeSelection").length == 1 ? '' : 's') + ' selected');
                $("#contextmenu-edge-container").show().delay(2000).hide(200);
                $("#contextmenu-edge-container").css({
                    left : mouseX,
                    top : mouseY,
                });
            }
            
            function onEdgesClick(targets) {
                state.setProperty("edgeSelection", targets.content);
                sigInst.iterEdges(function(e) {
                    e.selected = targets.content.indexOf(e.id) != -1;
                });
                
                var clicked = sigInst._core.graph.edges.filter(function(e) {
                    return e.selected;
                });
                clicked = clicked.map(function(e) {return [e.source.id, e.target.id];});
                var nodeClicked = [];
                for(var i = 0; i < clicked.length; i++) {
                    nodeClicked = nodeClicked.concat(clicked[i]);
                }
                $("input.gene-search-input").select2("val", nodeClicked, true);
            }
            
            function onNodesClick(targets) {
                noPulse = true;
                
                switch(clicking.modifierKey) {
                case 'ctrl':
                    break;
                case 'shift':
                    $("input.gene-search-input").select2("val", getSelection().concat(targets.content), true);
                    break;
                default:
                    $("input.gene-search-input").select2("val", targets.content, true);
                    break;
                }
                noPulse = false;
            }
            
            function onNodeClick(targets) {
                $("input.gene-search-input").select2("val", targets.content, true);
            }
            
            function onNodesShiftClick(targets) {
                $("input.gene-search-input").select2("val", getSelection().concat(targets.content), true);
            }
            
            function _setRunningLayout(bool) {
                var ladda, button = $('#btn-layout');
                
                opts.runningLayout = bool;
                button.toggleClass('btn-primary', !bool);
                button.toggleClass('btn-danger', bool);
                
                if (!bool) {
                    changeNodesState();
                    ladda = Ladda.getInstance(button.attr('id'));
                    ladda.stop();
                    button.siblings(".dropdown-toggle").removeClass('disabled');
                } else {
                    ladda = Ladda.create(button[0]);
                    button.siblings(".dropdown-toggle").addClass('disabled');
                    ladda.start();
                    button.removeAttr("disabled");
                }
            }
            
            function arangeNodes() {
                var selected = getSelectedNodes(true), xmin, xmax, ymin, ymax, n = 0;
                if (selected.length < 3) return;
                
                selected.forEach(function(node){
                    node = getNode(node);
                    xmin = xmin ? Math.min(xmin, node.x) : node.x;
                    xmax = xmax ? Math.max(xmax, node.x) : node.x;
                    ymin = ymin ? Math.min(ymin, node.y) : node.y;
                    ymax = ymax ? Math.max(ymax, node.y) : node.y;
                });
                
                switch($(this).data('arange-type')) {
                case "circle":
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
                case "crescent-right":
                    n += selected.length / 2;
                case "crescent-top":
                    n += selected.length / 2;
                case "crescent-left":
                    n += selected.length / 2;
                case "crescent-bottom":
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
            
            function toggleLayout(justStop, layoutType) {
                if (justStop.preventDefault != undefined) {
                    justStop.preventDefault();
                }
                
                if ($(this).data("layout-type") == "annotation" && state.getProperty("annotation") == "None")
                    return;
                else if ($(this).data("layout-type") == "gi" && state.getProperty("dataset") == 0)
                    return;
                
                var layoutButton = $("#btn-layout");
                if (countVisibleEdges() > 20000) {
                    alertUser('Too many edges', 'Too many edges are visible for the layout algorithm to run efficiently.<br>Edge count: ' + countVisibleEdges());
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
                        progress_callback: function(p) {
                            Ladda.getInstance(layoutButton.attr('id')).setProgress(p);
                        },
                        attraction_multiplier: $("#layout-slider-att").val() || 50,
                        repulsion_multiplier: $("#layout-slider-rep").val() || 1,
                        edgeFilter: function(edge) { return edge.weight > 0; },
                    };
                    
                    switch(layoutType || $(this).attr('data-layout-type') || 'force') {
                    case 'annotation':
                        annotations = {};
                        data = vizdata[state.getProperty("annotation")];
                        
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
                            
                            groups[tmpkey].nodes.push(n);
                        });
                        
                        for (key in groups) {
                            if (groups[key].keylen == 0) continue; // No edges whatsoever... would make weight=infinity
                            
                            weight = Math.log(groups[key].keylen) + 0.01;
                            
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
                        
                        data = vizdata[state.getProperty("annotation")];
                        
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
                    }
                    
                    sigInst.startForceLayout(lopts);
                    _setRunningLayout(true);
                }
                
            }
            
            function applyNeighbourhood(level) {
                /* Resets big red nodes */
                var selected = getSelectedNodes(true), localSelected = {}, tmpSelected, strain;
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
                    strain = getStrain(node.id);
                    
                    if (!localSelected.hasOwnProperty(strain.id)) {
                        node._hidden = node.hidden = true;
                    }
                });
                
                applyCutoff(getCutoff());
            };
            
            function applyCutoff(cutoff) {
                log('applying cutoff', cutoff);
                setCutoff(cutoff);
                
                var isArray = $.isArray(cutoff), selected = getSelectedNodes(true), strain;
                
                sigInst.iterNodes(function(node) {
                    node.visibleDegree = node.degree;
                }).iterEdges(function(edge) {
                    if (isArray) {
                        edge.hidden = (-cutoff[1] < edge.weight && edge.weight < -cutoff[0]) || edge.ds != state.getProperty("dataset");
                    } else {
                        edge.hidden = Math.abs(edge.weight) < cutoff || edge.ds != state.getProperty("dataset");
                    }
                    
                    if (edge.hidden || edge.source._hidden || edge.target._hidden) {
                        edge.source.visibleDegree--;
                        edge.target.visibleDegree--;
                    }
                }).iterNodes(function(node) {
                    strain = getStrain(node.id);
                    node.hidden = (node._hidden || node.visibleDegree <= 0) && selected.indexOf(strain.id + "") == -1; // either we manually hid the node or it's not connected to anything
                });
                
                rebuildLegend();
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
                $("#contextmenu-edge-container").appendTo("body");
                $("#edit-node-modal").appendTo("body");
                $("#rotation-modal").appendTo("body");
            }
            
            function initUI() {
                /*
                 * CLICK handlers
                 */
                $('#btn-group-neighbourhood a').click(function(evt) {
                    switch($(evt.target).data('type')) {
                    case 'neighbourhood':
                        applyNeighbourhood($(evt.target).data('level'));
                        break;
                    case 'correlation-gi':
                        var selection = getSelectedNodes(true);
                        if (selection.length > 1 && selection.length < 7)
                            showCorrelationDriving(true);
                        break;
                    }
                    
                    changeNodesState();
                    evt.preventDefault();
                });
                
                $(".dropdown-toggle").click(function(evt) {
                    evt.isDropDownToggleEvent = true;
//                    evt.stopPropagation();
////                    while (!$(this).parent().hasClass('open'))
//                    $(this).dropdown('toggle').dropdown('toggle');
                });
                
                $('#btn-group-annotation li a').click(function(evt) {
                    $('#btn-group-annotation li').removeClass('active');
                    $(this).parent().addClass('active');
                    loadAnnotation(evt.target.text); 
                    evt.preventDefault();
                });
                $('#btn-layout, .tool-layout').click(toggleLayout);
                
                $("#btn-group-download a, #btn-group-download button").click(function(evt) {
                    switch ($(this).attr('id')) {
                    case "download-visible":
                        downloadShownData();
                        break;
                    case "btn-view":
                    case "view-tabular":
                        var selected = getSelectedNodes();
                        if (selected.length > 0) 
                            window.open('tabular/?' + $.param({'n': selected}, true), '_blank');
                        break;
                    case "download-selected":
                        var selected = getSelectedNodes();
                        if (selected.length > 0 && selected.length < 20) 
                            window.location.href = 'dl/?' + $.param({'n': selected}, true);
                        break;
                    case "download-dataset":
                        if (opts.canBulkDownload) {
                            window.open('dl/','_blank');
                        }
                        break;
                    case "download-xgmml":
                        downloadXGMML();
                        break;
                    case "list-selected":
                        var selected = getUnique(getSelectedNodes().map(function(s) {return getStrain(s).label;}).sort());
                        var selectedOrfs = getUnique(getSelectedNodes().map(function(s) {return getStrain(s).orf;}).sort());
                        if (selected.length > 0)
                            alertUser('Selected genes', selected.join('<br>'), function(ele) {
                                ele.find('.modal-footer').append(
                                    '<button type="button" class="btn btn-primary submit-ym" data-dismiss="modal">Submit ORFs to YeastMine</button>');
                                ele.find('.submit-ym').click(function() {
                                    $('<form target="_blank" action="http://yeastmine.yeastgenome.org/yeastmine/portal.do" method="post">\
                                            <input type="hidden" name="class" value="Gene"> \
                                            <input type="hidden" name="externalids" value="' + selectedOrfs.join(',') + '"> \
                                       </form>').submit();
                                });
                            });
                        
                        break;
                    case "download-get-object":
                        console.log(JSON.stringify(state.asJson()));
                    }
                    
                    evt.preventDefault();
                });
                
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
                            state.setProperty("nodeSize", $(this).val());
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
                            state.setProperty("labelSize", $(this).val());
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
                            state.setProperty("lableThreshold", $(this).val());
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
                            state.setProperty("edgeWidth", $(this).val());
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
                    
                    //revert annotation colors to default
                    var stateAnnot = state.getProperty("annotation");
                    var data = vizdata[stateAnnot], strain, annot;
                    sigInst.iterNodes(function(n) {
                        strain = getStrain(n.id);
                        annot = data.map[strain.orf];
                        if (annot != undefined)
                            $.removeCookie(data.terms[annot[0]].name);
                    });
                    vizdata[stateAnnot].colorPalette[data.terms["-1"].idx] = 'e3e3e3';
                    vizdata[stateAnnot].colorPalette[data.terms["-2"].idx] = 'e3e3e3';
                    
                    rebuildLegend();
                    applyAnnotationColors();
                });
                $('.btn-style').click(function() {
                    $('#style-tabs a[href="' + $(this).data('tab') + '"]').tab('show');
                });
                
                /*
                 * Other sliders
                 */
                
//                var layoutSliders = {
//                    att: {
//                        range: {min: 1, max: 100},
//                        step: 1,
//                        start: 50,
//                        handles: 1,
//                        connect: "lower",
//                        set: changeState
//                    },
//                    rep: {
//                        range: {min: 1, max: 100},
//                        step: 1,
//                        start: 1,
//                        handles: 1,
//                        connect: "lower",
//                        set: changeState
//                    }
//                }
//                
//                for (slider in layoutSliders) {
//                    $('#layout-slider-' + slider).noUiSlider(layoutSliders[slider]);
//                }
                
                $("#cutoff-bar-cor").noUiSlider({
                    range: {min: sliderProperties.min, max: sliderProperties.max},
                    step: sliderProperties.step,
                    start: sliderProperties.value,
                    direction: "rtl",
                    orientation: "vertical",
                    serialization: {
                        lower: [new Link({target: $("#cutoff-label-min")})]
                    }
                }).on('set', function() {
                    applyCutoff($(this).val());
                    
                    $(this).find('.noUi-handle').toggleClass('cutoff-unreliable', $(this).val() < sliderProperties.value);
                    
                    if ($(this).find('.noUi-handle').hasClass('cutoff-unreliable')) {
                        alertUser('Not implemented yet', 'Loading correlations below the significant cutoff is not available yet.');
                    }
                    
                    changeState();
                });
                
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
                    applyCutoff($(this).val());
                    changeState();
                });
                
                $("#cutoff-label-min").html(sliderProperties.value);
                $("#cutoff-label").click(function() {});
                
                $("#btn-group-datasets a").click(function(evt){
                    switchDataset($(this).attr('data-id'));
                    evt.preventDefault();
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
                    
                    var moveRequired = Math.round( position.stageX ) != Math.round( x ) || Math.round( position.stageY ) != Math.round( y );
                    var timeout = 0;
                    
                    if (moveRequired) {
                        sigInst.goTo(x, y).draw();
                        timeout = 150; // We know goTo needs 100ms, 50ms buffer just in case
                    }
                    
                    setTimeout(function() {
                        if (timeout != 0) {
                            mmx = {};
                            sigInst.iterNodes(function(node) {
                                if (!node.hidden) {
                                    mmx.ax = Math.min(node.displayX, mmx.ax || node.displayX);
                                    mmx.zx = Math.max(node.displayX, mmx.zx || node.displayX);
                                    mmx.ay = Math.min(node.displayY, mmx.ay || node.displayY);
                                    mmx.zy = Math.max(node.displayY, mmx.zy || node.displayY);
                                }
                            });
                            
                            position = sigInst.position();
                            size = sigInst.size();
                        }
                        
                        if (mmx.ax < 0 || mmx.zx > size.w || mmx.ay < 0 || mmx.zy > size.h) { // Zoom out required
                            var xmin = Math.min(mmx.ax, size.w - mmx.zx);
                            var ymin = Math.min(mmx.ay, size.h - mmx.zy);
                            
                            var ratio = 0;
                            if (xmin < ymin) {
                                ratio = -xmin / size.w;
                            } else {
                                ratio = -ymin / size.h;
                            }
                            
                            log("zooming out");
                            // ratio multiplier should be 2.11 but let's set it to 3 for a nice padding around the newtwork
                            sigInst.goTo(size.w / 2, size.h / 2, position.ratio / (3 * ratio + 1)).draw();
                        } else { // Zoom in could be required
                            var xmin = Math.min(mmx.ax, size.w - mmx.zx);
                            var ymin = Math.min(mmx.ay, size.h - mmx.zy);
                            
                            var ratio = 0;
                            if (xmin < ymin) {
                                ratio = xmin / size.w;
                            } else {
                                ratio = ymin / size.h;
                            }
                            
                            if (ratio > 0.22) {
                                log("zooming");
                                // ratio multiplier should be 2 but let's set it to 1.9 for a nice padding around the newtwork
                                sigInst.goTo(size.w / 2, size.h / 2, position.ratio / ((-1.5 * ratio) + 1)).draw();
                            }
                        }
                        
                    }, timeout); 
                });
                $('#btn-fullscreen').click(function() {
                    log($().isFullScreen());
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
                    state.setProperty("background", $(this).val());
                    $(rootElement).css('background-color', "#" + state.getProperty("background"));
                    sigInst.drawingProperties({defaultLabelColor: invertColor(state.getProperty("background"))}).draw(-1, -1, 1);
                    changeState();
                });
                
                $('#style-label-color').change(function() {
                    state.setProperty("labelColor", $(this).val());
                    sigInst.drawingProperties({defaultLabelColor: "#" + state.getProperty("labelColor")}).draw(-1, -1, 1);
                    changeState();
                });
                
                if (!opts.debug) {
                    /*
                     * Prevent context menu, we want our own
                     * rightclick functionality
                     */
                    $("#network-container").contextmenu(function() {
                        return false;
                    });
                    // sigh... disable context menu on context menu
                    // b/c its not in the other container
                    $(".contextmenu").contextmenu(function() {
                        return false;
                    });
                }
                
                // Nice effects, stop any animations on enter,
                // hide on leave, hide if not entered (code in
                // callback above)
                $(".contextmenu").mouseleave(function() {
                    $(this).delay(500).hide();
                }).mouseenter(function() {
                    $(this).stop(true);
                });
                
                $("#contextmenu a").click(function(evt) {
                    switch ($(this).attr('id')) {
                    case "context-dl":
                        var node = getNode(hoveredTargets[0]), strain = getStrain(node.id);
                        window.location.href = 'dl/?n=' + node.id;
                        break
                    case "context-hide":
                        autoState = true; // prevent selection change from changing the state
                        var selected = getSelectedNodes(true);
                        hoveredTargets.forEach(function(node) {
                            if (selected.indexOf(node) != -1) {
                                selected.splice(selected.indexOf(node), 1);
                                $("input.gene-search-input").select2("val", selected, true);
                            }
                            node = getNode(node);
                            node.hidden = node._hidden = true;
                        });
                        sigInst.draw();
                        autoState = false;
                        changeNodesState();
                        break
                    case "context-label-toggle":
                        hoveredTargets.forEach(function(node) {
                            node = getNode(node);
                            node.forceLabel = !node.forceLabel;
                        });
                        sigInst.draw();
                        changeNodesState();
                        break;
                    case "context-edit-node":
                        editNode(hoveredTargets[0]);
                        break;
                    case "context-node-gi":
                        var selection = getSelectedNodes(true);
                        if (selection > 1 && selection < 6)
                            showCorrelationDriving(true);
                        break;
                    }
                    
                    $("#contextmenu-container").hide();
                    evt.preventDefault();
                });
                
                $("#contextmenu-edge a").click(function(evt) {
                    switch ($(this).attr('id')) {
                    case "context-edge-gi":
                        showCorrelationDriving();
                        break
                    }
                    evt.preventDefault();
                });
                
                $(".pick-a-color").pickAColor();
                $('#modal-style input.pick-a-color').addClass('form-control').css({width: "auto"});
                
                $(".refresh-network").click(function(evt) {
                    location.reload();
                    evt.preventDefault();
                });
                $(".undo-network").click(function(evt) {
                    if (!$(this).hasClass('disabled'))
                        setState(undo.undo());
                    _updateNavigation();
                    evt.preventDefault();
                });
                $(".redo-network").click(function(evt) {
                    if (!$(this).hasClass('disabled'))
                        setState(undo.redo());
                    _updateNavigation();
                    evt.preventDefault();
                });
                
                $('[data-toggle="tooltip"]').tooltip();
                
                /* EDIT NODE MODAL DIALOG STUFF */
                
                var modal = $('#edit-node-modal');
                modal.modal({show: false});
                modal.find('.modal-confirm').click(function() {
                    var node = getNode(modal.find('#edit-node-id').val()), colorsChanged = false;
                    node.label = modal.find('#edit-node-label').val();
                    node.color = "#" + modal.find('#edit-node-color').val().toUpperCase();
                    node.forceLabel = modal.find('#edit-node-label-force').prop('checked');
                    node.size_mult = modal.find('#edit-node-size-multiplier').val();
                    node.size = node.size_init * node.size_mult;
                    
                    modal.find('.annotation-color').each(function() {
                        var color = '#' + $(this).val().toUpperCase(), annot = state.getProperty("annotation");
                        
                        if (vizdata[annot].colorPalette[$(this).closest('tr').data('term')] != color) {
                            vizdata[annot].colorPalette[$(this).closest('tr').data('term')] = color;
                            colorsChanged = true;
                        }
                    });
                    
                    if (colorsChanged) {
                        applyAnnotationColors();
                        rebuildLegend();
                    } else {
                        sigInst.draw();
                    }
                    
                    modal.modal('hide');
                    
                    changeNodesState();
                });
                
                modal.find('#edit-node-color').on('change', function() {
                    if (modal.find('input[name=dominant]:checked').closest('tr').find('.pick-a-color').val() != $(this).val()) {
                        modal.find('input[name=dominant]').prop('checked', false);
                    }
                });
                
                $("a.tool-arange").click(arangeNodes);
                
                $("#tool-rotate-arbitrary").click(function(e) {
                    $("#rotation-modal").modal('show');
                    
                    $("#rotation-modal").on("shown.bs.modal", function() {
                        $("#rotation-modal input").focus();
                    });
                });
                
                $("#rotation-modal").find(".modal-confirm").click(function(e) {
                    var angle = $(".rotation-input").val();
                    
                    if (isNumber(angle)) {
                        angle = parseInt(angle);
                        
                        if (angle < 361 && angle > -361) {
                            angle = parseInt(angle);
                            sigInst.rotateNodes({callback: function() {changeNodesState();}}, angle);
                        }
                    }
                    $("#rotation-modal").modal("hide");
                    e.preventDefault();
                });
                
                $(".disabled a").click(function(e) {
                    e.preventDefault();
                    return false;
                });
                
                $(".cutoff-label").each(function() {
                    var label = $(this);
                    label.popover({
                        container: "body",
                        placement: "left",
                        html: true,
                        content: '<div><input type="text" class="form-control cutoff-label-input" data-for-cutoff="' + label.attr('id') + '"></div>'
                    }).on('hide.bs.popover', function () {
                        var value = $('.cutoff-label-input[data-for-cutoff=' + label.attr('id') + ']').val(), cutoff = state.getProperty("cutoff_" + state.getProperty("dataset"));
                        var data = state.getProperty("dataset");
                        if (data != 0) {
                            cutoff = cutoff.slice();
                        }
                        
                        if (isNumber(value)) {
                            value = parseFloat(value).toFixed(2);
                            if (label.attr('id') == 'cutoff-label-min') {
                                if (data == 0) {
                                    cutoff = value;
                                } else {
                                    cutoff[1] = -value;
                                }
                            } else {
                                cutoff[0] = -value;
                            }
                            
                            if (state.getProperty("cutoff_" + data) != cutoff) {
                                if (data == 0) { // TEMPORARY HACK
                                    $(".cutoff-bar[data-dataset=\"" + data + "\"]").val(opts.datasets[0].min + (opts.datasets[0].max-opts.datasets[0].min) / 2); // HAAAAAAAAAAAAACK BUGZ IN nouislider...
                                }
                                $(".cutoff-bar[data-dataset=\"" + data + "\"]").val(cutoff, {update: true, set: true});
                            }
                        }
                    }).on('shown.bs.popover', function () {
                        $('.cutoff-label-input[data-for-cutoff=' + label.attr('id') + ']').val(label.html()).keyup(function (e) {
                            $(this).parent().toggleClass('has-error', !isNumber($(this).val()));
                            
                            if (e.which == 13) {
                                label.click();
                            }
                        }).focus();
                    });
                });
                
                $(".dropdown-submenu > a").click(function(evt) {
                    evt.preventDefault();
                });
                
                $("li.disabled > a").click(function(evt) {
                    evt.preventDefault();
                });
                
                $("body").keydown(function(e) {
                    if (e.ctrlKey && (e.which == 97 || e.which == 65)){
                        var visibleNodes = sigInst._core.graph.nodes.filter(function(node) {
                            return !node.hidden;
                        });
                        visibleNodes = visibleNodes.map(function(node) {return node.id;});
                        $("input.gene-search-input").select2("val", visibleNodes, true);
                        return false;
                    }
                });
            };
            
            function addAttributeLayouts() {
                $('#attribute-layout-list').closest('li').toggleClass('disabled', opts.attributes.length == 0);
                
                opts.attributes.forEach(function(att) {
                    $('#attribute-layout-list').append('<li><a class="tool-layout" data-layout-type="attribute" data-layout-attribute="' + att + '" href="#">' + att + '</a></li>');
                });
                
                // Update the click listener
                $('#attribute-layout-list .tool-layout').click(toggleLayout);
                
                console.log("Available attributes: " + opts.attributes);
            };
            
            function showUI() {
                setTimeout(function() {
                    $(".vizualization-ui").fadeIn(1000);
                    
                    /* Some older browsers don't support this (Opera), add a workaround, disable damn windblows */
//                    if (!Modernizr.pointerevents && !window.attachEvent) {
//                        var evt, ele = $(".vizualization-ui")[0], target = $(".sigma_mouse_canvas")[0], eventFwd = function(e) {
//                            var evt = document.createEvent("MouseEvents");
//                            evt.initMouseEvent(e.type, e.bubbles, e.cancelable, e.view, e.detail, 
//                                    e.screenX, e.screenY, 
//                                    e.clientX, e.clientY, 
//                                    e.ctrlKey, e.altKey, e.shiftKey, e.metaKey, e.button, null);
//                            target.dispatchEvent(evt);
//                        };
//                        
//                        ele.addEventListener('DOMMouseScroll', eventFwd, false);
//                        ele.addEventListener('mousewheel', eventFwd, false);
//                        ele.addEventListener('mousemove', eventFwd, false);
//                        ele.addEventListener('mousedown', eventFwd, false);
//                    }
                }, 0);
            }
            
            function init() {
                sigInst = sigma.init(rootElement).drawingProperties({
                    defaultLabelSize: state.getProperty("labelSize"),
                    defaultLabelHoverColor: '#000',
                    labelThreshold: state.getProperty("labelThreshold"),
                    font: 'Arial',
                    edgeColor : 'white',
                    defaultLabelColor : "#" + state.getProperty("labelColor"),
                    nodeColor : opts.defaultNodeColor,
                    defaultEdgeArrow: opts.arrows ? 'target' : 'none',
                }).graphProperties(graphProperties).mouseProperties({
                    drawHoverEdges: false,
                    maxRatio : 64
                }).bind('rightclicknodes', onNodesContext
                 ).bind('ctrlclicknodes', function (e) {
                    clicking.modifierKey = 'ctrl';
                    onNodesContext(e);
                }).bind('shiftclicknodes', function () {
                    clicking.modifierKey = 'shift';
                }).bind('upnodes', function(e) {
                    if (!clicking.wasDragging) {
                        onNodesClick(e);
                    }
                    clicking.wasDragging = false;
                    clicking.modifierKey = null;
                }).bind('upgraph', function(evt) {
                    if (!evt.content.dragged && !evt.content.targeted && !evt.content.selecting && !$(".btn-group").hasClass('open')) { // Clear selection
                        log(evt.isDropDownToggleEvent);
                        clearSelection();
                        state.setProperty("edgeSelection", []);
                    }
                }).bind('draggedNode', function() {
                    clicking.wasDragging = true;
                    changeNodesState();
                }).bind('selectionStop', function(selection) {
                    noPulse = true;
                    if (selection.content.nodeSelect) {
                        $("input.gene-search-input").select2("val", getSelection().concat(selection.content.selected), true);
                    } else {
                        onEdgesClick({content: state.getProperty("edgeSelection").concat(selection.content.selected)});
                    }
                    noPulse = false;
                }).bind('selectionStart', function() {
                }).bind('rightclickedges', onEdgesContext
                 ).bind('ctrlclickedges', onEdgesContext
                 ).bind('upedges', function(targeted) {
                     if (!clicking.wasDragging) {
                         onEdgesClick(targeted);
                         changeState();
                     }
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
                
                state.setProperty("cutoff_1", [-0.08, 0.08]);
                $('.cutoff-bar[data-dataset="1"]').val(state.getProperty("cutoff_1"), {update: true});
                
                /* Fetch all node info */
                $.getJSON(opts.nodesUrl, function(data) {
                    vizdata['strains'] = data.nodes;
                    vizdata['annotations'] = data.annotations;
                    vizdata['index'] = {};
                    autocomp = [];
                    opts.attributes = [];
                    
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
                        
                        if (strain.attributes) {
                            for (var att in strain.attributes) {
                                if (opts.attributes.indexOf(att) == -1) opts.attributes.push(att);
                            }
                        }
                    }
                    
                    addAttributeLayouts();
                    
                    var tokenizing = false;
                    $("input.gene-search-input").select2({
                        multiple: true,
                        minimumInputLength: 2,
                        containerCssClass: 'form-control', 
                        placeholder: 'Start typing genes or annotations...',
                        allowClear: true,
                        width: '350px',
                        tokenSeparators: [",", " ", "\t", "\n"],
                        initSelection: function (element, callback) {
                            var id = $(element).val(), strain, result = [];
                            id.split(",").forEach(function(x) {
                                if (x !== "") {
                                    var annot = state.getProperty("annotation");
                                    if (x.startsWith('annot')) {
                                        x = parseInt(x.replace('annot', ''));
                                        for (var term in vizdata[annot].terms) {
                                            if (x == term) {
                                                result.push({
                                                    text: 'Annotation: ' + vizdata[annot].terms[term].name,
                                                    id: 'annot' + x
                                                });
                                            }
                                        }
                                    } 
                                    else if (x.startsWith('action_loadannot')) {
                                        x = x.replace('action_loadannot', '')
                                        result.push({
                                            text: "Load:" + x,
                                            id: "action_loadannot" + x
                                        });
                                    }
                                    else {
                                        strain = getStrain(x);
                                        result.push({
                                            text: strain.verboseName,
                                            id: strain.id
                                        });
                                    }
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
                            var aterm, aterms = vizdata[state.getProperty("annotation")].terms, acount = 0;
                            
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
                            
                            for (aterm in aterms) {
                                if (aterms.hasOwnProperty(aterm) && aterms[aterm].name.toLowerCase().indexOf(term) != -1) {
                                    data.results.unshift({id: 'annot' + aterm, text: "Annotation: " + aterms[aterm].name });
                                    acount++;
                                }
                                if (acount > 2) break; // List only 3 terms max
                            }
                            
                            //load annotations
                            opts.annotations.forEach(function(annotation) {
                                if (("load " + annotation.name.toLowerCase()).indexOf(term) != -1 && annotation.name != state.getProperty("annotation"))
                                    data.results.unshift({id: "action_loadannot " + annotation.name, text: "Load: " + annotation.name});
                            });
                            
                            data.results = data.results.slice(0, 6);
                            query.callback(data);
                        },
                        data: autocomp,
                    }).on('change', function(evt, a, b, c) {
                        var selected = getSelectedNodes(), numVisibleSelected = 0, strain;
                        var selectionLength, selection = getSelection();
                        
                        sigInst.iterNodes(function(node) {
                            strain = getStrain(node.id);
                            if ($.inArray(strain.id + "", selected) >= 0) {
                                node.selected = true;
                                
                                if (node.hidden && !autoState) {
                                    messageUser('Gene you\'re looking for is below current threshold.')
                                } else {
                                    numVisibleSelected++;
                                }
                            } else {
                                node.selected = false;
                            }
                        });
                        
                        $('[data-selection-constraint]').each(function() {
                            var enabled = true, size = selection.length, cls = $(this).data('selection-class') || 'disabled';
                            if ($(this).data('selection-type') == 'visible') {
                                size = numVisibleSelected;
                            }
                            if ($(this).data('selection-gt') != undefined) {
                                enabled &= size > $(this).data('selection-gt');
                            }
                            if ($(this).data('selection-lt') != undefined) {
                                enabled &= size < $(this).data('selection-lt');
                            }
                            
                            $(this).toggleClass(cls, !enabled);
                        });
                        
                        if (!tokenizing) {
                            updateMissingMessage();
                            sigInst.draw();
                            
                            if (!($(selected).not(state.getProperty("selection")).length == 0 && $(state.getProperty("selection")).not(selected).length == 0)) {
                                var diff = $(selected).not(state.getProperty("selection")).get();
                                
                                state.setProperty("selection", getSelection());
                                
//                                if (!noPulse) {
//                                    sigInst.pulseNodes({nodes: sigInst._core.graph.nodes.filter(function(node) {
//                                        return diff.indexOf(node.id) != -1;
//                                    })});
//                                }
                                changeState();
                                
                                /* Set the tooltips */
                                updateTooltips();
                            }
                        }
                    }).on('select2-selecting', function(e) {
                        var selection = e.val, annot;
                        if (selection.length > 17 && selection.indexOf("action_loadannot ") == 0) {
                            annot = selection.replace("action_loadannot ", '');
                            loadAnnotation(annot);
                            e.preventDefault();
                            $(".gene-search-input").select2("close");
                        }
                    });
                    
                    updateTooltips();
                    showUI();
                    
                    // Load plot graph in Michael Jackson mode by
                    // default
                    loadAnnotation(state.getProperty("annotation"));
                    loadLayout();
                });
                
                
                $(document).mousemove(updateMousePosition);
            }
            
            /* Starting point */
            init();
        }
    });
})(jQuery);
