require.config({
    paths: {
        'jquery': 'libs/jquery-2.1.4.min',
        'backbone': 'libs/backbone-min',
        'underscore': 'libs/underscore-min',
        'bootstrap': 'libs/bootstrap.min',
        
        'jquery.cookie': 'libs/js.cookie',
        'underscore.strings': 'libs/underscore.string.min',
        
        'fileSaver': 'libs/FileSaver.min',
        'ladda': 'libs/ladda',
        'spin': 'libs/spin',
        
        'blob': 'libs/blob',
        'canvas2Blob': 'libs/canvas-toBlob',
        'canvas2Svg': 'libs/canvas2svg',
        'combinations': 'libs/combinations',
        'drag': 'libs/dom-drag',
        'noUISlider': 'libs/nouislider-8.0.1.min',
        'packer': 'libs/packer.growing',
        'pickAColor': 'libs/pick-a-color',
        'select2': 'libs/select2',
        'sigma': 'libs/isigma',
        'tinyColor': 'libs/tinycolor-min',
        'xmlWriter': 'libs/XMLWriter-1.0.0-min',
        
        'sigma.forcelayout': 'libs/plugins/sigma.forcelayout',
        'sigma.drawregions': 'libs/plugins/sigma.drawregions',
        'sigma.move': 'libs/plugins/sigma.move',
        'sigma.rotate': 'libs/plugins/sigma.rotate',
        'sigma.searchlocator': 'libs/plugins/sigma.searchlocator',
        
        'booneGraph': 'booneGraph/booneGraph',
        
        'annotationModel': 'models/annotationModel',
        'annotationCollection': 'models/annotationCollection',
        'regionGroupModel': 'models/regionGroupModel',
        'regionGroupCollection': 'models/regionGroupCollection',
        'settingsModel': 'models/settingsModel',
        'stateModel': 'models/stateModel',
        'strainModel': 'models/strainModel',
        'strainCollection': 'models/strainCollection',
        
        'annotation': 'booneGraph/annotation',
        'dataset': 'booneGraph/dataset',
        'download': 'booneGraph/download',
        'layout': 'booneGraph/layout',
        'node': 'booneGraph/node',
        'settings': 'booneGraph/settings',
        'utils': 'booneGraph/utils',
        
        /* UI */
        'events': 'booneGraph/events',
        'ui': 'booneGraph/ui',
    },
    shim: {
        'backbone': ['underscore', 'jquery'],
        'bootstrap': ['jquery'],
        
        'jquery.cookie': ['jquery'],
        'ladda': ['jquery'],
        'noUISlider': ['jquery'],
        'select2': ['jquery'],
        
        'pickAColor': ['jquery', 'tinyColor'],
        
        'underscore.strings': ['underscore'],
        
        'sigma.forcelayout': ['sigma'],
        'sigma.drawregions': ['sigma'],
        'sigma.move': ['sigma'],
        'sigma.rotate': ['sigma'],
        'sigma.searchlocator': ['sigma'],
    },
});

require(['booneGraph'], function(booneGraph) {
    $(window).resize(function() {
        $('.sigma-parent').css('height', $(window).height() - $('.navbar').height() - 30);
    }).resize();
    booneGraph.init();
});