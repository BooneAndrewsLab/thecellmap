// Mathieu Jacomy @ Sciences Po Médialab & WebAtlas
// (requires sigma.js to be loaded)
sigma.selected = sigma.selected || {};
sigma.selected.Selected = function(graph, instance, properties) {
    sigma.classes.Cascade.call(this);
    var self = this;
    var inst = instance;
    this.graph = graph;
    this.p = {
        runtime: 3,
        sizeMultiplier: 2,
        nodes : this.graph.nodes.filter(function(n) {
            return n.selected;
        })
    };
    
    this.p = jQuery.extend({}, this.p, properties || {});
    
    this.init = function() {
        return self;
    }

    this.atomicGo = function() {
    }
    
    this.isDone = function() {
    };
    
    this.cleanup = function() {
    }
};

sigma.publicPrototype.selectedNodes = function(properties) {
    this.selected = new sigma.selected.Selected(this._core.graph, this, properties);
    this.selected.init();
    
    if (this.selected.p.nodes.length == 0) return;
    
    var pl = this.selected;
    
    this.addGenerator('selected', this.selected.atomicGo, function() {
        if (pl.isDone()) {
            pl.cleanup();
            return false
        }
        return true;
    });
};
