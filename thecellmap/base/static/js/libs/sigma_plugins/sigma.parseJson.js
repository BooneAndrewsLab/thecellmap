//Mathieu Jacomy @ Sciences Po Médialab & WebAtlas
//(requires sigma.js to be loaded)
sigma.publicPrototype.parseJson = function(opts) {
    var vizdata = opts.vizdata;
    var annotations = vizdata[opts.state.getProperty("annotation")];    
    var start = new Date().getTime();
    var nodes, edges, extraData = {datasetName: 'Correlations'};
    var method = opts.method || 'get';
    var data = opts.data || null;
    var datasetType = opts.type || 'C';
    
    /* Fetch all node info */
    opts.jq.ajax({dataType: 'json', data: data, type: method, url: opts.url, success: function(data) {
        var strain, annot, color;
        nodes = data.nodes || [];
        edges = data.edges || [];
        extraData.datasetName = data.dataset || extraData.datasetName;
        
        nodes.forEach(function (node) {
            strain = vizdata['strains'][vizdata['index'][node.id]];
            
            if (strain == undefined) {
                console.log("Strain not found:", node.id);
                strain = {};
            }
            
            annot = annotations.map[strain.id];
            if (annot != undefined) {
                color = annotations.colorPalette[annotations.terms[annot[0]].idx];
            } else {
                color = annotations.defaultColor;
            }
            
            node.label = strain.verboseName;
            node.size = 2;
            node.color = color;
            node.x = !isNaN(node.x) ? node.x : (Math.random() * 100);
            node.y = !isNaN(node.y) ? node.y : (Math.random() * 100);
        });
        
        edges.forEach(function (edge, edgeIdx) {
            // input file size optimizations 
            edge.id = edge.id || edgeIdx; // We can ommit ids, can be auto generated here
            edge.source = edge.source || edge.s; // s == source
            edge.target = edge.target || edge.t; // t == target
            edge.weight = edge.weight || edge.w; // w == weight
            edge.absweight = Math.abs(edge.weight);
            edge.color = edge.color || edge.c; // c == color
            edge.size = edge.absweight;
            
            if (edge.color == undefined && (extraData.datasetName == "Interactions" || datasetType == "I")) {
                edge.color = edge.weight < 0. ? "red" : "green";
                edge.size = 1;
            }
            
            switch (edge.color) {
            case "w": edge.color = 'white'; break;
            case "b": edge.color = 'blue'; break;
            case "r": edge.color = 'red'; break;
            }
            
            if (edge.color == undefined) delete edge.color;
            
            edge.label = edge.weight; // Sets the thickness of the edge
            extraData.min = Math.min(extraData.min || Number.MAX_VALUE, Math.abs(edge.weight));
            extraData.max = Math.max(extraData.max || Number.MIN_VALUE, Math.abs(edge.weight));
        });
        
        var end = new Date().getTime();
        var time = end - start;
        console.log('Execution time: ' + time);
    }}).always(function() { 
        opts.cb(nodes, edges, extraData); 
    }).fail(function(e) { 
        console.log('failed', e);
    });
};
