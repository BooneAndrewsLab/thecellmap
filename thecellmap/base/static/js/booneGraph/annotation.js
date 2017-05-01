define([
    'jquery',
    'underscore',
    'backbone',
    
    'jquery.cookie',
    'utils',
    'layout',
    
    'annotationModel',
    'regionGroupModel',
    
    'sigma.drawregions',
    'sigma.highlight'
], function($, _, Backbone, Cookies, Utils, Layout, AnnotationModel, RegionGroupModel) {
    var applyAnnotationColors = function() {
        var data = vizdata['annotations'].get(state.get('annotation')), strain, annot;
        
        if (!vizdata['regionGroups'].get(state.get('annotation')) || !state.get('showRegions')) {
            // Annotation is loaded and we have to paint individual nodes (subnetwork/network has changed)
            sigInst.iterNodes(function(n) {
                if (Object.keys(data.get('smap')).length == 0) {
                    strain = Utils.getStrain(n.id);
                    if (!strain) return;
                    annot = data.get('map')[strain.get('orf')];
                } else {
                    annot = data.get('smap')[n.id];
                }
                
                if (annot != undefined) {
                    if (annot.length == 1) {
                        n.color = Cookies.get(data.get('terms')[annot[0]].name) == undefined ? 
                                data.get('colorPalette')[data.get('terms')[annot[0]].idx] : Cookies.get(data.get('terms')[annot[0]].name);
                    } else {
                        n.color = data.get('colorPalette')[data.get('terms')['-2'].idx];
                    }
                } else {
                    if (n.neighbor) {
                        n.color = '#c0c0c0';
                    } else {
                        n.color = data.get('colorPalette')[data.get('terms')['-1'].idx];
                    }
                }
            }).draw();
            
            $('#panel-legend').toggle(state.get('annotation') != 'None' || state.get('myData'));
        } else {
            // We're looking at the global network so we need to show regions and leave default node colors
            sigInst.iterNodes(function(n) {
                if (n.neighbor) {
                    n.color = '#c0c0c0';
                } else {
                    n.color = opts['defaultNodeColor'];
                }
            }).draw();
            $('#panel-legend').toggle(state.get('myData'));
        }
        
        if (!$('#legend-body').is(":visible") || state.get('annotation') == 'None')
            $('#legend-handle button.close').click();
        
        if (state.get('showCircular')) {
            Layout.circularFunc(state.get('centerNode'));
        }
    }
    
    var applyLegendColor = function(id, color) {
        $('.box-annotation-color').each(function(){
            if (id == $(this).data("idx")) $(this).css("background-color", color);
        });
    }
    
    var rebuildLegend = function() {
        $('#style-annotation').empty();
        $('#list-annotation-legend').empty();
        
        var id = state.get('annotation'), terms = {}, num, strains = [], mapStrain = {}, annotation = vizdata['annotations'].get(id);
        
        $('#style-annotation').append('<table class="annotation-table"><thead><tr>\
              <th style="width: 1%;"></th>\
              <th>Annotation</th></tr></thead>\
          <tbody id="style-annotation-table"></tbody></table>');
        
        if (state.get('myData')) {
            if (state.get('myDataType') == 'selected') {
                $('#list-annotation-legend').append('<li><div class="box-annotation-color"></div><span>Enriched for positive genetic interactions</span></li>');
                $('#list-annotation-legend .box-annotation-color').last().css("background-color", Utils.hsvToRgba(48, 100, 100, 1));
                $('#list-annotation-legend').append('<li><div class="box-annotation-color"></div><span>Enriched for negative genetic interactions</span></li>');
                $('#list-annotation-legend .box-annotation-color').last().css("background-color", Utils.hsvToRgba(210, 100, 100, 1));
            } else {
                var seen = {};
                var keys = [];
                sigInst.iterNodes(function(node) {
                    if (!!node.enrichment_name && !seen.hasOwnProperty(node.enrichment_name)) {
                        keys.push(node.enrichment_name);
                        seen[node.enrichment_name] = Utils.hsvToRgba(node.enrichment_hue, 100, 100, 1);
                    }
                });
                
                keys.sort();
                keys.forEach(function(k) {
                    $('#list-annotation-legend').append('<li><div class="box-annotation-color"></div><span>' + k + '</span></li>');
                    $('#list-annotation-legend .box-annotation-color').last().css("background-color", seen[k]);
                });
            }
            
            return;
        }
        
        sigInst.iterNodes(function(node) {
//            if (!node.hidden && node.type != 'pin') strains.push(Utils.getStrain(node.id));
            if (!node.hidden) strains.push({strain: Utils.getStrain(node.id), node: node});
        });
        if (strains.length) {
            _.each(strains, function(s) {
                if (Object.keys(annotation.get('smap')).length == 0) {
                    mapStrain = annotation.get('map')[s.strain.get('orf')];
                } else {
                    mapStrain = annotation.get('smap')[s.node.id];
                }
                
                if (mapStrain && mapStrain.length == 1) {
                    if (!terms.hasOwnProperty(mapStrain[0]))
                        terms[mapStrain[0]] = {term: annotation.get('terms')[mapStrain[0]], num: 0};
                    terms[mapStrain[0]].num++;
                }
            });
        }
        
        if (_.size(terms)) {
            _.each(terms, function(term) {
                num = term.num;
                term = term.term;
                if (Cookies.get(term.name) == undefined) {
                    var color = annotation.get('colorPalette')[term.idx];
                } else {
                    var color = Cookies.get(term.name);
                }
                
//                    restrict name length, keep all annotation in one line within legend
                var name = term.alias.split('/');
//                    if (name.length > 25) {
//                        name = name.substring(0, 25) + "...";
//                    }
                
                if (name.length > 2) name = name[0] + ', ' + name[1] + '..';
                
                $('#style-annotation-table').append('<tr class="annotation-row" data-term="' + term.idx + '">\
                        <td><div class="input-group bs-colorpicker annotation-color">\
                            <input type="hidden" value="' + color + '" class="form-control" />\
                            <span class="input-group-addon"><i></i></span>\
                        </div></td>\
                        <td>' + term.name + '</td></td></tr>');
                
                $('#list-annotation-legend').append('<li><div class="box-annotation-color" data-idx=' + term.idx + '></div><span title="' + term.name + '">' + name + '</span></li>'); // <span class="pull-right">(' + num + ')</span>
                $('#list-annotation-legend .box-annotation-color').last().css("background-color", color);
            });
            $('#list-annotation-legend').append('<li><div class="box-annotation-color" data-idx="-1"></div><span title="Unannotated">Unannotated</span></li>');
            $('#list-annotation-legend .box-annotation-color').last().css("background-color", annotation.get('defaultColor'));
        } else {
            $('#list-annotation-legend').append('<li><div class="box-annotation-color" data-idx="-1"></div><span title="No annotations">No annotations for current network</span></li>');
        }
        
        $('#style-annotation-table .bs-colorpicker').colorpicker().on('hidePicker', function(e){
            var term, color = e.color.toHex(), a = $(this).closest("tr").data("term");
            for (n in terms) {
                term = annotation.get('terms')[n];
                if (terms[n].idx == a) break;
            }
            if (n != -1 && n != -2) {
                Cookies.set(term.name, color);
            } else {
                annotation.get('colorPalette')[term.idx] = color;
            }
            
//            $('#panel-annotation-' + term.id + ' .panel-heading').css('background', '-webkit-linear-gradient(left, #f5f5f5, ' + color + ' 50%)');
//            $('#panel-annotation-' + term.id + ' .panel-heading').css('background', '-moz-linear-gradient(right, #f5f5f5, ' + color + ' 50%)');
//            $('#panel-annotation-' + term.id + ' .panel-heading').css('background', '-o-linear-gradient(right, #f5f5f5, ' + color + ' 50%)');
//            $('#panel-annotation-' + term.id + ' .panel-heading').css('background', 'linear-gradient(to right, #f5f5f5, ' + color + ' 50%)');
            applyAnnotationColors();
            applyLegendColor(term.idx, color);
        });
        
        $("#list-annotation-legend li").hover(function() {
            var termIdx = $(this).find('div').data('idx');
            var data = vizdata['annotations'].get(state.get('annotation'));
            var nodes = [];
            
            Utils.iterVisibleNodes(function(n) {
                if (Object.keys(data.get('smap')).length == 0) {
                    strain = Utils.getStrain(n.id);
                    if (!strain) return;
                    annot = data.get('map')[strain.get('orf')];
                } else {
                    annot = data.get('smap')[n.id];
                }
                
//                strain = Utils.getStrain(n.id);
//                if (!strain) return;
                
//                annot = data.get('map')[strain.get('orf')];
                
                if (annot != undefined) {
                    annot.forEach(function(a) {
//                        console.log(data.get('terms')[a].idx, termIdx);
                        if (data.get('terms')[a].idx == termIdx) {
                            nodes.push(n.id);
                            return;
                        }
                    });
                }
            });
            sigInst.highlightNodes(nodes);
        }, function() {
            sigInst.unhighlightNodes();
        });
        
    };
    
    var applyLoadedAnnotation = function(id, data) {
        var annotations = vizdata['annotations'];
        var addedAnnot = data;
        addedAnnot.id = id;
        
        var i = 0, n, colors = [];
        for (n in addedAnnot.terms) {
            colors.push(addedAnnot.terms[n].color);
            if (colors[i].indexOf('#' == -1)) colors[i] = '#' + colors[i];
            
            addedAnnot.terms[n] = {
                idx: i++,
                id: n,
                name: addedAnnot.terms[n].name,
                orig_name: addedAnnot.terms[n].name,
                alias: addedAnnot.terms[n].alias,
            };
        }
        
        $.extend(addedAnnot.terms, {
            '-1': {id: -1, idx: i, name: 'Unannotated', orig_name: 'Unannotated', alias: 'Unannotated'},
            '-2': {id: -2, idx: i+1, name: 'Multi-function', orig_name: 'Multi-function', alias: 'Multi-function'}
        });
        
        addedAnnot['defaultColor'] = data['defaultColor'] || opts['defaultNodeColor'];
        addedAnnot['multifunctionNodeColor'] = data['multifunctionNodeColor'] || opts['multifunctionNodeColor'];
        addedAnnot['colorPalette'] = colors.concat([opts['defaultNodeColor'], opts['multifunctionNodeColor']]);
        
        annotations.add(new AnnotationModel(addedAnnot));
        rebuildLegend();
        loadRegion(id);
    };
    
    var loadCustomAnnotation = function(name, rows) {
        var terms = [];
        
        var annotations = vizdata['annotations'];
        state.set('annotation', name);
        
        if (!annotations.get(name)) {
            var i, t, o, a, c, annotation = {map: {}, terms: {}, smap: {}};
            for (i = 1; i < rows.length; i++) {
                o = rows[i][0], a = rows[i][1];
                
                if (!annotation.map.hasOwnProperty(o))
                    annotation.map[o] = [];
                annotation.map[o].push(a);
                
                if (!annotation.terms.hasOwnProperty(a)) {
                    annotation.terms[a] = {alias: a, name: a};
                    terms.push(a);
                }
            }
            
            c = Utils.randomColors(terms.length);
            for (i = 0; i < terms.length; i++) {
                annotation.terms[terms[i]].color = c[i].substring(1);
            }
            
            $('.btn-group-annotation li').removeClass('active');
            $('.btn-group-annotation li.divider').before('<li class="active"><a class="load-annotation" href="#">' + name + '</a></li>');
            applyLoadedAnnotation(name, annotation);
        } else {
            rebuildLegend();
            loadRegion(name);
        }
    }
    
    var loadAnnotation = function(id) {
        var annotations = vizdata['annotations'];
        state.set('annotation', id);
        
        $('#panel-legend').toggle((id != 'None' && !state.get('showRegions')) || state.get('myData'));
        
        if (!annotations.get(id)) {
            if (id == 'None') {
                annotations.add(new AnnotationModel());
            } else {
                opts['annotations'].forEach(function(annotation) {
                    if (annotation['name'] === id) {
                        $.ajax({
                            url : annotation['url'],
                            data : {
                                ds: opts.dataset_id,
                            },
                            dataType : 'json',
                            success : function(data) {
                                applyLoadedAnnotation(id, data);
                            },
                        }).fail(function() {
                            Utils.alertUser(
                                    "Error loading annotation",
                                    "There was an error loading requested annotation: " + id + ".<br>\
                                    TheCellMap team has been notified, we're sorry for the inconvenience."
                                   );
                        });
                    }
                });
            }
        } else {
            rebuildLegend();
            loadRegion(id);
        }
    }
    
    var clearRegions = function() {
        var canvas = $('#canvas-regions');
        if (canvas.length) {
            canvas[0].getContext('2d').clearRect(0, 0, canvas.width(), canvas.height());
        }
        
        var mouseCanvas = $('#sigma_mouse_1');
        mouseCanvas[0].getContext('2d').clearRect(0, 0, mouseCanvas.width(), mouseCanvas.height());
    }
    
    //step used to draw the regions in multiple steps so that the regions are under the nodes and the labels are over the nodes 
    var drawRegions = function(direct, step) {
        if (!direct) clearRegions();
        if (!state.get('showRegions') || !vizdata['regionGroups'].get(state.get('annotation'))) return;
        
        var ratio = sigInst.position()['ratio'];
        var canvas = $('#canvas-regions');
        
        var regions = [];
        var regionGroup = vizdata['regionGroups'].get(state.get('annotation'));
        
        for (r in regionGroup.get('regions')) {
            var color = regionGroup.get('colorPalette')[r], nodes = regionGroup.get('regions')[r].slice(), name = regionGroup.get('names')[r];
            var n1, n2,
                xmm = [nodes[0].displayX, nodes[0].displayX],
                ymm = [nodes[0].displayY, nodes[0].displayY];
            
            nodes.push(nodes[0]);
            
            var ctx = $('#canvas-regions')[0].getContext('2d');
            ctx.beginPath();
            ctx.lineWidth="1";
            ctx.lineCap = 'round';
            ctx.strokeStyle="white"; // Green path
            ctx.setLineDash([5, 5]);
            
            for (var i = 0; i < nodes.length - 1; i++) {
                n1 = nodes[i], n2 = nodes[i + 1];
                xmm[0] = Math.min(n2.displayX, xmm[0]), xmm[1] = Math.max(n2.displayX, xmm[1]);
                ymm[0] = Math.min(n2.displayY, ymm[0]), ymm[1] = Math.max(n2.displayY, ymm[1]);
            }
            
            var cr = {
                    c: color, 
                    n: name, 
                    x: xmm[0] + ((xmm[1] - xmm[0]) / 2), 
                    y: ymm[0] + ((ymm[1] - ymm[0]) / 2), 
                    l: Math.max((xmm[1] - xmm[0]), (ymm[1] - ymm[0])), 
                    label: regionGroup.get('locations')[r],
                }
            
            regions.push(cr);
            
            if (state.get('myData')) {
                nodes.push(nodes[1]);
                for (var i = 0; i < nodes.length - 1; i++) {
                    n1 = nodes[i], n2 = nodes[i + 1];
                    
                    n1x = cr.x + (n1.displayX - cr.x) * 1.5;
                    n1y = cr.y + (n1.displayY - cr.y) * 1.5;
                    n2x = cr.x + (n2.displayX - cr.x) * 1.5;
                    n2y = cr.y + (n2.displayY - cr.y) * 1.5;
                    
                    var xc = (n1x + n2x) / 2;
                    var yc = (n1y + n2y) / 2;
                    
                    if (i == 0) {
                        ctx.moveTo(xc, yc);
                    } else {
                        ctx.quadraticCurveTo(n1x,n1y, xc, yc);
                    }
                }
                ctx.stroke();
                
                var nodeMin, nodeMax;
                sigInst._core.graph.nodes.filter(function(node) {
                    if (!nodeMin) {
                        nodeMin = [node.displayX, node.displayY];
                        nodeMax = [node.displayX, node.displayY];
                    }
                    
                    nodeMin[0] = Math.min(node.displayX, nodeMin[0]);
                    nodeMin[1] = Math.min(node.displayY, nodeMin[1]);
                    nodeMax[0] = Math.max(node.displayX, nodeMax[0]);
                    nodeMax[1] = Math.max(node.displayY, nodeMax[1]);
                });
                
                var cx = nodeMin[0] + ((nodeMax[0] - nodeMin[0]) / 2);
                var cy = nodeMin[1] + ((nodeMax[1] - nodeMin[1]) / 2);
                var semidiameter = nodeMax[0] - cx;
                ctx.beginPath();
                ctx.arc(cx,cy,semidiameter,0,2*Math.PI);
                ctx.stroke();
            }
        }
        
        /**
         * Draw clouds
         */
        if ((!direct || (!!direct && step == 1)) && state.get('showAnnotColors')) {
            var ctx = !!direct ? direct : $('#canvas-regions')[0].getContext('2d');
            ctx.globalCompositeOperation = 'screen';
            
            regions.forEach(function(r){
                var grd = ctx.createRadialGradient(r.x, r.y, r.l / 14, r.x, r.y, r.l*0.7);
                grd.addColorStop(0, Utils.hexToStringRgba(r.c, ratio == 1 ? 0.5 : 0.6));
                grd.addColorStop(1, Utils.hexToStringRgba(r.c, 0.01)); //'transparent');
                
                ctx.fillStyle = grd;
                ctx.beginPath();
                ctx.arc(r.x, r.y, r.l*0.8, 0, 2*Math.PI);
                ctx.fill();
                ctx.closePath();
            });
        }
        
        if (state.get('myData')) {
            var ctx = $('#canvas-regions')[0].getContext('2d');
            ctx.globalCompositeOperation = 'screen';
            
            sigInst._core.graph.nodes.filter(function(node) {
                if (!node.enrichment || node.enrichment < state.get('cutoffEnrichment')) return;
                
                var r = node.displaySize * 4;
                var enr = node.enrichment;
                var radgrad = ctx.createRadialGradient(node.displayX,node.displayY,0,node.displayX,node.displayY,r);
                
                radgrad.addColorStop(0,   Utils.hsvToRgba(node.enrichment_hue, 100, enr * 100, 1));
                radgrad.addColorStop(0.9, Utils.hsvToRgba(node.enrichment_hue, 100, enr * 95, .8));
                radgrad.addColorStop(1,   Utils.hsvToRgba(node.enrichment_hue, 100, enr * 90, 0));
                
//                radgrad.addColorStop(0,   'rgba(' + parseInt(255 * enr) + ',' + parseInt(255 * enr) + ',0,1)');
//                radgrad.addColorStop(0.9, 'rgba(' + parseInt(255 * enr) + ',' + parseInt(235 * enr) + ',0,.8)');
//                radgrad.addColorStop(1,   'rgba(' + parseInt(255 * enr) + ',' + parseInt(205 * enr) + ',0,0)');
                
                ctx.fillStyle = radgrad;
                ctx.beginPath();
                ctx.arc(node.displayX, node.displayY, r, 0, 2*Math.PI);
                ctx.fill();
                ctx.closePath();
            });
        }
        
        /**
         * Draw text
         */
        if ((!direct || (!!direct && step == 2)) && window.innerWidth >= 768 && state.get('showAnnotLabels')) { // 768 is small in bootstrap terms 
            regions.sort(function(a, b){
                return a.y - b.y;
            });
            
            var mouseCtx = !!direct ? direct : $('#sigma_mouse_1')[0].getContext('2d');
            var text_height = 16 * (1 + ((ratio - 1) * .5));
            var th2 = text_height / 2, bb1, bb2;
            var r1, r2, moved = true, iter = 0;
            var lx, ly, lines, line, l;
            
            mouseCtx.font = 'bold ' + text_height + 'px Arial';
            mouseCtx.textAlign = 'center';
            mouseCtx.textBaseline = "middle";
            mouseCtx.lineWidth = .4;
            
            var getBbox = function(r) {
                text_width = 0;
                for (l in r.n) {
                    text_width = Math.max(text_width, mouseCtx.measureText(r.n[l]).width);
                }
//                text_width = mouseCtx.measureText(r.n).width;
                
                res = {
                    rx: text_width / 2,
                    ry: th2 * r.n.length,
                }
                
                if (!$.isEmptyObject(r.label)) {
                    res.fixed = true;
                    
                    switch (r.label.align) {
                    case 'left':
                        r.x = r.label.anchor.displayX + res.rx;
                        r.y = r.label.anchor.displayY;
                        break;
                    case 'right':
                        r.x = r.label.anchor.displayX - res.rx;
                        r.y = r.label.anchor.displayY;
                        break;
                    case 'middle':
                        r.x = r.label.anchor.displayX;
                        r.y = r.label.anchor.displayY;
                        break;
                    }
                }
                
                res.x = r.x;
                res.y = r.y;
                return res
            };
            
            while (moved && iter++ < 10) { // move names until no collisions, fail-safe kicks in at 10th iteration
                moved = false;
                for (i = 0; i < regions.length; i++) {
                    for (j = i + 1; j < regions.length; j++) {
                        r1 = regions[i], r2 = regions[j];
                        bb1 = getBbox(r1), bb2 = getBbox(r2);
                        
                        Dy = ((bb2.y - bb1.y) - (bb1.ry + bb2.ry));
                        Dx = ((bb2.x - bb1.x) - (bb1.rx + bb2.rx));
                        
                        if (Dy < 0 && Dx < 0) { // We got collision
                            if (!!bb1.fixed) r1.y += Dy/2 - 5;
                            if (!!bb2.fixed) r2.y -= Dy/2 - 5;
                            moved = true;
                        }
                    }
                }
            }
            
            regions.forEach(function(r) {
                mouseCtx.fillStyle = '#' + r.c;
//                mouseCtx.strokeStyle = 'white'; //Utils.shadeBlendConvert(-.6, '#' + r.c);
                mouseCtx.strokeStyle = Utils.shadeBlendConvert(-.6, '#' + r.c);
                
                // Multi line label
                for (l = 0; l < r.n.length; l++) {
                    line = r.n[l];
                    mouseCtx.fillText(line, r.x, r.y + (l * text_height));
                    mouseCtx.strokeText(line, r.x, r.y + (l * text_height));
                }
            });
        }
    }
    
    var loadRegion = function(id) {
        var regionGroups = vizdata['regionGroups'], toApply = true;
        clearRegions();
        
        opts['regionGroups'].forEach(function(regionGroup) {
            if (regionGroup.name === id) {
                if (!regionGroups.get(id)) {
                    toApply = false;
                    $.ajax({
                        url : regionGroup.url,
                        success : function(data) {
                            if ($.isEmptyObject(data)) return;
                            var addedGroup = {
                                id: id,
                                colorPalette: [], 
                                regions: [],
                                names: [],
                                locations: [],
                            };
                            
                            for (r in data) {
                                var nodes = [], color, name, n;
                                for (n in data[r]) {
                                    var node = Utils.getNode(data[r][n]);
                                    if (node) nodes.push(node);
                                }
                                
                                addedGroup['colorPalette'].push(data[r]['color']);
                                addedGroup['names'].push(data[r]['name'])
                                addedGroup['regions'].push(nodes);
                                
                                if (!!data[r]['label']) {
                                    data[r]['label']['anchor'] = Utils.getNode(data[r]['label']['anchor']);
                                    addedGroup['locations'].push(data[r]['label']);
                                } else {
                                    addedGroup['locations'].push({});
                                }
                            }
                            regionGroups.add(new RegionGroupModel(addedGroup));
                            drawRegions();
                        },
                    }).fail(function() {
                        Utils.alertUser(
                                "Error loading regions",
                                "There was an error loading regions: " + id + ".<br>\
                                TheCellMap team has been notified, we're sorry for the inconvenience."
                               );
                    }).always(function() {
                        applyAnnotationColors();
                    });
                } else {
                    drawRegions();
                }
            }
        });
        
        if (toApply) applyAnnotationColors();
    }
    
    return {
        loadAnnotation: loadAnnotation,
        loadCustomAnnotation: loadCustomAnnotation,
        applyAnnotationColors: applyAnnotationColors,
        rebuildLegend: rebuildLegend,
        loadRegion: loadRegion,
        clearRegions: clearRegions,
        drawRegions: drawRegions,
    };
});