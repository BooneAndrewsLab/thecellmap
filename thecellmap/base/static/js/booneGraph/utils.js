define([
    'jquery',
    'underscore',
    'underscore.strings',
    'backbone',
    
    'packer',
    'sigma.move',
], function($, _, _str, Backbone) {
    var iterVisibleNodes = function(func, ids) {
        sigInst._core.graph.nodes.filter(function(node) {
            return !node.hidden;
        }).forEach(func, ids);
    };
    var iterVisibleEdges = function(func, ids) {
        sigInst._core.graph.edges.filter(function(edge) {
            return !edge.hidden && !edge.source.hidden && !edge.target.hidden;
        }).forEach(func, ids);
    };
    
    var nodeExists = function(id) {
        return !!sigInst._core.graph.nodesIndex[id];
    }
    
    var edgeExists = function(id) {
        return !!sigInst._core.graph.edgesIndex[id];
    }
    
    var countVisibleNodes = function() {
        return sigInst._core.graph.nodes.filter(function(node) {
            return !node.hidden;
        }).length;
    }
    
    var countVisibleEdges = function() {
        return sigInst._core.graph.edges.filter(function(edge) {
            return !edge.hidden && !edge.source.hidden && !edge.target.hidden;
        }).length;
    }
    
    var onNodesContext = function(targets) {
        state.set('hoveredTargets', targets.content);
        $('#contextmenu-container').show().delay(2000).hide(200);
        $('#contextmenu-container').css({ left : mouseX, top : mouseY, });
    }
    
    var getNode = function(id) {
        return sigInst._core.graph.nodesIndex[id];
    }
    
    var getEdge = function(id) {
        return sigInst._core.graph.edgesIndex[id];
    }
    
    var getStrain = function(id) {
        if (typeof id === 'string' && id.indexOf('tmp') != -1) id = id.replace('tmp_', '');
        return vizdata['strains'].get(id);
    }
    
    var getSelection = function() {
        var selector = $('#ui input.gene-search-input');
        if (selector.length > 0) {
            return selector.select2('val');
        }
        return [];
    }
    
    var clearSelection = function() {
        if (state.get("selection").length > 0) {
            $('input.gene-search-input').select2('val', '', true);
            state.set("selection", []);
        }
        clearSelectionCanvas();
    }
    
    var clearSelectionCanvas = function() {
        $('.sigma_mouse_canvas')[0].getContext('2d').clearRect(0, 0, $(document).width(), $(document).height());
    }
    
    var graphSelectedNodes = function() {
        var nodes = sigInst._core.graph.nodes.filter(function(node) {
            return node.selected;
        });
        sigInst.locateSearchedNodes({nodes: nodes, runtime: 0});
    }
    
    var getSelectedNodes = function(getHidden) {
        if (state.get('isInitializing')) return;
        var selected = getSelection(), map, annotations = [], result, byAnnot = {};
        var i, j, selectedByAnnotation = {}, strain, node;
        
        result = selected.filter(function(sel) {
            return !_str.startsWith(sel, 'annot') && !_str.startsWith(sel, 'action');
        });
        
        if (vizdata['annotations'].get(state.get('annotation'))) {
            map = vizdata['annotations'].get(state.get("annotation")).get('map');
            
            selected.forEach(function(sel) {
                if (_str.startsWith(sel, 'annot')) {
                    annotations.push(parseInt(sel.replace('annot', '')));
                }
            });
            
            // Some annotations are selected
            if (annotations.length > 0) {
                for (i in map) {
                    if (map.hasOwnProperty(i)) {
                        for (j in map[i]) {
                            if ($Property.inArray(map[i][j], annotations) >= 0 && !selectedByAnnotation.hasOwnProperty(i)) {
                                selectedByAnnotation[i] = null;
                            }
                        }
                    }
                }
            }
        }
        
        vizdata['strains']['models'].forEach(function(strain) {
            if (selectedByAnnotation.hasOwnProperty(strain.get('orf'))) {
                result.push(strain.get('id') + "");
            }
        });
        
        if (!getHidden) {
            result =  result.filter(function(sid) {
                node = getNode(sid);
                return node && !node.hidden;
            });
        }
        
        return result;
    }
    
    var graphCenter = function() {
        var mmx = {};
        sigInst.iterNodes(function(node) {
            if (!node.hidden) {
                mmx.ax = Math.min(node.displayX, mmx.ax || node.displayX);
                mmx.zx = Math.max(node.displayX, mmx.zx || node.displayX);
                mmx.ay = Math.min(node.displayY, mmx.ay || node.displayY);
                mmx.zy = Math.max(node.displayY, mmx.zy || node.displayY);
            }
        });
        
        var position = sigInst.position(), size = sigInst.size();
        var x = -(mmx.ax + mmx.zx - (2 * position.stageX) - size.w) / 2;
        var y = -(mmx.ay + mmx.zy - (2 * position.stageY) - size.h) / 2;
        
        var moveRequired = Math.round(position.stageX) != Math.round(x) || Math.round(position.stageY) != Math.round(y);
        var timeout = 0;
        
        if (moveRequired) {
            sigInst.goTo(x, y).draw();
            timeout = 150; // We know goTo needs 100ms, 50ms buffer just in case
        }
        
        setTimeout(function() {
            if (timeout != 0) {
                mmx = {};
                sigInst.iterNodes(function(node) {
                    if (!node.hidden) {
                        mmx.ax = Math.min(node.displayX, mmx.ax || node.displayX);
                        mmx.zx = Math.max(node.displayX, mmx.zx || node.displayX);
                        mmx.ay = Math.min(node.displayY, mmx.ay || node.displayY);
                        mmx.zy = Math.max(node.displayY, mmx.zy || node.displayY);
                    }
                });
                
                position = sigInst.position();
                size = sigInst.size();
            }
            
            var xmin = Math.min(mmx.ax, size.w - mmx.zx);
            var ymin = Math.min(mmx.ay, size.h - mmx.zy);
            var ratio = 0;
            
            if (mmx.ax < 0 || mmx.zx > size.w || mmx.ay < 0 || mmx.zy > size.h) { // Zoom out required
                if (xmin < ymin) {
                    ratio = -xmin / size.w;
                } else {
                    ratio = -ymin / size.h;
                }
                
                // ratio multiplier should be 2.11 but let's set it to 3 for a nice padding around the newtwork
                sigInst.goTo(size.w / 2, size.h / 2, position.ratio / (3 * ratio + 1)).draw();
            } else { // Zoom in could be required
                if (xmin < ymin) {
                    ratio = xmin / size.w;
                } else {
                    ratio = ymin / size.h;
                }
                
                if (ratio > 0.22) {
                    // ratio multiplier should be 2 but let's set it to 1.9 for a nice padding around the newtwork
                    sigInst.goTo(size.w / 2, size.h / 2, position.ratio / ((-1.5 * ratio) + 1)).draw();
                }
            }
        }, timeout);
        graphSelectedNodes();
    }
    
    var traverseRec = function(node, netNum, len) {
        var nextNode;
        if (node.layout.subnetwork != null) return len;
        
        node.layout.subnetwork = netNum;
        for (nextNode in node.layout.connections) {
            nextNode = node.layout.connections[nextNode];
            len = traverseRec(nextNode, netNum, len);
        }
        return len + 1;
    }
    
    var stackNetworks = function() {
        var nodes = sigInst._core.graph.nodes.filter(function(node) { return !node.hidden; });
        var edges = sigInst._core.graph.edges.filter(function(e) { return !e.source.hidden && !e.target.hidden && !e.hidden; });
        var subnetwork = -1, offset, subnetworks = [], blocks = [], packer = new GrowingPacker();
        
        nodes.forEach(function(n) {
            n.layout = {
                connections : {},
                subnetwork : null
            };
        });
        
        edges.forEach(function(e) {
            e.source.layout.connections[e.target.id] = e.target;
            e.target.layout.connections[e.source.id] = e.source;
        });
        
        nodes.forEach(function(n) {
            if (n.layout.subnetwork == null) {
                subnetwork++;
                traverseRec(n, subnetwork, 0);
            }
            
            if (subnetworks[n.layout.subnetwork] == undefined) {
                subnetworks[n.layout.subnetwork] = [n];
            } else {
                subnetworks[n.layout.subnetwork].push(n);
            }
        });
        
        for (var i = 0; i < subnetworks.length; i++) {
            var xmax = xmin = subnetworks[i][0].x, ymax = ymin = subnetworks[i][0].y;
            for (var j = 0; j < subnetworks[i].length; j++) {
                xmax = Math.max(xmax, subnetworks[i][j].x);
                xmin = Math.min(xmin, subnetworks[i][j].x);
                ymax = Math.max(ymax, subnetworks[i][j].y);
                ymin = Math.min(ymin, subnetworks[i][j].y);
            }
            offset = Math.max(offset || (xmax-xmin)/10, (ymax-ymin)/10);
            blocks.push({x: xmin, y: ymin, w: xmax - xmin + offset, h: ymax - ymin + offset, area: Math.abs((xmax - xmin) * (ymax - ymin))});
        }
        
        for (var i = 0; i < blocks.length; i++) {
            blocks[i]["subnetwork"] = subnetworks[i];
        }
        
        blocks.sort(function (a, b) { return b.area - a.area; });
        packer.fit(blocks);
        
        var newPositions = [];
        for(var i = 0; i < blocks.length; i++) {
            for (var j = 0; j < blocks[i].subnetwork.length; j++) {
                var n = blocks[i].subnetwork[j], x = n.x, y = n.y;
                if ((x - blocks[i].x) < blocks[i].w) {
                    x += offset;
                } else {
                    x -= offset;
                }
                
                if ((y - blocks[i].y) < blocks[i].h) {
                    y += offset;
                } else {
                    y -= offset;
                }
                
                newPositions.push({x: x - blocks[i].x + blocks[i].fit.x,
                                  y: y - blocks[i].y + blocks[i].fit.y,
                                  node: n});
            }
        }
        
        nodes.forEach(function(n) {
            delete n.layout;
        });
        
        sigInst.moveNodes({destinations: newPositions, runtime: 3}, function() {
            graphCenter();
        });
    }
    
    var getUnique = function(array){
        var u = {}, a = [];
        for(var i = 0, l = array.length; i < l; ++i){
           if(u.hasOwnProperty(array[i])) {
              continue;
           }
           a.push(array[i]);
           u[array[i]] = 1;
        }
        return a;
    }
    
    var rgbToHex = function(rgb) {
        var rgbvals = /rgb\((.+),(.+),(.+)\)/i.exec(rgb);
        var rval = parseInt(rgbvals[1]);
        var gval = parseInt(rgbvals[2]);
        var bval = parseInt(rgbvals[3]);
        return '#' + (
                rval.toString(16) +
                gval.toString(16) +
                bval.toString(16)
        ).toUpperCase();
    }
    
    var cleanUpNodes = function() {
        sigInst.iterNodes(function(node) {
            if (node.id.indexOf('tmp_') != -1) sigInst.dropNode(node.id);
        });
    }
    
    var messageUser = function(text, target) {
        var alert = $('<div class="alert alert-warning fade in"> \
                <button class="close" aria-hidden="true" data-dismiss="alert" type="button">x</button> \
                ' + text + ' \
              </div>');
        if (target) {
            $('#' + target).empty();
            $('#' + target).append(alert);
        } else {
            $('#panel-alerts').append(alert);
        }
        alert.alert();
        setTimeout(function() { alert.alert('close'); }, 3000);
    }
    
    var alertUser = function(title, text, preModalCallback) {
        $('body').append(
            '<div class="modal fade" id="modal-alert" tabindex="-1" role="dialog" aria-labelledby="modal-alert-label" aria-hidden="true"> \
              <div class="modal-dialog"> \
                <div class="modal-content"> \
                  <div class="modal-header"> \
                    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button> \
                    <h4 class="modal-title" id="modal-alert-label">' + title + '</h4> \
                  </div> \
                  <div class="modal-body"> \
                    <p>' + text + '</p> \
                  </div> \
                  <div class="modal-footer"> \
                    <button type="button" class="btn btn-default" data-dismiss="modal">Close</button> \
                  </div> \
                </div>\
              </div>\
            </div>');
        
        if (preModalCallback != undefined) {
            preModalCallback($('#modal-alert'));
        }
        
        $('#modal-alert').modal().on('hidden.bs.modal', function () {
            $(this).remove();
        });
    }
    
    var parseBool = function(bool) {
        if (typeof bool == 'boolean') return bool;
        return bool == 'true';
    }
    
    return {
        iterVisibleNodes: iterVisibleNodes,
        iterVisibleEdges: iterVisibleEdges,
        nodeExists: nodeExists,
        edgeExists: edgeExists,
        onNodesContext: onNodesContext,
        countVisibleNodes: countVisibleNodes,
        countVisibleEdges: countVisibleEdges,
        getNode: getNode,
        getEdge: getEdge,
        getStrain: getStrain,
        
        clearSelection: clearSelection,
        clearSelectionCanvas: clearSelectionCanvas,
        graphSelectedNodes, graphSelectedNodes,
        getSelectedNodes: getSelectedNodes,
        
        stackNetworks: stackNetworks,
        graphCenter: graphCenter,
        
        getUnique: getUnique,
        rgbToHex: rgbToHex,
        
        cleanUpNodes: cleanUpNodes,
        messageUser: messageUser,
        alertUser: alertUser,
        parseBool: parseBool,
    };
});