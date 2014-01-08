sigma.publicPrototype.hoverHighlight = function(opts) {
    var greyColor = '#333';
    var inst = this;
    var _ = opts;

    this.bind('overnodes', function(event) {
        if (!!_.runningLayout) return;
        
        var nodes = event.content;
        var neighbors = {};
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
                }
            } else {
                n.color = n.attr['grey'] ? n.attr['true_color'] : n.color;
                n.attr['grey'] = 0;
            }
        }).draw(2, 2, 2);
    }).bind('outnodes', function() {
        if (!!_.runningLayout) return;
        
        inst.iterEdges(function(e) {
            e.color = e.attr['grey'] ? e.attr['true_color'] : e.color;
            e.attr['grey'] = 0;
        }).iterNodes(function(n) {
            n.color = n.attr['grey'] ? n.attr['true_color'] : n.color;
            n.attr['grey'] = 0;
        }).draw(2, 2, 2);
    });

    return this;
};

sigma.publicPrototype.exportToSVG = function(opts) {
    var inst = this;
    var _ = opts;
    
    var mmx = {};
    inst._core.graph.nodes.filter(function(node) {
        return !node.hidden;
    }).forEach(function(node) {
        if (!node.hidden) {
            mmx.ax = Math.min(node.x, mmx.ax || node.x);
            mmx.zx = Math.max(node.x, mmx.zx || node.x);
            mmx.ay = Math.min(node.y, mmx.ay || node.y);
            mmx.zy = Math.max(node.y, mmx.zy || node.y);
        }
    });
    
    var width = Math.abs(mmx.zx - mmx.ax);
    var height = Math.abs(mmx.zy - mmx.ay);
    
    
};

sigma.publicPrototype.debugGrid = function() {
    var inst = this;

    for ( var i = -1; i <= 1; i += .1) {
        inst.addNode('n00' + i, {
            'x' : i,
            'y' : 1,
            'label' : i + '',
            'size' : 2,
            'color' : 'white'
        });
        inst.addNode('s00' + i, {
            'x' : i,
            'y' : -1,
            'label' : i + '',
            'size' : 2,
            'color' : 'white'
        });
        inst.addEdge(i + 'v', 'n00' + i, 's00' + i);

        inst.addNode('e00' + i, {
            'x' : 1,
            'y' : i,
            'label' : i + '',
            'size' : 2,
            'color' : 'white'
        });
        inst.addNode('w00' + i, {
            'x' : -1,
            'y' : i,
            'label' : i + '',
            'size' : 2,
            'color' : 'white'
        });
        inst.addEdge(i + 'h', 'e00' + i, 'w00' + i);
    }

    return this;
};

sigma.publicPrototype.debugRandomNodes = function() {
    var inst = this;
    var i, N = 2869, E = 10087;

    for (i = 0; i < N; i++) {
        var x = Math.random();
        var y = Math.random();
        inst.addNode('n' + i, {
            'x' : x,
            'y' : y,
            'label' : x + ' ||| ' + y,
            'size' : 20,
            'color' : 'rgb(' + Math.round(Math.random() * 256) + ','
                    + Math.round(Math.random() * 256) + ','
                    + Math.round(Math.random() * 256) + ')'
        });
    }

    for (i = 0; i < E; i++) {
        inst.addEdge(i, 'n' + (Math.random() * N | 0), 'n'
                + (Math.random() * N | 0));
    }
    inst.draw();
    
    return this;
};