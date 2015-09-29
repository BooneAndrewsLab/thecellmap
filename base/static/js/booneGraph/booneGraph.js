define([
    'jquery',
    'underscore',
    'backbone',
    'stateModel',
    
    'annotationCollection',
    'regionGroupCollection',
    'strainCollection',
    
    'annotation',
    'dataset',
    'node',
    'settings',
    'utils',
    
    'ui',
    'events',
    'module',
    'sigma',
], function($, _, Backbone, StateModel, 
    AnnotationCollection, RegionGroupCollection, StrainCollection,
    Annotation, Dataset, Node, Settings, Utils,
    UI, EventsView, module) {
    var DEFAULTS = {
        arrows: false,
        colorScheme: 'black',
        datasets: [],
        debug: true,
        defaultNodeColor: '#E8E8E8',
        downloadLimit: 30,
        graphProperties: {
            type: 'network',
            minEdgeSize : 0,
            maxEdgeSize : 1.5,
            nodesPowRatio : 1,
            edgesPowRatio : .5,
            margin: 10,
            arrowRatio: 4,
            safe : false,
        },
        hideLayouts: false,
        highlight: false,
        layout: null,
        layoutAlgo: ['fl'],
        layoutButtonHide: true,
        modifiedCallback: null,
        multifunctionNodeColor: '#E8E8E8',
        rootElement: '#network-container',
        runningLayout: null,
        slider: {
            min : 0,
            step : 0.01,
            value : 0.2,
            max : 1,
            filter: 'edges',
        },
    };
    
    window.sliderProperties = $.extend({}, DEFAULTS.slider, module.config().slider || {});
    window.graphProperties = $.extend({}, DEFAULTS.graphProperties, module.config().graphProperties || {});
    $.extend(opts, DEFAULTS);
    window.vizdata = {
        annotations: new AnnotationCollection(),
        strains: new StrainCollection(),
        regionGroups: new RegionGroupCollection(),
        index: {}, 
    };
    
    window.state = new StateModel();
    window.sigInst = null;
    window.mouseX = null, window.mouseY = null;
    var clicking = {
        wasDragging: false,
        modifierKey: null
    };
    var init = function() {
        Settings.initialize();
        sigInst = sigma.init($(opts['rootElement'])[0]).drawingProperties({
            defaultLabelSize: state.get('labelSize'),
            defaultLabelHoverColor: '#000',
            labelThreshold: state.get('labelThreshold'),
            font: 'Arial',
            edgeColor : 'white',
            defaultLabelColor : '#' + state.get('labelColor'),
            nodeColor : opts.defaultNodeColor,
            defaultEdgeArrow: opts.arrows ? 'target' : 'none',
        }).graphProperties(graphProperties).mouseProperties({
            drawHoverEdges: false,
            maxRatio : 64,
            blockScroll: settings.get('disableScroll') || false,
        }).bind('rightclicknodes', Utils.onNodesContext
         ).bind('ctrlclicknodes', function (e) {
            clicking.modifierKey = 'ctrl';
            Utils.onNodesContext(e);
        }).bind('shiftclicknodes', function () {
            clicking.modifierKey = 'shift';
        }).bind('upnodes', function(targets) {
            if (!clicking.wasDragging) {
                switch(clicking.modifierKey) {
                case 'ctrl':
                    break;
                case 'shift':
                    $('input.gene-search-input').select2('val', Utils.getSelectedNodes().concat(targets.content), true);
                    break;
                default:
                    $('input.gene-search-input').select2('val', targets.content, true);
                    break;
                }
            }
            
            Utils.graphSelectedNodes();
            Annotation.drawRegions();
            
            clicking.wasDragging = false;
            clicking.modifierKey = null;
        }).bind('upgraph', function(evt) {
            if (!evt.content.dragged && !evt.content.targeted && !evt.content.selecting && !$('.btn-group').hasClass('open')) {
                Utils.clearSelection();
            }
        }).bind('startmovingnodes', function(evt) {
            Annotation.clearRegions();
            $('.sigma_mouse_canvas')[0].getContext('2d').clearRect(0, 0, $(document).width(), $(document).height());
        }).bind('stopmovingnodes', function(evt) {
            Utils.graphSelectedNodes();
            Annotation.drawRegions();
        }).bind('draggedNode', function() {
            clicking.wasDragging = true;
            state.set('showRegions', false);
        }).bind('selectionStop', function(selection) {
            if (selection.content.nodeSelect) {
                $('input.gene-search-input').select2('val', Utils.getSelectedNodes().concat(selection.content.selected), true);
            }
        }).bind('selectionStart', function() {
        }).bind('downnodes', function(selection) {
            Utils.clearSelectionCanvas();
            Annotation.clearRegions();
        });
        
        UI.initUI();
        Node.initSelect2(function() {
            Dataset.loadLayout();
        });
        
        var eventsView = new EventsView({el: $(opts['rootElement'])});
        UI.showUI();
        Annotation.loadAnnotation(state.get('annotation'));
        $(document).mousemove(function(e) { mouseX = e.pageX, mouseY = e.pageY; });
    };
    
    return {
        init: init
    };
});