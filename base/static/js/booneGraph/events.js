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
    
    'jquery.cookie',
    'sigma.rotate',
    'bootstrap',
    'drag',
], function($, _, Backbone, 
    Node, Annotation, Layout, Download, Dataset, Utils) {
    
    var eventsView = Backbone.View.extend({
        initialize: function() {
            if (!opts.debug) {
                $('#network-container').contextmenu(function() { return false; });
                $('.contextmenu').contextmenu(function() { return false; });
            }
            
            state.on('change:selection', function() {
                $('[data-selection-constraint]').each(function() {
                    var enabled = true, size = Utils.getSelectedNodes().length, cls = $(this).data('selection-class') || 'disabled';
                    if ($(this).data('selection-gt') != undefined) {
                        enabled &= size > $(this).data('selection-gt');
                    }
                    if ($(this).data('selection-lt') != undefined) {
                        enabled &= size < $(this).data('selection-lt');
                    }
                    $(this).toggleClass(cls, !enabled);
                });
            })
            
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
                    _.each(nodes, function(n) {
                        var strain = Utils.getStrain(n), annotation = vizdata['annotations'].get(state.get('annotation'));
                        
                        var color = annotation.get('defaultColor')
                        var annot = annotation.get('map')[strain.get('id')];
                        if (annot != undefined) {
                            color = annotation.get('colorPalette')[annotations.get('terms')[annot[0]].idx];
                        }
                        
                        var node = {
                            id : n,
                            label : strain.get('verboseName'),
                            size : 2,
                            color : color,
                            x : (Math.random() * 100),
                            y : (Math.random() * 100),
                            hidden : false,
                        };
                        
                        sigInst.addNode(node.id, node);
                    });
                    
                    Dataset.toggleDataset(1);
                }
            })
            
            var box = $(".content:first")[0].getBoundingClientRect();
            if ($('#panel-legend').length) {
                Drag.init(document.getElementById('legend-handle'), document.getElementById('panel-legend'), box["left"], box["right"] - 250, box["top"], box["bottom"] - 90);
            }
            
            $('.refresh-network').on('click', this.refreshNetwork);
            $('.pick-a-color').pickAColor();
            $('#canvas-background-color').change(this.updateBackgroundColor);
            $('#style-label-color').change(this.updateLabelColor);
            $('#modal-style input.pick-a-color').addClass('form-control').css({width: 'auto'});
            $('#modal-rotation #rotate-confirm').on('click', this.rotateConfirm);
            $('#modal-edit-node').modal({show: false});
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
            'click #btn-group-annotation .load-annotation': 'loadAnnotation',
            'click #btn-legend': 'showLegend',
            'dblclick #legend-handle': 'toggleLegend',
            'click .btn-home': 'graphCenter',
            'click .btn-zoom-in': 'graphZoomIn',
            'click .btn-zoom-out': 'graphZoomOut',
            'click .image-dataset-icon': 'toggleDataset',
            
            'click #view-network-simple': 'showNetwork',
        },
        
        downloadNetwork: function(e) {
            var selected = Utils.getSelectedNodes();
            switch ($(e.currentTarget).attr('id')) {
            case 'download-visible':
                Download.downloadShownData();
                break;
            case 'download-xgmml':
                Download.downloadXGMML();
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
                targets.forEach(function(node) {
                    if (selected.indexOf(node) != -1) {
                        selected.splice(selected.indexOf(node), 1);
                        $('input.gene-search-input').select2('val', selected, true);
                    }
                    node = Utils.getNode(node);
                    node.hidden = node._hidden = true;
                });
                sigInst.draw();
                break
            case 'context-label-toggle':
                targets.forEach(function(node) {
                    node = Utils.getNode(node);
                    node.forceLabel = !node.forceLabel;
                });
                sigInst.draw();
                break;
            case 'context-edit-node':
                Node.showNodeModal(targets[0]);
                break;
            case 'context-node-gi':
                if (state.get('dataset') == 0 && state.get('annotation') != 'None'){
                    $('input.gene-search-input').select2('val', targets, true);
                    Utils.clearSelectionCanvas();
                    $('.image-dataset-icon[data-dataset="' + 1 + '"]').click();
                }
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
            } else {
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
            $('#panel-legend .panel-body').toggle();
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
            state.set('background', $(e.target).val());
            $(opts['rootElement']).css('background-color', '#' + state.get('background'));
            e.preventDefault();
        },
        updateLabelColor: function(e) {
            state.set('labelColor', $(e.target).val());
            sigInst.drawingProperties({defaultLabelColor: '#' + state.get('labelColor')}).draw(-1, -1, 1);
            e.preventDefault();
        },
        
        showNetwork: function(e) {
            if (Utils.getSelectedNodes().length < 0) return;
            $('#panel-legend').show();
            Node.applyNeighbourhood(1);
            
            $('[data-simple-step]').each(function() {
                switch ($(this).data('simple-step')) {
                case 1:
                    $(this).hide();
                    break;
                case 2:
                    $(this).removeClass('hidden');
                    break;
                }
            });
        },
        refreshNetwork: function(e) {
            location.reload();
            e.preventDefault();
        }
    });
    
    return eventsView;
});