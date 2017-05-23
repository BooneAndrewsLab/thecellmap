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
        'drag': 'libs/draggabilly.pkgd.min',
        'noUISlider': 'libs/nouislider-8.0.1.min',
        'packer': 'libs/packer.growing',
        'select2': 'libs/select2',
        'sigma': 'libs/isigma',
        'xmlWriter': 'libs/XMLWriter-1.0.0-min',
        'bootstrap.colorpicker': 'libs/bootstrap-colorpicker',
        'intro': 'libs/intro.min',
        'clipboard': 'libs/clipboard.min',
        'graham_scan': 'libs/graham_scan.min',
        'jszip': 'libs/jszip',
        'load': 'app/load',
        'xls': 'libs/xls.min',
        
        'sigma.forcelayout': 'libs/plugins/sigma.forcelayout',
        'sigma.pinlayout': 'libs/plugins/sigma.pinlayout',
        'sigma.drawregions': 'libs/plugins/sigma.drawregions',
        'sigma.move': 'libs/plugins/sigma.move',
        'sigma.rotate': 'libs/plugins/sigma.rotate',
        'sigma.searchlocator': 'libs/plugins/sigma.searchlocator',
        'sigma.highlight': 'libs/plugins/sigma.highlight',
        
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
        
        /* XLSX hack, must not be optimized so we load it later on */
        'xlsx': '//cdnjs.cloudflare.com/ajax/libs/xlsx/0.8.1/xlsx.min',
    },
    shim: {
        'backbone': ['underscore', 'jquery'],
        'bootstrap': ['jquery'],
        
        'load': ['jszip'],
        'jquery.cookie': ['jquery'],
        'ladda': ['jquery'],
        'noUISlider': ['jquery'],
        'select2': ['jquery'],
        
        'underscore.strings': ['underscore'],
        
        'sigma.forcelayout': ['sigma'],
        'sigma.pinlayout': ['sigma'],
        'sigma.drawregions': ['sigma'],
        'sigma.move': ['sigma'],
        'sigma.rotate': ['sigma'],
        'sigma.searchlocator': ['sigma'],
        'sigma.highlight': ['sigma'],
    },
});

require(['booneGraph'], function(booneGraph) {
    $(window).resize(function() {
        var footer = 30;
        if ($(window).width() <= 767) {
            footer = 0;
        }
        $('.sigma-parent').css('height', $(window).height() - $('.navbar').height() - footer);
    }).resize();
    booneGraph.init();
});