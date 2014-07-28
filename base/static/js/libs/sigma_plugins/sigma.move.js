// Mathieu Jacomy @ Sciences Po Médialab & WebAtlas
// (requires sigma.js to be loaded)
sigma.move = sigma.move || {};
sigma.move.Move = function(graph, instance, properties) {
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

sigma.publicPrototype.moveNodes = function(properties, callback) {
    if (!properties.hasOwnProperty("destinations") || properties["destinations"].length == 0) return;
    
    this.move = new sigma.move.Move(this._core.graph, this, properties);
    this.move.init();
    
    var mv = this.move;
    
    this.addGenerator('move', this.move.atomicGo, function() {
        if (mv.isDone()) {
            callback();
            mv.cleanup();
            return false;
        }
        return true;
    });
};
