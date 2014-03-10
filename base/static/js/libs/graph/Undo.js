(function(undefined) {
    "use strict";
    
    var _currentVersion = -1;
    var _versions = {};
    
    var Undo = function(type, start) {
        _currentVersion = new Date().getTime();
        _versions[_currentVersion] = {type: type, state: start};
    };
    
    function _size() {
        var size = 0;
        for (var key in _versions) {
            if (_versions.hasOwnProperty(key)) {
                size++;
            }
        }
        return size;
    }
    
    Undo.prototype = {
        addChange: function(type, state) {
            // Remove any redo
            for (var key in _versions) {
                if (_versions.hasOwnProperty(key) && key > _currentVersion) {
                    delete _versions[key];
                }
            }
            
            _currentVersion = new Date().getTime();
            _versions[_currentVersion] = {type: type, state: state};
        },
        
        undo: function() {
            var prevVersion = 0;
            for (var key in _versions) {
                if (_versions.hasOwnProperty(key) && key < _currentVersion && key > prevVersion) {
                    prevVersion = key;
                }
            }
            
            _currentVersion = prevVersion;
            return _versions[_currentVersion];
        },
        
        redo: function() {
            var nextVersion = Number.MAX_VALUE;
            for (var key in _versions) {
                if (_versions.hasOwnProperty(key) && key > _currentVersion && key < nextVersion) {
                    nextVersion = key;
                }
            }
            
            _currentVersion = nextVersion;
            return _versions[_currentVersion];
        },
        
        hasUndo: function() {
            for (var key in _versions) {
                if (_versions.hasOwnProperty(key) && key < _currentVersion) {
                    return true;
                }
            }
            return false;
        },
        
        hasRedo: function() {
            for (var key in _versions) {
                if (_versions.hasOwnProperty(key) && key > _currentVersion) {
                    return true;
                }
            }
            return false;
        }
    };
    
    if (!window.Undo) {
        window.Undo = Undo;
    }
})(this);