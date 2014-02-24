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
                    layouts: [],
                    datasets: [],
                    hideLayouts: false,
                    annotations: [],
                    layoutAlgo: ['fa2', 'fr', 'fl'],
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
                    modifiedCallback: null
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
            var neighbourhoodLevel = -1;
            var networkCutoff = sliderProperties.value;
            
            function log(msg) {
                if (opts.debug) console.log(msg);
            };
            
            function updateColorInputs() {
                $.fn.spectrum.processNativeColorInputs();
                $('.sp-dd').remove();
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
            
            function updateColorInputs() {
                $.fn.spectrum.processNativeColorInputs();
                $('.sp-dd').remove();
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
            
            function modalInput(title, text, label, type, callback) {
                $('body').append('<div class="modal fade" id="modal-input" tabindex="-1" role="dialog" aria-labelledby="modal-input-label" aria-hidden="true"> \
                        <div class="modal-dialog"> \
                        <div class="modal-content"> \
                          <div class="modal-header"> \
                            <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button> \
                            <h4 class="modal-title" id="modal-input-label">' + title + '</h4> \
                          </div> \
                          <div class="modal-body"> \
                            <p>' + text + '</p> \
                            <p>' + label + '<input type="' + type + '" id="modal-input-value"></p> \
                          </div> \
                          <div class="modal-footer"> \
                            <button type="button" class="btn btn-default" data-dismiss="modal">Close</button> \
                            <button id="modal-input-confirm" type="button" class="btn btn-primary">Confirm</button> \
                          </div> \
                        </div> \
                      </div> \
                    </div>');
                
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
                    var annot = vizdata[vizdata.loaded_annot].map[node.id];
                    if (annot != undefined) {
                        color = vizdata[vizdata.loaded_annot].colorPalette[vizdata[vizdata.loaded_annot].terms[annot[0]].idx];
                    } else {
                        color = vizdata[vizdata.loaded_annot].defaultColor;
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
            }
            
            function loadDataset(preloaded) {
                var dataset = opts.datasets[0];
                
                var loadDatasetCallback = function (nodes, edges, extraContext) {
                    var edgesAdded = 0;
                    edges.forEach(function(edge){
                        if (nodeExists(edge.source) && nodeExists(edge.target)) {
                            sigInst.addEdge(edge.id, edge.source, edge.target, edge);
                            edgesAdded++;
                        }
                    });
                    
                    var minWeight = null;
                    var maxWeight = null;
                    sigInst._core.graph.edges.forEach(function(edge) {
                        edge.absweight = Math.abs(edge.weight);
                        minWeight = Math.min(minWeight || edge.absweight, edge.absweight);
                        maxWeight = Math.max(maxWeight || edge.absweight, edge.absweight);
                    });
                    
                    vizdata['edges'] = {};
                    
                    if (sliderProperties.updateLimits) {
                        $("#cutoff-bar").noUiSlider({range: [minWeight, maxWeight]}, true);
                    }
                    
                    sigInst.draw();
                };
                
                if (preloaded == undefined) {
                    getParser(dataset.parser)($, sigInst, dataset.url, vizdata, loadDatasetCallback);
                } else {
                    loadDatasetCallback(null, preloaded.edges);
                }
            }
            
            function loadLayout(e) {
                var layout = opts.layouts[0];
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
                    
                    sigInst._core.graph.nodes.forEach(function(node) {
                        node.size_init = node.size;
                    });
                    
                    if (edges.length > 0) {
                        loadDataset({edges: edges, dataset: extraContext});
                    } else {
                        // LOAD DEFAULT DATASET
                        loadDataset();
                    }
                    
                    vizdata['edges'] = {};
                }
                getParser(layout.parser)($, sigInst, layout.url, vizdata, layoutCallback);
            }

            function loadAnnotation(id) {
                vizdata.loaded_annot = id;

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
                                console.log(annotation);
                                
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
                                                    idx : i,
                                                    name : vizdata[id].terms[n]
                                            }
                                            i++;
                                        }
                                        
                                        vizdata[id].colorPalette = get_color_palette(i);
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
                    if (annot != undefined) {
                        n.color = data.colorPalette[data.terms[annot[0]].idx];
                    } else {
                        n.color = data.defaultColor;
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

            /**
             * Select nodes to isolate
             */
            function onNodesCtrlClick(targets) {
                // TODO: 
            }

            function onNodesClick(targets) {
                var node = getNode(targets.content[0]);
                var strain = getStrain(targets.content[0]);
                setTimeout( function(){
                    // HAACK
                    log('Opening in SGD: ' + node.id + " " + strain.orf);
                    window.open("http://www.yeastgenome.org/cgi-bin/locus.fpl?locus=" + strain.orf);
                }, 200); // delay 500 ms
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
            }
            
            function toggleLayout(justStop) {
                if (opts.runningLayout) {
                    sigInst.stopForceLayout();
                    _setRunningLayout(false);
                } else if (justStop !== true) {
                    sigInst.startForceLayout({
                        callback: function() {
                                _setRunningLayout(false);
                            },
                        attraction_multiplier: $("#layout-slider-att").val(),
                        repulsion_multiplier: $("#layout-slider-rep").val(),
                    });
                    _setRunningLayout(true);
                }
            }
            
            function applyNeighbourhood(level) {
                neighbourhoodLevel = level;
                
                /* Resets big red nodes */
                var selected = getSelected();
                selected.forEach(function (id){
                    var node = getNode(id);
                    if (node != undefined) node.size = node.size_init;
                });
                
                applyNetwork();
            };
            
            function applyCutoff(cutoff) {
                networkCutoff = cutoff;
                applyNetwork();
            };
            
            /**
             * Apply the cutoff/neighbourhood changes to the network.. aka. re-draw
             */
            function applyFilterEdges() {
                // reset all nodes
                var hidden = neighbourhoodLevel != -1;
                sigInst.iterNodes(function(node) {
                    node.hidden = hidden;
                    node.visibleDegree = node.degree;
                });
                
                sigInst.iterEdges(function(edge) {
                    edge.hidden = Math.abs(edge.weight) < networkCutoff;
                    if (edge.hidden) {
                        edge.source.visibleDegree--;
                        edge.target.visibleDegree--;
                    }
                });
                
                if (neighbourhoodLevel != -1) {
                    var localSelected = {};
                    getSelected().forEach(function(id) {
                        var node = getNode(id);
                        if (node != undefined) {
                            node.hidden = false;
                            localSelected[node.id] = true;
                        }
                    });
                    
                    for (var level = 0; level < neighbourhoodLevel; level++) {
                        console.log('level', level);
                        var tmpSelected = {};
                        
                        sigInst.iterEdges(function(edge) {
                            if (!edge.hidden && (localSelected[edge.source.id] || localSelected[edge.target.id])) {
                                edge.source.hidden = false;
                                edge.target.hidden = false;
                                tmpSelected[edge.source.id] = true;
                                tmpSelected[edge.target.id] = true;
                            }
                        });
                        
                        localSelected = $.extend({}, localSelected, tmpSelected);
                    }
                    
                    delete localSelected;
                }
                
                sigInst.iterNodes(function(node) {
                    if (!node.hidden && node.visibleDegree == 0) node.hidden = true;
                })
            }
            
            function applyFilterNodes() {
                var hidden = neighbourhoodLevel != -1;
                
                // re-apply cutoff
                sigInst.iterNodes(function(node) {
                    if (node.degree > networkCutoff) {
                        node.visibleDegree = 0;
                        node.hidden = true;
                    } else {
                        node.visibleDegree = node.degree;
                        node.hidden = hidden;
                    }
                });
                
                sigInst.iterEdges(function(edge){
                    if (edge.source.visibleDegree < 1 || edge.target.visibleDegree < 1) {
                        edge.source.visibleDegree--;
                        edge.target.visibleDegree--;
                    }
                });
                
                // ^^ cutoff applied here ^^
                
                if (neighbourhoodLevel != -1) {
                    var localSelected = {};
                    getSelected().forEach(function(id) {
                        var node = getNode(id);
                        if (node != undefined) {
                            node.hidden = false;
                            localSelected[node.id] = true;
                        }
                    });
                    
                    for (var level = 0; level < neighbourhoodLevel; level++) {
                        console.log('level', level);
                        var tmpSelected = {};
                        
                        sigInst.iterEdges(function(edge) {
                            if (edge.source.visibleDegree > 0 && edge.target.visibleDegree > 0 && 
                                    (localSelected[edge.source.id] || localSelected[edge.target.id])) {
                                edge.source.hidden = false;
                                edge.target.hidden = false;
                                tmpSelected[edge.source.id] = true;
                                tmpSelected[edge.target.id] = true;
                            }
                        });
                        
                        localSelected = $.extend({}, localSelected, tmpSelected);
                    }
                    
                    delete localSelected;
                }
                
                // All good nodes are visible, hide them now
                if (!hidden) {
                    sigInst.iterNodes(function(node) {
                        if (!node.hidden && node.visibleDegree < 1) node.hidden = true;
                    });
                }
            }
            
            function applyNetwork() {
                console.log("Applying changes to network: cutoff=", networkCutoff, "neighbourhood level=", neighbourhoodLevel);
                
                switch(sliderProperties.filter) {
                case 'edges':
                    applyFilterEdges();
                    break;
                case 'nodes':
                    applyFilterNodes();
                    break;
                }
                
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
            
            function initElements() {
                $(rootElement).append('<div id="search-bar" class="input-group"> \
                          <span class="input-group-addon glyphicon glyphicon-search"></span> \
                          <input class="gene-search-input form-control" type="hidden"> \
                      </div>');
                $(rootElement).append('<div id="download-bar" class="input-group"> \
                    </div>');
                
                $(rootElement).append('<div id="cutoff-bar"></div>');
                $(rootElement).append('<div id="cutoff-label"></div>');
                
                var menuBar = $('<div id="menu-bar">');
                
                menuBar.append('<div id="btn-group-neighbourhood" class="hidden btn-group"> \
                        <button type="button" class="btn btn-primary">Neighbourhood</button> \
                        <button type="button" class="btn btn-primary dropdown-toggle" data-toggle="dropdown"> \
                          <span class="caret"></span> \
                          <span class="sr-only">Toggle Dropdown</span> \
                        </button> \
                        <ul class="dropdown-menu" role="menu"> \
                          <li><a href="#">Remove selection</a></li> \
                          <li class="divider"></li> \
                          <li><a href="#" data-toggle="download">Selected genes only</a></li> \
                          <li><a href="#" data-toggle="download">1st neighbours</a></li> \
                          <li><a href="#" data-toggle="download">2nd neighbours</a></li> \
                          <li><a href="#" data-toggle="download">3rd neighbours</a></li> \
                          <!-- <li class="divider neighbourhood-download"></li> \
                          <li class="neighbourhood-download"><a href="#" data-toggle="download">Download</a></li> --> \
                        </ul> \
                      </div>');
                menuBar.find('#btn-group-neighbourhood a').click(function(evt) {
                    $(".neighbourhood-download").toggle($(this).attr('data-toggle') == "download");
                    
                    switch (evt.target.text) {
                    case "Download":
                        downloadShownData();
                        break;
                    case "Remove selection":
                        clearSelection();
                        break;
                    case "Selected genes only":
                        applyNeighbourhood(0);
                        break;
                    default:
                        applyNeighbourhood(parseInt(evt.target.text.charAt(0)));
                    }
                });
                menuBar.find(".neighbourhood-download").hide();
                
                if (opts.annotations.length > 0) {
                    menuBar.append('<div id="btn-group-annotation" class="btn-group"> \
                            <button type="button" class="btn btn-primary">Annotation</button> \
                            <button type="button" class="btn btn-primary dropdown-toggle" data-toggle="dropdown"> \
                              <span class="caret"></span> \
                              <span class="sr-only">Toggle Dropdown</span> \
                            </button> \
                            <ul class="dropdown-menu" role="menu"> \
                              <li><a href="#">None</a></li> \
                              <li class="divider"></li> \
                            </ul> \
                          </div>');
                    
                    opts.annotations.forEach(function(annotation) {
                        menuBar.find('#btn-group-annotation .dropdown-menu').append('<li><a href="#">' + annotation.name + '</a></li>');
                    });
                    
                    menuBar.find('#btn-group-annotation a').click(function(evt) {
                        loadAnnotation(evt.target.text);
                    });
                }
                
                var download_bar = $(rootElement).find('#download-bar');
                download_bar.append('<div id="btn-group-download" class="btn-group"> \
                        <button id="btn-view" type="button" class="btn btn-primary ladda-button" data-style="zoom-in">Get the data</button> \
                        <button type="button" class="btn btn-primary dropdown-toggle" data-toggle="dropdown"> \
                          <span class="caret"></span> \
                          <span class="sr-only">Toggle Dropdown</span> \
                        </button> \
                        <ul class="dropdown-menu" role="menu"> \
                            <li><a id="view-tabular" href="#"><span class="glyphicons table"></span> View data in table form</a></li> \
                            <li class="divider"></li> \
                            <li><a id="download-visible" href="#"><span class="filetype-icon csv"></span> Download visible network</a></li> \
                            <li><a id="download-selected" href="#"><span class="filetype-icon xls"></span> Download data for selected genes</a></li> \
                            <li><a id="download-dataset" href="#"><span class="filetype-icon csv"></span> Download dataset</a></li> \
                            <li class="divider"></li> \
                            <li><a id="download-xgmml" href="#"><span class="filetype-icon xml"></span> Export visible network to xgmml</a></li> \
                        </ul> \
                      </div>');
                download_bar.find("#download-selected").toggleClass('disabled');
                download_bar.find("#download-dataset").toggleClass('disabled');
                
                download_bar.find("#btn-group-download a, #btn-group-download button").click(function() {
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
                
                menuBar.append('<div id="btn-group-layout" class="btn-group"> \
                        <button id="btn-layout" type="button" class="btn btn-primary">Layout</button> \
                        <button type="button" class="btn btn-primary dropdown-toggle" data-toggle="dropdown"> \
                          <span class="caret"></span> \
                          <span class="sr-only">Toggle Dropdown</span> \
                        </button> \
                        <ul class="dropdown-menu" role="menu"> \
                          <li><a href="#">Attraction: <div id="layout-slider-att"></div></a></li> \
                        <li><a href="#">Repulsion: <div id="layout-slider-rep"></div></a></li> \
                        </ul> \
                      </div>');
                
                menuBar.find('#btn-group-layout').toggleClass('hidden', opts.layoutButtonHide);
                menuBar.find('#btn-layout').click(toggleLayout);
                
                $('body').append('<div id="alerts-panel"> \
                        </div>');
                
                $('body').append('<div class="modal fade" id="modal-style" tabindex="-1" role="dialog" aria-labelledby="modal-style-label" aria-hidden="true"> \
                            <div class="modal-dialog"> \
                            <div class="modal-content"> \
                              <div class="modal-header"> \
                                <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button> \
                                <h4 class="modal-title" id="modal-style-label">Network style</h4> \
                              </div> \
                              <div class="modal-body"> \
                                <ul id="style-tabs" class="nav nav-pills nav-justified"> \
                                  <li class="active"><a href="#style-node" data-toggle="tab">Node</a></li> \
                                  <li><a href="#style-edge" data-toggle="tab">Edge</a></li> \
                                  <li><a href="#style-general" data-toggle="tab">General</a></li> \
                                </ul> \
                                <div class="tab-content"> \
                                  <div class="tab-pane fade in active" id="style-node"> \
                                    <ul class="list-group"> \
                                      <li class="list-group-item">Node size: <div id="style-slider-nsize"></div></li> \
                                      <li class="list-group-item">Label size: <div id="style-slider-lsize"></div></li> \
                                      <li class="list-group-item">Label threshold: <div id="style-slider-lthresh"></div></li> \
                                      <li class="list-group-item">Label color: <input id="style-label-color" value="fff" name="label-color" class="pick-a-color"></li> \
                                    </ul> \
                                  </div> \
                                  <div class="tab-pane fade" id="style-edge"> \
                                    <ul class="list-group"> \
                                      <li class="list-group-item">Edge width: <div id="style-slider-esize"></div></li> \
                                    </ul> \
                                  </div> \
                                  <div class="tab-pane fade" id="style-general"> \
                                    <ul class="list-group"> \
                                      <li class="list-group-item">Background color: <input id="background-color" value="222222" name="background-color" class="pick-a-color"></li> \
                                    </ul> \
                                  </div> \
                                </div> \
                              </div> \
                              <div class="modal-footer"> \
                                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button> \
                                <button id="btn-style-default" type="button" class="btn btn-primary">Revert to defaults</button> \
                              </div> \
                            </div><!-- /.modal-content --> \
                          </div><!-- /.modal-dialog --> \
                        </div><!-- /.modal -->');
                
                $('#style-tabs a').click(function (e) {
                    e.preventDefault();
                    $(this).tab('show');
                });
                
                $('body').append('<div id="contextmenu-container" class="dropdown clearfix" style="display: none;"> \
                        <ul id="contextmenu" class="dropdown-menu" role="menu" aria-labelledby="dropdownMenu" style="display:block;position:static;margin-bottom:5px;"> \
                          <li><a id="context-info" tabindex="-1" href="#"><span class="glyphicon glyphicon-info-sign"></span> Show info</a></li> \
                          <li><a id="context-dl" tabindex="-1" href="#"><span class="glyphicon glyphicon-download"></span> Download interactions</a></li> \
                          <li class="divider"></li> \
                          <li><a id="context-hide" tabindex="-1" href="#"><span class="glyphicon glyphicon-eye-close"></span> Hide node</a></li> \
                          <li><a id="context-rename" tabindex="-1" href="#"><span class="glyphicon glyphicon-pencil"></span> Rename node</a></li> \
                          <li><a id="context-color" tabindex="-1" href="#"><span class="glyphicon glyphicon-tint"></span> Color node</a></li> \
                        </ul> \
                      </div>');
                
                menuBar.append('<button id="btn-style" type="button" class="btn btn-success" data-toggle="modal" data-target="#modal-style">Style</button>');
                menuBar.find('#btn-style').click(function() { $.event.trigger('networkModified'); });
                
                $(rootElement).append(menuBar);
                
                $(rootElement).append('<div id="zoom-box">\
                          <div class="btn-group-vertical">\
                            <button id="btn-home" type="button" class="btn btn-default" data-toggle="tooltip" data-placement="left" data-delay="500" title="Center view"><span class="glyphicon glyphicon-home"></span></button>\
                          </div>\
                          <div class="btn-group-vertical" data-toggle="tooltip" data-placement="left" data-delay="500" title="Zoom">\
                            <button id="btn-zoom-in" type="button" class="btn btn-default"><span class="glyphicon glyphicon-zoom-in"></span></button>\
                            <button id="btn-zoom-out" type="button" class="btn btn-default"><span class="glyphicon glyphicon-zoom-out"></span></button>\
                          </div>\
                          <div class="btn-group-vertical">\
                            <button id="btn-fullscreen" type="button" class="btn btn-default" data-toggle="tooltip" data-placement="left" data-delay="500" title="Fullscreen"><span class="glyphicon glyphicon-fullscreen"></span></button>\
                            <button id="btn-snapshot" type="button" class="btn btn-default" data-toggle="tooltip" data-placement="left" data-delay="500" title="Network snapshot"><span class="glyphicon glyphicon-camera"></span></button>\
                          </div>\
                        </div>');
                
                $('[data-toggle="tooltip"]').tooltip();
                
                /*
                 * Style modal stuff
                 */
                
                var styleSliders = {
                    nsize: {
                        range: [.1, 10],
                        step: .2,
                        start: 2,
                        handles: 1,
                        connect: "lower",
                        set: function() {
                            sigInst.graphProperties({maxNodeSize: $(this).val()}).draw();
                        }
                    },
                    lsize: {
                        range: [1, 30],
                        step: 1,
                        start: sigInst._core.plotter.p.defaultLabelSize,
                        handles: 1,
                        connect: "lower",
                        set: function() {
                            sigInst.drawingProperties({defaultLabelSize: $(this).val()}).draw(-1, -1, 1);
                        }
                    },
                    lthresh: {
                        range: [0, 20],
                        step: 1,
                        start: sigInst._core.plotter.p.labelThreshold,
                        handles: 1,
                        connect: "lower",
                        set: function() {
                            sigInst.drawingProperties({labelThreshold: $(this).val()}).draw(-1, -1, 1);
                        }
                    },
                    esize: {
                        range: [1, 30],
                        step: 1,
                        start: 1,
                        handles: 1,
                        connect: "lower",
                        set: function() {
                            sigInst.graphProperties({maxEdgeSize: $(this).val()}).draw();
                        }
                    }
                } 
                
                for (slider in styleSliders) {
                    $('#style-slider-' + slider).noUiSlider(styleSliders[slider]);
                    $('#style-slider-' + slider).attr('data-slider-default', $('#style-slider-' + slider).val());
                }
                
                $('#btn-style-default').click(function() {
                    for (slider in styleSliders) {
                        $('#style-slider-' + slider).val($('#style-slider-' + slider).attr('data-slider-default'), true);
                    }
                    $('#background-color').val('#222222').change();
                });
                
                /*
                 * Other sliders
                 */
                
                var layoutSliders = {
                    att: {
                        range: [1, 100],
                        step: 1,
                        start: 50,
                        handles: 1,
                        connect: "lower",
                    },
                    rep: {
                        range: [1, 100],
                        step: 1,
                        start: 1,
                        handles: 1,
                        connect: "lower"
                    }
                }
                
                for (slider in layoutSliders) {
                    $('#layout-slider-' + slider).noUiSlider(layoutSliders[slider]);
                }
                
                $("#cutoff-bar").noUiSlider({
                    range: [sliderProperties.min, sliderProperties.max],
                    step: sliderProperties.step,
                    start: sliderProperties.value,
                    handles: 1,
                    connect: "upper",
                    direction: "rtl",
                    orientation: "vertical",
                    set: function() {
                        $.event.trigger('networkModified');
                        applyCutoff($(this).val());
                    },
                    serialization: {
                        to: [$("#cutoff-label"), 'html']
                    }
                });
                
                networkCutoff = sliderProperties.value;
                
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
                    console.log(size, position.ratio);
                    
                    var x = -(mmx.ax + mmx.zx - (2 * position.stageX) - size.w) / 2;
                    var y = -(mmx.ay + mmx.zy - (2 * position.stageY) - size.h) / 2;
                    
                    console.log(x, y);
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
                $('#btn-snapshot').click(downloadCanvasSnapshot);
                
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
                
                $('#background-color').change(function() {
                    $(rootElement).css('background-color', "#" + $(this).val());
                });
                
                $('#style-label-color').change(function() {
                    sigInst.drawingProperties({defaultLabelColor: $(this).val()}).draw(-1, -1, 1);
                });
                
                /*
                 * Prevent context menu, we want our own
                 * rightclick functionality
                 */
                $("#network-container").contextmenu(function() {
                    return false;
                });
                // sigh... disable context menu on context menu
                // b/c its not in the other container
                $("#contextmenu-container").contextmenu(function() {
                    return false;
                });
                // Nice effects, stop any animations on enter,
                // hide on leave, hide if not entered (code in
                // callback above)
                $("#contextmenu-container").mouseleave(function() {
                    $(this).delay(500).hide();
                }).mouseenter(function() {
                    $(this).stop(true);
                });
                
                $("#contextmenu a").click(function() {
                    switch ($(this).attr('id')) {
                    case "context-info":
                        var node = getNode(hoveredTargets[0]), strain = getStrain(node.id);
                        
                        console.log(opts.nodeInfo(node, strain));
                        
                        alertUser('Node info', opts.nodeInfo(node, strain))
                        break
                    case "context-dl":
                        var node = getNode(hoveredTargets[0]), strain = getStrain(node.id);
                        window.location.href = 'dl/?n=' + node.id;
                        break
                    case "context-hide":
                        hoveredTargets.forEach(function(node) {
                            getNode(node).hidden = true;
                        });
                        sigInst.draw();
                        break
                    case "context-rename":
                        var node = getNode(hoveredTargets[0]);
                        modalInput(
                                'Rename node', 
                                'Renaming node <strong>' + node.label + '</strong>',
                                'New name: ',
                                'text',
                                function(val) {
                                    node.label = val;
                                    sigInst.draw(-1, -1, 1);
                                }
                            );
                        break
                    case "context-color":
                        var node = getNode(hoveredTargets[0]);
                        modalInput(
                                'Color node', 
                                'Coloring node <strong>' + node.label + '</strong>',
                                'New color: ',
                                'color',
                                function(val) {
                                    console.log(val);
                                    node.color = val;
                                    sigInst.draw(1);
                                }
                            );
                        updateColorInputs();
                        break
                    }
                    
                    switch ($(this).attr('id')) {
                    case "context-hide":
                    case "context-rename":
                    case "context-color":
                        $.event.trigger('networkModified');
                        break;
                    }
                    
                    $("#contextmenu-container").hide();
                });
                
                $(".pick-a-color").pickAColor();
            }
            
            function init() {
                sigInst = sigma.init(rootElement).drawingProperties({
                    defaultLabelSize: 14,
                    defaultLabelHoverColor: '#000',
                    labelThreshold: 6,
                    font: 'Arial',
                    edgeColor : 'white',
                    defaultLabelColor : 'white',
                    nodeColor : opts.defaultNodeColor,
                    defaultEdgeArrow: opts.arrows ? 'target' : 'none',
                }).graphProperties(graphProperties).mouseProperties({
                    drawHoverEdges: false,
                    maxRatio : 64
                }).bind('rightclicknodes', onNodesContext
                 ).bind('ctrlclicknodes', onNodesCtrlClick
                 ).bind('shiftclicknodes', onNodesShiftClick
//                 ).bind('dblclicknodes', onNodesClick
        		 ).bind('downnodes', onNodeClick
                );
                
                initElements();
                
                if (opts.highlight) sigInst.hoverHighlight(opts);
                
                /* Loading spinner each time we hit the server */
                $("body").on({
                    ajaxStart: function() {
                        $(rootElement).append('<div id="modal-overlay" class="ui-widget-overlay ui-front"></div>');
                    },
                    ajaxStop: function() {
                        $("#modal-overlay").remove()
                    }
                });
                
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
                            
                            if (addedNew) {
                                applyNetwork();
                                sigInst.draw();
                            }
                            
                            tokenizing = false;
                            if (original!==input) return input;
                        },
                        createSearchChoice: function(term) {
                            var wildcard = term.indexOf('*') != -1;
                            term = term.replace('*', '').toLowerCase();
                            
                            if (term.length > 0) {
                                var results = [];
                                
                                autocomp.forEach(function(node) {
                                    node.tokens.forEach(function(token) {
                                        if ((wildcard && token.toLowerCase().startsWith(term)) || token.toLowerCase() === term) {
                                            results.push({id: node.id, text: node.value });
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
                    }).on('change', function(evt) {
                        $.event.trigger('networkModified');
                        var selected = getSelected();
                        
                        sigInst.iterNodes(function(node) {
                            if ($.inArray(node.id, selected) >= 0) {
                                setNodeColor(node, "#FF0000");
                                node.size = node.size_init; // * 3;
                                
                                if (node.hidden) {
                                    messageUser('Gene you\'re looking for is below current threshold.')
                                }
                            } else {
                                setNodeColor(node);
                                node.size = node.size_init;
                            }
                        });
                        
                        if (selected.length == 0) {
                            neighbourhoodLevel = -1; // All nodes
                        }
                        
                        $('#btn-group-neighbourhood').toggleClass('hidden', selected.length == 0);
                        $('#btn-group-layout').toggleClass('hidden', opts.layoutButtonHide && selected.length == 0);
                        $('#download-selected').toggleClass('disabled', selected.length == 0);
                        
                        if (!tokenizing) {
                            updateMissingMessage();
                            applyNetwork();
                            sigInst.draw();
                        }
                    });
                    
                    // Load plot graph in Michael Jackson mode by
                    // default
                    loadAnnotation('None');
                    loadLayout();
                });
                
                $(document).mousemove(updateMousePosition);
            }
            
            /* Starting point */
            init();
        }
    });
})(jQuery);