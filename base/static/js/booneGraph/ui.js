define([
    'jquery',
    'underscore',
    'backbone',
    
    'jquery.cookie',
    
    'annotation',
    'dataset',
    'layout',
    'utils',
    'node',
    
    'noUISlider',
], function($, _, Backbone, Cookies, Annotation, Dataset, Layout, Utils, Node, nouislider
    ) {
    
    var buildUI = function() {
        $('.vizualization-ui').appendTo(opts['rootElement']);
        $('.vizualization-ui').ready(function() {
            $(window).resize(function() {
                var parent = $('.vizualization-ui').parent();
                $('.vizualization-ui').css('height', parent.innerHeight());
                $('.vizualization-ui').css('width', parent.innerWidth());
            }).resize();
        });
        $('#ui-placeholder').remove();
        
        $('#btn-group-layout').toggleClass('hidden', true);
        
        if (opts['annotations'].length > 0) {
            opts['annotations'].forEach(function(annotation) {
                $('#btn-group-annotation').append('<li><a class="load-annotation" href="#">' + annotation['name'] + '</a></li>');
            });
        }
        $('#btn-group-annotation').append('<li class="divider"></li><li><a id="btn-legend" href="#">Annotation legend</a></li>');
        
        $('.changed-network').hide().removeClass('hidden');
        $('#modal-style').appendTo('body');
        $('#contextmenu-container').appendTo('body');
        $('#contnodeextmenu-edge-container').appendTo('body');
        $('#edit-node-modal').appendTo('body');
        $('#modal-rotation').appendTo('body');
        
        $('#panel-legend').css('top', '105px');
        $('#panel-legend').css('left', '20px');
        
        $(opts['rootElement']).append('<canvas id="canvas-draw" width="' + $('canvas:first').width() + 'px" height="' + $('canvas:first').height() + 'px" style="display: none;"></canvas>');
        window.addEventListener('resize', function() {
            $('#canvas-draw').attr('width', $('canvas:first').width());
            $('#canvas-draw').attr('height', $('canvas:first').height());
        });
    }
    
    function buildDrawUI() {
        var isDrawing = false, fillOn = false, drawShape = 'free', x, y, deltaX, deltaY;
        var canvas = $('#canvas-draw'), context = canvas[0].getContext('2d'), mouseEvent;
        
        canvas.mousedown(function(e) {
            context.strokeStyle = 'rgba(255, 0, 0, 1)';
            context.fillStyle = 'rgba(255, 0, 0, 0.5)';
            x = [], y = [];
            context.clearRect(0, 0, canvas.width(), canvas.height());
            isDrawing = true;
            var xPos = e.offsetX != undefined ? e.offsetX : e.pageX - this.offsetLeft;
            var yPos = e.offsetY != undefined ? e.offsetY : e.pageX - this.offsetTop;
            x.push(xPos);
            y.push(yPos);
        });
        
        var drawFunc = function(e) {
            if (isDrawing) {
                if (e.type != 'mousemove' && e.keyCode == 16) {
                    e = mouseEvent;
                    e.shiftKey = true;
                }
                
                context.clearRect(0, 0, canvas.width(), canvas.height());
                context.beginPath();
                
                var xPos = e.offsetX != undefined ? e.offsetX : e.pageX - canvas[0].offsetLeft;
                var yPos = e.offsetY != undefined ? e.offsetY : e.pageX - canvas[0].offsetTop;
                
                var centerX = (xPos - x[0])/2 + x[0], centerY = (yPos - y[0])/2 + y[0];
                var width = xPos - x[0], height = yPos - y[0];
                
                if (e.shiftKey && drawShape == 'square') {
                    width = Math.abs(width)/width*Math.max(Math.abs(width), Math.abs(height));
                    height = Math.abs(height)/height*Math.max(Math.abs(width), Math.abs(height));
                    centerX = width/2 + x[0], centerY = height/2 + y[0];
                }
                
                switch (drawShape) {
                case 'circle':
                    context.arc(centerX, centerY, Math.sqrt(Math.pow(width/2, 2) + Math.pow(height/2, 2)), 0, 2*Math.PI);
                    break;
                case 'square':
                    context.rect(x[0], y[0], width, height);
                    break;
                case 'line':
                    context.moveTo(x[0], y[0]);
                    context.lineTo(xPos, yPos);
                    break;
                default:
                    context.moveTo(x[0], y[0]);
                    x.push(xPos);
                    y.push(yPos);
                    for (var i = 1; i < x.length; i++) {
                        context.lineTo(x[i], y[i]);
                    }
                }
                context.stroke();
                if (fillOn && drawShape != 'free') context.fill();
                context.closePath();
                mouseEvent = e;
            }
        };
        
        canvas.on('mousemove', drawFunc);
        window.addEventListener('keydown', drawFunc, false);
        
        canvas.on('mouseup', function(e) {
            var xPos = e.offsetX != undefined ? e.offsetX : e.pageX - canvas[0].offsetLeft;
            var yPos = e.offsetY != undefined ? e.offsetY : e.pageX - canvas[0].offsetTop;
            var width = xPos - x[0], height = yPos - y[0];
            
            if (e.shiftKey && drawShape == 'square') {
                width = Math.abs(width)/width*Math.max(Math.abs(width), Math.abs(height));
                height = Math.abs(height)/height*Math.max(Math.abs(width), Math.abs(height));
                x.push(x[0] + width);
                y.push(y[0] + height);
            } else {
                x.push(xPos);
                y.push(yPos);
            }
            isDrawing = false;
        });
        
        $('.fill-radio input').on('change', function() {
            fillOn = $(this).val() == 'true';
            if (mouseEvent != undefined || mouseEvent != null) {
                isDrawing = true;
                drawFunc(mouseEvent);
                isDrawing = false;
            }
        });
        
        $('.shape-radio input').on('change', function() {
            context.clearRect(0, 0, canvas.width(), canvas.height());
            drawShape = $(this).data('shape');
            if (drawShape == 'free' || drawShape == 'line') {
                $('.fill-radio label').addClass('disabled');
            } else {
                $('.fill-radio label').removeClass('disabled');
            }
            x = [], y = [];
        });
        
        $('#draw-confirm').click(function() {
            var selected = Node.getSelectedNodes();
            if (x.length == 0 || selected == null || selected.length < 1 || selected == undefined) return;
            
            context.clearRect(0, 0, canvas.width(), canvas.height());
            var draw = [], cursor = {x: x[0], y: y[0]}, delta = 0, length = 0, i = 1, dS = selected.length - 1;
            var drawReady = true;
            
            if (drawShape == 'free' || drawShape == 'line' || !fillOn) {
                switch (drawShape) {
                case 'circle':
                    var theta = Math.PI * 2 / selected.length;
                    var mX = (x[x.length - 1] - x[0])/2, mY = (y[y.length - 1] - y[0])/2, r = Math.sqrt(mX*mX + mY*mY);
                    for (var i = 0; i < selected.length; i++) {
                        draw.push({x: x[0] + mX + r*Math.cos(theta * i), y: y[0] + mY + r*Math.sin(theta * i)});
                    }
                    break;
                case 'line':
                    var dX = (x[x.length - 1] - x[0]) / (selected.length - 1), dY = (y[y.length - 1] - y[0]) / (selected.length - 1);
                    for (i = 0; i < selected.length; i++) {
                        draw.push({x: x[0] + i*dX, y: y[0] + i*dY});
                    }
                    break;
                case 'square':
                    dS = selected.length;
                    x = [x[0], x[x.length - 1], x[x.length - 1], x[0], x[0]];
                    y = [y[0], y[0], y[y.length - 1], y[y.length - 1], y[0]];
                default:
                    draw.push(cursor);
                    
                    for (count = 0; count < x.length - 1; count++) {
                        delta += Math.sqrt(Math.pow(x[count+1] - x[count], 2) + Math.pow(y[count+1] - y[count], 2));
                    }
                    delta /= dS;
                    
                    while (i < x.length) {
                       var nxtX = x[i], nxtY = y[i];
                       var dist = Math.sqrt(Math.pow((nxtX-cursor['x']), 2) + Math.pow((nxtY-cursor['y']), 2));
                       var next_jump = length + dist;
                       
                       if (next_jump == delta) {
                           draw.push({x: nxtX, y: nxtY});
                           cursor = {x: nxtX, y: nxtY};
                           length = 0;
                           i += 1;
                       } else if (next_jump < delta) {
                           cursor = {x: nxtX, y: nxtY};
                           length += dist;
                           i += 1;
                       } else {
                           var remainder = delta - length;
                           var angle = Math.atan2(nxtY - cursor['y'], nxtX - cursor['x']);
                           cursor = {x: cursor['x'] + (Math.cos(angle) * remainder), y: cursor['y'] + (Math.sin(angle) * remainder)}
                           draw.push(cursor)
                           length = 0;
                       }
                       if (draw.length == selected.length) break;
                    }
                    if (draw.length < selected.length) draw.push({x: x[x.length-1], y: y[y.length-1]});
                }
            } else {
                var mX = (x[x.length - 1] - x[0])/2., mY = (y[y.length - 1] - y[0])/2.;
                
                switch (drawShape) {
                case 'circle':
                    var num = selected.length, path = opts.urls['circle'];
                    drawReady = false;
                    
                    $.ajax({dataType: 'json', type: 'get', data: {num: num}, url: path, success: function(data) {
                        draw = data
                        if (draw.length == selected.length) {
                            r = Math.sqrt(mX*mX + mY*mY)
                            for (i = 0; i < draw.length; i++) {
                                draw[i]['x'] = draw[i]['x'] * r + x[0] + mX;
                                draw[i]['y'] = draw[i]['y'] * r + y[0] + mY;
                            }
                        } else {
                            var i = level = 1, coor = [];
                            while (i < selected.length) {
                                i += level * 6;
                                level += 1;
                            }
                           
                            level -= 1;
                             
                            for (i = -level; i <= level - 1; i++) {
                                for (var j = -level; j <= level - 1; j++) {
                                    if (Math.abs(i + j) <= level) {
                                        coor.push({x: 0.5 * i * 3/2, y: Math.sqrt(3) * 0.5 *(j + i/2)});
                                        coor.push({x: Math.sqrt(3) * 0.5 *(j + i/2), y: 0.5 * i * 3/2});
                                    }
                                }
                            }
                            
                            var r = Math.sqrt(mX*mX + mY*mY) / level;
                            for (i = 0; i < coor.length; i++) {
                                coor[i]['x'] = coor[i]['x'] * r + x[0] + mX;
                                coor[i]['y'] = coor[i]['y'] * r + y[0] + mY;
                            }
                            
                            for (i = 0; i < selected.length; i++) {
                                var n = Math.floor(Math.random() * coor.length);
                                draw.push(coor[n]);
                                coor.splice(n, 1);
                            }
                        }
                    }}).always(function() {
                        drawReady = true;
                    });
                    
                    break;
                default:
                    var r = Math.max(mX / mY) / Math.min (mX / mY);
                    var bSide = Math.ceil(Math.sqrt(selected.length / r)), sSide = Math.ceil(selected.length / bSide);
                    
                    var nX = mX > mY ? bSide : sSide, dX = mX * 2 / (nX - 1);
                    var nY = mY > mX ? bSide : sSide, dY = mY * 2 / (nY - 1);
                    
                    for (var i = 0; i < nY; i++) {
                        var n = selected.length - draw.length, count;
                        if (n >= nX) {
                            count = nX;
                        } else {
                            dX = mX * 2  / (n - 1);
                            count = n;
                        }
                        for (j = 0; j < count; j++) {
                            draw.push({x: x[0] + j * dX, y: y[0] + i * dY});
                        }
                    }
                }
            }
            
            while(!drawReady);
            
            var position = sigInst.position(), size = sigInst.size();
            var n1 = Utils.getNode(selected[0]), n2 = Utils.getNode(selected[1]);
            var dAbs = Math.sqrt(Math.pow(n1.x - n2.x, 2) + Math.pow(n1.y - n2.y, 2));
            var dDis = Math.sqrt(Math.pow(n1.displayX - n2.displayX, 2) + Math.pow(n1.displayY - n2.displayY, 2));
            var ratio = dAbs/dDis;
            
            for (var i = 0; i < selected.length; i++) {
                var n = Utils.getNode(selected[i]);
                draw[i]['x'] = n.x + ((draw[i]['x']) - n.displayX)*ratio;
                draw[i]['y'] = n.y + ((draw[i]['y']) - n.displayY)*ratio;
                draw[i]['node'] = n;
            }
            sigInst.moveNodes({destinations: draw, runtime: 3});
            x = [], y = [];
        });
        
        $('#draw-cancel').click(function() {
            canvas.hide();
            $('#draw-ui').hide();
            $('#ui').fadeIn(1000);
        });
    }
    
    var buildCutoffBars = function() {
        $('.cutoff-int').each(function() {
            var orientation = $(this).data('orientation');
            
            var slider = this;
            nouislider.create(slider, {
                range: {min: -1, max: 1},
                step: sliderProperties.step,
                start: [-0.08, 0.08],
                orientation: orientation,
                direction: orientation == 'horizontal' ? 'ltr' : 'rtl', // Important, vertical sliders should be going bot->top
            });
            
            slider.noUiSlider.on('set', function() {
                var val = slider.noUiSlider.get(), preVal = state.get('cutoffInteraction');
                if (parseFloat(val[0]) == parseFloat(preVal[0]) && parseFloat(val[1]) == parseFloat(preVal[1])) return;
                if (parseFloat(val[0]) < 0 && parseFloat(val[1]) > 0) {
                    Node.applyCutoff(val);
                    state.set('cutoffInteraction', [val[0], val[1]]);
                } else {
                    slider.noUiSlider.set(preVal);
                }
            });
            
            slider.noUiSlider.on('update', function( values, handle ) {
                $('.cutoff-label-min').html(values[0]);
                $('.cutoff-label-max').html(values[1]);
            });
        });
        
        $('.cutoff-cor').each(function() {
            var orientation = $(this).data('orientation'), direction = $(this).data('direction');
            
            var slider = this;
            nouislider.create(slider, {
                range: {min: sliderProperties.min, max: sliderProperties.max},
                step: sliderProperties.step,
                start: sliderProperties.value,
                direction: direction,
                orientation: orientation,
            });
            
            slider.noUiSlider.on('set', function(e) {
                var val = parseFloat(slider.noUiSlider.get()), preVal = parseFloat(state.get('cutoffCorrelation')), lowVal = parseFloat(state.get('cutoffLow'));
                if (val == preVal) return;
                
                var nodes = sigInst._core.graph.nodes.filter(function(node) {
                    return !(node.hidden && node._hidden);
                }).map(function(node) {
                    return node.id;
                });
                var nodeMulti = 140, nodeLimit = Math.floor(nodeMulti * (Math.log((val-0.04)*100)/Math.log(20))) + 1;
                if (val < lowVal && nodes.length <= nodeLimit) {
                    $.post('correlations/', {csrfmiddlewaretoken: Cookies.get('csrftoken'), nodes: nodes, cutoff: val}, function(data) {
                        for (n in data['nodes']) {
                            var node = data['nodes'][n];
                            var strain = Utils.getStrain(node);
                            if (!Utils.nodeExists(node)) {
                                sigInst.addNode(node, {
                                    x: (Math.random() * 100),
                                    y: (Math.random() * 100),
                                });
                            }
                        }
                        
                        for (e in data['edges']) {
                            var edge = data['edges'][e];
                            var edgeId = edge.s + '+' + edge.t, edgeReverseId = edge.t + '+' + edge.s;
                            if (Utils.nodeExists(edge.s) && Utils.nodeExists(edge.t) && !sigInst._core.graph.edgesIndex[edgeId] && !sigInst._core.graph.edgesIndex[edgeReverseId]) {
                                sigInst.addEdge(edgeId, edge.s, edge.t, edge);
                                
                                var addedEdge = Utils.getEdge(edgeId), source = Utils.getNode(edge.s), target = Utils.getNode(edge.t);
                                addedEdge.weight = addedEdge.size = Math.abs(edge.w);
                                
                                source.hidden = source._hidden = false;
                                target.hidden = target._hidden = false;
                            }
                        }
                        
                        sigInst.draw();
                    }).always(function() {
                        Dataset.updateEdges(0);
                        Node.applyCutoff(val);
                        Layout.toggleLayout();
                        state.set('cutoffCorrelation', val);
                        state.set('cutoffLow', val);
                    });
                } else if (val < lowVal && nodes.length > nodeLimit) {
                    slider.noUiSlider.set(preVal);
                    Utils.alertUser('Too many nodes', 'Too many nodes on the working network, number of nodes should be lower than or equal to ' + nodeLimit + 
                              ' for the selected cutoff.<br>Node count: ' + nodes.length + '<br>Visible node count: ' + Utils.countVisibleNodes());
                    return;
                } else {
                    state.set('cutoffCorrelation', val);
                    Node.applyCutoff(val);
                }
            });
            
            slider.noUiSlider.on('update', function(values, handle) {
                $('.cutoff-label-min').html(values);
            });
        });
        
        $('.cutoff-label').each(function() {
            var label = $(this), placement = label.data('placement') || 'left';
            label.popover({
                container: 'body',
                placement: placement,
                html: true,
                content: '<div><input type="text" class="form-control cutoff-label-input" data-for-cutoff="' + label.attr('id') + '"></div>'
            }).on('hide.bs.popover', function () {
                var value = $('.cutoff-label-input[data-for-cutoff=' + label.attr('id') + ']').val(), data = state.get("dataset");
                var cutoff = data == 0 ? state.get('cutoffCorrelation') : state.get('cutoffInteraction').slice();
                
                if ($.isNumeric(value)) {
                    value = parseFloat(value).toFixed(2);
                    if (label.attr('id') == 'cutoff-label-min'  || label.attr('id') == 'cutoff-label-min-simple') {
                        if (data == 0) {
                            cutoff = value;
                        } else {
                            cutoff[0] = value;
                        }
                    } else {
                        cutoff[1] = value;
                    }
                    $('.cutoff-bar[data-dataset=\"' + data + '\"], .cutoff-bar-simple[data-dataset=\"' + data + '\"]')[0].noUiSlider.set(cutoff);
                }
            }).on('shown.bs.popover', function () {
                $('.cutoff-label-input[data-for-cutoff=' + label.attr('id') + ']').val(label.html()).keyup(function (e) {
                    var dataset = state.get('dataset'), hasError = true, val = parseFloat($(this).val());
                    var cutoff = dataset == 0 ? state.get('cutoffCorrelation') : state.get('cutoffInteraction').slice();
                    
                    if (dataset == 0) {
                        if (val <= 1 && val >= 0) hasError = false;
                    } else {
                        if (label.attr('id') == 'cutoff-label-min' || label.attr('id') == 'cutoff-label-min-simple') {
                            if (val >= -1 && val < 0) hasError = false;
                        } else {
                            if (val <= 1 && val > 0) hasError = false;
                        }
                    }
                    $(this).parent().toggleClass('has-error', !$.isNumeric($(this).val()) || hasError);
                    
                    if ($.isNumeric($(this).val()) && !hasError) {
                        if (label.attr('id') == 'cutoff-label-min'  || label.attr('id') == 'cutoff-label-min-simple') {
                            if (dataset == 0) {
                                cutoff = val;
                            } else {
                                cutoff[0] = val;
                            }
                        } else {
                            cutoff[1] = val;
                        }
                        
                        if (e.which == 13) {
                            $('.cutoff-bar[data-dataset=\"' + dataset + '\"], .cutoff-bar-simple[data-dataset=\"' + dataset + '\"]')[0].noUiSlider.set(cutoff);
                        }
                    }
                }).focus();
            });
        });
    }
    
    var buildSliders = function() {
        var styleSliders = {
            nsize: {
                range: {min: .1, max: 8},
                step: 2,
                start: 2,
                connect: 'lower',
                set: function(v) {
                    sigInst.graphProperties({maxNodeSize: v[0]}).draw();
                    state.set('nodeSize', v[0]);
                }
            },
            lsize: {
                range: {min: 1, max: 28},
                step: 7,
                start: sigInst._core.plotter.p.defaultLabelSize,
                connect: 'lower',
                set: function(v) {
                    sigInst.drawingProperties({defaultLabelSize: v[0]}).draw(-1, -1, 1);
                    state.set('labelSize', v[0]);
                }
            },
            lthresh: {
                range: {min: 0, max: 24},
                step: 6,
                start: sigInst._core.plotter.p.labelThreshold,
                connect: 'lower',
                set: function(v) {
                    sigInst.drawingProperties({labelThreshold: v[0]}).draw(-1, -1, 1);
                    state.set('labelThreshold', v[0]);
                }
            },
            esize: {
                range: {min: 1, max: 20},
                step: 5,
                start: 1,
                connect: 'lower',
                set: function(v) {
                    sigInst.graphProperties({maxEdgeSize: v[0]}).draw();
                    state.set('edgeWidth', v[0]);
                }
            },
            snsize: {
                range: {min: 1, max: 10},
                step: 1,
                start: 1,
                connect: 'lower', 
                set: function() {},
            },
        }
        
        for (slider in styleSliders) {
            if ($('#style-slider-' + slider).length) {
                var sl = document.getElementById('style-slider-' + slider);
                nouislider.create(sl, styleSliders[slider]);
                sl.noUiSlider.on('set', styleSliders[slider].set);
                
                $('#style-slider-' + slider).attr('data-slider-default', $('#style-slider-' + slider).val());
            }
        }
        
        $('#btn-style-default').click(function() {
            for (slider in styleSliders) {
                $('#style-slider-' + slider).val($('#style-slider-' + slider).attr('data-slider-default'), true);
            }
            $('#canvas-background-color').val('222222').change();
            
            var annotation = vizdata['annotations'].get(state.get('annotation')), strain, annot;
            var terms = annotation.get('terms');
            sigInst.iterNodes(function(n) {
                if (n.pin) return;
                
                strain = Utils.getStrain(n.id);
                annot = annotation.get('map')[strain.get('orf')];
                if (annot != undefined) $.removeCookie(terms[annot[0]].name);
            });
            annotation.get('colorPalette')[terms['-1'].idx] = '#e3e3e3';
            if (terms['-2']) annotation.get('colorPalette')[terms['-2'].idx] = '#e3e3e3';
            
            Annotation.rebuildLegend();
            Annotation.applyAnnotationColors();
        });
    }
    
    var initUI = function() {
        buildUI();
        buildDrawUI();
        buildCutoffBars();
        buildSliders();
    }
    
    var showUI = function() {
        setTimeout(function() {
            $('.changed-network').fadeIn(2000);
            $('#ui').fadeIn(1000);
        }, 1000);
    }
    
    return {
        buildUI: buildUI,
        buildDrawUI: buildDrawUI,
        buildCutoffBars: buildCutoffBars,
        buildSliders: buildSliders,
        initUI: initUI,
        showUI: showUI,
    };
});