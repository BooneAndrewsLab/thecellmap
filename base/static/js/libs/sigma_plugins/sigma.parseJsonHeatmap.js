//Mathieu Jacomy @ Sciences Po Médialab & WebAtlas
//(requires sigma.js to be loaded)
sigma.publicPrototype.parseJson = function(opts) {
    var vizdata = opts.vizdata;
    var start = new Date().getTime();
    var nodes;
    var method = opts.method || 'get';
    var data = opts.data || null;
    
    /* Fetch all node info */
    opts.jq.ajax({dataType: 'json', data: data, type: method, url: opts.url, success: function(data) {
        var strain, color;
        nodes = data.matrix || [];
        
        nodes.forEach(function (node) {
            node.size = 2.5;
            
            node.x = !isNaN(node.x) ? node.x * 5 : (Math.random() * 100);
            node.y = !isNaN(node.y) ? node.y * 5 : (Math.random() * 100);
            node.col = vizdata['col'][node.x / 5]['label'];
            node.row = vizdata['row'][node.y / 5]['label'];
            node.label = node.col + ' / ' + node.row;
            node.id = node.x * vizdata['col'].length + node.y;
        });
        
        var end = new Date().getTime();
        var time = end - start;
        console.log('Execution time: ' + time);
    }}).always(function() { 
        opts.cb(nodes); 
    }).fail(function(e) { 
        console.log('failed', e);
    });
};
