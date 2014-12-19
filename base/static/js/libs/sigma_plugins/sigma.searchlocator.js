// Mathieu Jacomy @ Sciences Po Médialab & WebAtlas
// (requires sigma.js to be loaded)
sigma.searchlocator = sigma.searchlocator || {};
sigma.searchlocator.SearchLocator = function(graph, instance, properties) {
    sigma.classes.Cascade.call(this);
    var self = this;
    var inst = instance;
    this.graph = graph;
    this.m = {
        runtime: 3,
    };
    
    this.m = jQuery.extend({}, this.m, properties || {});
    
    var step = self.m.runtime*10;
    
    this.init = function() {
        // one move
        self.m.destinations.forEach(function(dest) {
            dest.node.move = {
                dx: (dest.x - dest.node.x)/step,
                dy: (dest.y - dest.node.y)/step
            }
        });
        return self;
    }

    this.atomicGo = function() {
        var graph = self.graph;
        self.m.destinations.forEach(function(dest) {
            dest.node.x += dest.node.move.dx;
            dest.node.y += dest.node.move.dy;
        });
        step--;
    }
    
    this.isDone = function() {
        return step <= 0;
    };
    
    this.cleanup = function() {
        self.m.destinations.forEach(function(dest) {
            delete dest.node.move;
        });
    }
};

sigma.publicPrototype.locateSearchedNodes = function(properties, callback) {
    if (!properties.hasOwnProperty("destinations") || properties["destinations"].length == 0) return;
    
    this.searchlocator = new sigma.searchlocator.SearchLocator(this._core.graph, this, properties);
    this.searchlocator.init();
    
    var sl = this.searchlocator;
    
    this.addGenerator('move', this.searchlocator.atomicGo, function() {
        if (sl.isDone()) {
            callback();
            sl.cleanup();
            return false;
        }
        return true;
    });
};
