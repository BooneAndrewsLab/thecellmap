define([
    'jquery',
    'underscore',
    'backbone',
    
    'utils',
    'node',
    'annotation',
    
    'fileSaver',
    'blob',
    'canvas2Blob',
    'canvas2Svg',
    'xmlWriter',
], function($, _, Backbone, Utils, Node, Annotation) {
    var downloadCanvasSnapshot = function() {
        var canvas = $('canvas:first').clone(), ctx = canvas[0].getContext("2d"), cx;
        
        $('canvas:visible').each(function(){
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
        var canvas = new C2S(width, height);
        var filename = 'boonelab_network_' + date.getDate() + '_' + date.getHours() + '_' + date.getMinutes() + '_' + date.getSeconds() + '.svg';
        
        canvas.fillStyle = "#" + $('#canvas-background-color').val();
        canvas.fillRect(0, 0, width, height);
//        canvas.fillRect(0, 0, settings['showLegendSvg'] ? width * 1.25 : width, height);
        
        sigInst._core.plotter.switchCxt(canvas);
        
        if( $('#tools-safe-download').is('.hidden') ){
            Annotation.drawRegions(canvas, 1);
            sigInst.draw(0,2,0,0); 
            sigInst.draw(2,0,0,0); 
            sigInst.draw(0,0,2,0); 
            Annotation.drawRegions(canvas, 2);
        }
        else {
          Annotation.drawRegions(canvas, 2);
          sigInst.draw(0,0,2,0);
        }
        

        
        sigInst._core.plotter.restoreCxt();
        sigInst.draw();
        
        var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        if (isSafari) {
            var w = window.open();
            w.document.write('<html><body><img src="data:image/svg+xml;base64,' + btoa(canvas.getSerializedSvg()) + '"></body></html>');
        } else {
            saveAs(new Blob([canvas.getSerializedSvg()], {type: 'application/octet-stream'}), filename);
        }
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
    
    var downloadGEXF = function() {
        var v = new XMLWriter(), color;
        v.writeStartDocument();
        
        v.writeStartElement('gexf');
        v.writeAttributeString('xmlns','http://www.gexf.net/1.2draft');
        v.writeAttributeString('version', "1.2");
        v.writeAttributeString('xmlns:viz', "http://www.gexf.net/1.2draft/viz");
        v.writeAttributeString('xmlns:xsi', "http://www.w3.org/2001/XMLSchema-instance");
        v.writeAttributeString('xsi:schemaLocation', "http://www.gexf.net/1.2draft http://www.gexf.net/1.2draft/gexf.xsd");
        
        v.writeStartElement('graph');
        v.writeAttributeString('defaultedgetype', "directed");
        v.writeAttributeString('mode', "static");
        
        v.writeStartElement('attributes');
        v.writeAttributeString('class', "edge");
        v.writeAttributeString('mode', "static");
        v.writeStartElement('attribute');
        v.writeAttributeString('id', "absweight");
        v.writeAttributeString('title', "absweight");
        v.writeAttributeString('type', "float");
        v.writeEndElement();
        v.writeEndElement();
        
        v.writeStartElement('nodes');
        
        Utils.iterVisibleNodes(function(node) {
            var strain = Utils.getStrain(node.id);
            v.writeStartElement('node');
            v.writeAttributeString('id', node.label);
            
            v.writeStartElement('viz:size');
            v.writeAttributeString('value', node.size);
            v.writeEndElement();
            
            v.writeStartElement('viz:position');
            v.writeAttributeString('x', node.x);
            v.writeAttributeString('y', node.y);
            v.writeEndElement();
            
            v.writeStartElement('viz:color');
            color = Utils.hexToRgb(node.color);
            v.writeAttributeString('r', color.r);
            v.writeAttributeString('g', color.g);
            v.writeAttributeString('b', color.b);
            v.writeEndElement();
            
            v.writeEndElement(); // node
        });
        
        v.writeEndElement(); // nodes
        
        v.writeStartElement('edges');
        
        Utils.iterVisibleEdges(function(edge) {
            v.writeStartElement('edge')
            v.writeAttributeString('source', edge.source.label);
            v.writeAttributeString('target', edge.target.label);
            v.writeAttributeString('weight', edge.weight);
            
            if (!!edge.color) {
                v.writeStartElement('viz:color');
                color = Utils.hexToRgb(edge.color);
                v.writeAttributeString('r', color.r);
                v.writeAttributeString('g', color.g);
                v.writeAttributeString('b', color.b);
                v.writeEndElement();
            }
            
            v.writeStartElement('attvalues');
            v.writeStartElement('attvalue');
            v.writeAttributeString('for', 'absweight');
            v.writeAttributeString('value', edge.absweight);
            v.writeEndElement();
            v.writeEndElement();
            
            v.writeEndElement();
        });
        
        v.writeEndElement(); // edges
        v.writeEndElement(); // graph
        v.writeEndElement(); // gexf
        v.writeEndDocument();
        
        var blob = new Blob([v.flush()], {type: 'application/gexf;charset=utf-8'});
        saveAs(blob, 'network_data.gexf');
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
        v.writeAttributeString('value', '#000000'); // TODO: FIX THIS
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
            v.writeAttributeString('fill', node.color);
            
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
        downloadGEXF: downloadGEXF
    };
});
