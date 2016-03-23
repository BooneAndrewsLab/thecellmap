define([
    'jquery',
    'underscore',
    'backbone',
    
    'jquery.cookie',
    'tinyColor',
    'utils',
    
    'annotationModel',
    'regionGroupModel',
    
    'pickAColor',
    'sigma.drawregions',
], function($, _, Backbone, Cookies, TinyColor,
    Utils,
    AnnotationModel, RegionGroupModel) {
    window.tinycolor = TinyColor;
    var applyAnnotationColors = function() {
        var data = vizdata['annotations'].get(state.get('annotation')), strain, annot;
        
        $('#panel-legend .panel-body').hide();
        
        if (!vizdata['regionGroups'].get(state.get('annotation')) || !state.get('showRegions')) {
            sigInst.iterNodes(function(n) {
                strain = Utils.getStrain(n.id);
                if (!strain) return;
                
                annot = data.get('map')[strain.get('orf')];
                if (annot != undefined) {
                    if (annot.length == 1) {
                        n.color = Cookies.get(data.get('terms')[annot[0]].name) == undefined ? 
                                data.get('colorPalette')[data.get('terms')[annot[0]].idx] : Cookies.get(data.get('terms')[annot[0]].name);
                    } else {
                        n.color = data.get('colorPalette')[data.get('terms')['-2'].idx];
                    }
                } else {
                    n.color = data.get('colorPalette')[data.get('terms')['-1'].idx];
                }
            }).draw();
            
            if ($('#panel-legend .panel-body').css('display') == 'none') $('#legend-handle').dblclick();
            $('#panel-legend').show();
        } else {
            sigInst.iterNodes(function(n) {
                n.color = opts['defaultNodeColor'];
            }).draw();
            
            $('#panel-legend').hide();
        }
    }
    
    var applyLegendColor = function(id, color) {
        $('.legend-box').each(function(){
            if (id == $(this).data("idx")) $(this).css("background-color", color);
        });
    }
    
    var rebuildLegend = function() {
        $('#style-annotation').empty();
        $('#list-annotation-legend').empty();
        
        var id = state.get('annotation'), terms = {}, strains = [], mapStrain = {}, annotation = vizdata['annotations'].get(id);
        
        $('#style-annotation').append('<table class="annotation-table"><thead><tr>\
              <th style="width: 1%;"></th>\
              <th>Annotation</th></tr></thead>\
          <tbody id="style-annotation-table"></tbody></table>');
        sigInst.iterNodes(function(node) {
//            if (!node.hidden && node.type != 'pin') strains.push(Utils.getStrain(node.id));
            if (!node.hidden) strains.push(Utils.getStrain(node.id));
        });
        if (strains.length) {
            _.each(strains, function(s) {
                mapStrain = annotation.get('map')[(s.get('orf'))];
                if (mapStrain) {
                    if (mapStrain.length == 1) {
                        terms[mapStrain[0]] = annotation.get('terms')[mapStrain[0]];
                    } else {
                        terms[-2] = annotation.get('terms')[-2];
                    }
                } else {
                    terms[-1] = annotation.get('terms')[-1];
                }
            });
        } else {
            terms[-1] = annotation.get('terms')[-1];
        }
        
        
        console.log(terms, terms.length);
        
        _.each(terms, function(term) {
            
            if (Cookies.get(term.name) == undefined) {
                var color = annotation.get('colorPalette')[term.idx];
            } else {
                var color = Cookies.get(term.name);
            }
            
//                restrict name length, keep all annotation in one line within legend
            var name = term.alias.split('/');
//                if (name.length > 25) {
//                    name = name.substring(0, 25) + "...";
//                }
            
            if (name.length > 2) name = name[0] + ', ' + name[1] + '..';
            
            $('#style-annotation-table').append('<tr class="annotation-row" data-term="' + term.idx + '">\
                    <td><input class="form-control pick-a-color annotation-color" value="' + color + '">\
                    <td>' + term.name + '</td></td></tr>');
            $('#list-annotation-legend').append('<li><div class="box-annotation-color" data-idx=' + term.idx + '></div><span title="' + term.name + '">' + name + '</span></li>');
            $('#list-annotation-legend .box-annotation-color').last().css("background-color", color);
        });
        
        $('#style-annotation-table .pick-a-color').pickAColor({showHexInput: false, showSavedColors: false});
        $("#style-annotation-table .pick-a-color").on('change', function() {
            var term, color = '#' + $(this).val(), a = $(this).closest("tr").data("term");
            for (n in terms) {
                term = annotation.get('terms')[n];
                if (terms[n].idx == a) break;
            }
            if (n != -1 && n != -2) {
                Cookies.set(term.name, color);
            } else {
                annotation.get('colorPalette')[term.idx] = color;
            }
            $('#panel-annotation-' + term.id + ' .panel-heading').css('background', '-webkit-linear-gradient(left, #f5f5f5, ' + color + ' 50%)');
            $('#panel-annotation-' + term.id + ' .panel-heading').css('background', '-moz-linear-gradient(right, #f5f5f5, ' + color + ' 50%)');
            $('#panel-annotation-' + term.id + ' .panel-heading').css('background', '-o-linear-gradient(right, #f5f5f5, ' + color + ' 50%)');
            $('#panel-annotation-' + term.id + ' .panel-heading').css('background', 'linear-gradient(to right, #f5f5f5, ' + color + ' 50%)');
            applyAnnotationColors();
            applyLegendColor(term.idx, color);
        });
    }
    
    var loadAnnotation = function(id) {
        var annotations = vizdata['annotations'];
        state.set('annotation', id);
        if (!annotations.get(id)) {
            if (id == 'None') {
                annotations.add(new AnnotationModel());
            } else {
                opts['annotations'].forEach(function(annotation) {
                    if (annotation['name'] === id) {
                        $.ajax({
                            url : annotation['url'],
                            dataType : 'json',
                            success : function(data) {
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
                                loadRegion(id);
                                rebuildLegend();
                            },
                        });
                    }
                });
            }
        } else {
            rebuildLegend();
            loadRegion(id);
        }
        
//        $('input.gene-search-input').select2('val', Utils.getSelectedNodes(), true);
        $('#btn-group-annotation li').removeClass('active');
        $('#btn-group-annotation li a').each(function() {
            if ($(this).html() == id) $(this).parent().addClass('active');
        });
    }
    
    var clearRegions = function() {
        var canvas = $('#canvas-regions');
        if (canvas.length) {
            canvas[0].getContext('2d').clearRect(0, 0, canvas.width(), canvas.height());
        }
        
        var mouseCanvas = $('#sigma_mouse_1');
        mouseCanvas[0].getContext('2d').clearRect(0, 0, mouseCanvas.width(), mouseCanvas.height());
    }
    var drawRegions = function(direct, step) {
        if (!direct) clearRegions();
        if (!state.get('showRegions') || !vizdata['regionGroups'].get(state.get('annotation'))) return;
        
        if (!$('#canvas-regions').length) {
            var canvas = $('canvas:first').clone();
            canvas.attr('id', 'canvas-regions');
            $('#sigma_edges_1').before(canvas);
            
            window.addEventListener('resize', function() {
                $('#canvas-regions').attr('width', $('.sigma_edges_canvas').width());
                $('#canvas-regions').attr('height', $('.sigma_edges_canvas').height());
                drawRegions();
            });
        }
        
        var regions = [];
        var regionGroup = vizdata['regionGroups'].get(state.get('annotation'));
        
        for (r in regionGroup.get('regions')) {
            var color = regionGroup.get('colorPalette')[r], nodes = regionGroup.get('regions')[r], name = regionGroup.get('names')[r];
            var n1, n2,
                xmm = [nodes[0].displayX, nodes[0].displayX],
                ymm = [nodes[0].displayY, nodes[0].displayY];
            
            nodes.push(nodes[0]);
            for (var i = 0; i < nodes.length - 1; i++) {
                n1 = nodes[i], n2 = nodes[i + 1];
                xmm[0] = Math.min(n2.displayX, xmm[0]), xmm[1] = Math.max(n2.displayX, xmm[1]);
                ymm[0] = Math.min(n2.displayY, ymm[0]), ymm[1] = Math.max(n2.displayY, ymm[1]);
            }
            
//            regions.push({c: color, n: name, x: xmm[0] + ((xmm[1] - xmm[0]) / 2), y: ymm[0] + ((ymm[1] - ymm[0]) / 2), nodes: nodes});
            regions.push({c: color, n: name, x: xmm[0] + ((xmm[1] - xmm[0]) / 2), y: ymm[0] + ((ymm[1] - ymm[0]) / 2), l: Math.max((xmm[1] - xmm[0]), (ymm[1] - ymm[0]))});
        }
        
        if (!direct || (!!direct && step == 1)) {
            var ctx = !!direct ? direct : $('#canvas-regions')[0].getContext('2d');
            ctx.globalCompositeOperation = 'screen';
            
            regions.forEach(function(r){
                var grd = ctx.createRadialGradient(r.x, r.y, r.l / 14, r.x, r.y, r.l*0.8);
                grd.addColorStop(0, '#' + r.c);
                grd.addColorStop(1, 'transparent');
                
                ctx.fillStyle = grd;
                ctx.beginPath();
                ctx.arc(r.x, r.y, r.l*0.8, 0, 2*Math.PI);
                ctx.fill();
                ctx.closePath();
            });
        }
        
        if (!direct || (!!direct && step == 2)) {
            regions.sort(function(a, b){
                return a.y - b.y;
            });
            
            var mouseCtx = !!direct ? direct : $('#sigma_mouse_1')[0].getContext('2d');
            var last = 0, spacing = 20;
            
            mouseCtx.font = 'bold 16px Arial';
            mouseCtx.textAlign = 'center';
            mouseCtx.lineWidth = 2;
            
            regions.forEach(function(r) {
                if (r.y - last < spacing) {
                    r.y += spacing - (r.y - last);
                }
                
                mouseCtx.fillStyle = '#' + r.c;
                mouseCtx.fillText(r.n, r.x, r.y);
                
                last = r.y;
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
                            }
                            
                            regionGroups.add(new RegionGroupModel(addedGroup));
                            drawRegions();
                        },
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
        applyAnnotationColors: applyAnnotationColors,
        rebuildLegend: rebuildLegend,
        loadRegion: loadRegion,
        clearRegions: clearRegions,
        drawRegions: drawRegions,
    };
});