// Mathieu Jacomy @ Sciences Po Médialab & WebAtlas
// (requires sigma.js to be loaded)
sigma.forcelayout = sigma.forcelayout || {};
sigma.forcelayout.ForceLayout = function(graph, instance, properties) {
    sigma.classes.Cascade.call(this);
    var self = this;
    var inst = instance;
    this.graph = graph;

    var EPSILON = 0.000001; // 0.000001
    var attraction_constant;
    var repulsion_constant;
    var forceConstant;
    var layout_iterations = 0;
    var temperature = 0;
    var centre_gravity = {x: 0, y: 0};
    var bound_box = {x: 0, y: 0};
    
    // performance test
    var mean_time = 0;

    this.p = {
        attraction_multiplier : 1,
        repulsion_multiplier : .75, // 0.75
        gravity: 10,
        max_iterations : 1000,
        width : 1000,
        height : 1000,
        finished : false,
        nodes : this.graph.nodes.filter(function(n) {
            return !n.hidden;
        }),
        edges : this.graph.edges.filter(function(e) {
            return !e.source.hidden && !e.target.hidden && !e.hidden;
        }),
        subnetworkLengths: {
        }
    };
    
    this.p = jQuery.extend({}, this.p, properties || {});
    
    this.traverseRec = function(node, netNum, len) {
        var nextNode;
        if (node.layout.subnetwork != null) return len;
        
        node.layout.subnetwork = netNum;
        for (nextNode in node.layout.connections) {
            nextNode = node.layout.connections[nextNode];
            len = self.traverseRec(nextNode, netNum, len);
        }
        return len + 1;
    }
    
    /**
     * Traverse the nodes and enumerate unconnected networks
     */
    this.traverse = function() {
        var subnetworkLength, subnetwork = 0, subSum = 0;
        
        self.p.edges.forEach(function(e) {
            e.source.layout.connections[e.target.id] = e.target;
            e.target.layout.connections[e.source.id] = e.source;
        });
        
        self.p.nodes.forEach(function(n) {
            if (n.layout.subnetwork == null) {
                subnetwork++;
                subnetworkLength = self.traverseRec(n, subnetwork, 0);
                self.p.subnetworkLengths[subnetwork] = subnetworkLength;
                subSum += subnetworkLength;
                console.log("Subnetwork " + subnetwork + " length=" + subnetworkLength);
            }
        });
        
        self.p.nodes.forEach(function(n) {
            delete n.layout.connections;
        });
        
        self.p.subnetworkLengths.mean = 1. * subSum / subnetwork;
        
        console.log(self.p.nodes.length + " nodes in " + subnetwork + " unconnected subnetworks (sum=" + subSum + ", mean=" + self.p.subnetworkLengths.mean + ")");
    }
    
    this.init = function() {
        var xmax, xmin, ymax, ymin;
        self.p.width = self.p.nodes.length * 15;
        self.p.height = self.p.nodes.length * 15;
        
        self.p.finished = false;
        temperature = self.p.width / 10.0;
        nodes_length = self.p.nodes.length;
        edges_length = self.p.edges.length;
        forceConstant = Math.sqrt(self.p.height * self.p.width / nodes_length);
        attraction_constant = self.p.attraction_multiplier * forceConstant;
        repulsion_constant = self.p.repulsion_multiplier * forceConstant;
        
        if (self.p.edgeFilter) {
//            self.p.edges = self.p.edges.filter(self.p.edgeFilter);
        }
        
        self.p.nodes.forEach(function(n) {
            n.layout = {
                offset_x : 0,
                offset_y : 0,
                force : 0,
                tmp_pos_x : n.x,
                tmp_pos_y : n.y,
                connections : {},
                subnetwork : null
            };
            xmax = !xmax ? n.x : Math.max(xmax, n.x);
            xmin = !xmin ? n.x : Math.min(xmin, n.x);
            ymax = !ymax ? n.y : Math.max(ymax, n.y);
            ymin = !ymin ? n.y : Math.min(ymin, n.y);
        });
        
        bound_box.x = Math.abs(xmax - xmin);
        bound_box.y = Math.abs(ymax - ymin);
        centre_gravity.x = xmin + ((xmax - xmin) / 2);
        centre_gravity.y = ymin + ((ymax - ymin) / 2);
        
        self.traverse();
        
        return self;
    }

    this.atomicGo = function() {
        var graph = self.graph;
        var p = self.p;
        var nodes = p.nodes;
        var edges = p.edges;
        var lens = p.subnetworkLengths;
        var m = p.subnetworkLengths.mean;
        var new_box;

        var start = new Date().getTime();

        var delta_x, delta_y, delta_length, force, x_off, y_off;
        var node_v, node_u;

        // calculate repulsion
        for ( var i = 0; i < nodes_length; i++) {
            node_v = nodes[i];
            if (i == 0) {
                node_v.layout.offset_x = 0;
                node_v.layout.offset_y = 0;
            }

            for ( var j = i + 1; j < nodes_length; j++) {
                node_u = nodes[j];
                
//                if (node_v.layout.subnetwork != node_u.layout.subnetwork) continue;
                
                if (i == 0) {
                    node_u.layout.offset_x = 0;
                    node_u.layout.offset_y = 0;
                }
                
                delta_x = node_v.layout.tmp_pos_x - node_u.layout.tmp_pos_x;
                delta_y = node_v.layout.tmp_pos_y - node_u.layout.tmp_pos_y;
                delta_length = Math.max(EPSILON, Math.sqrt((delta_x * delta_x) + (delta_y * delta_y)));
                force = (repulsion_constant * repulsion_constant) / delta_length;
                
                x_off = (delta_x / delta_length) * force;
                y_off = (delta_y / delta_length) * force;
                
                node_v.layout.offset_x += x_off;
                node_v.layout.offset_y += y_off;
                node_u.layout.offset_x -= x_off;
                node_u.layout.offset_y -= y_off;
            }
        }

        // calculate attraction
        edges.forEach(function(edge) {
            node_v = edge.source;
            node_u = edge.target;
            
            delta_x = node_v.layout.tmp_pos_x - node_u.layout.tmp_pos_x;
            delta_y = node_v.layout.tmp_pos_y - node_u.layout.tmp_pos_y;

            delta_length = Math.max(EPSILON, Math.sqrt((delta_x * delta_x) + (delta_y * delta_y)));
            force = ((delta_length * delta_length) / attraction_constant) * (edge.absweight * 10);

            node_v.layout.offset_x -= (delta_x / delta_length) * force;
            node_v.layout.offset_y -= (delta_y / delta_length) * force;

            node_u.layout.offset_x += (delta_x / delta_length) * force;
            node_u.layout.offset_y += (delta_y / delta_length) * force;
        });
        
        nodes.forEach(function(n) {
            // Gravity
            var d = Math.sqrt((n.x - centre_gravity.x) * (n.x - centre_gravity.x) + (n.y - centre_gravity.y) * (n.y - centre_gravity.y));
            var gf = forceConstant * p.gravity * d * 0.0001;
            
            n.layout.offset_x -= gf * n.layout.offset_x / d;
            n.layout.offset_y -= gf * n.layout.offset_y / d;
        });
        
        // calculate positions
        nodes.forEach(function(node) {
            delta_length = Math.max(EPSILON, Math.sqrt(node.layout.offset_x * node.layout.offset_x
                    + node.layout.offset_y * node.layout.offset_y));
            
            node.layout.tmp_pos_x += (node.layout.offset_x / delta_length) * Math.min(delta_length, temperature);
            node.layout.tmp_pos_y += (node.layout.offset_y / delta_length) * Math.min(delta_length, temperature);

            node.x -= (node.x - node.layout.tmp_pos_x) / 10;
            node.y -= (node.y - node.layout.tmp_pos_y) / 10;
        });
        
        // calculate if expanding or contracting
        new_box = self.calc_bound_box();
        
        temperature *= (1 - (layout_iterations / p.max_iterations));
        layout_iterations++;

        var end = new Date().getTime();
        mean_time += end - start;
    }

    this.end = function() {
        this.graph.nodes.forEach(function(n) {
            delete n.layout;
        });
    }
    
    this.temp = function() {
        return temperature;
    }
    
    this.calc_bound_box = function() {
        var xmax, xmin, ymax, ymin, box = {};
        self.p.nodes.forEach(function(n) {
            xmax = !xmax ? n.x : Math.max(xmax, n.x);
            xmin = !xmin ? n.x : Math.min(xmin, n.x);
            ymax = !ymax ? n.y : Math.max(ymax, n.y);
            ymin = !ymin ? n.y : Math.min(ymin, n.y);
        });
        box.x = Math.abs(xmax - xmin);
        box.y = Math.abs(ymax - ymin);
        return box;
    }
};

sigma.publicPrototype.startForceLayout = function(properties) {
    this.forcelayout = new sigma.forcelayout.ForceLayout(this._core.graph, this, properties);
    this.forcelayout.init();
    var fl = this.forcelayout;

    this.addGenerator('forcelayout', this.forcelayout.atomicGo, function() {
        if (fl.temp() < 0.0005) {
            properties.callback();
            return false;
        }
        return true;
    });
};

sigma.publicPrototype.stopForceLayout = function() {
    this.removeGenerator('forcelayout');
};
