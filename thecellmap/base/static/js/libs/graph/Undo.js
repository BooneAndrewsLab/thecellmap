(function(undefined) {
    "use strict";
    
    var _currentVersion = -1;
    var _versions = {};
    var _nodeVersions = {};
    
    var Undo = function(style, nodes) {
        _currentVersion = new Date().getTime();
        _versions[_currentVersion] = style;
        _nodeVersions[_currentVersion] = nodes;
    };
    
    function _size() {
        var size = 0;
        for (var key in _versions) {
            if (_versions.hasOwnProperty(key)) {
                size++;
            }
        }
        return size;
    };
    
    function _sortedKeys() {
        var keys = [];
        for (var key in _versions) {
            _versions.hasOwnProperty(key) && keys.push(key);
        }
        return keys.sort();
    }
    
    Undo.prototype = {
        addChange: function(state, nodes) {
            // Remove any redo
            var keys = _sortedKeys(), key, i = 0;
            for (; i < keys.length; i++) {
                key = keys[i];
                if (key > _currentVersion) {
                    delete _versions[key];
                    delete _nodeVersions[key];
                }
            }
            
            _currentVersion = new Date().getTime();
            _versions[_currentVersion] = state;
            if (!!nodes) {
                _nodeVersions[_currentVersion] = nodes;
            }
        },
        
        undo: function() {
            var prevVersion = 0;
            var prevNodeState = null;
            var keys = _sortedKeys(), key, i = 0;
            
            for (; i < keys.length; i++) {
                key = keys[i];
                if (key < _currentVersion) {
                    prevVersion = key;
                    
                    if (_nodeVersions.hasOwnProperty(_currentVersion) && _nodeVersions.hasOwnProperty(key)) {
                        prevNodeState = _nodeVersions[key];
                    }
                }
            }
            
            _currentVersion = prevVersion;
            return {style: _versions[_currentVersion], nodes: prevNodeState}
        },
        
        redo: function() {
            var nextVersion = Number.MAX_VALUE;
            var nextNodeState = null;
            var keys = _sortedKeys().reverse(), key, i = 0;
            
            for (; i < keys.length; i++) {
                key = keys[i];
                if (key > _currentVersion) {
                    nextVersion = key;
                }
            }
            
            _currentVersion = nextVersion;
            
            if (_nodeVersions.hasOwnProperty(_currentVersion)) {
                nextNodeState = _nodeVersions[_currentVersion];
            }
            
            return {style: _versions[_currentVersion], nodes: nextNodeState};
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