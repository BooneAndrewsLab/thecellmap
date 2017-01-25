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
        dataset: 0,
        defaultNodeColor: '#ffffff',
        downloadLimit: 30,
        graphProperties: {
            type: 'network',
            minEdgeSize : 0,
            maxEdgeSize : 1,
            nodesPowRatio : 1,
            edgesPowRatio : .5,
            margin: 25,
            arrowRatio: 10,
            safe : false,
        },
        hideLayouts: false,
        highlight: false,
        layout: null,
        layoutAlgo: ['fl'],
        layoutButtonHide: true,
        modifiedCallback: null,
        multifunctionNodeColor: '#ffffff',
        rootElement: '#network-container',
        runningLayout: null,
        slider: {
            min : 0,
            step : 0.01,
            value : 0.2,
            max : 1,
            filter: 'edges',
        },
        tokenSeparators: [',', ' ', '\t', '\n'],
        url: window.location.href.substr(0, window.location.href.indexOf('?')),
    };
    
    window.sliderProperties = $.extend({}, DEFAULTS.slider, module.config().slider || {});
    window.graphProperties = $.extend({}, DEFAULTS.graphProperties, module.config().graphProperties || {});
    
    opts = $.extend({}, DEFAULTS, opts);
    
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
            edgeLabelThreshold: Number.MAX_VALUE,
            font: 'Arial',
            edgeColor : 'white',
            defaultLabelColor : '#' + state.get('labelColor'),
            nodeColor : opts.defaultNodeColor,
            defaultEdgeArrow: opts.arrows ? 'target' : 'none',
        }).graphProperties(graphProperties).mouseProperties({
            drawHoverEdges: false,
            maxRatio : 64,
            blockScroll: settings.get('disableScroll') || false,
            allowNodeDrag: false,
        }).bind('rightclicknodes', Utils.onNodesContext
         ).bind('ctrlclicknodes', function(e) {
            clicking.modifierKey = 'ctrl';
            Utils.onNodesContext(e);
        }).bind('shiftclicknodes', function() {
            clicking.modifierKey = 'shift';
        }).bind('dblclicknodes', Utils.onNodeDblClick
         ).bind('dblclickgraph', function() {
             var position = sigInst.position(), m = sigInst.getMouse();
             sigInst._core.mousecaptor.interpolate(m.mouseX, m.mouseY, position.ratio * 2);
         }).bind('upnodes', function(targets) {
            for (var i in targets.content) {
                var n = targets.content[i];
                console.log(n, Utils.getStrain(n).get('label'), Utils.getStrain(n));
            }
            
            if (!clicking.wasDragging) {
                switch(clicking.modifierKey) {
                case 'ctrl':
                    break;
                case 'shift':
                    $('input.gene-search-input').select2('val', Utils.getSelection().concat(targets.content), true);
                    break;
                default:
                    $('input.gene-search-input').select2('val', targets.content, true);
                    break;
                }
            }
            
            Annotation.drawRegions();
            
            clicking.wasDragging = false;
            clicking.modifierKey = null;
        }).bind('upgraph', function(evt) {
            if (!evt.content.dragged && !evt.content.targeted && !evt.content.selecting && !$('.btn-group').hasClass('open')) {
                Utils.clearSelection();
            }
        }).bind('startmovingnodes', function(evt) {
            Annotation.clearRegions();
        }).bind('stopmovingnodes', function(evt) {
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
            if (sigInst.mouseProperties('allowNodeDrag')) {
                Annotation.clearRegions();
            }
        }).bind('rightclickgraph', Utils.onGraphContext);
        
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