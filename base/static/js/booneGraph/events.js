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
    
    'jquery.cookie',
    'sigma.rotate',
    'bootstrap',
], function($, _, Backbone, 
    Node, Annotation, Layout, Download, Dataset, Utils, Draggabilly, Colorpicker) {
    
    var eventsView = Backbone.View.extend({
        initialize: function() {
            if (!opts.debug) {
                $('#network-container').contextmenu(function() { return false; });
                $('.contextmenu').contextmenu(function() { return false; });
            }
            
            state.on('change:selection', function() {
                var enabled, cls, size = Utils.getSelectedNodes().length;
                
                $('[data-selection-constraint]').each(function() {
                    enabled = true;
                    cls = $(this).data('selection-class') || 'disabled';
                    
                    if ($(this).data('selection-gt') != undefined) {
                        enabled &= size > $(this).data('selection-gt');
                    }
                    if ($(this).data('selection-lt') != undefined) {
                        enabled &= size < $(this).data('selection-lt');
                    }
                    
                    $(this).prop(cls, !enabled);
                    
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
                    $('.cutoff-bar[data-dataset=0]')[0].noUiSlider.set(0.1);
                    state.set('missingNodes', []);
                }
            });
            
            state.on('change:isInitializing', function() {
                var a = window.location.search.substr(1).split('&');
                
                if (a == '') return;
                var b = {};
                for (var i = 0; i < a.length; ++i) {
                    var p=a[i].split('=', 2);
                    if (p.length == 1)
                        b[p[0]] = '';
                    else
                        b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, ' ')).split(',');
                }
                
                var strains = vizdata['strains'], sel = [];
                strains.forEach(function(s) {
                    for (var n in b['q']) {
                        if (b['q'][n].toLowerCase() == s.get('verboseName').toLowerCase()) sel.push(s.get('id'));
                    }
                });
                
                if (b['a'] && b['a'].length == 1) Annotation.loadAnnotation(b['a'][0]);
                $('input.gene-search-input').select2('val', sel, true);
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
//                            $(this).removeClass('hidden');
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
            
            $('.refresh-network').on('click', this.refreshNetwork);
            
            $('.bs-colorpicker').colorpicker();
            
            $('#canvas-background-color').parent().on('changeColor', this.updateBackgroundColor);
            $('#style-label-color').parent().on('changeColor', this.updateLabelColor);
            
            $('#modal-rotationDrag #rotate-confirm').on('click', this.rotateConfirm);
            $('#modal-edit-node').modal({show: false});
//            $("#modal-search").modal({show: false});
            $('#modal-edit-node #edit-node-confrim').click(function() { Node.editNode(); });
            $('#contextmenu a').on('click', this.nodeContext);
            
            $('.contextmenu').mouseleave(function() { $(this).delay(500).fadeOut(500); }).mouseenter(function() { $(this).stop(true); });
            $('body').keydown(this.graphNodes);
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
            
            'click .btn-show-search': 'smallDeviceSearch',
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
                if (selected.length > 0)
                    window.open('tabular/?' + $.param({'n': selected}, true), '_blank');
                break;
            case 'download-selected-simple':
            case 'download-selected':
                if (selected.length > 0 && selected.length < 20)
                    window.location.href = 'dl/?' + $.param({'n': selected}, true);
                break;
            case 'download-dataset':
                if (opts.canBulkDownload) {
                    window.open('dl/','_blank');
                }
                break;
            }
            e.preventDefault();
        },
        
        nodeContext: function(e) {
            var targets = state.get('hoveredTargets');
            switch ($(e.target).attr('id')) {
            case 'context-dl':
                var node = Utils.getNode(targets[0]), strain = Utils.getStrain(node.id);
                window.location.href = 'dl/?n=' + node.id;
                break
            case 'context-hide':
                var selected = Utils.getSelectedNodes();
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
                var labels = '', sels = Utils.getSelectedNodes(true);
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
                var selection = Utils.getSelection()
                if (selection.length <= 0) return;
                
                $('#modal-copy').modal('show');
                $('#modal-copy').on('shown.bs.modal', function() {
                    var str = '';
                    for (var s in selection) {
                        if (s != 0) str += ', ';
                        str += Utils.getNode(selection[s]).label;
                    }
                    $('#modal-copy input').val(str).select();
                }).on('hide.bs.modal', function() {
                    $('#modal-copy input').val('');
                });
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
            $('#btn-group-annotation li').removeClass('active');
            $(this).parent().addClass('active');
            Annotation.loadAnnotation(e.target.text);
            e.preventDefault();
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
            Dataset.toggleDataset($(e.target).data('dataset'));
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
            Download.downloadCanvasSvg();
            e.preventDefault();
        },
        
        showNetwork: function(e) {
            if (Utils.getSelectedNodes().length < 0) return;
            if (state.get('annotation') == 'SAFE' && state.get('showRegions')) Annotation.loadAnnotation('None');
            
            $('#panel-legend').show();
            Node.applyNeighbourhood(1);
            $(e.target).addClass('hidden');
        },
        
        refreshNetwork: function(e) {
            window.location.href = opts['urls']['home'];
            e.preventDefault();
        },
        
        smallDeviceSearch: function(e) {
            $('.search-bar');
            $('#modal-search').modal('show');
            $('#modal-search').on('hide.bs.modal', function() {
                
            });
        }
    });
    
    return eventsView;
});