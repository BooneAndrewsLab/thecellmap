define([
    'jquery',
    'underscore',
    'backbone',
    
    'utils',
    'node',
    
    'fileSaver',
    'blob',
    'canvas2Blob',
    'canvas2Svg',
    'xmlWriter',
], function($, _, Backbone, Utils, Node) {
    var downloadCanvasSnapshot = function() {
        var canvas = $('canvas:first').clone(), ctx = canvas[0].getContext("2d"), cx;
        
        $('canvas').each(function(){
            if (canvas.height() === 0) {
                canvas.height($(this).height());
                canvas.width($(this).width());
                
                ctx.fillStyle = Utils.rgbToHex($('#network-container').css('backgroundColor'));
                ctx.fillRect(0,0,canvas.width(),canvas.height());
            }
            
            ctx.drawImage(this, 0, 0);
        });
        
        canvas[0].toBlob(function(blob) {
            saveAs(blob, 'boonelab_network.png');
        });
    };
    
    var downloadCanvasSvg = function() {
        var width = $('canvas:first').width(), height = $('canvas:first').height(), date = new Date();
        var canvas = new C2S(width * 1.25, height);
        var filename = 'boonelab_network_' + date.getDate() + '_' + date.getHours() + '_' + date.getMinutes() + '_' + date.getSeconds() + '.svg';
        
//        if (settings['showBgSvg']) {
//            canvas.fillStyle = $('#canvas-background-color').val();
//            canvas.fillRect(0, 0, settings['showLegendSvg'] ? width * 1.25 : width, height);
//        }
        
        sigInst._core.plotter.switchCxt(canvas);
        sigInst.draw(0,2,0,0);
        sigInst.draw(2,0,0,0);
        sigInst.draw(0,0,2,0);
        sigInst._core.plotter.restoreCxt();
        sigInst.draw();
        
//        var annot = state.get('annotation');
//        if (settings['showLegendSvg'] && annot != 'None') {
//            canvas.fillStyle = $('#canvas-background-color').val();
//            canvas.fillRect(width, 0, width/4 + 25, height);
//            canvas.font = "10px Arial";
//            var x = width + 5, y = 10;
//            for (t in vizdata[annot].terms) {
//                var term = vizdata[annot].terms[t];
//                canvas.fillStyle = vizdata[annot].colorPalette[term.idx];
//                canvas.fillRect(x, y, 5, 5);
//                canvas.fillText(term.name, x + 10, y + 5);
//                y += 10;
//            }
//        }
        
        var blob = new Blob([canvas.getSerializedSvg()], {type: 'text/svg+xml;charset=utf-8'});
        saveAs(blob, filename);
    };
    
    var downloadShownData = function() {
        var data = ['Gene A ORF\tGene A allele\tGene B ORF\tGene B allele\tCorrelation\n'];
        var src, trg;
        
        Utils.iterVisibleEdges(function(edge) {
            src = Utils.getStrain(edge.source.id);
            trg = Utils.getStrain(edge.target.id);
            data.push([src.get('orf'), src.get('a') || src.get('n') || src.get('orf').toLowerCase(), 
                       trg.get('orf'), trg.get('a') || trg.get('n') || trg.get('orf').toLowerCase(), 
                       edge.weight.toFixed(3)].join('\t') + '\n');
        });
        
        var blob = new Blob(data, {type: 'text/tab-separated-values;charset=utf-8'});
        saveAs(blob, 'network_data.tsv');
    };
    
    var downloadXGMML = function() {
        var v = new XMLWriter();
        v.writeStartDocument();
        
        v.writeStartElement('graph');
        v.writeAttributeString('directed','0');
        v.writeAttributeString('id','test');
        v.writeAttributeString('xmlns', 'http://www.cs.rpi.edu/XGMML');
        
        v.writeStartElement('graphics');
        v.writeStartElement('att');
        v.writeAttributeString('name', 'NETWORK_BACKGROUND_PAINT');
        v.writeAttributeString('value', '#000000');
        v.writeAttributeString('type', 'string');
        v.writeEndElement();
        v.writeEndElement();
        
        Utils.iterVisibleNodes(function(node) {
            var strain = Utils.getStrain(node.id);
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
        
        Utils.iterVisibleEdges(function(edge) {
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
        
        var blob = new Blob([v.flush()], {type: 'application/xgmml;charset=utf-8'});
        saveAs(blob, 'network_data.xgmml');
    };
    
    return {
        downloadCanvasSnapshot: downloadCanvasSnapshot,
        downloadCanvasSvg: downloadCanvasSvg,
        downloadShownData: downloadShownData,
        downloadXGMML: downloadXGMML,
    };
});
