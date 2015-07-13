/*
 * @author Torsten Sprenger / http://torstensprenger.com
 *
 * Leap Camera Controls (http://leapmotion.com)
 * 
 */

THREE.LeapCameraControls = function(camera, scene, ui) {
  var _this = this;

  this.camera             = camera;
  this.scene              = scene;
  this.ui                 = ui;
  this.raycaster          = new THREE.Raycaster();
  
  this.modeThreshhold     = 500000;
  this.selectThreshhold   = 500000;
  this.guiThreshhold      = 3000000;
  
  this.updateTerm         = null;
  this.state              = 'network';
  
  // api
  this.enabled      = true;
  this.target       = new THREE.Vector3(0, 0, 0);
  this.step         = (camera.position.z == 0 ? Math.pow(10, (Math.log(camera.near) + Math.log(camera.far))/Math.log(10))/10.0 : camera.position.z);
  this.fingerFactor = 2;

  // `...Hands`       : integer or range given as an array of length 2
  // `...Fingers`     : integer or range given as an array of length 2
  // `...RightHanded` : boolean indicating whether to use left or right hand for controlling (if number of hands > 1)
  // `...HandPosition`: boolean indicating whether to use palm position or finger tip position (if number of fingers == 1)
  // `...Stabilized`  : boolean indicating whether to use stabilized palm/finger tip position or not

  // rotation
  this.rotateEnabled       = true;
  this.rotateSpeed         = 1.0;
  this.rotateHands         = 1;
  this.rotateFingers       = [2, 3]; 
  this.rotateRightHanded   = true;
  this.rotateHandPosition  = true;
  this.rotateStabilized    = true;
  this.rotateMin           = 0;
  this.rotateMax           = Math.PI;
  
  // zoom
  this.zoomEnabled         = true;
  this.zoomSpeed           = 1.0;
  this.zoomHands           = 2;
  this.zoomFingers         = [6, 12];
  this.zoomRightHanded     = true;
  this.zoomHandPosition    = true;
  this.zoomStabilized      = true;
  this.zoomMin             = _this.camera.near;
  this.zoomMax             = _this.camera.far;
  
  // select
  this.selectEnabled         = true;
  this.selectHands           = 1;
  this.selectFingers         = 1;
  this.selectRightHanded     = true;
  this.selectHandPosition    = false;
  this.selectStabilized      = true;
  
  // internals
  var _rotateXLast         = null;
  var _rotateYLast         = null;
  var _zoomZLast           = null;
  var _selectLast          = null;
  
  var _mode                = null;
  var _modeElapse          = 0;
  var _selectElapse        = 0;
  
  var clouds = [], lines = {}, meshes = {};
  for (var i in _this.scene.children) {
      var obj = _this.scene.children[i];
      if (obj.name != 'default' && obj.type == 'Mesh') {
          clouds.push(obj);
          meshes[obj.name] = obj;
      } else if (obj.name != 'default' && obj.type == 'Line') {
          lines[obj.name] = obj;
      }
  }
  
  // helpers
  this.transformFactor = function(action) {
    switch(action) {
      case 'rotate':
        return _this.rotateSpeed * (_this.rotateHandPosition ? 1 : _this.fingerFactor);
      case 'zoom':
        return _this.zoomSpeed * (_this.zoomHandPosition ? 1 : _this.fingerFactor);
    };
  };

  this.rotateTransform = function(delta) {
    return _this.transformFactor('rotate') * THREE.Math.mapLinear(delta, -400, 400, -Math.PI, Math.PI);
  };

  this.zoomTransform = function(delta) {
    return _this.transformFactor('zoom') * THREE.Math.mapLinear(delta, -400, 400, -_this.step, _this.step);
  };

  this.applyGesture = function(frame, action) {
    var hl = frame.hands.length, fl = 0;
    for (p in frame.pointables) {
        if (frame.pointables[p].extended) fl++;
    }
    switch(action) {
      case 'rotate':
        if (_this.rotateHands instanceof Array) {
          if (_this.rotateFingers instanceof Array) {
            if (_this.rotateHands[0] <= hl && hl <= _this.rotateHands[1] && _this.rotateFingers[0] <= fl && fl <= _this.rotateFingers[1]) return true;
          } else {
            if (_this.rotateHands[0] <= hl && hl <= _this.rotateHands[1] && _this.rotateFingers == fl) return true;
          };
        } else {
          if (_this.rotateFingers instanceof Array) {
            if (_this.rotateHands == hl && _this.rotateFingers[0] <= fl && fl <= _this.rotateFingers[1]) return true;
          } else {
            if (_this.rotateHands == hl && _this.rotateFingers == fl) return true;
          };
        };
        break;
      case 'zoom':
        if (_this.zoomHands instanceof Array) {
          if (_this.zoomFingers instanceof Array) {
            if (_this.zoomHands[0] <= hl && hl <= _this.zoomHands[1] && _this.zoomFingers[0] <= fl && fl <= _this.zoomFingers[1]) return true;
          } else {
            if (_this.zoomHands[0] <= hl && hl <= _this.zoomHands[1] && _this.zoomFingers == fl) return true;
          };
        } else {
          if (_this.zoomFingers instanceof Array) {
            if (_this.zoomHands == hl && _this.zoomFingers[0] <= fl && fl <= _this.zoomFingers[1]) return true;
          } else {
            if (_this.zoomHands == hl && _this.zoomFingers == fl) return true;
          };
        };
        break;
      case 'select':
        if (_this.selectHands instanceof Array) {
          if (_this.selectFingers instanceof Array) {
            if (_this.selectHands[0] <= hl && hl <= _this.selectHands[1] && _this.selectFingers[0] <= fl && fl <= _this.selectFingers[1]) return true;
          } else {
            if (_this.selectHands[0] <= hl && hl <= _this.selectHands[1] && _this.selectFingers == fl) return true;
          };
        } else {
          if (_this.selectFingers instanceof Array) {
            if (_this.selectHands == hl && _this.selectFingers[0] <= fl && fl <= _this.selectFingers[1]) return true;
          } else {
            if (_this.selectHands == hl && _this.selectFingers == fl) return true;
          };
        };
        break;
    };

    return false;
  };

  this.hand = function(frame, action) {
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
            if (_this.rotateRightHanded) {
              return rh;
            } else {
              return lh;
            };
          case 'zoom':
            if (_this.zoomRightHanded) {
              return rh;
            } else {
              return lh;
            };
          case 'select':
            if (_this.selectRightHanded) {
              return rh;
            } else {
              return lh;
            };
        };
      };
    };

    return false;
  };

  this.position = function(frame, action) {
    // assertion: if `...HandPosition` is false, then `...Fingers` needs to be 1 or [1, 1]
    var h;
    switch(action) {
      case 'rotate':
        h = _this.hand(frame, 'rotate');
        return (_this.rotateHandPosition 
          ? (_this.rotateStabilized ? h.stabilizedPalmPosition : h.palmPosition) 
          : (_this.rotateStabilized ? frame.pointables[0].stabilizedTipPosition : frame.pointables[0].tipPosition)
        );
      case 'zoom':
        h = _this.hand(frame, 'zoom');
        return (_this.zoomHandPosition 
          ? (_this.zoomStabilized ? h.stabilizedPalmPosition : h.palmPosition) 
          : (_this.zoomStabilized ? frame.pointables[0].stabilizedTipPosition : frame.pointables[0].tipPosition)
        );
      case 'select':
        h = _this.hand(frame, 'select');
        return (_this.selectHandPosition 
          ? (_this.selectStabilized ? h.stabilizedPalmPosition : h.palmPosition) 
          : (_this.selectStabilized ? frame.pointables[0].stabilizedTipPosition : frame.pointables[0].tipPosition)
        );
    };
  };

  // methods
  this.rotateCamera = function(frame) {
    if (_this.rotateEnabled && _this.applyGesture(frame, 'rotate')) {
      // rotate around axis in xy-plane (in target coordinate system) which is orthogonal to camera vector
      var y = _this.position(frame, 'rotate')[1];
      if (!_rotateYLast) _rotateYLast = y;
      var yDelta = y - _rotateYLast;
      var t = new THREE.Vector3().subVectors(_this.camera.position, _this.target); // translate
      angleDelta = _this.rotateTransform(yDelta);
      newAngle = t.angleTo(new THREE.Vector3(0, 1, 0)) + angleDelta;
      if (_this.rotateMin < newAngle && newAngle < _this.rotateMax) {
        var n = new THREE.Vector3(t.z, 0, -t.x).normalize();
        var matrixX = new THREE.Matrix4().makeRotationAxis(n, angleDelta);
        var trans = t.applyMatrix4(matrixX).add(_this.target);
        _this.camera.position.x = trans.x;
        _this.camera.position.y = trans.y;
        _this.camera.position.z = trans.z;
      };

      // rotate around y-axis translated by target vector
      var x = _this.position(frame, 'rotate')[0];
      if (!_rotateXLast) _rotateXLast = x;
      var xDelta = x - _rotateXLast;
      var matrixY = new THREE.Matrix4().makeRotationY(-_this.rotateTransform(xDelta));
      _this.camera.position.sub(_this.target).applyMatrix4(matrixY).add(_this.target); // translate, rotate and translate back
      _this.camera.lookAt(_this.target);
      
      _rotateYLast = y;
      _rotateXLast = x;
      _zoomZLast   = null;
    } else {
      _rotateYLast = null;
      _rotateXLast = null;
    };
    
    $('#cursor').css('left', '-54px');
    $('#cursor').css('top', '-54px');
  };

  this.zoomCamera = function(frame) {
    if (_this.zoomEnabled && _this.applyGesture(frame, 'zoom')) {
      var z = _this.position(frame, 'zoom')[0];
      if (!_zoomZLast) _zoomZLast = z;
      var zDelta = z - _zoomZLast;
      var t = new THREE.Vector3().subVectors(_this.camera.position, _this.target);
      lengthDelta = _this.zoomTransform(zDelta);
      newLength = t.length() - lengthDelta;
      if (_this.zoomMin < newLength && newLength < _this.zoomMax) {
        t.normalize().multiplyScalar(lengthDelta);
        _this.camera.position.sub(t);
        _this.zoomSpeed = Math.log(Math.abs(_this.camera.position.z))/Math.log(10);
      };
      _zoomZLast   = z;
    } else {
      _zoomZLast = null;
    };
    _rotateXLast = null;
    _rotateYLast = null;
    
    $('#cursor').css('left', '-1px');
    $('#cursor').css('top', '-1px');
  };

  this.selectCamera = function(frame) {
      if (_this.selectEnabled && _this.applyGesture(frame, 'select')) {
          var windowWidth = state['rootElement'].width(), windowHeight = state['rootElement'].height();
          
          var position = _this.position(frame, 'select');
          var width = 117.5, height = 317.5, minHeight = 82.5; //Leap bounding box in mm relative to the controller
          var ftx = (position[0] > width ? width - 1 : (position[0] < -width ? -width + 1 : position[0]));
          var fty = (position[1] > height ? height - 1 : (position[1] < minHeight ? minHeight + 1 : position[1]));
          var x = THREE.Math.mapLinear(ftx, -width, width, 0, windowWidth);
          var y = THREE.Math.mapLinear(fty, height, minHeight, 0, windowHeight);
          
          var vector = new THREE.Vector3();
          vector.set((x / windowWidth) * 2 - 1, -(y / windowHeight) * 2 + 1, 0.5);
          vector.unproject(camera);
          var dir = vector.sub( camera.position ).normalize();
          var distance = - camera.position.z / dir.z;
          var pos = camera.position.clone().add( dir.multiplyScalar( distance ) );
          
          var cursor = _this.ui.getObjectByName('cursor');
          cursor.material.opacity = 1;
          cursor.position.set(pos['x'], pos['y'], pos['z']);
          
          _this.raycaster.setFromCamera( new THREE.Vector2(( x / windowWidth ) * 2 - 1, - ( y / windowHeight ) * 2 + 1), _this.camera );
          
          var intersects = _this.raycaster.intersectObjects(clouds);
          if (_this.state == 'network') {
              if (intersects.length > 0) {
                  if (controller.frame(1).valid) _selectElapse += frame.timestamp - controller.frame(1).timestamp;
                  
                  if (intersects[0].object != _selectLast && _selectElapse > _this.selectThreshhold) {
                      if (_selectLast) {
                          lines[_selectLast.name].material.opacity = 0.3;
                          lines[_selectLast.name].material.lineWidth = 0.25;
//                          $('#cursor').css('background', '#E3E3E3');
                      }
                      _selectLast = intersects[0].object;
                  } else if (_selectLast) {
                      if (_selectElapse < _this.guiThreshhold) {
                          lines[_selectLast.name].material.opacity += 0.005;
                          lines[_selectLast.name].material.lineWidth += 0.0025;
//                          $('#cursor').css('background', '#' + lines[_selectLast.name].material.color.getHexString())
                          
                      } else {
                          _this.updateTerm = _selectLast.name;
                      }
                  }
              } else {
                  if (_selectLast) {
                      lines[_selectLast.name].material.opacity = 0.3;
                      lines[_selectLast.name].material.lineWidth = 0.25;
//                      $('#cursor').css('background', '#E3E3E3');
                  }
              }
          }
          
          _rotateXLast = null;
          _rotateYLast = null;
      };
  }
  
  function toScreenPosition(obj) {
      var vector = new THREE.Vector3(obj.x, obj.y, obj.z);
      vector.project(_this.camera);
      vector.x = (vector.x + 1) / 2 * state['rootElement'].width();
      vector.y = -(vector.y + 1) / 2 * state['rootElement'].height();
      return { x: vector.x, y: vector.y };
  };

  this.update = function(frame) {
      var hl = frame.hands.length, fl = 0;
      for (p in frame.pointables) {
          if (frame.pointables[p].extended) fl++;
      }
      if (controller.frame(1).valid) _modeElapse += frame.timestamp - controller.frame(1).timestamp;
      
      if (_this.enabled) {
          if (_modeElapse > _this.modeThreshhold || _this.mode == null) {
              if (hl == 1 && fl == 1) {
                  _this.mode = 'select';
              } else if (hl == 1) {
                  _this.mode = 'rotate';
              } else {
                  _this.mode = 'zoom';
              }
              _this.elasped = 0;
          }
          
          switch(_this.mode) {
          case 'select':
              _this.selectCamera(frame);
              break;
          case 'rotate':
              _this.rotateCamera(frame);
              break;
          case 'zoom':
              _this.zoomCamera(frame);
              break;
          }
      }
  };
};