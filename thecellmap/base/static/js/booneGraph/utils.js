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
    
    var onGraphContext = function() {
        $('#contextmenu-graph-container').show().delay(2000).hide(200);
        $('#contextmenu-graph-container').css({ left : mouseX, top : mouseY, });
    }
    
    var onNodesContext = function(targets) {
        state.set('hoveredTargets', targets.content);
        $('#contextmenu-container').show().delay(2000).hide(200);
        $('#contextmenu-container').css({ left : mouseX, top : mouseY, });
    }
    
    var onNodeDblClick = function(targets) {
        var strain = getStrain(targets[0] || targets.content[0]);
        setTimeout(function() {open('http://www.yeastgenome.org/search?is_quick=true&q=' + strain.get('orf'))}, 150);
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
    }
    
    var clearSelectionCanvas = function() {
        $('.sigma_mouse_canvas')[0].getContext('2d').clearRect(0, 0, $(document).width(), $(document).height());
    }
    
    var graphSelectedNodes = function(direct) {
        if (state.get('showCircular')) return;
        
        var nodes = sigInst._core.graph.nodes.filter(function(node) {
            return node.selected;
        });
        
        if (!direct) {
            sigInst.locateSearchedNodes({nodes: nodes, runtime: 0});
        } else {
            sigInst.drawSearchedNodesDirect({nodes: nodes, context: direct});
        }
    }
    
    var getSelectedNodes = function(getHidden, getPrevious) {
        if (state.get('isInitializing')) return;
        
        var selected = getSelection(), map, annotations = [], result, byAnnot = {};
        var i, j, selectedByAnnotation = {}, strain, node;
        
        if (getPrevious) selected = getSelection().length > 0 ? getSelection() : state.get('preselect');
        
        if (vizdata['annotations'].get(state.get('annotation'))) {
            map = vizdata['annotations'].get(state.get('annotation')).get('map');
            
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
                            if ($.inArray(map[i][j], annotations) >= 0 && !selectedByAnnotation.hasOwnProperty(i)) {
                                selectedByAnnotation[i] = null;
                            }
                        }
                    }
                }
            }
        }
        
        result = selected.filter(function(sel) {
            return !_str.startsWith(sel, 'annot') && !_str.startsWith(sel, 'action');
        });
        
        vizdata['strains']['models'].forEach(function(strain) {
            if (selectedByAnnotation.hasOwnProperty(strain.get('orf'))) {
                result.push(strain.get('id') + '');
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
    
    var hexToRgb = function(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    var hexToStringRgba = function(hex, alpha) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? "rgba(" + parseInt(result[1], 16) + ", " + parseInt(result[2], 16) + ", " + parseInt(result[3], 16) + ", " + alpha + ")": null;
    }
    
    /**
     * HSV to RGB color conversion
     *
     * H runs from 0 to 360 degrees
     * S and V run from 0 to 100
     * 
     * Ported from the excellent java algorithm by Eugene Vishnevsky at:
     * http://www.cs.rit.edu/~ncs/color/t_convert.html
     */
    var hsvToRgb = function (h, s, v) {
        var r, g, b;
        var i;
        var f, p, q, t;
        
        // Make sure our arguments stay in-range
        h = Math.max(0, Math.min(360, h));
        s = Math.max(0, Math.min(100, s));
        v = Math.max(0, Math.min(100, v));
        
        // We accept saturation and value arguments from 0 to 100 because that's
        // how Photoshop represents those values. Internally, however, the
        // saturation and value are calculated from a range of 0 to 1. We make
        // That conversion here.
        s /= 100;
        v /= 100;
        
        if(s == 0) {
            // Achromatic (grey)
            r = g = b = v;
            return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
        }
        
        h /= 60; // sector 0 to 5
        i = Math.floor(h);
        f = h - i; // factorial part of h
        p = v * (1 - s);
        q = v * (1 - s * f);
        t = v * (1 - s * (1 - f));

        switch(i) {
            case 0:
                r = v;
                g = t;
                b = p;
                break;
                
            case 1:
                r = q;
                g = v;
                b = p;
                break;
                
            case 2:
                r = p;
                g = v;
                b = t;
                break;
                
            case 3:
                r = p;
                g = q;
                b = v;
                break;
                
            case 4:
                r = t;
                g = p;
                b = v;
                break;
                
            default: // case 5:
                r = v;
                g = p;
                b = q;
        }
        
        return '#' + (
                ("0" + Math.round(r * 255).toString(16)).slice(-2) +
                ("0" + Math.round(g * 255).toString(16)).slice(-2) +
                ("0" + Math.round(b * 255).toString(16)).slice(-2)
        ).toUpperCase();
    };
    
    var stripLetters = function(s) {
        return s.match(/\d/g).join('');
    };
    
    var cleanUpNodes = function() {
        sigInst.iterNodes(function(node) {
            if (node.id.indexOf('tmp_') != -1) sigInst.dropNode(node.id);
        });
    };
    
    var messageUser = function(text, target, missingNodes) {
        var alert = $('<div class="alert alert-danger fade in"> \
                <button class="close" aria-hidden="true" data-dismiss="alert" type="button">x</button> \
                ' + text + ' \
              </div>');
        
        if (!!target) {
            $('#' + target).empty().append(alert);
        } else {
            $('#panel-alerts').empty();
            
            alert.on('close.bs.alert', function() {
                $('#panel-alerts').hide();
            });
            
            if (missingNodes) {
                alert.append('<br><a href="#"> Click here to extract the similarity network for the selected gene(s) at a lower PCC threshold</a>');
                alert.find('a').on('click', function(e) {
                    alert.alert('close'); 
                    if (!target) $('#panel-alerts').hide();
                    state.set('missingNodes', missingNodes);
                    e.preventDefault();
                });
            }
            
            $('#panel-alerts').append(alert).show();
        }
        
        alert.alert();
//        setTimeout(function() { 
//            alert.alert('close'); 
//            if (!target) $('#panel-alerts').hide();
//        }, 6000);
    };
    
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
    };
    
    var parseBool = function(bool) {
        if (typeof bool == 'boolean') return bool;
        return bool == 'true';
    };
    
    var updateUrl = function(type) {
        var selection = state.get('selection'), selStr = '';
        
        sigInst.iterNodes(function(node) {
            if ($.inArray(node.id + '', selection) >= 0) {
                if (selStr.length) selStr += ',';
                selStr += node.label.toLowerCase();
            }
        });
        
        if (!selStr.length) selStr = 'null';
        
//        var urlNew = opts.url + '?q=' + selStr + '&' + 'a=' + state.get('annotation');
        var urlNew = opts.url + '?q=' + selStr;
        window.history.pushState({}, 'TheCellMap', encodeURI(urlNew));
    };
    
    var sbcRip = function(d){
        var l=d.length,RGB=new Object(),i=parseInt;
        if(l>9){
            d=d.split(",");
            if(d.length<3||d.length>4)return null;//ErrorCheck
            RGB[0]=i(d[0].slice(4)),RGB[1]=i(d[1]),RGB[2]=i(d[2]),RGB[3]=d[3]?parseFloat(d[3]):-1;
        }else{
            if(l==8||l==6||l<4)return null; //ErrorCheck
            if(l<6)d="#"+d[1]+d[1]+d[2]+d[2]+d[3]+d[3]+(l>4?d[4]+""+d[4]:""); //3 digit
            d=i(d.slice(1),16),RGB[0]=d>>16&255,RGB[1]=d>>8&255,RGB[2]=d&255,RGB[3]=l==9||l==5?r(((d>>24&255)/255)*10000)/10000:-1;
        }
        return RGB;
    };
    
    var shadeBlendConvert = function(p, from, to) {
        if(typeof(p)!="number"||p<-1||p>1||typeof(from)!="string"||(from[0]!='r'&&from[0]!='#')||(typeof(to)!="string"&&typeof(to)!="undefined"))return null; //ErrorCheck
        var r=Math.round,h=from.length>9,h=typeof(to)=="string"?to.length>9?true:to=="c"?!h:false:h,b=p<0,p=b?p*-1:p,to=to&&to!="c"?to:b?"#000000":"#FFFFFF",f=sbcRip(from),t=sbcRip(to);
        if(!f||!t)return null; //ErrorCheck
        if(h)return "rgb("+r((t[0]-f[0])*p+f[0])+","+r((t[1]-f[1])*p+f[1])+","+r((t[2]-f[2])*p+f[2])+(f[3]<0&&t[3]<0?")":","+(f[3]>-1&&t[3]>-1?r(((t[3]-f[3])*p+f[3])*10000)/10000:t[3]<0?f[3]:t[3])+")");
        else return "#"+(0x100000000+(f[3]>-1&&t[3]>-1?r(((t[3]-f[3])*p+f[3])*255):t[3]>-1?r(t[3]*255):f[3]>-1?r(f[3]*255):255)*0x1000000+r((t[0]-f[0])*p+f[0])*0x10000+r((t[1]-f[1])*p+f[1])*0x100+r((t[2]-f[2])*p+f[2])).toString(16).slice(f[3]>-1||t[3]>-1?1:3);
    };
    
    var boundingBox = function(nodes) {
        var xmax, xmin, ymax, ymin, box = {};
        nodes.forEach(function(n) {
            xmax = !xmax ? n.x : Math.max(xmax, n.x);
            xmin = !xmin ? n.x : Math.min(xmin, n.x);
            ymax = !ymax ? n.y : Math.max(ymax, n.y);
            ymin = !ymin ? n.y : Math.min(ymin, n.y);
        });
        box.w = Math.abs(xmax - xmin);
        box.h = Math.abs(ymax - ymin);
        box.xmax = xmax;
        box.xmin = xmin;
        box.ymax = ymax;
        box.ymin = ymin;
        return box;
    };
    
    var sheet_to_array = function(reader, sheet) {
        var out = [], txt = "", qreg = /"/g;
        if(sheet == null || sheet["!ref"] == null) return "";
        var r = reader.utils.decode_range(sheet["!ref"]);
        var row, rr = "", cols = [];
        var i = 0, cc = 0, val;
        var R = 0, C = 0;
        for(C = r.s.c; C <= r.e.c; ++C) cols[C] = reader.utils.encode_col(C);
        for(R = r.s.r; R <= r.e.r; ++R) {
            row = [];
            rr = reader.utils.encode_row(R);
            for(C = r.s.c; C <= r.e.c; ++C) {
                val = sheet[cols[C] + rr];
                row.push(val !== undefined ? '' + reader.utils.format_cell(val) : "");
            }
            out.push(row);
        }
        return out;
    };
    
    var randomColors = function (total) {
        var i = 360 / (total - 1); // distribute the colors evenly on the hue range
        var r = []; // hold the generated colors
        for (var x=0; x<total; x++)
        {
            r.push(hsvToRgb(i * x, 100, 100)); // you can also alternate the saturation and value for even more contrast between the colors
        }
        return r;
    };
    
    return {
        iterVisibleNodes: iterVisibleNodes,
        iterVisibleEdges: iterVisibleEdges,
        nodeExists: nodeExists,
        edgeExists: edgeExists,
        onGraphContext: onGraphContext,
        onNodesContext: onNodesContext,
        onNodeDblClick: onNodeDblClick,
        countVisibleNodes: countVisibleNodes,
        countVisibleEdges: countVisibleEdges,
        getNode: getNode,
        getEdge: getEdge,
        getStrain: getStrain,
        getSelection: getSelection,
        
        clearSelection: clearSelection,
        clearSelectionCanvas: clearSelectionCanvas,
        graphSelectedNodes: graphSelectedNodes,
        getSelectedNodes: getSelectedNodes,
        
        stackNetworks: stackNetworks,
        graphCenter: graphCenter,
        
        getUnique: getUnique,
        rgbToHex: rgbToHex,
        hexToRgb: hexToRgb,
        hexToStringRgba: hexToStringRgba,
        shadeBlendConvert: shadeBlendConvert,
        
        cleanUpNodes: cleanUpNodes,
        messageUser: messageUser,
        stripLetters: stripLetters,
        alertUser: alertUser,
        parseBool: parseBool,
        boundingBox: boundingBox,
        
        updateUrl: updateUrl,
        
        sheet_to_array: sheet_to_array,
        randomColors: randomColors, 
    };
});