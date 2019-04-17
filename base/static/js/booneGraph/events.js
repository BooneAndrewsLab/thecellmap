define([
    'jquery',
    'underscore',
    'backbone',

    'node',
    'annotation',
    'layout',
    'download',
    'dataset',
    'utils',

    'drag',
    'bootstrap.colorpicker',
    'clipboard',
    'xls',
    'load',

    'jquery.cookie',
    'sigma.rotate',
    'bootstrap',
], function($, _, Backbone,
    Node, Annotation, Layout, Download, Dataset, Utils, Draggabilly, Colorpicker, Clipboard) {
    var tabularWindow;

    var eventsView = Backbone.View.extend({
        initialize: function() {
            if (!opts.debug) {
                $('#network-container').contextmenu(function() { return false; });
                $('.contextmenu').contextmenu(function() { return false; });
            }

            state.on('change:selecting', function() {
                $('#download-selected-simple').removeClass('hidden');
            });

            state.on('change:selection', function() {
                var enabled, cls, size = Utils.getSelectedNodes().length;

                $('#dataset-toggle label').attr('disabled', size == 0);

                $('[data-selection-constraint]').each(function() {
                    enabled = true;
                    cls = $(this).data('selection-class') || 'disabled';

                    if ($(this).data('selection-gt') != undefined) {
                        enabled &= size > $(this).data('selection-gt');
                    }
                    if ($(this).data('selection-lt') != undefined) {
                        enabled &= size < $(this).data('selection-lt');
                    }

                    if (cls == 'disabled') $(this).prop(cls, !enabled);
                    else $(this).toggleClass(cls, !enabled);

                    if (!enabled) {
                        $(this).attr('title', $(this).data('selection-disabled-title'));
                    } else {
                        $(this).removeAttr('title');
                    }
                });

                Utils.updateUrl();
            });

            state.on('change:annotation', function() {
                Utils.updateUrl();
            });

            state.on('change:annotation change:dataset', function() {
                $('[data-annotation-constraint], [data-dataset-constraint]').each(function() {
                    var enabled = true;
                    if ($(this).data('annotation-constraint') != undefined) {
                        enabled &= state.get('annotation') != 'None';
                    }
                    if ($(this).data('dataset-constraint') != undefined) {
                        enabled &= state.get('dataset') != 0;
                    }
                    $(this).toggleClass('disabled', !enabled);
                })
            })

            state.on('change:showRegions', function() {
                if (state.get('showRegions') == false) {
                    Annotation.clearRegions();
                    Annotation.applyAnnotationColors();
                }
            });

            state.on('change:showCircular', function() {
                if (state.get('showCircular') == false) {
                    Utils.cleanUpNodes();
                }
                $('[data-circular-constraint]').each(function() {
                    $(this).toggleClass('disabled', state.get('showCircular'));
                });
            });

            state.on('change:missingNodes', function() {
                var nodes = state.get('missingNodes');
                if (nodes.length) {
                    // TODO, add nodes to the network, approx their location
// $('.cutoff-bar[data-dataset=0]')[0].noUiSlider.set(0.1);
// Dataset.addMissing(nodes);
                    $('.cutoff-bar[data-dataset=0]')[0].noUiSlider.set(0.1);
                    state.set('missingNodes', []);
                }
            });

            state.on('change:isInitializing', function() {
                var a = window.location.search.substr(1).split('&');

                if (a == '') return;
                var b = {};
                for (var i = 0; i < a.length; ++i) {
                    var p = a[i].split('=', 2);
                    if (p.length == 1) {
                        b[p[0]] = '';
                    } else if (p[1].indexOf('null') == -1){
                        b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, ' ')).split(',');
                    }
                }

                if (b['q']) {
                    if (b['q'].length == 1) b['q'].push('');
                    $('input.gene-search-input').select2('search', b['q'], true);
                }
            });

            state.on('change:step', function() {
                if (state.get('step') > 1) {
                    sigInst.mouseProperties({allowNodeDrag: true});
                }

                $('[data-simple-step]').each(function() {
                    var action = $(this).data('simple-action') || 'hidden';

                    if (action == 'hidden') {
                        if ($(this).data('simple-step') == state.get('step')) {
                            $(this).removeClass('hidden');
                            $(this).show();
                        } else if ($(this).data('simple-keep') != true){
                            $(this).hide();
                        }
                    } else if (action == 'disabled') {
                        if ($(this).data('simple-step') == state.get('step')) {
// $(this).removeClass('hidden');
                            $(this).removeClass('disabled');
                        } else if ($(this).data('simple-keep') != true){
                            $(this).addClass('disabled');
                        }
                    }
                });
            });

            var draggable = new Draggabilly('#panel-legend', {
                containment: '.vizualization-ui',
                handle: '#legend-handle'
            });

            var clipboard = new Clipboard('.btn-clipboard');
            clipboard.on('success', function(e) {
                $('#node-selected-list').tooltip({title: 'Copied!', trigger: 'manual', placement: 'bottom'});
                $('#node-selected-list').tooltip('show');
            });

            clipboard.on('error', function(e) {
                $('#node-selected-list').tooltip({title: 'Copy failed, press Ctrl+c', trigger: 'manual', placement: 'bottom'});
                $('#node-selected-list').tooltip('show');
            });

            $('.refresh-network').on('click', this.refreshNetwork);

            $('.bs-colorpicker').colorpicker();

            $('#canvas-background-color').parent().on('changeColor', this.updateBackgroundColor);
            $('#style-label-color').parent().on('changeColor', this.updateLabelColor);

            $('#modal-rotationDrag #rotate-confirm').on('click', this.rotateConfirm);
            $('#modal-edit-node').modal({show: false});

            $('#modal-search').modal({show: false}).on('hide.bs.modal', function() {
                $('.search-bar').appendTo('.select2-div').addClass('hidden-xs');
            }).on('show.bs.modal', function() {
                $('.search-bar').appendTo('#modal-search .modal-body').removeClass('hidden-xs');
            });

            $('#modal-copy').on('show.bs.modal', function() {
                var selection = Utils.getSelection()
                if (selection.length <= 0) return;

                var str = '';
                for (var s in selection) {
                    if (s != 0) str += ', ';
                    str += Utils.getNode(selection[s]).label;
                }
                $('#modal-copy input').val(str);
            }).on('shown.bs.modal', function() {
                $('#modal-copy input').select();
            }).on('hide.bs.modal', function() {
                $('#modal-copy input').val('');
                $('#node-selected-list').tooltip('destroy');
            });

            $('#custom-annot-submit').click(this.loadCustomAnnotation);
            $('#modal-edit-node #edit-node-confrim').click(function() { Node.editNode(); });
            $('#contextmenu a').on('click', this.nodeContext);
            $('#contextmenu-graph a').on('click', this.graphContext);

            $('.contextmenu').mouseleave(function() { $(this).delay(500).fadeOut(500); }).mouseenter(function() { $(this).stop(true); });
            $('body').keydown(this.graphNodes);
            $('body').keyup(function(e){
                if (e.keyCode == 8 && state.get('step') > 1) window.location.href = opts['urls']['home'];
            });
        },
        events: {
            'click #btn-group-download a, #btn-view-tabular, #download-selected-simple': 'downloadNetwork',
            'click #btn-group-neighbourhood a': 'applyNeighbourhood',
            'click #btn-layout, .tool-layout': 'toggleLayout',
            'click #tool-rotate-arbitrary': 'showRotateModal',
            'click #tool-stack': 'stackNetworks',
            'click #tool-custom-arrange': 'showDrawUI',
            'click .load-annotation': 'loadAnnotation',
            'click #btn-legend': 'showLegend',
            'click #legend-handle .close': 'toggleLegend',
            'click .btn-home': 'graphCenter',
            'click .btn-zoom-in': 'graphZoomIn',
            'click .btn-zoom-out': 'graphZoomOut',
            'click #dataset-toggle': 'toggleDataset',

            'click #screenshot-link': 'getSvgScreenshot',

            'click #view-network-simple': 'showNetwork',

            'click #safe-submit': 'safe',
            'click #safe-custom-add': 'safe_more',
            'click #tools-safe-download, .enrich-annotation': 'safe_download',
        },

        downloadNetwork: function(e) {
            var selected = Utils.getSelection();
            switch ($(e.currentTarget).attr('id')) {
            case 'download-visible':
                Download.downloadShownData();
                break;
            case 'download-xgmml':
                Download.downloadXGMML();
                break;
            case 'download-gexf':
                Download.downloadGEXF();
                break;
            case 'download-snapshot':
                Download.downloadCanvasSnapshot();
                break;
            case 'download-svg':
                Download.downloadCanvasSvg();
                break;
            case 'btn-view-tabular':
            case 'view-tabular':
                if (selected.length > 0) {
                    setTimeout(function(){
                        if (!tabularWindow || tabularWindow.closed) {
                            tabularWindow = window.open('tabular/?' + $.param({'n': selected}, true), '_blank');
                        } else {
                            tabularWindow.show_table(selected);
                            tabularWindow.focus();
                        }
                    }, 100);
                    e.target.blur();
                }
                break;
            case 'download-selected-simple':
            case 'download-selected':
                if (selected.length > 0 && selected.length < 20) window.location.href = 'dl/?' + $.param({'n': selected}, true);
                break;
            case 'download-dataset':
                if (opts.canBulkDownload) {
                    window.open('dl/','_blank');
                }
                break;
            }
            e.preventDefault();
        },

        graphContext: function(e) {
            switch ($(e.target).attr('id')) {
            case 'context-copy':
                $('#modal-copy').modal('show');
                break
            case 'context-toggle-nlabel':
                var bool = state.get('showNodeLabels'), val = bool ? 0 : 24;
                state.set('showNodeLabels', !bool);
                sigInst.drawingProperties({labelThreshold: val}).draw(-1, -1, 1);
                break;
            case 'context-toggle-alabel':
                state.set('showAnnotLabels', !state.get('showAnnotLabels'));
                Annotation.drawRegions();
                break;
            case 'context-toggle-acolor':
                state.set('showAnnotColors', !state.get('showAnnotColors'));
                Annotation.drawRegions();
                break;
            case 'context-svg':
                if (settings.get("saveAsSvg") == false){
                    Download.downloadCanvasSnapshot();
                }
                else {
                    Download.downloadCanvasSvg();
                }
                break;
            case 'context-tour':
                localStorage.setItem('enableIntro', true);
                break
            case 'context-styles':
                $('#modal-style').modal('show');
                break;
            case 'context-yeastmine':
                var orfs = {}, strain, form;
                Utils.iterVisibleNodes(function(n) {
                    strain = Utils.getStrain(n.id);
                    orfs[strain.get('orf')] = null;
                });

                form = $('#yeastmine-post');
                form.find('input[name=externalids]').attr('value', Object.keys(orfs).join(','));
                setTimeout(function(){form.submit();}, 100);

                break
            }
        },

        nodeContext: function(e) {
            var targets = state.get('hoveredTargets'), node = Utils.getNode(targets[0]);
            switch ($(e.target).attr('id')) {
            case 'context-dl':
                if (!node.selected) {
                    window.location.href = 'dl/?n=' + node.id;
                } else {
                    var selected = Utils.getSelection();
                    if (selected.length > 0 && selected.length < 20) window.location.href = 'dl/?' + $.param({'n': selected}, true);
                }
                break
            case 'context-hide':
                var selected = !node.selected ? targets : Utils.getSelectedNodes();
                selected.forEach(function(node) {
                    node = Utils.getNode(node);
                    node.hidden = node._hidden = true;
                });
                $('input.gene-search-input').select2('val', [], true);
                sigInst.draw();
                break
            case 'context-label-toggle':
                targets.forEach(function(node) {
                    node = Utils.getNode(node);
                    node.forceLabel = !node.forceLabel;
                });
                sigInst.draw();
                break;
            case 'context-sgd':
                Utils.onNodeDblClick(targets);
                break;
            case 'context-edit-node':
                Node.showNodeModal(targets[0]);
                break;
            case 'context-view-network':
                var labels = '', sels = !node.selected ? targets : Utils.getSelectedNodes(true);
                for (var i in sels) {
                    var node = Utils.getNode(sels[i]);
                    labels += node.label + ',';
                }
                window.open('?q=' + labels.slice(0, -1),'_blank');
                break;
            case 'context-node-gi':
                if (state.get('dataset') == 0 && state.get('annotation') != 'None'){
                    $('input.gene-search-input').select2('val', targets, true);
                    $('.image-dataset-icon[data-dataset="' + 1 + '"]').click();
                }
                break;
            case 'context-copy':
                $('#modal-copy').modal('show');
                break;
            }

            $('#contextmenu-container').hide();
            e.preventDefault();
        },

        applyNeighbourhood: function(e) {
            Node.applyNeighbourhood($(e.target).data('level'));
            e.preventDefault();
        },

        toggleLayout: function(e) {
            Layout.toggleLayout($(e.target).data('layout-type'));
            e.preventDefault();
        },

        showRotateModal: function(e) {
            $('#modal-rotation').modal('show');
            $('#modal-rotation').on('shown.bs.modal', function() {
                $('#modal-rotation input').focus();
            });
            e.preventDefault();
        },
        rotateConfirm: function(e) {
            var angle = $('.rotation-input').val(), onlySelected = $('.rotation-select').is(':checked');
            var nodes = Utils.getSelectedNodes(), selected = [];

            if (onlySelected) {
                for (var i = 0; i < nodes.length; i++) {
                    selected.push(Node.getNode(nodes[i]));
                }
            } else {true
                selected = sigInst._core.graph.nodes;
            }

            if ($.isNumeric(angle)) {
                angle = parseInt(angle);

                if (angle < 361 && angle > -361) {
                    angle = parseInt(angle);
                    Annotation.clearRegions();
                    sigInst.rotateNodes({
                        callback: function() {
                            Annotation.drawRegions();
                        },
                        degrees: angle,
                        nodes: selected
                    });
                    $('#modal-rotation').modal('hide');
                } else {
                    Utils.messageUser('Please enter an angle between -360 and 360 degrees.', 'alerts-panel-rotate');
                }
            } else {
                Utils.messageUser('Please enter a valid angle.', 'alerts-panel-rotate');
            }

            e.preventDefault();
        },

        stackNetworks: function(e) {
            Utils.stackNetworks();
            e.preventDefault();
        },

        showDrawUI: function(e) {
            if (state.get('selection').length < 3) return;

            $('.vizualization-ui').hide();
            $('#draw-ui').fadeIn(1000);
            $('#canvas-draw').fadeIn(1000);
            true
            e.preventDefault();
        },

        loadAnnotation: function(e) {
            $('.btn-group-annotation li').removeClass('active');
            $(e.target).parent().addClass('active');

            if ($(e.target).hasClass('custom-annotation')) {
                $("#modal-custom-annotation").modal('show');
            } else {
                Annotation.loadAnnotation(e.target.text);
            }
            e.preventDefault();
        },

        loadCustomAnnotation: function(e) {
            var f = $('#custom-annot-file')[0].files[0], reader = new FileReader(), name = f.name;
            fileType = name.split('.').pop();

            if (fileType != 'xls' && fileType != 'xlsx') {
                console.log('Not an excel file, bailing');
                return;
            }

            setTimeout(function() {
                reader.onload = function(e) {
                    var data = e.target.result, rows;
                    var xls_cb = function() {
                        var workbook, xlsreader = fileType == 'xls' ? XLS : XLSX;
                        workbook = xlsreader.read(data, {type: 'binary'});
                        rows = Utils.sheet_to_array(xlsreader, workbook.Sheets[workbook.SheetNames[0]]);
                        Annotation.loadCustomAnnotation(name, rows);
                    };

                    if (fileType == 'xls') {
                        xls_cb();
                    } else {
                        $.holdReady( true );
                        $.getScript( "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.8.1/xlsx.min.js", function() {
                          $.holdReady( false );
                          xls_cb();
                        });
                    }
                };
                reader.readAsBinaryString(f);
            }, 500);
        },

        showLegend: function(e) {
            if (state.get('annotation') == 'None') return;
            $('#panel-legend').show();
            e.preventDefault();
        },
        toggleLegend: function(e) {
            if (!$('#legend-body').is(":visible") && state.get('annotation') != 'None') {
                $('#legend-body').show();
                $('#legend-handle button.close').text('-');
            } else {
                $('#legend-body').hide();
                $('#legend-handle button.close').text('+');
            }
            e.preventDefault();
        },

        graphCenter: function(e) {
            Utils.graphCenter();
            e.preventDefault();
        },
        graphZoomIn: function(e) {
            var position = sigInst.position(), size = sigInst.size();
            sigInst.goTo(size.w / 2, size.h / 2, position.ratio * 2).draw();
            e.preventDefault();
        },
        graphZoomOut: function(e) {
            var position = sigInst.position(), size = sigInst.size();
            sigInst.goTo(size.w / 2, size.h / 2, position.ratio / 2).draw();
            e.preventDefault();
        },
        graphNodes: function(e) {
            if (e.ctrlKey && (e.which == 97 || e.which == 65) && Utils.countVisibleNodes() <= 100){
                var visibleNodes = sigInst._core.graph.nodes.filter(function(node) {
                    return !node.hidden;
                }).map(function(node) {
                    return node.id;
                });
                $('input.gene-search-input').select2('val', visibleNodes, true);
                e.preventDefault();
            }
        },

        toggleDataset: function(e) {
            if (opts.runningLayout || Utils.getSelectedNodes() == 0) return false;
            Dataset.toggleDataset($(e.target).parent().data('dataset'));
            e.preventDefault();
        },

        updateBackgroundColor: function(e) {
            state.set('background', e.color.toHex());
            $(opts['rootElement']).css('background-color', e.color.toHex());
            e.preventDefault();
        },
        updateLabelColor: function(e) {
            state.set('labelColor', e.color.toHex());
            sigInst.drawingProperties({defaultLabelColor: e.color.toHex()}).draw(-1, -1, 1);
            e.preventDefault();
        },

        getSvgScreenshot: function(e) {
            if (settings.get("saveAsSvg") == false){
                Download.downloadCanvasSnapshot();
            }
            else {
                Download.downloadCanvasSvg();
            }
            e.preventDefault();
        },

        showNetwork: function(e) {
            if (Utils.getSelectedNodes().length < 0) return;
            if (state.get('showRegions')) Annotation.loadAnnotation('None'); // state.get('annotation')
                                                                                // ==
                                                                                // 'SAFE'
                                                                                // &&

            sigInst.graphProperties({maxEdgeSize: 1});
//            state.set('edgeWidth', 4);

            Node.applyNeighbourhood(1);
            $(e.target).addClass('hidden');
        },

        refreshNetwork: function(e) {
            window.location.href = opts['urls']['home'];
            e.preventDefault();
        },

        smallDeviceSearch: function(e) {
            $('#modal-search').modal('show');
        },

        safe: function(e) {
            var form = $("#modal-safe .tab-pane.active form");

            if (!$("#modal-safe .tab-pane.active form")[0].checkValidity()) {
                return false;
            }

            var form_data = {};
            form.find('.tab-pane').each(function() {
                form_data[$(this).find('.custom-name').val()] = $(this).find('.safe-custom-color').data('colorpicker').color.value.h * 360;
            });

            $.ajax({
                type: "post",
                url: form.attr('action'),
                data: form.serialize(),
                success: function(enrichments) {
                    var node, hue;

                    $("#sigma_nodes_1").hide();
                    $("#sigma_hover_1").hide();

                    Utils.iterVisibleEdges(function(edge) {
                        edge.hidden = true;
                    });

                    sigInst._core.graph.nodes.filter(function(node) {
                        if (node.hasOwnProperty('enrichment')) {
                            delete node['enrichment'];
                            delete node['enrichment_hue'];
                            delete node['enrichment_name'];
                        }
                        if (node.hasOwnProperty('safe_overlay')) {
                            delete node['safe_overlay'];
                        }
                    });

                    if (!!enrichments._selected_node) {
                        node = Utils.getNode(enrichments._selected_node);
                        if (!!node) node['safe_overlay'] = true;
                    }

                    var minEnr = 1;
                    for (var k in enrichments) {
                        if (!enrichments.hasOwnProperty(k)) continue;

                        if (form.find('input[name="safe-type"]').val() == 'selected') {
                            if (k == 'positives') {
                                hue = 48;
                            } else {
                                hue = 210;
                            }
                        } else {
                            hue = form_data[k];
                        }

                        var pairs = enrichments[k];
                        for (var n in pairs) {
                            if (!pairs.hasOwnProperty(n) || isNaN(pairs[n])) continue;

                            node = Utils.getNode(parseInt(n));

                            if (!node.enrichment || node.enrichment < pairs[n]) {
                                node.enrichment = pairs[n];
                                node.enrichment_hue = hue;
                                node.enrichment_name = k;
                            }

                            minEnr = Math.min(node.enrichment, minEnr);
                        }
                    }

                    state.set('myData', true);
                    state.set('myDataType', form.find('input[name="safe-type"]').val());
                    // state.set('showAnnotColors', false);
                    // state.set('showAnnotLabels', true);

                    settings.set('disableScroll', true);
                    sigInst.mouseProperties({mouseEnabled: false});

                    Annotation.loadAnnotation(opts.default_annotation);

                    $('.middle-right').removeClass('hidden');
                    $('.middle-right').show();
                    $('#cutoff-bar-cor').hide();
                    $('#cutoff-bar-safe').show();
                    $('#view-network-simple').hide();

                    $('.top-right-simple > :not([data-safe])').addClass('hidden').hide();
                    $('.top-right-simple > [data-safe]').removeClass('hidden');

                    $('.alert').alert('close');

                    $('#cutoff-bar-safe')[0].noUiSlider.set(0.05); // minEnr
                    $('#panel-legend').toggle(true);

                    sigInst.drawingProperties({drawSafePin: true});

                    sigInst.draw();
                }
              });

            $("#modal-safe").modal('hide');
        },

        safe_more: function(e) {
            var numeles = $('#safe-custom-form .tab-content .tab-pane').length + 1;
            var newtab = $("#safe-tablist").clone();
            newtab.attr('id', newtab.attr('id') + '-' + numeles);

            var tabbutton = $('<li role="presentation"><a href="#' + newtab.attr('id') + '" aria-controls="home" role="tab" data-toggle="tab">Custom list ' + numeles + '</a></li>')

            var nextcolor = (120 + (60 * (numeles - 1))) % 360;
            nextcolor = Utils.hsvToRgb(nextcolor, 100, 100);

            newtab.removeClass('hidden');

            newtab.find('label').each(function() {
                $(this).attr('for', $(this).attr('for') + '-' + numeles);
            });

            newtab.find('div.col-sm-9 > *:first-child').each(function() {
                $(this).attr('id', $(this).attr('id') + '-' + numeles);
                $(this).attr('name', $(this).attr('name') + '-' + numeles);
            });

            newtab.find('input:first').val('Custom list ' + numeles).keyup(function() {
                tabbutton.find('a').text($(this).val());
            });

            newtab.find(".safe-custom-color").colorpicker({
                color: nextcolor,
                horizontal: true,
                input: '#' + newtab.find('.safe-custom-color-container').parent().find('input').attr('id'),
                container: newtab.find('.safe-custom-color-container'),
                inline: true,
                template: '<div class="colorpicker dropdown-menu">' +
                '<div class="colorpicker-saturation hidden"><i><b></b></i></div>' +
                '<div class="colorpicker-hue"><i></i></div>' +
                '<div class="colorpicker-alpha hidden"><i></i></div>' +
                '<div class="colorpicker-color"><div /></div>' +
                '<div class="colorpicker-selectors"></div>' +
                '</div>',
            });

            newtab.appendTo("#safe-custom-form .tab-content");

            $("#safe-custom-add").parent().before(tabbutton);
            tabbutton.find('a').on('shown.bs.tab', function (e) {
                newtab.find('textarea').focus();
            }).tab('show');
        },

        safe_download: function(e) {
            var form = $("#modal-safe .tab-pane.active form");
            var ghost = $('<input type="hidden" name="dl" value="yes">');
            form.append(ghost);

            var annotation = $(e.target).data('annotation-id');
            var annotationGhost;
            if (!!annotation) {
                annotationGhost = $('<input type="hidden" name="annotation">');
                annotationGhost.val(annotation);
                form.append(annotationGhost);
            }

            form.submit();
            ghost.remove();
            if (!!annotation) {
                annotationGhost.remove();
            }
        }
    });

    return eventsView;
});
