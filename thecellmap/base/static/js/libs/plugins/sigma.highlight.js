sigma.publicPrototype.hoverHighlight = function(state) {
    var greyColor = '#333';
    var inst = this;
    var isDragging = function() {
        var dragging = false;
        inst.iterNodes(function(n) {
            dragging |= n.dragging;
        });
        return dragging;
    };
    
    this.bind('overnodes', function(event) {
        var nodes = event.content;
        var neighbors = {};
        if (isDragging() || state['runningAnimation']) return;
        inst.iterEdges(function(e) {
            if (e.hidden || (nodes.indexOf(e.source.id) < 0 && nodes.indexOf(e.target.id) < 0)) {
                if (!e.attr['grey']) {
                    e.attr['true_color'] = e.color;
                    e.color = greyColor;
                    e.attr['grey'] = 1;
                }
            } else {
                e.color = e.attr['grey'] ? e.attr['true_color'] : e.color;
                e.attr['grey'] = 0;

                neighbors[e.source.id] = 1;
                neighbors[e.target.id] = 1;
            }
        }).iterNodes(function(n) {
            if (!neighbors[n.id]) {
                if (!n.attr['grey']) {
                    n.attr['true_color'] = n.color;
                    n.color = greyColor;
                    n.attr['grey'] = 1;
                    n.forceLabel = false;
                }
            } else {
                n.color = n.attr['grey'] ? n.attr['true_color'] : n.color;
                n.forceLabel = n.attr['grey'] ? false : true;
                n.attr['grey'] = 0;
            }
        }).draw(2, 2, 2);
    }).bind('outnodes', function() {
        if (state['runningAnimation']) return;
        
        inst.iterEdges(function(e) {
            e.color = e.attr['true_color'];
            e.attr['grey'] = 0;
        }).iterNodes(function(n) {
            n.color = n.attr['true_color'];
            n.forceLabel = true;
            n.attr['grey'] = 0;
        }).draw(2, 2, 2);
    }).bind('upgraph', function() {
        if (state['runningAnimation']) return;
        inst.iterEdges(function(e) {
            e.color = e.attr['true_color'] || e.color;
            e.attr['grey'] = 0;
        }).iterNodes(function(n) {
            n.color = n.attr['true_color'] || n.color;
            n.forceLabel = true;
            n.attr['grey'] = 0;
        }).draw(2, 2, 2);
    });

    return this;
};