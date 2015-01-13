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
        runtime: 3,
    };
    
    this.m = jQuery.extend({}, this.m, properties || {});
    
    var step = self.m.runtime*10;
    
    this.init = function() {
        // one move
        self.m.d = size/step;
        return self;
    }

    this.atomicGo = function() {
        var graph = self.graph;
        var canvas = $(".sigma_mouse_canvas")[0], context = canvas.getContext('2d'), distance = self.m.d * step;
        
        context.fillStyle = "rgb(255,0,0)";
        context.clearRect(0, 0, $(document).width(), $(document).height());
        context.beginPath();
        context.arc(self.m.x, self.m.y, distance, 0, 2*Math.PI, false);
        context.fill();
        step--;
    }
    
    this.isDone = function() {
        return step <= 0;
    };
    
    this.cleanup = function() {
        var canvas = $(".sigma_mouse_canvas")[0], context = canvas.getContext('2d');
        context.clearRect(0, 0, $(document).width(), $(document).height());
        delete self.m.d;
    }
};

sigma.publicPrototype.locateSearchedNodes = function(properties) {
    if (!properties.hasOwnProperty("x") && !properties.hasOwnProperty("y")) return;
    
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
