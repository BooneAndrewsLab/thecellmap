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
                          type: 'heatmap',
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
            var annotation, network; 
            
            var showingDemo = false;
            
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
                    
                    if (state.getProperty("dataset") == 0) { // TEMPORARY HACK
                        $(".cutoff-bar[data-dataset=\"" + state.getProperty("dataset") + "\"]").val(opts.datasets[0].min + (opts.datasets[0].max-opts.datasets[0].min) / 2); // HAAAAAAAAAAAAACK BUGZ IN nouislider...
                    }
                    $(".cutoff-bar[data-dataset=\"" + state.getProperty("dataset") + "\"]").val(state.getProperty("cutoff_" + state.getProperty("dataset")), {update: true});
                }
                
                for (key in difference) {
                    switch (difference[key]) {
                    case 'selection':
                        $("input.gene-search-input").select2("val", newState.style.getProperty("selection"), true);
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
            
            function iterVisibleNodes(func, ids) {
                sigInst._core.graph.nodes.filter(function(node) {
                    return !node.hidden;
                }).forEach(func, ids);
            };

            function getStrain(id) {
                return vizdata.cells[id];
            }

            function getNode(id) {
                return sigInst._core.graph.nodesIndex[id];
            };
            
            function nodeExists(id) {
                return !!sigInst._core.graph.nodesIndex[id];
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
                
                modal.find('#node-column').html(strain.col_name);
                modal.find('#node-row').html(strain.row_name);
                modal.find('#node-weight').html(strain.weight);
                
                modal.find('#edit-node-id').val(id);
                modal.find('#edit-node-label').val(node.label);
                
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

            function updateMousePosition(event) {
                mouseX = event.pageX;
                mouseY = event.pageY;
            }
            
            function getSelectedNodes(visible) {
                var result = getSelection(), result;
                var strain, node;
                
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
            
            function loadLayout(e) {
                var matrix = opts.matrix;
                var dataset = opts.datasets;
                
                opts.loadedDataset = null;
                opts.loadedLayout = null;
                
                var layoutCallback = function (nodes) {
                    nodes.forEach(function(node) {
//                        if (!isNaN(node.w) && node.w != 0)
                        sigInst.addNode(node.id, node);
                    });
                    
                    loadSearch(nodes);
                    
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
                    
                    var max, position = sigInst.position(), size = sigInst.size();
                    sigInst._core.graph.nodes.forEach(function(node) {
                        max =  Math.max(node['x'], node['y'], max || node['x']);
                    });
                    var r = Math.max(size.w, size.h) / max / 3;
                    
                    sigInst.goTo(size.w / 2, size.h / 2, position.ratio * r).draw();
                    isInitializing = false;
                }
                
                getParser(matrix.parser)({
                    jq: $, sigInst: sigInst, url: matrix.url, vizdata: vizdata, cb: layoutCallback, state: state
                });
            }
            
            function loadSearch(nodes) {
                autocomp = [];
                var column = vizdata['col'], row = vizdata['row'];
                
                for (n in nodes) {
                    var node = nodes[n];
                    if (node.w == 0) continue;
                    
                    autocomp.push({
                        value: node.label,
                        tokens: [node.col, node.row],
                        id: node.id,
                    });
                }
                
                var tokenizing = false;
                $("input.gene-search-input").select2({
                    multiple: true,
                    minimumInputLength: 2,
                    containerCssClass: 'form-control', 
                    placeholder: 'Start typing terms...',
                    allowClear: true,
                    width: '350px',
                    tokenSeparators: [",", " ", "\t", "\n"],
                    initSelection: function (element, callback) {
                        var id = $(element).val(), strain, result = [];
                        id.split(",").forEach(function(x) {
                            if (x !== "") {
                                node = getNode(x);
                                result.push({
                                    text: node.label,
                                    id: node.id
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
                        
                        data.results = data.results.slice(0, 6);
                        query.callback(data);
                    },
                    data: autocomp,
                }).on('change', function(evt, a, b, c) {
                    var selected = getSelectedNodes(), numVisibleSelected = 0, node;
                    var selectionLength, selection = getSelection();
                    
                    sigInst.iterNodes(function(node) {
                        if ($.inArray(node.id + "", selected) >= 0) {
                            node.selected = true;
                            
                            if (node.hidden && !autoState) {
                                if (!selected.byAnnot.hasOwnProperty(node.id))
                                    messageUser('Gene you\'re looking for is below current threshold.')
                            } else {
                                numVisibleSelected++;
                            }
                        } else {
                            node.selected = false;
                        }
                    });
                    
                    $('[data-selection-constraint]').each(function() {
                        var enabled = true, size = selected.length, cls = $(this).data('selection-class') || 'disabled';
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
                            changeState();
                            
                            /* Set the tooltips */
                            updateTooltips();
                        }
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
            }
            
            function onNodesContext(targets) {
                hoveredTargets = targets.content;
                $("#contextmenu-container").show().delay(2000).hide(200);
                $("#contextmenu-container").css({
                    left : mouseX,
                    top : mouseY,
                });
            }
            
            function onNodesClick(targets) {
                noPulse = true;
                switch(clicking.modifierKey) {
                case 'ctrl':
                    break;
                case 'shift':
                    onNodesShiftClick(targets)
                    break;
                default:
                    onNodeClick(targets)
                    break;
                }
                noPulse = false;
            }
            
            function onNodeClick(targets) {
//                Selects the row and column of the node
//              
//              var selected = getNode(targets.content[0])
//              var nodes = sigInst._core.graph.nodes.filter(function(n) {
//                  return selected.attr.col == n.attr.col || selected.attr.row == n.attr.row;
//              })
//              
//              for (var i = 0; i < nodes.length; i++) {
//                  nodes[i] = nodes[i].id;
//              }
//              
//              $("input.gene-search-input").select2("val", nodes, true);
                
                var nodes = [], node;
                
                for (var i = 0; i < targets.content.length; i++) {
                    node = getNode(targets.content[i]);
                    if (node.attr.weight != 0) {
                        nodes.push(targets.content[i]);
                    }
                }
                
                $("input.gene-search-input").select2("val", nodes, true);
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
            
            function applyNeighbourhood(level) {
                /* Resets big red nodes */
                var selected = getSelectedNodes(true), localSelected = {}, tmpSelected, strain;
                selected.forEach(function (id){
                    localSelected[id] = null;
                });
                
                sigInst.iterNodes(function(node) {
                    strain = getStrain(node.id);
                    
                    if (!localSelected.hasOwnProperty(strain.id)) {
                        node._hidden = node.hidden = true;
                    }
                });
                
                applySettings(settings);
            };
            
            function applySettings(s) {
                for (key in s) {
                    switch(key) {
                    case 'zoom':
                        if (s[key]) $('#btn-home').click();
                        break;
                    case 'label':
                        var numVisible = 0, nodes = [];
                        sigInst.iterNodes(function(node) {
                            if (!node.hidden && s[key]) {
                                numVisible++;
                                nodes.push(node);
                            } else if (!s[key]) {
                                node.forceLabel = false;
                            }
                        });
                        if (numVisible <= 100) for (n in nodes) nodes[n].forceLabel = true;
                        sigInst.draw();
                        break;
                    }
                }
            }
            
            function applyCutoff(cutoff) {
                log('applying cutoff', cutoff);
                setCutoff(cutoff);
                var isArray = $.isArray(cutoff), selected = getSelectedNodes(true), strain;
                
                sigInst.iterNodes(function(node) {
                    node.hidden = node.attr.weight < -cutoff[0] &&  node.attr.weight > -cutoff[1];
                });
                
                sigInst.draw();
            };
            function buildNewUI() {
                $.ajax(opts.uiUrl, {
                    async: false,
                    processData: false,
                    success: function(data) {
                        $(rootElement).append($('<div class="vizualization-ui" style="display: none;">').html(data));
                    }
                  });
                
                $('#btn-group-layout').toggleClass('hidden', opts.layoutButtonHide);
                
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
                
                $(".sigma_mouse_canvas").dblclick(function(e) {
                    var position = sigInst.position();
                    var xPos = e.offsetX != undefined ? e.offsetX : e.pageX - this.offsetLeft;
                    var yPos = e.offsetY != undefined ? e.offsetY : e.pageX - this.offsetTop;
                    
                    sigInst.goTo(xPos, yPos, position.ratio * 2).draw();
                });
                
                $(".dropdown-toggle a").click(function(evt) {
                    e.stopImmediatePropagation();
                });
                
                /*
                 * Style modal stuff
                 */
                
                var styleSliders = { 
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
                
                $('.btn-style').click(function() {
                    $('#style-tabs a[href="' + $(this).data('tab') + '"]').tab('show');
                });
                
                $("#cutoff-bar").noUiSlider({
                    range: {
                        min: -1, 
                        max: 1
                    },
                    step: sliderProperties.step,
                    start: [-0.05, 0.05],
                    orientation: "vertical",
                    serialization: {
                        lower: [new Link({target: function(val){$("#cutoff-label-max").html(-val);}})],
                        upper: [new Link({target: function(val){$("#cutoff-label-min").html(-val);}})]
                    }
                }).on('set', function() {
                    applyCutoff($(this).val());
                    changeState();
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
                    case "context-edit-node":
                        editNode(hoveredTargets[0]);
                    case "context-complex":
                        var node = getNode(hoveredTargets[0]);
                        var storage = {
                                annotation: annotation,
                                terms: [node.attr.row.dk, node.attr.col.dk],
                        }
                        
                        sessionStorage.setItem(sessionStorage.length + 1, JSON.stringify(storage))
                        window.location.href = '/network/' + network + '?' + $.param({'hmid': sessionStorage.length}, true);
                        break;
                    }
                    
                    $("#contextmenu-container").hide();
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
                    
                    modal.modal('hide');
                    
                    changeNodesState();
                });
                
                modal.find('#edit-node-color').on('change', function() {
                    if (modal.find('input[name=dominant]:checked').closest('tr').find('.pick-a-color').val() != $(this).val()) {
                        modal.find('input[name=dominant]').prop('checked', false);
                    }
                });
                
                $(".vizualization-ui a").click(function(e) {
                    if ($(this).parent().hasClass('disabled')) {
                        return false;
                    }
                    e.preventDefault();
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
                
                $("#settings-modal .modal-confirm").click(function() {
                    applySettings(settings);
                });
                
                $("#search-bar").mouseenter(function(e) {
                    $(".select2-container-multi .select2-choices").css("max-height", "300px");
                }).mouseleave(function(e) {
                    if (!$("input.gene-search-input").data("open")) {
                        $(".select2-container-multi .select2-choices").css("max-height", "34px");
                    }
                });
            }
            
            function showUI() {
                setTimeout(function() {
                    $(".vizualization-ui").fadeIn(1000);
                }, 1000);
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
                    }
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
                
                /* Fetch all node info */
                $.getJSON(opts.axisUrl, function(data) {
                    var column = data.axis.x, row = data.axis.y;
                    annotation = data.annotation, network = data.network;
                    
                    vizdata['col'] = column; 
                    vizdata['row'] = row;
                    vizdata['cells'] = [];
                    
                    updateTooltips();
                    showUI();
                    
                    // Load plot graph in Michael Jackson mode by
                    // default
                    loadLayout();
                });
                $(document).mousemove(updateMousePosition);
            }
            
            /* Starting point */
            init();
        }
    });
})(jQuery);
