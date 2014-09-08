(function(undefined) {
    "use strict";
    
    // public static
    var storage = {
            selection: [],
            edgeSelection: [],
            nodeSize: 2,
            labelSize: 14,
            labelThreshold: 6,
            labelColor: "ffffff",
            edgeWidth: 1,
            background: "222222",
            layoutAttraction: 50,
            layoutRepulsion: 1,
            annotation: 'None',
            dataset: 0
    };
    
    var State = function(savedState) {
        this._storage = $.extend({}, storage, savedState);
    }
    
    State.prototype = {
        getProperty: function(key) {
            return this._storage[key];
//            if (localStorage.getItem(key) == null || localStorage.getItem(key) == undefined) {
//                return storage[key];
//            }
//            else {
//                return localStorage.getItem(key);
//            }
        }, 
        
        setProperty: function(key, value) {
//            localStorage.setItem(key, value);
            this._storage[key] = value;
        },
        
        compareTo: function(state) {
            var changed = [], key;
            for (key in storage) {
                if (this._storage.hasOwnProperty(key) && (typeof(this._storage[key]) == "undefined" || state._storage[key] != this._storage[key])) {
                    changed.push(key);
                }
            }
            return changed;
        },
        
        numOfCutoffs: function() {
            var r = 0;
            for (var key in this._storage) {
                if (this._storage.hasOwnProperty(key) && key.indexOf('cutoff_') == 0)
                    r++;
            }
            return r;
        }, 
        
        clone: function() {
            return new State(this._storage);
        },
        
        asJson: function() {
            return $.extend({}, this._storage);
        }
    };
    
    if (!window.State) {
        window.State = State;
    }
})(this);