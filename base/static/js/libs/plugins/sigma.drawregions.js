// Mathieu Jacomy @ Sciences Po Médialab & WebAtlas
// (requires sigma.js to be loaded)
sigma.drawregions = sigma.drawregions || {};
sigma.drawregions.RegionDraw = function(graph, instance, properties) {
    sigma.classes.Cascade.call(this);
    var self = this;
    var inst = instance;
    
    this.graph = graph;
    this.m = {
        runtime: 1,
    };
    
    this.m = jQuery.extend({}, this.m, properties || {});
    var step = 0;
    
    this.atomicGo = function() {
        var graph = self.graph;
        var ctx = $('#canvas-regions')[0].getContext('2d');
        if (!!self.m.hasOwnProperty('context')) {
            ctx = self.m.context
        }
        var last = 0, spacing = 20;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.9;
        
        for (var r in self.m.regions) {
            var region = self.m.regions[r];
            var color = region['c'], nodes = region['nodes'], name = region['n'];
            
            ctx.strokeStyle = '#' + color;
            ctx.fillStyle = '#' + color;
            if (step == 0) {
                ctx.beginPath();
                
                ctx.moveTo(nodes[0]['displayX'], nodes[0]['displayY']);
                var n1, n2, dx, dy, angle, dr;
                for (var i = 0; i < nodes.length - 1; i++) {
                    n1 = nodes[i], n2 = nodes[i + 1];
                    dx = (n2.displayX - n1.displayX)/2, dy = (n2.displayY - n1.displayY)/2, angle = Math.atan(dx/dy);
                    dr = Math.sqrt(dx*dx + dy*dy) * 2/3;
                    
                    if (dx > 0) {
                        ctx.quadraticCurveTo(n1.displayX + dx + dr*Math.cos(Math.PI/2 - angle), n1.displayY + dy - dr*Math.sin(Math.PI/2 - angle), n2.displayX, n2.displayY);
                    } else if (dy > 0){
                        ctx.quadraticCurveTo(n1.displayX + dx + dr*Math.sin(Math.PI/2 - angle), n1.displayY + dy - dr*Math.cos(Math.PI/2 - angle), n2.displayX, n2.displayY);
                    } else {
                        ctx.quadraticCurveTo(n1.displayX + dx - dr*Math.sin(Math.PI/2 - angle), n1.displayY + dy + dr*Math.cos(Math.PI/2 - angle), n2.displayX, n2.displayY);
                    }
                }
                ctx.stroke();
                ctx.closePath();
            } else {
                if (region.y - last < spacing) {
                    region.y += spacing - (region.y - last);
                }
                
                ctx.fillText(name, region.x, region.y);
                
                last = region.y;
            }
        }
        step++;
    }
    
    this.isDone = function() {
        return step >= self.m.runtime;
    };
    
    this.cleanup = function() {
//        delete self.m.d;
    }
};

sigma.publicPrototype.displayRegions = function(properties) {
    if (!properties.hasOwnProperty('regions')) return;
    
    this.drawregions = new sigma.drawregions.RegionDraw(this._core.graph, this, properties);
    var dwr = this.drawregions;
    
    this.addGenerator('draw', this.drawregions.atomicGo, function() {
        if (dwr.isDone()) {
            dwr.cleanup();
            return false;
        }
        return true;
    });
};

sigma.publicPrototype.drawRegionsDirect = function(properties) {
    if (!properties.hasOwnProperty('regions')) return;
    
    this.drawregions = new sigma.drawregions.RegionDraw(this._core.graph, this, properties);
    this.drawregions.atomicGo();
    this.drawregions.atomicGo();
};