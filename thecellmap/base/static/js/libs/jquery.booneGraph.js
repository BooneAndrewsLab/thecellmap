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
                        preCorValue: 0.2,
                        preIntValue: [-0.08, 0.08]
                    },
                    graphProperties: {
                          type: 'network',
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
            var showRegions = true;
            
            var currentUi = 'simple';
            var circularLayout = false;
            
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
                
                for (var i = 0; i < newState.style.numOfCutoffs(); i++) {
                    if (newState.style.getProperty("cutoff_" + newState.style.getProperty("dataset")) != state.getProperty("cutoff_" + state.getProperty("dataset"))) {
                        state.setProperty(("cutoff_" + i), newState.style.getProperty("cutoff_" + i));
                        
                        reapplyCutoff = true;
                    }
                }
                
                if (reapplyCutoff) {
                    log("reapplying", state.getProperty("dataset"), state.getProperty("cutoff"), state.getProperty("cutoff_" + state.getProperty("dataset")));
                    applyCutoff(state.getProperty("cutoff_" + state.getProperty("dataset")));
                    $(".cutoff-bar[data-dataset=\"" + state.getProperty("dataset") + "\"]").val(state.getProperty("cutoff_" + state.getProperty("dataset")));
                }
                
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
                        break;
                    }
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
                if (!isInitializing && !autoState && undo != null) {
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
                if (typeof id === 'string' && id.indexOf('tmp') != -1) id = id.replace('tmp_', '');
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
            
            function edgeExists(id) {
                return !!sigInst._core.graph.edgesIndex[id];
            }
            
            function clearEdges() {
                sigInst._core.graph.edges = [];
                sigInst._core.graph.edgesIndex = {};
            }
            
            function messageUser(text, element) {
                var alert = $('<div class="alert alert-warning fade in"> \
                        <button class="close" aria-hidden="true" data-dismiss="alert" type="button">x</button> \
                        ' + text + ' \
                      </div>');
                if (element) {
                    $("#" + element).empty();
                    $("#" + element).append(alert);
                } else {
                    $('#alerts-panel').append(alert);
                }
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
                var selected = getSelection(), map, annotations = [], result, byAnnot = {};
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
                        byAnnot[strain.id] = null;
                    }
                });
                
                if (!!visible) {
                    return result.filter(function(strainid) {
                        node = getNode(strainid);
                        return !!node && !node.hidden;
                    });
                }
                
                return {selected: result, byAnnot: byAnnot};
            }
            
            function getSelection() {
                var selector = $("#" + currentUi + "-ui input.gene-search-input");
                if (selector.length > 0) {
                    return selector.select2('val');
                }
                return [];
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
            
            function showCorrelationDriving(fromNodes, single, callback) {
                var nodes = [];
                autoState = true; // Prevent automatic state change on loadDataset
                
                $(".dataset-constraint").removeClass("disabled");
                
                if (fromNodes && !single) {
                    nodes = getSelection();
                } else if (fromNodes && single) {
                    nodes.push(getNode(hoveredTargets[0]).id);
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
                    $(".data-type-img").toggleClass("hidden");
                    state.setProperty("dataset", 1);
                    sigInst.draw();
                    autoState = false;
                    
                    if (callback) {
                        callback();
                    } else {
                        var layoutType = state.getProperty('annotation') != 'None' ? 'gi+' : 'gi';
                        toggleLayout(false, layoutType);
                        applySettings({label: settings['label']});
                    }
                    
                    rebuildLegend();
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
                    
                    sigInst._core.graph.nodes.filter(function(node) {
                        if (!node.hidden && node._hidden) node._hidden = false;
                    });
                    
                    updateEdges(value);
                } else { // Interactions
                    var newVisible = [];
                    sigInst._core.graph.nodes.filter(function(node) {
                        if (!node.hidden && dataset.fetched.indexOf(node.id) == -1) {
                            newVisible.push(node.id);
                        } else if (node.hidden) {
                            node._hidden = true; //Force hide the nodes so that they will not appear when cutoff is changed
                        }
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
                
                rebuildLegend();
                $(".data-type-img").toggleClass("hidden");
                applySettings({label: settings['label']});
                state.setProperty("dataset", value);
            };
            
            function updateEdges(ds) {
                var minWeight = null;
                var maxWeight = null;
                
                var ele = $(".cutoff-bar-simple[data-dataset=\"" + ds + "\"], .cutoff-bar[data-dataset=\"" + ds + "\"]");
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
                    ele.val([state.getProperty("cutoff_" + ds) || minWeight]);
                } else {
                    $(".cutoff-label-max").html(state.getProperty("cutoff_" + ds)[1]);
                    $(".cutoff-label-min").html(state.getProperty("cutoff_" + ds)[0]);
                }
                
                if (ds == 0) {
                    $(".cutoff-label-max").css('visibility', 'hidden');
                    $(".cutoff-label-min").removeClass('btn-danger').addClass('btn-default');
                } else {
                    $(".cutoff-label-max").css('visibility', 'visible');
                    $(".cutoff-label-min").removeClass('btn-default').addClass('btn-danger');
                }
                
                $(".cutoff-bar-simple").css('display', 'none');
                $(".cutoff-bar").css('display', 'none');
                ele.css('display', 'block');
                
                changeNodesState();
                sigInst.draw();
            }
            
            function loadDataset(dsid, data, preloaded, callback) {
                var dataset = opts.datasets[dsid], dataType;
                if (!dataset.type) {
                    dataType = dsid;
                } else {
                    dataType = dataset.type == 'I' ? 1 : 0;
                }
                
                if (dataset.type) {
                    $("#btn-group-datasets button").addClass("disabled");
                    $("#btn-group-neighbourhood li[data-selection-constraint='true']").removeAttr("data-selection-constraint");
                }
                
                var loadDatasetCallback = function (nodes, edges, extraContext) {
                    var edgesAdded = 0;
                    edges = edges || [];
                    
                    edges.forEach(function(edge){
                        if (!nodeExists(edge.source) && !isInitializing) {
                            sigInst.addNode(edge.source);
                            var node = getNode(edge.source), strain = getStrain(edge.source);
                            
                            node.label = strain.verboseName;
                            node.size = 2;
                            node.x = !isNaN(node.x) ? node.x : (Math.random() * 100);
                            node.y = !isNaN(node.y) ? node.y : (Math.random() * 100);
                        }
                        if (!nodeExists(edge.target) && !isInitializing) {
                            sigInst.addNode(edge.target);
                            var node = getNode(edge.target), strain = getStrain(edge.target);
                            
                            node.label = strain.verboseName;
                            node.size = 2;
                            node.x = !isNaN(node.x) ? node.x : (Math.random() * 100);
                            node.y = !isNaN(node.y) ? node.y : (Math.random() * 100);
                        }
                        if (nodeExists(edge.source) && nodeExists(edge.target) && !sigInst._core.graph.edgesIndex[edge.id]) {
                            sigInst.addEdge(edge.id, edge.source, edge.target, edge);
                            edgesAdded++;
                        }
                    });
                    
                    if (dataset.type && dataType == 1) {
                        var dsEle = $("#btn-group-datasets a[data-id=\"" + dataType + "\"]");
                        dsEle.addClass('active');
                        $("#selected-dataset").html("Genetic interactions");
                        $(".data-type-img").toggleClass("hidden");
                        $(".dataset-constraint").removeClass("disabled");
                        state.setProperty("dataset", 1);
                    }
                    
                    if (edges.length > 0) updateEdges(dataType);
                    
                    if (callback != undefined) {
                        callback(edges);
                    }
                    
                    if (opts.preloadedState && isInitializing) {
                        var savedState = new State(opts.preloadedState);
                        var savedNodes = JSON.parse(localStorage.getItem("savedNodes"));
                        setState({style: savedState, nodes: savedNodes});
                    }
                    
                    if (isInitializing) {
                        applySettings({scroll: settings['scroll']});
                    }
                    
                    isInitializing = false;
                };
                
                if (preloaded == undefined) {
                    getParser(dataset.parser)({
                            jq: $, sigInst: sigInst, url: dataset.url, vizdata: vizdata, cb: loadDatasetCallback,
                            data: data, method: dataset.method, state: state, type: dataset.type
                        });
                } else {
                    loadDatasetCallback(null, preloaded.edges);
                }
            }
            
            function loadLayout(e) {
                var layout = opts.layout;
                var dataset = opts.datasets;
                if (!isInitializing) {
                    showRegions = false;
                    clearDrawnRegions();
                }
                
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
                    
                    var hmid = window.location.href.slice(window.location.href.indexOf('hmid=')).replace('hmid=', '');
                    var data = JSON.parse(sessionStorage.getItem(hmid)), hmAnnot;
                    
                    if (data && hmid) {
                        for (annot in opts.annotations) {
                            if (opts.annotations[annot].id == data.annotation) {
                                hmAnnot = opts.annotations[annot].name;
                                sigInst.iterNodes(function(node) {
                                    node.hidden = true;
                                });
                                break;
                            }
                        }
                        var annotCallback = function() {
                            sigInst.iterNodes(function(node) {
                                var strain = getStrain(node.id), hidden = true, nodeTerm;
                                
                                for (term in data.terms) {
                                    if (vizdata[hmAnnot]['map'][strain.orf] != undefined && vizdata[hmAnnot]['map'][strain.orf].indexOf(data.terms[term]) != -1) {
                                        node.hidden = false;
                                        nodeTerm = vizdata[hmAnnot]['terms'][data.terms[term]];
                                        node.color = vizdata[hmAnnot]['colorPalette'][nodeTerm.idx];
                                    }
                                }
                            });
                            switchDataset(1);
                            toggleLayout(false, 'annotation');
                        }
                        
                        loadAnnotation(hmAnnot, annotCallback);
                    }
                    
                    rebuildLegend();
                }
                getParser(layout.parser)({
                    jq: $, sigInst: sigInst, url: layout.url, vizdata: vizdata, cb: layoutCallback, state: state
                });
            }
            
            function loadAnnotation(id, callback) {
                state.setProperty("annotation", id);
                if (id == "None") {
                    $(".annotation-constraint").addClass("disabled");
                } else {
                    $(".annotation-constraint").removeClass("disabled");
                }
                
                if (vizdata[id] == undefined) {
                    if (id == 'None') {
                        vizdata[id] = {
                                map : {},
                                defaultColor : opts.defaultNodeColor,
                                terms: {"-1": {id: -1, idx: 0, name: 'Unannotated', orig_name: 'Unannotated', alias: 'Unannotated'}},
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
                                                    alias: vizdata[id].terms[n].alias,
                                            }
                                        }
                                        
                                        $.extend(vizdata[id].terms, {
                                              "-1": {id: -1, idx: i, name: 'Unannotated', orig_name: 'Unannotated', alias: 'Unannotated'},
                                              "-2": {id: -2, idx: i+1, name: 'Multi-function', orig_name: 'Multi-function', alias: "Multi-function"}
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
                
                $('#btn-legend').click();
                autoState = oldState;
                applyAnnotationColors();
                rebuildLegend();
                changeNodesState();
                if (callback) callback();
                setTimeout(loadRegion(id), '0');
            }
            
            function loadRegion(id) {
                clearDrawnRegions();
                opts.regionGroup.forEach(function(regionGroup) {
                    if (regionGroup.name === id) {
                        $.ajax({
                            url : regionGroup.url,
                            dataType : 'json',
                            async : true,
                            success : function(data) {
                                vizdata[id + 'Region'] = {colorPalette: [], nodes: []};
                                
                                for (r in data) {
                                    var nodes = [], color, n;
                                    for (n in data[r]) {
                                        if (getNode(data[r][n])) {
                                            nodes.push(getNode(data[r][n]));
                                        } else {
                                            color = data[r][n];
                                        }
                                    }
                                    vizdata[id + 'Region']['colorPalette'].push(color);
                                    vizdata[id + 'Region']['nodes'].push(nodes);
                                }
                                drawRegions();
                            },
                            error: function() {},
                        });
                    }
                });
            }
            
            function drawRegions() {
                clearDrawnRegions();
                if (!showRegions || state.getProperty("annotation") == 'None') return;
                
                var region = state.getProperty("annotation") + 'Region'
                
                if (!$('#region_canvas').length) {
                    var canvas = $('canvas:first').clone();
                    canvas.attr('id', 'region_canvas');
                    $('#network-container').prepend(canvas);
                    
                    window.addEventListener('resize', function() {
                        $('#region_canvas').attr('width', $(".sigma_edges_canvas").width());
                        $('#region_canvas').attr('height', $(".sigma_edges_canvas").height());
                    });
                }
                
                var canvas = $('#region_canvas'), ctx = canvas[0].getContext("2d");
                var regionGroup = vizdata[region];
                
                for (r in regionGroup['nodes']) {
                    var color = regionGroup['colorPalette'][r], nodes = regionGroup['nodes'][r];
                    
                    ctx.fillStyle = '#' + color;
//                    ctx.globalAlpha = 0.4;
                    ctx.beginPath();
                    ctx.moveTo(nodes[0]['displayX'], nodes[0]['displayY']);
                    
                    var n1, n2, dx, dy, angle, dr;
                    
                    nodes.push(nodes[0])
                    for (var i = 0; i < nodes.length - 1; i++) {
                        n1 = nodes[i], n2 = nodes[i + 1];
                        dx = (n2.displayX - n1.displayX)/2, dy = (n2.displayY - n1.displayY)/2, angle = Math.atan(dx/dy);
                        dr = Math.sqrt(dx*dx + dy*dy) / 2;
                        
                        if (dx > 0) {
                            ctx.quadraticCurveTo(n1.displayX + dx + dr*Math.cos(Math.PI/2 - angle), n1.displayY + dy - dr*Math.sin(Math.PI/2 - angle), n2.displayX, n2.displayY);
                        } else if (dy > 0){
                            ctx.quadraticCurveTo(n1.displayX + dx + dr*Math.sin(Math.PI/2 - angle), n1.displayY + dy - dr*Math.cos(Math.PI/2 - angle), n2.displayX, n2.displayY);
                        } else {
                            ctx.quadraticCurveTo(n1.displayX + dx - dr*Math.sin(Math.PI/2 - angle), n1.displayY + dy + dr*Math.cos(Math.PI/2 - angle), n2.displayX, n2.displayY);
                        }
                    }
                    
                    ctx.closePath();
                    ctx.fill();
                }
            }
            
            function clearDrawnRegions() {
                var canvas = $('#region_canvas');
                if (canvas.length) {
                    ctx = canvas[0].getContext("2d");
                    ctx.clearRect(0, 0, canvas.width(), canvas.height());
                }
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
                $("#legend-list").empty();
                $("#style-annotation").append('<table class="annotation-table"><thead><tr>\
                      <th style="width: 1%;"></th>\
                      <th>Annotation</th></tr></thead>\
                  <tbody id="style-annotation-table"></tbody></table>');
                
                for (n in terms) {
                    var term = terms[n];
                    var color;
                    if ($.cookie(term.name) == undefined) {
                        color = vizdata[id].colorPalette[term.idx];
                    }
                    else {
                        color = $.cookie(term.name);
                    }
                    
                    var name = term.alias;
//                    restrict name length, keep all annotation in one line within legend
//                    if (name.length > 30) {
//                        name = name.substring(0, 30) + "...";
//                    }
                    $('#style-annotation-table').append('<tr class="annotation-row" data-term="' + term.idx + '">\
                            <td><input class="form-control pick-a-color annotation-color" value="' + color + '">\
                            <td>' + term.name + '</td></td></tr>');
                    $('#legend-list').append('<li><div class="legend-box" data-idx=' + term.idx + '></div><span title="' + term.name + '">' + name + '</span></li>');
                    $('#legend-list .legend-box').last().css("background-color", color);
                }
                
                $('#style-annotation-table').find(".pick-a-color").pickAColor({showHexInput: false, showSavedColors: false});
                $("#style-annotation-table .pick-a-color").on('change', function() {
                    var term, color = '#' + $(this).val(), a = $(this).closest("tr").data("term");
                    for (n in terms) {
                        term = vizdata[id].terms[n];
                        if(terms[n].idx == a) {
                            break;
                        }
                    }
                    
                    if (n != -1 && n != -2){
                        $.cookie(term.name, color);
                    }
                    else {
                        vizdata[id].colorPalette[term.idx] = color;
                    }
                    
                    $("#panel-annotation-" + term.id + " .panel-heading").css('background', '-webkit-linear-gradient(left, #f5f5f5, ' + color + ' 50%)');
                    $("#panel-annotation-" + term.id + " .panel-heading").css('background', '-moz-linear-gradient(right, #f5f5f5, ' + color + ' 50%)');
                    $("#panel-annotation-" + term.id + " .panel-heading").css('background', '-o-linear-gradient(right, #f5f5f5, ' + color + ' 50%)');
                    $("#panel-annotation-" + term.id + " .panel-heading").css('background', 'linear-gradient(to right, #f5f5f5, ' + color + ' 50%)');
                    applyAnnotationColors();
                    applyLegendColor(term.idx, color);
                    changeNodesState();
                });
            }
            
            function applyAnnotationColors() {
                var data = vizdata[state.getProperty("annotation")], strain, annot;
                sigInst.iterNodes(function(n) {
                    strain = getStrain(n.id);
                    annot = data.map[strain.orf];
                    if (annot != undefined) {
                        if (annot.length == 1)
                            n.color = $.cookie(data.terms[annot[0]].name) == undefined ? data.colorPalette[data.terms[annot[0]].idx] : $.cookie(data.terms[annot[0]].name);
                        else
                            n.color = data.colorPalette[data.terms["-2"].idx];
                    } else {
                        // No annotation or multifunction
                        n.color = data.colorPalette[data.terms["-1"].idx];
                    }
                }).draw();
            }
            
            function applyLegendColor(id, color) {
                $(".legend-box").each(function(){
                    if (id == $(this).data("idx")) {
                        $(this).css("background-color", color);
                    }
                });
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
                
                noPulse = true;
                var clicked = sigInst._core.graph.edges.filter(function(e) {
                    return e.selected;
                });
                clicked = clicked.map(function(e) {return [e.source.id, e.target.id];});
                var nodeClicked = [];
                for(var i = 0; i < clicked.length; i++) {
                    nodeClicked = nodeClicked.concat(clicked[i]);
                }
                $("input.gene-search-input").select2("val", nodeClicked, true);
                noPulse = false;
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
            
            function toggleLayout(justStop, layoutType) {
                if (justStop.preventDefault != undefined) {
                    justStop.preventDefault();
                }
                
                if ($(this).data("layout-type") == "annotation" && state.getProperty("annotation") == "None")
                    return;
                else if ($(this).data("layout-type") == "gi" && state.getProperty("dataset") == 0)
                    return;
                
                var layoutButton = $("#btn-layout");
                
                if (countVisibleEdges() > 7000) {
                    alertUser('Too many edges', 'Too many edges are visible for the layout algorithm to run efficiently.<br>Edge count: ' + countVisibleEdges());
                    return;
                }
                
                circularLayout = false;
                sigInst.iterEdges(function(edge) {
                    if (edge.id.indexOf('tmp') != -1) {
                        edge.hidden = true;
                    } else if (edge._cl_hidden) {
                        edge.hidden = false;
                    }
                });
                
                sigInst.iterNodes(function(node) {
                    if (node.id.indexOf('tmp') != -1) {
                        node.hidden = node._hidden = true;
                    }
                });
                
                if (opts.runningLayout) {
                    sigInst.stopForceLayout();
                    _setRunningLayout(false);
                } else if (justStop !== true) {
                    var lopts, annotations, data, strain, annot, key;
                    
                    lopts = {
                        callback: function(n) {
                                if (Object.keys(n).length - 1 > 1) $("#tool-stack").click();
                                $('.btn-home').click();
                                _setRunningLayout(false);
                            },
                        progress_callback: function(p) {
                            setTimeout(function(){Ladda.getInstance(layoutButton.attr('id')).setProgress(p);}, 0);
                        },
                        attraction_multiplier: $("#layout-slider-att").val() || 50,
                        repulsion_multiplier: $("#layout-slider-rep").val() || 1,
                        edgeFilter: function(edge) { return edge.weight > 0; },
                    };
                    switch(layoutType || $(this).attr('data-layout-type') || 'force') {
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
                        if (state.getProperty("annotation") == 'None') break;
                        
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
                    case 'gi+':
                        if (state.getProperty("annotation") == 'None') break;
                        
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
                            weight = Math.log(groups[key].keylen) + 0.01;
                            
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
                    _setRunningLayout(true);
                }
            }
            
            function applyNeighbourhood(level) {
                if (!isInitializing) {
                    showRegions = false;
                    clearDrawnRegions();
                }
                
                /* Resets big red nodes */
                var selected = getSelectedNodes(true), localSelected = {}, tmpSelected, strain;
                selected.forEach(function (id){
                    localSelected[id] = null;
                });
                
                for (var l = 0; l < level; l++) {
                    tmpSelected = {};
                    sigInst.iterEdges(function(edge) {
                        if ((!edge.source._hidden && !edge.target._hidden) && 
                            (localSelected.hasOwnProperty(edge.source.id) || localSelected.hasOwnProperty(edge.target.id)) &&
                            edge.ds == state.getProperty('dataset')) {
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
                applySettings(settings);
                
                $("#btn-group-layout").fadeTo(500, 0.5).fadeTo(500, 1);
                
                if (countVisibleNodes() > 1 && currentUi == 'simple') toggleLayout(false, 'force');
            }
            
            function applySettings(s) {
                for (key in s) {
                    switch(key) {
                    case 'zoom':
                        if (s[key]) $('.btn-home').click();
                        break;
                    case 'label':
                        var val = s[key] && countVisibleNodes() <= 100 ? 0 : 6;
                        $('#style-slider-lthresh').val(val, true);
                        break;
                    case 'scroll':
                        sigInst.mouseProperties({blockScroll: s[key]});
                        break;
                    }
                }
            }
            
            function applyCutoff(cutoff) {
                log('applying cutoff', cutoff);
                setCutoff(cutoff);
                var isArray = $.isArray(cutoff), selected = getSelectedNodes(true), strain;
                
                sigInst.iterNodes(function(node) {
                    node.visibleDegree = node.degree;
                }).iterEdges(function(edge) {
                    if (isArray) {
                        if (edge.id.indexOf('tmp') != -1 && !circularLayout) {
                            edge.hidden = true;
                        } else if (edge.id.indexOf('tmp') == -1 && circularLayout && edge._cl_hidden) {
                            edge.hidden = edge._cl_hidden;
                        } else if (edge.id.indexOf('tmp') != -1 && circularLayout) {
                            edge.hidden = (-cutoff[1] < edge.weight && edge.weight < -cutoff[0]);
                        } else {
                            edge.hidden = (-cutoff[1] < edge.weight && edge.weight < -cutoff[0]) || edge.ds != state.getProperty("dataset");
                        }
                    } else {
                        edge.hidden = Math.abs(edge.weight) < cutoff || edge.ds != state.getProperty("dataset");
                    }
                    
                    if (edge.hidden || edge.source._hidden || edge.target._hidden) {
                        edge.source.visibleDegree--;
                        edge.target.visibleDegree--;
                    }
                }).iterNodes(function(node) {
                    strain = getStrain(node.id);
                    node.hidden = ((node._hidden || node.visibleDegree <= 0) && selected.indexOf(strain.id + "") == -1); // either we manually hid the node or it's not connected to anything
                });
                
                rebuildLegend();
                sigInst.draw();
            }
            
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
            
            function downloadCanvasSvg() {
                var width = $('canvas:first').width(), height = $('canvas:first').height(), date = new Date();
                var canvas = new C2S(width * 1.25, height);
                var filename = 'boonelab_network_' + date.getDate() + '_' + date.getHours() + '_' + date.getMinutes() + '_' + date.getSeconds() + '.svg';
                
                if (settings['showBgSvg']) {
                    canvas.fillStyle = $('#canvas-background-color').val();
                    canvas.fillRect(0, 0, settings['showLegendSvg'] ? width * 1.25 : width, height);
                }
                
                sigInst._core.plotter.switchCxt(canvas);
                sigInst.draw(0,2,0,0);
                sigInst.draw(2,0,0,0);
                sigInst.draw(0,0,2,0);
                sigInst._core.plotter.restoreCxt();
                sigInst.draw();
                
                var annot = state.getProperty('annotation');
                if (settings['showLegendSvg'] && annot != 'None') {
                    canvas.fillStyle = $('#canvas-background-color').val();
                    canvas.fillRect(width, 0, width/4 + 25, height);
                    canvas.font = "10px Arial";
                    var x = width + 5, y = 10;
                    for (t in vizdata[annot].terms) {
                        var term = vizdata[annot].terms[t];
                        canvas.fillStyle = vizdata[annot].colorPalette[term.idx];
                        canvas.fillRect(x, y, 5, 5);
                        canvas.fillText(term.name, x + 10, y + 5);
                        y += 10;
                    }
                }
                
                var blob = new Blob([canvas.getSerializedSvg()], {type: 'text/svg+xml;charset=utf-8'});
                saveAs(blob, filename);
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
                for (ui in opts.uiUrl) {
                    $.ajax(opts.uiUrl[ui], {
                        async: false,
                        processData: false,
                        success: function(data) {
                            $(rootElement).append($('<div class="vizualization-ui" id="' + ui + '-ui" style="display: none;">').html(data));
                        }
                    });
                }
                
                $('#btn-group-layout').toggleClass('hidden', opts.layoutButtonHide);
                
                if (opts.annotations.length > 0) {
                    opts.annotations.forEach(function(annotation) {
                        $('#btn-group-annotation').append('<li><a class="load-annotation" href="#">' + annotation.name + '</a></li>');
                    });
                }
                
                $('#btn-group-annotation').append('<li class="divider"></li><li><a id="btn-legend" href="#"> Annotation legend </a></li>');
                
                $(".changed-network").hide().removeClass('hidden');
                $("#modal-style").appendTo("body");
                $("#contextmenu-container").appendTo("body");
                $("#contextmenu-edge-container").appendTo("body");
                $("#edit-node-modal").appendTo("body");
                $("#rotation-modal").appendTo("body");
                $("#legend").appendTo("body");
                $("#legend").css("top", "105px");
                $("#legend").css("left", "20px");
                $("#legend").hide();
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
                        if (selection.length < 8)
                            showCorrelationDriving(true);
                        break;
                    }
                    
                    changeNodesState();
                    evt.preventDefault();
                });
                
                $('#simple-view-network').click(function() {
                    if (getSelectedNodes().length < 0) return;
                    
                    applyNeighbourhood(1);
                    
                    $('[data-hidden-network]').each(function() {
                        $(this).removeClass('hidden');
                    });
                    
                    $('[data-hidden-simple-btn]').each(function() {
                        $(this).hide();
                    });
                    
                    loadAnnotation('SAFE');
                });
                
                $(".dropdown-toggle").click(function(evt) {
                    evt.isDropDownToggleEvent = true;
//                    evt.stopPropagation();
////                    while (!$(this).parent().hasClass('open'))
//                    $(this).dropdown('toggle').dropdown('toggle');
                });
                
                $(".sigma_mouse_canvas").dblclick(function(e) {
                    var position = sigInst.position();
                    var xPos = e.offsetX != undefined ? e.offsetX : e.pageX - this.offsetLeft;
                    var yPos = e.offsetY != undefined ? e.offsetY : e.pageX - this.offsetTop;
                    
                    sigInst.goTo(xPos, yPos, position.ratio * 2).draw();
                });
                
                $(".dropdown-toggle a").click(function(evt) {
                    e.stopImmediatePropagation();
                });
                
                $('#btn-group-annotation .load-annotation').click(function(evt) {
                    $('#btn-group-annotation li').removeClass('active');
                    $(this).parent().addClass('active');
                    loadAnnotation(evt.target.text);
                    evt.preventDefault();
                });
                $('#btn-layout, .tool-layout').click(toggleLayout);
                
                $("#btn-group-download a, #btn-group-download #btn-view, #download-selected").click(function(evt) {
                    switch ($(this).attr('id')) {
                    case "download-visible":
                        downloadShownData();
                        break;
                    case "btn-view":
                    case "view-tabular":
                        var selected = getSelectedNodes().selected;
                        if (selected.length > 0)
                            window.open('tabular/?' + $.param({'n': selected}, true), '_blank');
                        break;
                    case "download-selected":
                        var selected = getSelectedNodes().selected;
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
                        var selected = getUnique(getSelectedNodes().selected.map(function(s) {return getStrain(s).label;}).sort());
                        var selectedOrfs = getUnique(getSelectedNodes().selected.map(function(s) {return getStrain(s).orf;}).sort());
                        var hasFlash = false;
                        
                        try {
                          var fo = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');
                          if (fo) {
                            hasFlash = true;
                          }
                        } catch (e) {
                          if (navigator.mimeTypes
                                && navigator.mimeTypes['application/x-shockwave-flash'] != undefined
                                && navigator.mimeTypes['application/x-shockwave-flash'].enabledPlugin) {
                            hasFlash = true;
                          }
                        }
                        if (hasFlash) {
                            messageUser("Selected genes were copied to clipboard");
                        } else if (selected.length > 0) {
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
                        }
                        break;
                    }
                    
                    evt.preventDefault();
                });
                
                /*
                 * Style modal stuff
                 */
                var styleSliders = {
                    nsize: {
                        range: {min: .1, max: 8},
                        step: 2,
                        start: 2,
                        connect: "lower",
                        set: function() {
                            sigInst.graphProperties({maxNodeSize: $(this).val()}).draw();
                            state.setProperty("nodeSize", $(this).val());
                            changeState();
                        }
                    },
                    lsize: {
                        range: {min: 1, max: 28},
                        step: 7,
                        start: sigInst._core.plotter.p.defaultLabelSize,
                        connect: "lower",
                        set: function() {
                            sigInst.drawingProperties({defaultLabelSize: $(this).val()}).draw(-1, -1, 1);
                            state.setProperty("labelSize", $(this).val());
                            changeState();
                        }
                    },
                    lthresh: {
                        range: {min: 0, max: 24},
                        step: 6,
                        start: sigInst._core.plotter.p.labelThreshold,
                        connect: "lower",
                        set: function() {
                            sigInst.drawingProperties({labelThreshold: $(this).val()}).draw(-1, -1, 1);
                            state.setProperty("labelThreshold", $(this).val());
                            changeState();
                        }
                    },
                    esize: {
                        range: {min: 1, max: 20},
                        step: 5,
                        start: 1,
                        connect: "lower",
                        set: function() {
                            sigInst.graphProperties({maxEdgeSize: $(this).val()}).draw();
                            state.setProperty("edgeWidth", $(this).val());
                            changeState();
                        }
                    },
                    snsize: {
                        range: {min: 1, max: 10},
                        step: 1,
                        start: 1,
                        connect: "lower", 
                        set: function() {},
                    },
                }
                
                for (slider in styleSliders) {
                    if ($('#style-slider-' + slider).length) {
                        $('#style-slider-' + slider).noUiSlider(styleSliders[slider]).on('set', styleSliders[slider].set);
                        $('#style-slider-' + slider).attr('data-slider-default', $('#style-slider-' + slider).val());
                    }
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
                        if (annot != undefined) $.removeCookie(data.terms[annot[0]].name);
                    });
                    vizdata[stateAnnot].colorPalette[data.terms["-1"].idx] = 'e3e3e3';
                    vizdata[stateAnnot].colorPalette[data.terms["-2"].idx] = 'e3e3e3';
                    
                    rebuildLegend();
                    applyAnnotationColors();
                });
                
                $('#btn-legend').click(function(e) {
                    if (state.getProperty('annotation') == 'None') return;
                    $('#legend').show();
                    e.preventDefault();
                });
                
                var box = $(".content:first")[0].getBoundingClientRect(), toClose = true;
                if ($('#legend').length) {
                    Drag.init(document.getElementById("legend-handle"), document.getElementById("legend"), box["left"], box["right"] - 250, box["top"], box["bottom"] - 90);
                }
                
                $('#legend .panel-heading').dblclick(function(e) {
                    $('#legend .panel-body').toggle();
                    e.preventDefault();
                });
                
                $('#btn-group-styles').click(function() {
                    $('#style-tabs').tab('show');
                    
                    var modal = $('#style-tabs').parent('.modal-body');
                    $('#style-tabs a[href=#' + modal.find('.tab-content .active').attr('id') + ']').addClass('active');
                });
                
                $(".cutoff-cor").each(function() {
                    var ori = $(this).data("ori"), dir = $(this).data("dir");
                    
                    $(this).noUiSlider({
                        range: {min: sliderProperties.min, max: sliderProperties.max},
                        step: sliderProperties.step,
                        start: sliderProperties.value,
                        direction: dir,
                        orientation: ori,
                    }).on('set', function(e) {
                        var val = $(this).val();
                        if (isInitializing || parseFloat(val) == sliderProperties.preCorValue) return;
                        
                        var nodes = sigInst._core.graph.nodes.filter(function(node) {
                            return !(node.hidden && node._hidden);
                        }).map(function(node) {
                            return node.id;
                        });
                        
                        var nodeMulti = 140, nodeLimit = Math.floor(nodeMulti * (Math.log((val-0.04)*100)/Math.log(20))) + 1;
                        
                        if (val < sliderProperties.value && nodes.length <= nodeLimit) {
                            $.post("correlations/", {csrfmiddlewaretoken: $.cookie('csrftoken'), nodes: nodes, cutoff: val}, function(data) {
                                for (n in data["nodes"]) {
                                    var node = data["nodes"][n];
                                    var strain = getStrain(node);
                                    if (!nodeExists(node)) {
                                        sigInst.addNode(node, {
                                            x: (Math.random() * 100),
                                            y: (Math.random() * 100),
                                        });
                                    }
                                }
                                
                                for (e in data["edges"]) {
                                    var edge = data["edges"][e];
                                    var edgeId = edge.s + '+' + edge.t, edgeReverseId = edge.t + '+' + edge.s;
                                    if (nodeExists(edge.s) && nodeExists(edge.t) && !sigInst._core.graph.edgesIndex[edgeId] && !sigInst._core.graph.edgesIndex[edgeReverseId]) {
                                        sigInst.addEdge(edgeId, edge.s, edge.t, edge);
                                        
                                        var addedEdge = getEdge(edgeId), source = getNode(edge.s), target = getNode(edge.t);
                                        addedEdge.weight = addedEdge.size = Math.abs(edge.w);
                                        
                                        source.hidden = source._hidden = false;
                                        target.hidden = target._hidden = false;
                                    }
                                }
                                
                                updateEdges(0);
                                sigInst.draw();
                                toggleLayout(false, 'force');
                                applySettings({label: settings['label']});
                            });
                            sliderProperties.value = val;
                        } else if (nodes.length > nodeLimit && val < sliderProperties.value) {
                            $(this).val(sliderProperties.preCorValue);
                            alertUser('Too many nodes', 'Too many nodes on the working network, number of nodes should be lower than or equal to ' + nodeLimit + 
                                      ' for the selected cutoff.<br>Node count: ' + nodes.length + '<br>Visible node count: ' + countVisibleNodes());
                            return;
                        }
                        
                        sliderProperties.preCorValue = val;
                        applyCutoff(val);
                        $(".cutoff-cor:not(#" + $(this).attr("id") + ")").val(val);
                        changeState();
                    }).Link('lower').to($(".cutoff-label-min"));
                });
                
                $(".cutoff-int").each(function() {
                    var ori = $(this).data("ori");
                    
                    $(this).noUiSlider({
                        range: {
                            min: -1,
                            max: 1
                        },
                        step: sliderProperties.step,
                        start: [-0.08, 0.08],
                        orientation: ori,
                    }).on('set', function() {
                        var val = $(this).val(), preVal = sliderProperties.preIntValue;
                        if (isInitializing || (parseFloat(val[0]) == preVal[0] && parseFloat(val[1]) == preVal[1])) return;
                        
                        if (ori == 'horizontal') {
                            var tmpVal = val[0]; 
                            val[0] = -val[1], val[1] = -tmpVal;
                        }
                        
                        if (val[0] < 0 && val[1] > 0) {
                            applyCutoff(val);
                            sliderProperties.preIntValue = [val[0], val[1]]
                            $(".cutoff-int:not(#" + $(this).attr("id") + ")").val(val);
                            changeState();
                        } else {
                            $(this).val(preVal);
                        }
                    }).on('slide', function() {
                        var val = $(this).val();
                        if (val[0] > 0) {
                            $(this).val([0, null]);
                        } else if (val[1] < 0) {
                            $(this).val([null, 0]);
                        }
                    });
                }).Link('lower').to(function(val){
                    if ($(this).data("ori") == 'horizontal') {
                        $(".cutoff-label-min").html(val);
                    } else {
                        $(".cutoff-label-max").html(-val);
                    }
                }).Link('upper').to(function(val){
                    if ($(this).data("ori") == 'horizontal') {
                        $(".cutoff-label-max").html(val);
                    } else {
                        $(".cutoff-label-min").html(-val);
                    }
                });
                
                $(".cutoff-label-min").html(sliderProperties.value);
                $("#cutoff-label").click(function() {});
                
                var tmpNetworks = {before: {}, current: {}};
                $(".img-icon").click(function(evt){
                    var selection = getSelection();
                    if (selection.length < 1 || selection.length > 7) return;

                    sigInst.iterNodes(function(node) {
                        if (node.id.indexOf('tmp_') != -1) sigInst.dropNode(node.id);
                    });

                    tmpNetworks['before'] = $.extend({}, tmpNetworks['current']);
                    var ntmp = sigInst._core.graph.nodes.filter(function(node) {
                        return !node.hidden;
                    });
                    
                    tmpNetworks['current'] = {};
                    for (n in ntmp) {
                        var node = ntmp[n];
                        tmpNetworks['current'][node.id] = {x: node.x, y: node.y};
                    }
                    
                    if ($(this).attr('data-id') == 0) {
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
                        }
                        
                        switchDataset($(this).attr('data-id'));
                        if (countVisibleEdges() < 1000) {
                            toggleLayout(false, 'force');
                        } else {
                            showRegions = true;
                            drawRegions();
                        }
                    } else {
                        showRegions = false;
                        clearDrawnRegions(); 
                        
                        if (selection.length == 1 && state.getProperty("dataset") == 0) {
                            if (state.getProperty("annotation") == "None") loadAnnotation("SAFE");
                            
                            var circularFunc = function() {
                                circularLayout = true;
                                var selected = getSelectedNodes(true), node = getNode(selected[0]), groups = {}, draw = [];
                                var etmp = sigInst._core.graph.edges.filter(function(e) {return !e.hidden && !e.source.hidden && !e.target.hidden;});
                                var ntmp = sigInst._core.graph.nodes.filter(function(n) {return !n.hidden && n.id != parseInt(selected[0]);});
                                
                                if (!nodeExists("tmp_" + node.id)) sigInst.addNode("tmp_" + node.id, node);
                                var tempN = getNode("tmp_" + node.id), nMap = {"+": node, "-": tempN};
                                tempN.hidden = tempN._hidden = false;
                                tempN.x = node.x - 3600;
                                tempN.y = node.y;
                                
                                etmp.forEach(function(e) {
                                    var tmpkey = "+", centerNode, outNode;
                                    if (e.source.id == node.id) {
                                        centerNode = e.source;
                                        outNode = e.target;
                                    } else if (e.target.id == node.id) {
                                        centerNode = e.target;
                                        outNode = e.source;
                                    } else {
                                        e.hidden = true;
                                    }
                                    
                                    if (centerNode) {
                                        if (e.weight < 0) {
                                            tmpkey = "-";
                                            sigInst.addEdge(tempN.id + "-" + outNode.id, tempN.id, outNode.id, e);
                                            e._cl_hidden = e.hidden = true; //hide the edges to the original node
                                        }
                                        
                                        if (!groups.hasOwnProperty(tmpkey)) groups[tmpkey] = [];
                                        groups[tmpkey].push(outNode);
                                    }
                                });
                                
                                ntmp.forEach(function(n) {
                                    var connected = false;
                                    etmp.forEach(function (e) {
                                        if (e.source.id == n.id || e.target.id == n.id) {
                                            connected = true;
                                        }
                                    })
                                    n.hidden = !connected;
                                })
                                
                                for (i in groups) {
                                    groups[i].sort(function(n1, n2) {
                                        if (n1.color < n2.color) return -1;
                                        if (n1.color > n2.color) return 1;
                                        return 0;
                                    });
                                    
                                    var sides = [], s = [300, 480], angle;
                                    
                                    sides[0] = sides[1] = groups[i].length/2;
                                    if (groups[i].length % 2 != 0) {
                                        sides[0] = Math.floor(sides[0]);
                                        sides[1] = Math.ceil(sides[1]);
                                    }
                                    
                                    var j = 0, k = 0;
                                    for (n in sides) {
                                        angle = 2 * Math.PI / 3 / sides[n];
                                        while (k < sides[n]) {
                                            var node = groups[i][j];
                                            draw.push({x: nMap[i].x + 1400*Math.cos(k*angle + s[n]*Math.PI/180), 
                                                       y: nMap[i].y + 1400*Math.sin(k*angle + s[n]*Math.PI/180), 
                                                       node: node});
                                            j++;
                                            k++;
                                        }
                                        k = 0;
                                    }
                                }
                                
                                sigInst.moveNodes({destinations: draw, runtime: 3}, function() {
                                    changeNodesState();
                                    $('#style-slider-lthresh').val(0, true);
                                    $('.btn-home').click();
                                });
                            }
                            
                            showCorrelationDriving(true, false, circularFunc);
                        } else {
                            showCorrelationDriving(true);
                        }
                    }
                    
                    evt.preventDefault();
                });
                
                /*
                 * Buttons
                 */
                $('.btn-home').click(function() {
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
                
                
                $('#download-snapshot').click(downloadCanvasSnapshot);
                $('#download-svg').click(downloadCanvasSvg);
                
                $('.btn-zoom-in').click(function() {
                    var position = sigInst.position();
                    var size = sigInst.size();
                    
                    sigInst.goTo(size.w / 2, size.h / 2, position.ratio * 2).draw();
                });
                
                $('.btn-zoom-out').click(function() {
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
                    case "context-nodes-gi":
                        var selection = getSelectedNodes(true);
                        if (selection.length < 6 && selection.length > 0)
                            showCorrelationDriving(true);
                        break;
                    case "context-node-gi":
                        showCorrelationDriving(true, true);
                        break;
                    }
                    
                    $("#contextmenu-container").hide();
                    evt.preventDefault();
                });
                
                $("#contextmenu-edge a").click(function(evt) {
                    switch ($(this).attr('id')) {
                    case "context-edge-gi":
                        showCorrelationDriving();
                        break;
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
                
//                $('[data-toggle="tooltip"]').tooltip();
                
                /* EDIT NODE MODAL DIALOG STUFF */
                
                var modal = $('#edit-node-modal');
                modal.modal({show: false});
                modal.find('.modal-confirm').click(function() {
                    var node = getNode(modal.find('#edit-node-id').val()), colorsChanged = false;
                    node.label = modal.find('#edit-node-label').val();
                    node.color = "#" + modal.find('#edit-node-color').val().toUpperCase();
                    node.forceLabel = modal.find('#edit-node-label-force').prop('checked');
                    node.size_mult = modal.find('#style-slider-snsize').val();
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
                
                $("#custom-arange").click(function() {
                    if (state.getProperty('selection').length < 3) return;
                    $(".vizualization-ui").hide();
                    $('.draw-ui').fadeIn(1000);
                    $('#draw-canvas').fadeIn(1000);
                });
                
                $("#tool-rotate-arbitrary").click(function(e) {
                    $("#rotation-modal").modal('show');
                    $("#rotation-modal").on("shown.bs.modal", function() {
                        $("#rotation-modal input").focus();
                    });
                });
                
                $("#rotation-modal").find(".modal-confirm").click(function(e) {
                    var angle = $(".rotation-input").val();
                    var onlySelected = $(".rotation-select").is(':checked');
                    var nodes = getSelectedNodes(true), selected = [];
                    
                    if (onlySelected) {
                        for (var i = 0; i < nodes.length; i++) {
                            selected.push(getNode(nodes[i]));
                        }
                    } else {
                        selected = sigInst._core.graph.nodes.filter(function(node) {
                            return !node.hidden;
                        });
                    }
                    
                    if (isNumber(angle)) {
                        angle = parseInt(angle);
                        
                        if (angle < 361 && angle > -361) {
                            angle = parseInt(angle);
                            clearDrawnRegions();
                            sigInst.rotateNodes({callback: function() {drawRegions(); changeNodesState();}, degrees: angle, nodes: selected});
                            $("#rotation-modal").modal("hide");
                        } else {
                            messageUser("Please enter an angle between -360 and 360 degrees.", "alerts-panel-rotate");
                        }
                    } else {
                        messageUser("Please enter a valid angle.", "alerts-panel-rotate");
                    }
                    
                    e.preventDefault();
                });
                
                $(".vizualization-ui a").click(function(e) {
                    if ($(this).parent().hasClass('disabled')) {
                        return false;
                    }
                    e.preventDefault();
                });
                
                $(".cutoff-label, .cutoff-label-simple").each(function() {
                    var label = $(this), placement = label.data('placement') || 'left';
                    label.popover({
                        container: "body",
                        placement: placement,
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
                            if (label.attr('id') == 'cutoff-label-min' || label.attr('id') == 'cutoff-label-min-simple') {
                                if (data == 0) {
                                    cutoff = value;
                                } else {
                                    cutoff[1] = -value;
                                }
                            } else {
                                cutoff[0] = -value;
                            }
                            
                            if (state.getProperty("cutoff_" + data) != cutoff) {
                                $(".cutoff-bar[data-dataset=\"" + data + "\"]").val(cutoff);
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
                
                var hasFlash = false;
                try {
                    var fo = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');
                    if (fo) {
                      hasFlash = true;
                    }
                } catch (e) {
                    if (navigator.mimeTypes
                        && navigator.mimeTypes['application/x-shockwave-flash'] != undefined
                        && navigator.mimeTypes['application/x-shockwave-flash'].enabledPlugin) {
                        hasFlash = true;
                    }
                }
                
                if (hasFlash) {
                    ZeroClipboard.config({
                        forceEnhancedClipboard: true
                    });
                    var client = new ZeroClipboard($("#list-selected"));
                }
                
                $("#settings-modal .modal-confirm").click(function() {
                    applySettings(settings);
                });
                
                $("#tool-stack").click(function() {
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
                        changeNodesState();
                        $('.btn-home').click();
                    });
                });
                
//                $("#btn-save-state").click(function() {
//                    localStorage.setItem("savedState", JSON.stringify(state.asJson()));
//                    var nodesState = {};
//                    sigInst._core.graph.nodes.forEach(function(node) {
//                        nodesState[node.id] = {
//                             x: node.x,
//                             y: node.y,
//                             color: node.color,
//                             label: node.label,
//                             hidden: node.hidden
//                        }
//                    });
//                    localStorage.setItem("savedNodes", JSON.stringify(nodesState));
//                    messageUser("Saved State")
//                });
                
                $(".search-bar").mouseenter(function(e) {
                    $(".select2-container-multi .select2-choices").css("max-height", "300px");
                }).mouseleave(function(e) {
                    if (!$("input.gene-search-input").data("open")) {
                        $(".select2-container-multi .select2-choices").css("max-height", "34px");
                    }
                });
                
                $(".switch-ui").click(function() {
                    $("#" + currentUi + "-ui").fadeOut(1000);
                    currentUi = currentUi == "simple" ? "advance" : "simple";
                    $("#" + currentUi + "-ui").fadeIn(1000);
                });
            }
            
            function traverseRec(node, netNum, len) {
                var nextNode;
                if (node.layout.subnetwork != null) return len;
                
                node.layout.subnetwork = netNum;
                for (nextNode in node.layout.connections) {
                    nextNode = node.layout.connections[nextNode];
                    len = traverseRec(nextNode, netNum, len);
                }
                return len + 1;
            }
            
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
                    if (settings['advanceUi']) currentUi = 'advance';
                    $("#" + currentUi + "-ui").fadeIn(1000);
                    $("#common-ui").show();
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
                }, 1000);
            }
            
            function buildDrawUI() {
                $.ajax(opts.drawUIUrl, {
                    async: false,
                    processData: false,
                    success: function(data) {
                        $(rootElement).append('<canvas id="draw-canvas" width="' + $("canvas:first").width() + 'px" height="' + $("canvas:first").height() + 'px" style="display: none;"></canvas>')
                        $(rootElement).append($('<div class="draw-ui" style="display: none;">').html(data));
                        
                        window.addEventListener('resize', function() {
                            $('#draw-canvas').attr('width', $("canvas:first").width());
                            $('#draw-canvas').attr('height', $("canvas:first").height());
                        });
                    }
                  });
            }
            
            function initDrawUI() {
                var isDrawing = false, fillOn = false, drawShape = "free", x, y, deltaX, deltaY;
                var canvas = $("#draw-canvas"), context = canvas[0].getContext("2d"), mouseEvent;
                
                $("#draw-canvas").mousedown(function(e) {
                    context.strokeStyle = "rgba(255, 0, 0, 1)";
                    context.fillStyle = "rgba(255, 0, 0, 0.5)";
                    x = [], y = [];
                    context.clearRect(0, 0, canvas.width(), canvas.height());
                    isDrawing = true;
                    var xPos = e.offsetX != undefined ? e.offsetX : e.pageX - this.offsetLeft;
                    var yPos = e.offsetY != undefined ? e.offsetY : e.pageX - this.offsetTop;
                    x.push(xPos);
                    y.push(yPos);
                });
                
                var drawFunc = function(e) {
                    if (isDrawing) {
                        if (e.type != "mousemove" && e.keyCode == 16) {
                            e = mouseEvent;
                            e.shiftKey = true;
                        }
                        
                        context.clearRect(0, 0, canvas.width(), canvas.height());
                        context.beginPath();
                        
                        var xPos = e.offsetX != undefined ? e.offsetX : e.pageX - $("#draw-canvas")[0].offsetLeft;
                        var yPos = e.offsetY != undefined ? e.offsetY : e.pageX - $("#draw-canvas")[0].offsetTop;
                        
                        var centerX = (xPos - x[0])/2 + x[0], centerY = (yPos - y[0])/2 + y[0];
                        var width = xPos - x[0], height = yPos - y[0];
                        
                        if (e.shiftKey && drawShape == "square") {
                            width = Math.abs(width)/width*Math.max(Math.abs(width), Math.abs(height));
                            height = Math.abs(height)/height*Math.max(Math.abs(width), Math.abs(height));
                            centerX = width/2 + x[0], centerY = height/2 + y[0];
                        }
                        
                        switch (drawShape) {
                        case "circle":
                            context.arc(centerX, centerY, Math.sqrt(Math.pow(width/2, 2) + Math.pow(height/2, 2)), 0, 2*Math.PI);
                            break;
                        case "square":
                            context.rect(x[0], y[0], width, height);
                            break;
                        case "line":
                            context.moveTo(x[0], y[0]);
                            context.lineTo(xPos, yPos);
                            break;
                        default:
                            context.moveTo(x[0], y[0]);
                            x.push(xPos);
                            y.push(yPos);
                            for (var i = 1; i < x.length; i++) {
                                context.lineTo(x[i], y[i]);
                            }
                        }
                        context.stroke();
                        if (fillOn && drawShape != "free") context.fill();
                        context.closePath();
                        mouseEvent = e;
                    }
                };
                
                $("#draw-canvas").on("mousemove", drawFunc);
                window.addEventListener("keydown", drawFunc, false);
                
                $("#draw-canvas").on("mouseup", function(e) {
                    var xPos = e.offsetX != undefined ? e.offsetX : e.pageX - $("#draw-canvas")[0].offsetLeft;
                    var yPos = e.offsetY != undefined ? e.offsetY : e.pageX - $("#draw-canvas")[0].offsetTop;
                    var width = xPos - x[0], height = yPos - y[0];
                    
                    if (e.shiftKey && drawShape == "square") {
                        width = Math.abs(width)/width*Math.max(Math.abs(width), Math.abs(height));
                        height = Math.abs(height)/height*Math.max(Math.abs(width), Math.abs(height));
                        x.push(x[0] + width);
                        y.push(y[0] + height);
                    } else {
                        x.push(xPos);
                        y.push(yPos);
                    }
                    isDrawing = false;
                });
                
                $(".fill-radio input").on("change", function() {
                    fillOn = $(this).val() == "true";
                    if (mouseEvent != undefined || mouseEvent != null) {
                        isDrawing = true;
                        drawFunc(mouseEvent);
                        isDrawing = false;
                    }
                });
                
                $(".shape-radio input").on("change", function() {
                    context.clearRect(0, 0, canvas.width(), canvas.height());
                    drawShape = $(this).data("shape");
                    if (drawShape == "free" || drawShape == "line") {
                        $(".fill-radio label").addClass("disabled");
                    } else {
                        $(".fill-radio label").removeClass("disabled");
                    }
                    x = [], y = [];
                });
                
                $("#draw-confirm").click(function() {
                    var selected = getSelectedNodes(true);
                    if (x.length == 0 || selected == null || selected.length < 1 || selected == undefined) return;
                    
                    context.clearRect(0, 0, canvas.width(), canvas.height());
                    var draw = [], cursor = {x: x[0], y: y[0]}, delta = 0, length = 0, i = 1, dS = selected.length - 1;
                    
                    if (drawShape == "free" || drawShape == "line" || !fillOn) {
                        switch (drawShape) {
                        case "circle":
                            var theta = Math.PI * 2 / selected.length;
                            var mX = (x[x.length - 1] - x[0])/2, mY = (y[y.length - 1] - y[0])/2, r = Math.sqrt(mX*mX + mY*mY);
                            for (var i = 0; i < selected.length; i++) {
                                draw.push({x: x[0] + mX + r*Math.cos(theta * i), y: y[0] + mY + r*Math.sin(theta * i)});
                            }
                            break;
                        case "line":
                            var dX = (x[x.length - 1] - x[0]) / (selected.length - 1), dY = (y[y.length - 1] - y[0]) / (selected.length - 1);
                            for (i = 0; i < selected.length; i++) {
                                draw.push({x: x[0] + i*dX, y: y[0] + i*dY});
                            }
                            break;
                        case "square":
                            dS = selected.length;
                            x = [x[0], x[x.length - 1], x[x.length - 1], x[0], x[0]];
                            y = [y[0], y[0], y[y.length - 1], y[y.length - 1], y[0]];
                        default:
                            draw.push(cursor);
                            
                            for (count = 0; count < x.length - 1; count++) {
                                delta += Math.sqrt(Math.pow(x[count+1] - x[count], 2) + Math.pow(y[count+1] - y[count], 2));
                            }
                            delta /= dS;
                            
                            while (i < x.length) {
                               var nxtX = x[i], nxtY = y[i];
                               var dist = Math.sqrt(Math.pow((nxtX-cursor["x"]), 2) + Math.pow((nxtY-cursor["y"]), 2));
                               var next_jump = length + dist;
                               
                               if (next_jump == delta) {
                                   draw.push({x: nxtX, y: nxtY});
                                   cursor = {x: nxtX, y: nxtY};
                                   length = 0;
                                   i += 1;
                               } else if (next_jump < delta) {
                                   cursor = {x: nxtX, y: nxtY};
                                   length += dist;
                                   i += 1;
                               } else {
                                   var remainder = delta - length;
                                   var angle = Math.atan2(nxtY - cursor["y"], nxtX - cursor["x"]);
                                   cursor = {x: cursor["x"] + (Math.cos(angle) * remainder), y: cursor["y"] + (Math.sin(angle) * remainder)}
                                   draw.push(cursor)
                                   length = 0;
                               }
                               if (draw.length == selected.length) break;
                            }
                            if (draw.length < selected.length) draw.push({x: x[x.length-1], y: y[y.length-1]});
                        }
                    } else {
                        // fillOn
                        var mX = (x[x.length - 1] - x[0])/2., mY = (y[y.length - 1] - y[0])/2.;
                        
                        switch (drawShape) {
                        case "circle":
                            var num = selected.length;
                            
                            var path = opts.circleUrl;
                                            
                            $.ajax({dataType: 'json', type: 'get', data: {num: num}, url: path, async: false, success: function(data) {
                                draw = data
                            }});
                            
                            if (draw.length == selected.length) {
                                r = Math.sqrt(mX*mX + mY*mY)
                                for (i = 0; i < draw.length; i++) {
                                    draw[i]["x"] = draw[i]["x"] * r + x[0] + mX;
                                    draw[i]["y"] = draw[i]["y"] * r + y[0] + mY;
                                }
                            } else {
                                var i = level = 1, coor = [];
                                while (i < selected.length) {
                                    i += level * 6;
                                    level += 1;
                                }
                               
                                level -= 1;
                                 
                                for (i = -level; i <= level - 1; i++) {
                                    for (var j = -level; j <= level - 1; j++) {
                                        if (Math.abs(i + j) <= level) {
                                            coor.push({x: 0.5 * i * 3/2, y: Math.sqrt(3) * 0.5 *(j + i/2)});
                                            coor.push({x: Math.sqrt(3) * 0.5 *(j + i/2), y: 0.5 * i * 3/2});
                                        }
                                    }
                                }
                                
                                var r = Math.sqrt(mX*mX + mY*mY) / level;
                                for (i = 0; i < coor.length; i++) {
                                    coor[i]["x"] = coor[i]["x"] * r + x[0] + mX;
                                    coor[i]["y"] = coor[i]["y"] * r + y[0] + mY;
                                }
                                
                                for (i = 0; i < selected.length; i++) {
                                    var n = Math.floor(Math.random() * coor.length);
                                    draw.push(coor[n]);
                                    coor.splice(n, 1);
                                }
                            }
                            break;
                        default:
                            var r = Math.max(mX / mY) / Math.min (mX / mY);
                            var bSide = Math.ceil(Math.sqrt(selected.length / r)), sSide = Math.ceil(selected.length / bSide);
                            
                            var nX = mX > mY ? bSide : sSide, dX = mX * 2 / (nX - 1);
                            var nY = mY > mX ? bSide : sSide, dY = mY * 2 / (nY - 1);
                            
                            for (var i = 0; i < nY; i++) {
                                var n = selected.length - draw.length, count;
                                if (n >= nX) {
                                    count = nX;
                                } else {
                                    dX = mX * 2  / (n - 1);
                                    count = n;
                                }
                                for (j = 0; j < count; j++) {
                                    draw.push({x: x[0] + j * dX, y: y[0] + i * dY});
                                }
                            }
                        }
                    }
                    
                    var position = sigInst.position(), size = sigInst.size();
                    var n1 = getNode(selected[0]), n2 = getNode(selected[1]);
                    var dAbs = Math.sqrt(Math.pow(n1.x - n2.x, 2) + Math.pow(n1.y - n2.y, 2));
                    var dDis = Math.sqrt(Math.pow(n1.displayX - n2.displayX, 2) + Math.pow(n1.displayY - n2.displayY, 2));
                    var ratio = dAbs/dDis;
                    
                    for (var i = 0; i < selected.length; i++) {
                        var n = getNode(selected[i]);
                        draw[i]["x"] = n.x + ((draw[i]["x"]) - n.displayX)*ratio;
                        draw[i]["y"] = n.y + ((draw[i]["y"]) - n.displayY)*ratio;
                        draw[i]["node"] = n;
                    }
                    sigInst.moveNodes({destinations: draw, runtime: 3}, function() {
                        changeNodesState();
                    });
                    x = [], y = [];
                });
                
                $("#draw-cancel").click(function() {
                    $("#draw-canvas").hide();
                    $(".draw-ui").hide();
                    $("#" + currentUi + "-ui").fadeIn(1000);
                });
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
                    maxRatio : 64,
                    blockScroll: settings['scroll'] || false,
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
                }).bind('startmovingnodes', function(evt) {
                    clearDrawnRegions();
                }).bind('stopmovingnodes', function(evt) {
                    if (vizdata[state.getProperty("annotation") + 'Region']) drawRegions();
                }).bind('draggedNode', function() {
                    clicking.wasDragging = true;
                    changeNodesState();
                }).bind('selectionStop', function(selection) {
                    noPulse = true;
                    if (selection.content.nodeSelect) {
                        $("input.gene-search-input").select2("val", getSelection().concat(selection.content.selected), true);
                    } 
//                    else {
//                        onEdgesClick({content: state.getProperty("edgeSelection").concat(selection.content.selected)});
//                    }
                    noPulse = false;
                }).bind('selectionStart', function() {
                }).bind('rightclickedges', onEdgesContext
                 ).bind('ctrlclickedges', onEdgesContext
                 );
//                 ).bind('upedges', function(targeted) {
//                     if (!clicking.wasDragging) {
//                         onEdgesClick(targeted);
//                         changeState();
//                     }
//                 });
                
                buildNewUI();
                initUI();
                buildDrawUI();
                initDrawUI();
                
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
                
                
                if (!opts.datasets[0].type) {
                    /* Add extra dataset */
                    opts.datasets[1] = {
                            parser: 'json',
                            url: 'interactions/',
                            method: 'post',
                            fetched: []
                    }
                } else {
                    opts.datasets[1] = {
                            parser: 'json',
                            url: opts.datasets[0].url,
                            method: 'get',
                            fetched: []
                    }
                }
                
                state.setProperty("cutoff_1", [-0.08, 0.08]);
                //$('.cutoff-bar[data-dataset="1"]').val(state.getProperty("cutoff_1"), {update: true});
                
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
                        
                        var toPaste = getUnique(getSelectedNodes().selected.map(function(s) {return getStrain(s).label;})).sort();
                        $("#copy-area").html(toPaste.toString())
                        
                        var moveOn = true;
                        sigInst.iterNodes(function(node) {
                            strain = getStrain(node.id);
                            if ($.inArray(strain.id + "", selected.selected) >= 0) {
                                node.selected = true;
                                
                                if (node.hidden && !autoState ) {
                                    if (!selected.byAnnot.hasOwnProperty(node.id)) {
                                        messageUser('Gene you\'re looking for is below current threshold.');
                                        moveOn = false;
                                    }
                                } else {
                                    numVisibleSelected++;
                                    if (state.getProperty('annotation') == 'None') loadAnnotation('SAFE');
                                    node.forceLabel = true;
//                                    node.size_mult = 2;
//                                    node.size = node.size_init * node.size_mult;
                                }
                            } else {
                                node.selected = false;
                                node.forceLabel = false;
//                                node.size_mult = 1;
//                                node.size = node.size_init;
                            }
                        });
                        
                        if (moveOn && !isInitializing) {
                            $('[data-hidden-search]').each(function() {
                                $(this).hide();
                            });
                            
                            $('[data-hidden-simple-btn]').each(function() {
                                $(this).removeClass("hidden");
                            });
                        }
                        
                        $('[data-selection-constraint]').each(function() {
                            var enabled = true, size = selected.selected.length, cls = $(this).data('selection-class') || 'disabled';
                            
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
                            
                            if ($(this).attr("id") != undefined && $(this).attr("id").indexOf("btn-group-neighbourhood") != -1 && !isInitializing && !$(this).data("blinked")) {
                                $(this).fadeTo(500, 0.5).fadeTo(500, 1);
                                $(this).data("blinked", true);
                            }
                        });
                        
                        if (!tokenizing) {
                            updateMissingMessage();
                            sigInst.draw();
                            
                            if (!($(selected.selected).not(state.getProperty("selection")).length == 0 && $(state.getProperty("selection")).not(selected).length == 0)) {
                                var diff = $(selected.selected).not(state.getProperty("selection")).get(), nodes = [];
                                state.setProperty("selection", getSelection());
                                
                                //takes difference, and only blinks new nodes
//                                if (!noPulse) {
//                                    diff.forEach(function(n) {
//                                        var node = getNode(n);
//                                        if (node) nodes.push(node);
//                                    });
//                                    sigInst.locateSearchedNodes({nodes: nodes, runtime: 3});
//                                }
                                
                                //blinks all nodes
                                if (!noPulse && diff.length > 0) {
                                    selection.forEach(function(n) {
                                        var node = getNode(n);
                                        if (node) nodes.push(node);
                                    });
                                    sigInst.locateSearchedNodes({nodes: nodes, runtime: 3});
                                }
                                
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
                            var dropdown = $('#btn-group-annotation li:contains('+ annot +')');
                            $('#btn-group-annotation li').removeClass('active');
                            dropdown.addClass('active');
                            loadAnnotation(annot);
                            $(".gene-search-input").select2("close");
                            e.preventDefault();
                        }
                    }).on('select2-opening', function(e) {
                        $(this).data('open', true);
                    }).on('select2-close', function(e) {
                        $(this).data('open', false);
                        $(".select2-container-multi .select2-choices").css("max-height", "34px");
                    }).on('select2-focus', function(e) {
                        setTimeout(function() {
                            var height = $(".select2-container-multi .select2-choices")[0].scrollHeight;
                            $(".select2-container-multi .select2-choices").scrollTop(height);
                        }, 0);
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
