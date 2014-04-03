// Mathieu Jacomy @ Sciences Po Médialab & WebAtlas
// (requires sigma.js to be loaded)
sigma.pulse = sigma.pulse || {};
sigma.pulse.Pulse = function(graph, instance, properties) {
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
    
    var step = 0;
    var currentPos = 0;
    
    this.init = function() {
        // one pulse
        step = Math.PI / (self.p.runtime * 20);
        
        self.p.nodes.forEach(function(n) {
            n.pulse = {
                    init_size: n.size,
                    max_increment: n.size * self.p.sizeMultiplier - n.size
            }
        });
        
        return self;
    }

    this.atomicGo = function() {
        var graph = self.graph;
        var p = self.p;
        var mult = Math.sin(currentPos);
        var maxSize = 0;
        
        p.nodes.forEach(function(n) {
            n.size = n.pulse.init_size + (n.pulse.max_increment * (mult * p.sizeMultiplier));
            maxSize = Math.max(maxSize, n.size);
        })
        
        currentPos += step;
    }
    
    this.isDone = function() {
        return currentPos >= Math.PI;
    };
    
    this.cleanup = function() {
        self.p.nodes.forEach(function(n) {
            n.size = n.pulse.init_size;
            delete n.pulse;
        });
    }
};

sigma.publicPrototype.pulseNodes = function(properties) {
    this.pulse = new sigma.pulse.Pulse(this._core.graph, this, properties);
    this.pulse.init();
    
    if (this.pulse.p.nodes.length == 0) return;
    
    var pl = this.pulse;
    
    this.addGenerator('pulse', this.pulse.atomicGo, function() {
        if (pl.isDone()) {
            pl.cleanup();
            return false
        }
        return true;
    });
};
