define([
    'jquery',
    'underscore',
    'backbone',
    
    'build',
    'utils',
    
    'leap',
    'three',
], function($, _, Backbone, Build, Utils) {
    var rotateXLast         = null;
    var rotateYLast         = null;
    var zoomZLast           = null;
    var selectLast          = null;
    var gesture             = null;
    var elapse              = null;
    
    var step                = null;
    var regions             = [], nodes = [];
    
    var init = function() {
        step = (three['camera'].position.z == 0 ? Math.pow(10, (Math.log(three['camera'].near) + Math.log(three['camera'].far))/Math.log(10))/10.0 : three['camera'].position.z);
        
        elapse = {
            'gesture': opts['timeGesture'],
            'select': opts['timeSelect'],
            'uiHide': 0,
            'uiExtract': 0,
        }
        
        for (var i in three['scene'].children) {
            if (three['scene'].children[i].name != 'default' && three['scene'].children[i].type == 'Mesh') {
                regions.push(three['scene'].children[i]);
            }
        }
        
        state['isInitializing'] = false;
    }
    
    var applyGesture = function(frame, action) {
        var hl = frame.hands.length, fl = 0;
        for (p in frame.pointables) {
            if (frame.pointables[p].extended) fl++;
        }
        switch(action) {
        case 'rotate':
            if (opts['rotateHands'] == hl && opts['rotateFingers'][0] <= fl && fl <= opts['rotateFingers'][1]) return true;
            break;
        case 'zoom':
            if (opts['zoomHands'] == hl && opts['zoomFingers'][0] <= fl && fl <= opts['zoomFingers'][1]) return true;
            break;
        case 'select':
            if (opts['selectHands'] == hl && opts['selectHands'] == fl) return true;
            break;
        }
        return false;
    }
    
    var transformFactor = function(action) {
        switch(action) {
        case 'rotate':
            return opts['rotateSpeed'] * (opts['rotateHandPosition'] ? 1 : 2);
        case 'zoom':
            return opts['zoomSpeed'] * (opts['zoomHandPosition'] ? 1 : 2);
        }
    }
    
    var rotateTransform = function(delta) {
        return transformFactor('rotate') * THREE.Math.mapLinear(delta, -400, 400, -Math.PI, Math.PI);
    }
    
    var zoomTransform = function(delta) {
        return transformFactor('zoom') * THREE.Math.mapLinear(delta, -400, 400, -step, step);
    }
    
    var getHand = function(frame, action) {
        var hds = frame.hands;
        if (hds.length > 0) {
            if (hds.length == 1) {
                return hds[0];
            } else if (hds.length == 2) {
                var lh, rh;
                if (hds[0].palmPosition[0] < hds[1].palmPosition[0]) {
                    lh = hds[0];
                    rh = hds[1];
                } else {
                    lh = hds[1];
                    rh = hds[0];
                }
                switch(action) {
                case 'rotate':
                    if (opts['rotateRightHanded']) {
                        return rh;
                    } else {
                        return lh;
                    }
                case 'zoom':
                    if (opts['zoomRightHanded']) {
                        return rh;
                    } else {
                        return lh;
                    }
                case 'select':
                    if (opts['selectRightHanded']) {
                        return rh;
                    } else {
                        return lh;
                    }
                }
            }
        }
        return false;
    }
    
    var getPosition = function(frame, action) {
        var h;
        switch(action) {
        case 'rotate':
            h = getHand(frame, 'rotate');
            return (opts['rotateHandPosition'] 
                ? (opts['rotateStabilized'] ? h.stabilizedPalmPosition : h.palmPosition) 
                : (opts['rotateStabilized'] ? frame.pointables[0].stabilizedTipPosition : frame.pointables[0].tipPosition)
            )
        case 'zoom':
            h = getHand(frame, 'zoom');
            return (opts['zoomHandPosition'] 
                ? (opts['zoomStabilized'] ? h.stabilizedPalmPosition : h.palmPosition) 
                : (opts['zoomStabilized'] ? frame.pointables[0].stabilizedTipPosition : frame.pointables[0].tipPosition)
            )
        case 'select':
            h = getHand(frame, 'select');
            return (opts['selectHandPosition'] 
                ? (opts['selectStabilized'] ? h.stabilizedPalmPosition : h.palmPosition) 
                : (opts['selectStabilized'] ? frame.pointables[0].stabilizedTipPosition : frame.pointables[0].tipPosition)
            )
        }
    }
    
    var rotateCamera = function(frame) {
        if (applyGesture(frame, 'rotate')) {
            var target = new THREE.Vector3(0, 0, 0);
            
            var y = getPosition(frame, 'rotate')[1];
            if (!rotateYLast) rotateYLast = y;
            var yDelta = y - rotateYLast;
            var t = new THREE.Vector3().subVectors(three['camera'].position, target); // translate
            angleDelta = rotateTransform(yDelta);
            newAngle = t.angleTo(new THREE.Vector3(0, 1, 0)) + angleDelta;
            if (opts['rotateMin'] < newAngle && newAngle < opts['rotateMax']) {
                var n = new THREE.Vector3(t.z, 0, -t.x).normalize();
                var matrixX = new THREE.Matrix4().makeRotationAxis(n, angleDelta);
                var trans = t.applyMatrix4(matrixX).add(target);
                three['camera'].position.set(trans.x, trans.y, trans.z);
            }
            
            var x = getPosition(frame, 'rotate')[0];
            if (!rotateXLast) rotateXLast = x;
            var xDelta = x - rotateXLast;
            var matrixY = new THREE.Matrix4().makeRotationY(-rotateTransform(xDelta));
            
            three['camera'].position.sub(target).applyMatrix4(matrixY).add(target); // translate, rotate and translate back
            three['camera'].lookAt(target);
            
            rotateXLast = x;
            rotateYLast = y;
        } else {
            rotateXLast = null;
            rotateYLast = null;
        }
        zoomZLast = null;
    }
    
    var zoomCamera = function(frame) {
        if (applyGesture(frame, 'zoom')) {
            var target = new THREE.Vector3(0, 0, 0);
            var z = getPosition(frame, 'zoom')[0];
            if (!zoomZLast) zoomZLast = z;
            var zDelta = z - zoomZLast;
            var t = new THREE.Vector3().subVectors(three['camera'].position, target);
            lengthDelta = zoomTransform(zDelta);
            newLength = t.length() - lengthDelta;
            if (opts['zoomMin'] < newLength && newLength < opts['zoomMax']) {
                t.normalize().multiplyScalar(lengthDelta);
                three['camera'].position.sub(t);
                opts['zoomSpeed'] = Math.log(Math.abs(three['camera'].position.z))/Math.log(10);
            }
            
            if (state['showTerm']) {
                var dist = three['camera'].position.distanceTo(new THREE.Vector3(0, 0, 0));
                if (dist > (three['termCloud']['radius'] * 9)) {
                    var alpha = (dist - 8 * three['termCloud']['radius']) / (three['termCloud']['radius']);
                    three['renderer'].setClearColor(0x222222, alpha);
                    
                    if (alpha >= 7) {
                        Utils.clearScene();
                        three['renderer'].setClearColor(0x222222, 1);
                        Build.buildNodes();
                        Build.buildEdges();
                        state['showTerm'] = false;
                    }
                } else {
                    three['renderer'].setClearColor(0x222222, 1);
                }
            }
            
            zoomZLast = z;
        } else {
            zoomZLast = null;
        }
        rotateXLast = null;
        rotateYLast = null;
    }
    
    var selectCamera = function(frame) {
        if (applyGesture(frame, 'select')) {
            var windowWidth = opts['rootElement'].width(), windowHeight = opts['rootElement'].height();
            var position = getPosition(frame, 'select');
            var width = 117.5, height = 317.5, minHeight = 82.5; //Leap bounding box in mm relative to the controller
            var ftx = (position[0] > width ? width - 1 : (position[0] < -width ? -width + 1 : position[0]));
            var fty = (position[1] > height ? height - 1 : (position[1] < minHeight ? minHeight + 1 : position[1]));
            var x = THREE.Math.mapLinear(ftx, -width, width, 0, windowWidth);
            var y = THREE.Math.mapLinear(fty, height, minHeight, 0, windowHeight);
            
            var vector = new THREE.Vector3();
            vector.set((x / windowWidth) * 2 - 1, -(y / windowHeight) * 2 + 1, 0.5);
            vector.unproject(three['uiCamera']);
            var dir = vector.sub(three['uiCamera'].position).normalize();
            var distance = -three['uiCamera'].position.z / dir.z;
            var pos = three['uiCamera'].position.clone().add(dir.multiplyScalar(distance));
            
            three['cursor'].material.visible = true;
            three['cursor'].position.set(pos['x'], pos['y'], pos['z']);
            
            if (state['showUI']) toggleUI(frame, pos['x'], pos['y']);
            if (!state['showTerm']) {
                getSelection(frame, x, y);
            } else {
                getNodes(frame, x, y);
            }
        }
        rotateXLast = null;
        rotateYLast = null;
        zoomZLast = null;
    }
    
    var getNodes = function(frame, x, y) {
        var raycaster = new THREE.Raycaster(), intersects;
        raycaster.setFromCamera(new THREE.Vector2((x / opts['rootElement'].width()) * 2 - 1, - (y / opts['rootElement'].height()) * 2 + 1), three['camera']);
        
        intersects = raycaster.intersectObjects(nodes);
        if (intersects.length > 0) {
            var obj = intersects[0].object;
            three['cursor'].position.set(obj.position.x, obj.position.y, obj.position.z);
        }
    }
    
    var getSelection = function(frame, x, y) {
        var raycaster = new THREE.Raycaster(), intersects;
        var term = selectLast ? selectLast.name.replace(/\D/g,'') : '';
        
        raycaster.setFromCamera(new THREE.Vector2((x / opts['rootElement'].width()) * 2 - 1, - (y / opts['rootElement'].height()) * 2 + 1), three['camera']);
        elapseFrame('select', frame);
        
        if (state['showUI']) {
            intersects = raycaster.intersectObjects(three['ui'].children);
            if (intersects.length > 0) {
                if (intersects[0].object.name == 'extract') {
                    elapseFrame('uiExtract', frame);
                    if (elapse['uiExtract'] > opts['timeUIExtract']) {
                        Build.extractTerm(term);
                        
                        for (var i in three['scene'].children) {
                            if (three['scene'].children[i].type == 'Node') {
                                nodes.push(three['scene'].children[i]);
                            }
                        }
                        
                        elapse['uiExtract'] = 0;
                        state['showTerm'] = true;
                        state['showUI'] = false;
                    }
                } else {
                    elapse['uiExtract'] = 0;
                }
                elapse['uiHide'] = 0;
            } else {
                elapse['uiExtract'] = 0;
                elapseFrame('uiHide', frame);
                
                if (elapse['uiHide'] > opts['timeUIHide']) {
                    elapse['uiHide'] = 0;
                    state['showUI'] = false;
                    Utils.clearUI();
                }
            }
        } else {
            intersects = raycaster.intersectObjects(regions);
            if (intersects.length > 0) {
                var obj = three['scene'].getObjectByName('edges' + term);
                if (selectLast != intersects[0].object && elapse['select'] > opts['timeSelect']) { //Change selection
                    selectLast = intersects[0].object;
                    selectLast.material.opacity = opts['edgeOpacity'];
                    selectLast.material.linewidth = opts['edgeWidth'];
                    elapse['select'] = 0;
                } else if (!!selectLast) { //No change in selection
                    if (elapse['select'] < opts['timeUIShow']) {
                        if (obj.material.opacity < 1 && obj.material.linewidth < 1) {
                            obj.material.opacity += 0.005;
                            obj.material.linewidth += 0.005;
                        }
                    } else { //Show UI
                        state['showUI'] = true;
                        Build.buildSelect(term);
                    }
                }
            } else { //No selection
                if (!!selectLast && elapse['select'] > opts['timeSelect']) { //Clear previous selections
                    selectLast.material.opacity = opts['edgeOpacity'];
                    selectLast.material.linewidth = opts['edgeWidth'];
                    elapse['select'] = 0;
                    selectLast = null;
                }
            }
        }
    }
    
    var toggleUI = function(frame, x, y) {
        var dir = new THREE.Vector2(x - state['uiCoord']['x'], y - state['uiCoord']['y']);
        var theta = Math.atan2(x - state['uiCoord']['x'], y - state['uiCoord']['y']);
        var obj = three['ui'].getObjectByName('extract');
        
        if (!!obj) {
            if (1/2 * Math.PI <= theta && theta <= 5/6 * Math.PI && dir.length() >= (Math.max(obj.scale.x, obj.scale.y) / 2)) {
                if (!obj.visible) obj.visible = true;
                if (obj.material.opacity < 1) obj.material.opacity += 0.05;
            } else {
                if (obj.material.opacity > 0) obj.material.opacity -= 0.05;
            }
        }
    }
    
    var elapseFrame = function(type, frame) {
        elapse[type] += controller.frame(1).valid ? frame.timestamp - controller.frame(1).timestamp : 0
    }
    
    var update = function(frame) {
        var hl = frame.hands.length;
        var fl = Utils.iterFingers(frame);
        
        elapseFrame('gesture', frame);
        
        if (elapse['gesture'] > opts['timeGesture'] || gesture == null) {
            if (hl == 1 && fl['count'] == 1 && fl['extended'][0] == 1) {
                gesture = 'select';
            } else if (hl == 1) {
                gesture = 'rotate';
            } else if (hl == 2) {
                gesture = 'zoom';
            }
            elapse['gesture'] = 0;
        }
        switch(gesture) {
        case 'select':
            selectCamera(frame);
            break;
        case 'rotate':
            rotateCamera(frame);
            break;
        case 'zoom':
            zoomCamera(frame);
            break;
        }
    }
    
    return {
        init: init,
        update: update,
    }
});