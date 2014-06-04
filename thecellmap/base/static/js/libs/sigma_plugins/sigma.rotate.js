// Mathieu Jacomy @ Sciences Po Médialab & WebAtlas
// (requires sigma.js to be loaded)
sigma.rotate = sigma.rotate || {};
sigma.rotate.Rotate = function(graph, instance, properties, angle) {
    sigma.classes.Cascade.call(this);
    var self = this;
    var inst = instance;
    this.graph = graph;
    this.p = {
        runtime: 1,
        degrees: angle || 90,
        nodes : this.graph.nodes.filter(function(n) {
            return !n.hidden;
        })
    };
    
    var rotated = 0;
    var rotationPerFrame;
    var centre_network = {x: 0, y: 0};
    var cos, sin;
    
    this.p = jQuery.extend({}, this.p, properties || {});
    
    this.init = function() {
        var xmax, xmin, ymax, ymin;
        
        self.p.radians = (Math.PI / 180) * self.p.degrees;
        rotationPerFrame = self.p.radians / (20 * self.p.runtime);
        self.p.radians = Math.abs(self.p.radians);
        
        self.p.nodes.forEach(function(n) {
            xmax = !xmax ? n.x : Math.max(xmax, n.x);
            xmin = !xmin ? n.x : Math.min(xmin, n.x);
            ymax = !ymax ? n.y : Math.max(ymax, n.y);
            ymin = !ymin ? n.y : Math.min(ymin, n.y);
        });
        
        centre_network.x = xmin + ((xmax - xmin) / 2);
        centre_network.y = ymin + ((ymax - ymin) / 2);
        
        cos = Math.cos(rotationPerFrame);
        sin = Math.sin(rotationPerFrame);
        
        return self;
    }

    this.atomicGo = function() {
        var graph = self.graph;
        var p = self.p;
        
        p.nodes.forEach(function(n) {
            n.x = (n.x - centre_network.x) * cos - (n.y - centre_network.y) * sin + centre_network.x;
            n.y = (n.y - centre_network.y) * cos + (n.x - centre_network.x) * sin + centre_network.y;
        })
        
        rotated += Math.abs(rotationPerFrame);
    }
    
    this.soFar = function() {
        return rotated;
    };
};

sigma.publicPrototype.rotateNodes = function(properties, angle) {
    this.rotate = new sigma.rotate.Rotate(this._core.graph, this, properties, angle);
    this.rotate.init();
    var rt = this.rotate;
    
    this.addGenerator('rotate', this.rotate.atomicGo, function() {
        if (rt.soFar() >= rt.p.radians) {
            properties.callback();
            return false;
        }
        
        return true;
    });
};
