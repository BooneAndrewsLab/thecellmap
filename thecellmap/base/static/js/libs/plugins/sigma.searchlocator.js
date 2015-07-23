// Mathieu Jacomy @ Sciences Po Médialab & WebAtlas
// (requires sigma.js to be loaded)
sigma.searchlocator = sigma.searchlocator || {};
sigma.searchlocator.SearchLocator = function(graph, instance, properties) {
    sigma.classes.Cascade.call(this);
    var self = this;
    var inst = instance;
    var size = 30;
    
    this.graph = graph;
    this.m = {
        runtime: 1,
    };
    
    this.m = jQuery.extend({}, this.m, properties || {});
    
    var step = self.m.runtime * 10;
    
    this.init = function() {
        // one move
        self.m.d = size/step;
        return self;
    }

    this.atomicGo = function() {
        var graph = self.graph, ratio = sigInst.position().ratio;
        var canvas = $('.sigma_mouse_canvas')[0], context = canvas.getContext('2d');
        context.clearRect(0, 0, $(document).width(), $(document).height());
        context.strokeStyle = '#222222';
        
        self.m.nodes.forEach(function(n) {
            if (!n.hidden && !n._hidden) {
                distance = n.displaySize / ratio * step ;
                
                if (n.displaySize / 2 > size) {
                    size = n.displaySize;
                }
                
                context.fillStyle = 'red';
                context.beginPath();
                
                context.moveTo(n.displayX, n.displayY - distance);
                context.bezierCurveTo(n.displayX, n.displayY - 1/3 * size - distance, 
                        n.displayX - 2/3 * size, n.displayY - 5/6 * size - distance, 
                        n.displayX, n.displayY - size - distance);
                context.bezierCurveTo(n.displayX + 2/3 * size, n.displayY - 5/6 * size - distance, 
                        n.displayX, n.displayY - 1/3 * size - distance, 
                        n.displayX, n.displayY - distance);
                context.fill();
                context.stroke();
                
                context.beginPath();
                context.fillStyle = '#222222';
                context.arc(n.displayX, n.displayY - 2/3 * size - distance, 2/15 * size, 0, 2 * Math.PI);
                context.fill();
            }
        });
        step--;
    }
    
    this.isDone = function() {
        return step <= 0;
    };
    
    this.cleanup = function() {
        delete self.m.d;
    }
};

sigma.publicPrototype.locateSearchedNodes = function(properties) {
    if (!properties.hasOwnProperty('nodes') || !!state.get('showCircular')) return;
    
    this.searchlocator = new sigma.searchlocator.SearchLocator(this._core.graph, this, properties);
    this.searchlocator.init();
    
    var sl = this.searchlocator;
    
    this.addGenerator('locate', this.searchlocator.atomicGo, function() {
        if (sl.isDone()) {
            sl.cleanup();
            return false;
        }
        return true;
    });
};
