define([
    'jquery',
    'underscore',
    'backbone',
    'noUISlider',
    
    'three',
    'scrollbar',
    
    'bootstrap',
    'sigma',
    'mouse',
    
    'sigma.forcelayout',
    'sigma.highlight',
    'sigma.move',
    'sigma.rotate'
], function($, _, Backbone, nouislider) {
    var sigInst, vizdata = {}, state = {}, three = {};
    
    var init = function() {
        var DEFAULTS = {
            edgeColor: 'FF9126',
            maxColor: '#006ED9',
            minColor: '#66FF33',
            minDate: null,
            maxDate: null,
            piImageWidth: 132,
            piImageHeight: 198,
            rootElement: '#network-container',
        };
        $.extend(opts, DEFAULTS);
        
        state['isDragging'] = false;
        sigInst = sigma.init($(opts['rootElement'])[0]).configProperties({
            auto: false,
            drawEdges: 2,
        }).drawingProperties({
            defaultLabelSize: 14,
            defaultLabelHoverColor: '#000',
            labelThreshold: 144,
            font: 'Arial',
            fontStyle: 'bold ',
            defaultLabelColor : '#E3E3E3',
        }).graphProperties({
            type: 'network',
//            minEdgeSize : 1,
//            maxEdgeSize : 20,
            maxNodeSize: 2,
            nodesPowRatio : 1,
            edgesPowRatio : .5,
            margin: 50,
            arrowRatio: 4,
            safe : false,
        }).mouseProperties({
            drawHoverEdges: false,
            maxRatio : 64,
            blockScroll: false,
        }).bind('upnodes', function(targets) {
            if (!state['isDragging']) buildPIPanel(targets.content[0]);
            getNode(targets.content[0]).dragging = false;
            state['isDragging'] = false;
        }).bind('downnodes', function(targets) {
            getNode(targets.content[0]).dragging = true;
        }).bind('draggedNode', function() {
            state['isDragging'] = true;
        }).bind('upgraph', function() {
            sigInst.iterNodes(function(n) {
                n.dragging = false;
            });
        });
        
        loadAuthors();
        sigInst.hoverHighlight(state);
        sigInst.draw();
    }
    
    var buildUI = function() {
        //Load UI
        $('.vizualization-ui').appendTo(opts['rootElement']);
        $('.vizualization-ui').ready(function() {
            $(window).resize(function() {
                var parent = $('.vizualization-ui').parent();
                $('.vizualization-ui').css('height', parent.innerHeight());
                $('.vizualization-ui').css('width', parent.innerWidth());
                
                if (!!three['scene']) {
                    three['camera'].aspect = parent.innerWidth()/parent.innerHeight();
                    three['camera'].updateProjectionMatrix();
                    three['renderer'].setSize(parent.innerWidth(), parent.innerHeight());
                    three['renderer'].render(three['scene'], three['camera']);
                }
            }).resize();
        });
        $('#ui-placeholder').remove();
        
        //Create and initialize date cutoff bar
        var slider = $('#cutoff-bar-date')[0];
        nouislider.create(slider, {
            range: {
                min: opts['minDate'],
                max: opts['maxDate'],
            },
            step: 7 * 24 * 60 * 60 * 1000,
            start: opts['minDate'],
            orientation: 'horizontal',
            direction: 'ltr',
        });
        
        slider.noUiSlider.on('set', updateNetwork)
        
        //Create slider tooltip
        $('#cutoff-bar-date .noUi-handle').append('<div id="label-date"></div>');
        slider.noUiSlider.on('update', function(values, handle){
            var time = new Date(parseInt(values[handle]));
            var months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
            $('#label-date').html(months[time.getMonth()] + ' ' + time.getFullYear());
        });
        
        //Initialize icons for start and pause layout
        $('#icon-pin').click(function(e) {
            toggleLayout();
            $('#icon-pin').toggleClass('icon-dark');
        });
        
        //Initialize icons for show and hide legend
        $('.icon-legend').click(function() {
            if ($(this).data('legend') == 'closed') {
                $('#canvas-legend').show();
                $('.top-right').animate({ width:'390px' }, 500);
            } else {
                $('.top-right').animate({ width:'40px' }, 500, function() {
                    $('#canvas-legend').hide();
                });
            }
            
            $('.icon-group-legend').find('span').toggleClass('hidden');
        });
        
        //Initialize icons for start and pause time line animation
        $('.icon-time').click(function() {
            if (parseInt($('#cutoff-bar-date')[0].noUiSlider.get()) >= opts['maxDate']) return;
            if (!state['runningLayout']) toggleLayout();
            
            state['runningAnimation'] = true;
            
            if ($(this).data('toggle') == 'start') {
                timeout(function() {
                    var time = parseInt($('#cutoff-bar-date')[0].noUiSlider.get()) + 7 * 24 * 60 * 60 * 1000;
                    $('#cutoff-bar-date')[0].noUiSlider.set(new Date(time));
                    
                    if (state['runningAnimation'] && parseInt($('#cutoff-bar-date')[0].noUiSlider.get()) >= opts['maxDate']){
                        $('.icon-group-time').find('span').toggleClass('hidden');
                        state['runningAnimation'] = false;
                    }
                    
                    return state['runningAnimation'];
                }, 50);
            } else {
                state['runningAnimation'] = false;
            }
            
            $('.icon-group-time').find('span').toggleClass('hidden');
        });
        
        $('.icon-group-demension').click(function() {
            if (state['three']) {
                for (var i = three['scene'].children.length; i > 0; i--) {
                    var obj = three['scene'].children[i];
                    three['scene'].remove(obj);
                }
                state['three'] = false;
                
                $('#scene').remove();
                $(opts['rootElement']).children(':not(#ui)').fadeIn(1000);
            } else {
                buildThree();
            }
            
            $('.icon-group-demension').find('span').toggleClass('hidden');
        });
        
        $('.icon-center').click(graphCenter);
        
        buildLegend();
        $('[data-toggle="tooltip"]').tooltip()
        
        //Fade in UI
        setTimeout(function() {
            $('#ui').fadeIn(1000);
            toggleLayout();
        }, 1000);
    }
    
    function timeout(func, delay) {
        setTimeout(function () {
            func() && timeout(func, delay);
        }, delay);
    }
    
    var buildThree = function() {
        var rootElement = $(opts['rootElement']);
        rootElement.children(':not(#ui)').fadeOut(1000);
        state['three'] = true;
        
        three['scene'] = new THREE.Scene();
        three['renderer'] = new THREE.WebGLRenderer({antialias: true, alpha: true});
        three['renderer'].setSize(rootElement.width(), rootElement.height());
        three['renderer'].setClearColor(0x222222, 1);
        rootElement.append(three['renderer'].domElement);
        three['renderer'].domElement.id = 'scene';
        
        three['camera'] = new THREE.PerspectiveCamera(25, rootElement.width()/rootElement.height(), 0.1, 5000);
        three['camera'].position.set(0, 0, 1700);
        
        three['control'] = new THREE.TrackballControls(three['camera']);
        three['control'].damping = 0.2;
        
        three['light'] = new THREE.DirectionalLight(0xffffff, 1);
        three['light'].position.set(0, 0, 1);
        three['scene'].add(three['light']);
        
        var canvasMeasure = document.createElement('canvas'), ctxMeasure = canvasMeasure.getContext('2d');
        ctxMeasure.font = '14px bold Arial';
        sigInst.iterNodes(function(n) {
            var sphere = new THREE.Mesh(
                new THREE.SphereGeometry(1, 32, 32),
                new THREE.MeshLambertMaterial({ color: parseInt('0x' + n['three']['color']), transparent: true, opacity: 0 })
            );
            sphere.position.set(n.three['x'], n.three['y'], n.three['z']);
            sphere.name = 'node_' + n.id;
            sphere.visible = false;
            three['scene'].add(sphere);
            
            var canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
            canvas.width = ctxMeasure.measureText(n.label).width;
            canvas.height = 14;
            ctx.font = '14px bold Arial';
            ctx.textAlign = 'start';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(n.label, 0, canvas.height/2);
            
            var texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            texture.minFilter = THREE.LinearFilter;
            
            var sprite = new THREE.Sprite(new THREE.SpriteMaterial( { map: texture, color: 0xffffff, fog: true } ));
            sprite.scale.set(canvas.width, canvas.height, 1)
            sprite.visible = false;
            sprite.name = 'label_' + n.id;
            
            three['scene'].add(sprite);
        });
        
        sigInst.iterEdges(function(e) {
            var cylinder = cylinderMesh(three['scene'].getObjectByName('node_' + e.source.id).position, 
                                        three['scene'].getObjectByName('node_' + e.target.id).position,
                                        e);
            cylinder.visible = false;
            three['scene'].add(cylinder);
        });
        
        $('#cutoff-bar-date')[0].noUiSlider.set(opts['minDate']);
        animate();
    }
    
    var cylinderMesh = function(pointX, pointY, e) {
        var direction = new THREE.Vector3().subVectors(pointY, pointX), arrow = new THREE.ArrowHelper(direction, pointX);
        var edge = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, direction.length(), 16, 16),
            new THREE.MeshLambertMaterial({ color: parseInt('0x' + opts['edgeColor']), transparent: true, opacity: 0 }));
        
        var offsetRotation = new THREE.Matrix4().makeRotationX(Math.PI * 0.5);
        var orientation = new THREE.Matrix4().lookAt(pointX,pointY,new THREE.Vector3(0,1,0)).multiply(offsetRotation);
        
        edge.applyMatrix(orientation);
        edge.position.addVectors(pointX, direction.multiplyScalar(0.5));
        edge.name = 'edge_' + e.id;
        
        edge.source = e.source.id;
        edge.target = e.target.id;
        
        return edge;
    }
    
    var render = function() {
        if (state['three']) requestAnimationFrame(render);
//        three['control'].update();
        
        var radius = 1700;
        three['camera'].position.x = radius * Math.cos( (new Date() - state['startTime'])/2000 );
        three['camera'].position.z = radius * Math.sin( (new Date() - state['startTime'])/2000 );
        three['camera'].position.y = radius * Math.cos( (new Date() - state['startTime'])/2000 );
        three['camera'].lookAt(three['scene'].position);
        
        three['light'].position.set(three['camera'].position.x, three['camera'].position.y, three['camera'].position.z);
        three['renderer'].render(three['scene'], three['camera']);
    }
    
    var animate = function() {
        state['time'] = opts['minDate'];
        
        timeout(function() {
            var time = parseInt($('#cutoff-bar-date')[0].noUiSlider.get()) + 7 * 24 * 60 * 60 * 1000;
            $('#cutoff-bar-date')[0].noUiSlider.set(new Date(time));
            
            sigInst.iterNodes(function(n) {
                if (!n.hidden) {
                    var node = three['scene'].getObjectByName('node_' + n.id);
                    if (!!node) {
                        if (!node.visible) {
                            node.visible = true;
                            node.scale.set(n.size, n.size, n.size);
                        } else {
                            if (node.material.opacity < 1) node.material.opacity += 0.02;
                        }
                    }
                    
                    var label = three['scene'].getObjectByName('label_' + n.id);
                    if (!!label) {
                        label.visible = true;
                        var padding = label.material.map.image.width/2 + node.geometry.boundingSphere.radius * n.size + 5;
                        label.position.set(node.position.x + padding, node.position.y, node.position.z);
                    }
                }
            }).iterEdges(function(e) {
                if (!e.hidden) {
                    var edge = three['scene'].getObjectByName('edge_' + e.id);
                    if (!!edge) {
                        var source = three['scene'].getObjectByName('node_' + edge.source), target = three['scene'].getObjectByName('node_' + edge.target);
                        if (!edge.visible && source.visible && target.visible) {
                            edge.visible = true;
                        } else {
                            if (edge.material.opacity < 1) edge.material.opacity += 0.02;
                        }
                    }
                }
            })
            
            return time <= opts['maxDate'] && state['three'];
        }, 15);
        
        state['startTime'] = new Date();
        render();
    }
    
    var buildLegend = function(step) {
        var canvas = $('#canvas-legend'), ctx = canvas[0].getContext('2d');
        
        ctx.clearRect(0, 0, canvas[0].width, canvas[0].height);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        
        var y1 = 12, y2 = 41;
        ctx.font = 'bold 14px Arial';
        ctx.fillText('Collaborations: ', 10, y1);
        ctx.fillText('Publications: ', 10, y2);
        
        ctx.font = 'bold 12px Arial';
        ctx.fillText('Least', 125, y1);
        ctx.fillText('Least', 125, y2);
        ctx.fillText('Most', 270, y1);
        ctx.fillText('Most', 270, y2);
        
        var index = 3, ix = 185, dx = 30;
        for (var i = 0; i < index; i++) {
            var c = shadeColor(opts['minColor'], opts['maxColor'], i/(index - 1));
            ctx.fillStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',1)';
            ctx.beginPath();
            ctx.arc(ix + i * dx, y1, 7, 0, 2 * Math.PI);
            ctx.fill();
        }
        
        var ir = 5, dr = 4;
        var c = shadeColor(opts['minColor'], opts['maxColor'], 0.5);
        ctx.fillStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',1)';
        for (var i = 0; i < index; i++) {
            ctx.beginPath();
            ctx.arc(ix + i * dx, y2, ir + i * dr, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
    
    var buildPIPanel = function(id) {
        var node = getNode(id);
        var edges = sigInst._core.graph.edges.filter(function(e) {
            return e.source.id == id || e.target.id == id;
        });
        
        var modal = $('#modal-pi');
        modal.find('.modal-title').html(node.label);
        var uniPMID = {};
        
        $('#publication-list').mCustomScrollbar('destroy');
        $('#publication-list').empty();
        
        _.each(edges, function(e) {
            for (var a in e['articles']) {
                if (!uniPMID.hasOwnProperty(a)) {
                    uniPMID[a] = {p: e['articles'][a], c: []};
                }
                
                var collaborator = e.source.id != id ? e.source.id : e.target.id;
                uniPMID[a]['c'].push(collaborator);
            }
        });
        
        var keys = Object.keys(uniPMID);
        keys.sort();
        keys.reverse();
        
        _.each(keys, function(pmid) {
            var paper = uniPMID[pmid], paperDiv;
            
            $('#publication-list').append(
                    '<div class="panel panel-default panel-publication" data-pmid="' + pmid + '">\
                        <div class="panel-heading">' + paper.p['name'] + '</div>\
                        <div class="panel-body">\
                            <div class="row data-loading">\
                                <div class="col-md-2"><label>Published in</label></div>\
                                <div class="col-md-10"><span class="publication-date"></span></div>\
                            </div>\
                            <div class="row">\
                                <div class="col-md-2"><label>Name</label></div>\
                                <div class="col-md-10"><span class="publication-name">' + paper.p['name'] + '</span></div>\
                            </div>\
                            <div class="row">\
                                <div class="col-md-2"><label>PubMed Link</label></div>\
                                <div class="col-md-10"><a href="http://www.ncbi.nlm.nih.gov/pubmed/' + pmid +  '" class="publication-pubmed">http://www.ncbi.nlm.nih.gov/pubmed/' + pmid + '</a></div>\
                            </div>\
                            <div class="row">\
                                <div class="col-md-2"><label>Collaborators</label></div>\
                                <div class="col-md-10"><div class="publication-collaborators"></div></div>\
                            </div>\
                            <div class="row data-loading">\
                                <div class="col-md-2"><label>Cited by</label></div>\
                                <div class="col-md-10"><span class="publication-citations"></span></div>\
                            </div>\
                            <div class="row data-loading">\
                                <div class="col-md-2"><label>Abstract</label></div>\
                                <div class="col-md-10"><span class="publication-abstract"></span></div>\
                            </div>\
                        </div>\
                    </div>');
            
            paperDiv = $('.panel-publication[data-pmid="'+ pmid + '"]');
            _.each(paper.c, function(collab) {
                paperDiv.find('.publication-collaborators').append('<div class="pi-icon pull-left" data-pi="' + collab + '"></div>');
            });
        });
        
        $('.panel-heading').click(function(e) {
            e.preventDefault();
            var panel = $(this).parent(), heading = $(this);
            
            $('.panel-heading.panel-active').removeClass('panel-active');
            heading.addClass('panel-active');
            
            if (panel.find('.panel-body').is(':hidden')) {
                var piIcons = panel.find('.publication-collaborators').children('.pi-icon');
                piIcons.each(function(icon) {
                    var el = $(piIcons[icon]);
                    el.css('background-position', parseInt(el.data('pi')) * -75 + 'px 0');
                });
                
                $('#publication-list').mCustomScrollbar('scrollTo', heading, { scrollInertia: 1000 });
                
                setTimeout(function() {
                    var pmid = $('.panel-active').parent().data('pmid');
                    $.ajax({
                        url: 'http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=PMID' + pmid + '&rettype=abstract', 
                        dataType : 'xml',
                        success: function(res) {
                            var xml = $(res);
                            var dat = xml.find('PubDate');
                            var abs = xml.find('AbstractText');
                            
                            if (!!abs) {
                                panel.find('.publication-abstract').html(abs.text()).closest('.row').slideDown(700);
                                panel.find('.publication-date').html(dat.find('Month').text() + ' ' + dat.find('Year').text()).closest('.row').slideDown(700);
                            }
                        },
                    });
                    
                    $.ajax({
                        url: 'citations/' + heading.text() + '/', 
                        dataType : 'json',
                        success: function(res) {
                            if (res['cited'] != null) {
                                panel.find('.publication-citations').html(res['cited']).closest('.row').slideDown(700);
                            }
                        },
                    });
                }, 1000);
            }
            
            panel.find('.panel-body').toggle();
        });
        
        $('#publication-list').mCustomScrollbar({
            axis: 'y',
            scrollButtons: { enabled: true },
            advance: {
                updateOnContentResize: true,
            },
        });
        
        $('.pi-image').css('background-position', -id * opts['piImageWidth'] + 'px 0');
        
        modal.modal({
            backdrop: 'static',
            keyboard: true,
        });
    }
    
    var loadAuthors = function() {
        $.ajax({
            url: opts['urls']['authors'], 
            dataType : 'json',
            success: function(nodes) {
                three.cloud = new THREE.Geometry();
                
                nodes.forEach(function(n) {
                    var node = {}
                    node.id = n.id;
                    node.label = n.name;
                    node.size = 2;
                    node.x = !isNaN(n.two.x) ? n.two.x : (Math.random() * 100);
                    node.y = !isNaN(n.two.y) ? n.two.y : (Math.random() * 100);
                    node.forceLabel = true;
                    
                    sigInst.addNode(node.id, node);
                    getNode(node.id).three = { x: n.three.x, y: n.three.y, z: n.three.z, color: n.color };
                    three.cloud.vertices.push(new THREE.Vector3(n.three.x, n.three.y, n.three.z));
                });
                
                three.cloud.computeBoundingSphere();
                three.cloud = three.cloud.boundingSphere;
                
                sigInst.iterNodes(function(n) {
                    n.three.x -= three.cloud.center.x;
                    n.three.y -= three.cloud.center.y;
                    n.three.z -= three.cloud.center.z;
                });
                
                loadArticles();
            },
        });
    }
    
    var loadArticles = function() {
        $.ajax({
            url: opts['urls']['articles'], 
            dataType : 'json',
            success: function(edges) {
                vizdata['articles'] = {};
                edges.forEach(function(e) {
                    var edge = {};
                    edge.source = e.s;
                    edge.target = e.t;
                    edge.id = edge.source + '+' + edge.target;
                    edge.label = '';
                    
                    var date = new Date();
                    date.setFullYear(e.d.substring(0, 4), e.d.substring(4, 6));
                    var time = date.getTime();
                    opts.minDate = Math.min(opts.minDate, time) || time;
                    opts.maxDate = Math.max(opts.maxDate, time) || time;
                    
                    edge.weight = edge.size = 1;
                    edge.color = '#' + opts['edgeColor'];
                    
                    var addedEdge = getEdge(edge.id);
                    if (!addedEdge) {
                        sigInst.addEdge(edge.id, edge.source, edge.target, edge);
                        addedEdge = getEdge(edge.id);
                        addedEdge.date = time;
                        addedEdge.articles = {};
                        addedEdge.articles[e.pmid] = { name: e.at, date: time, };
                        addedEdge.absweight = Math.abs(addedEdge.weight);
                    } else {
                        if (time < addedEdge.date) addedEdge.date = time;
                        if (!addedEdge.articles.hasOwnProperty(e.pmid)) addedEdge.articles[e.pmid] = {
                                name: e.at,
                                date: time,
                        }
                    }
                });
                
                buildUI();
                
                sigInst.iterEdges(function(e) {
                    for (key in e['attr']) {
                        e[key] = e['attr'][key];
                    }
                });
                
                $('#cutoff-bar-date')[0].noUiSlider.set(new Date(opts['minDate']));
                sigInst.draw();
            },
        });
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
        var pause = 0;
        
        if (moveRequired) {
            sigInst.goTo(x, y).draw();
            timeout = 150; // We know goTo needs 100ms, 50ms buffer just in case
        }
        
        setTimeout(function() {
            if (pause != 0) {
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
        }, pause);
    }
    
    var updateNetwork = function() {
        var val = parseInt($('#cutoff-bar-date')[0].noUiSlider.get()), uniPMID = {};
        var maxDegree = 0;
        
        sigInst.iterNodes(function(n) {
            n.visibleDegree = 0;
            n.colorDegree = 0;
        });
        
        sigInst.iterEdges(function(e) {
            e.hidden = e.date > val;
            e.size = 1;
            e.weight = 1;
            
            if (!e.hidden) {
                //Visible and size of the node scales with # of unique PMID
                for (var a in e.articles) {
                    if (!uniPMID.hasOwnProperty(a)) {
                        e.source.visibleDegree++;
                        e.target.visibleDegree++;
                        uniPMID[a] = null;
                    }
                    
                    if (e.articles[a].date < val) {
                        if (e.weight < 7) e.weight++;
                        e.size++;
                    }
                }
                
                //Color the node scales with # of collaboration
                e.source.colorDegree++;
                e.target.colorDegree++;
            }
        });
        
        var xMax, yMax, xMin, yMin;
        sigInst.iterNodes(function(n) {
            n.hidden = n.visibleDegree <= 0;
            if (!n.hidden) {
                if (n.degree > 2) n.size = Math.sqrt(n.visibleDegree * 25);
                maxDegree = Math.max(maxDegree, n.colorDegree);
                xMax = Math.max(xMax, n.x) || n.x;
                xMin = Math.min(xMin, n.x) || n.x;
                yMax = Math.max(yMax, n.y) || n.y;
                yMin = Math.min(yMin, n.y) || n.y;
            }
        });
        
        sigInst.iterNodes(function(n) {
            if (!n.hidden) {
                var c = shadeColor(opts['minColor'], opts['maxColor'], n.colorDegree/maxDegree), cHex = rgbToHex(c.r, c.g, c.b);
                n.color = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',1)';
            } else {
                n.x = (Math.random() * (xMax - xMin) / 3) + Math.abs(xMax - xMin) / 2;
                n.y = (Math.random() * (yMax - yMin) / 3) + Math.abs(yMax - yMin) / 2;
            }
        });
        
        sigInst.draw();
    }
    
    var toggleLayout = function() {
        if (!!state['runningLayout']) {
            sigInst.stopForceAtlas2();
            state['runningLayout'] = false;
        } else {
            sigInst.startForceAtlas2();
            state['runningLayout'] = true;
        }
    }
    
    var hexToRgb = function(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    var rgbToHex = function(r, g, b) {
        return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    
    var shadeColor = function(c1, c2, g) {
        c1 = hexToRgb(opts['minColor']);
        c2 = hexToRgb(opts['maxColor']);
        
        return { r: parseInt((c2.r - c1.r) * g + c1.r), g: parseInt((c2.g - c1.g) * g + c1.g), b: parseInt((c2.b - c1.b) * g + c1.b) };
    }
    
    var stripLetters = function(s) {
        return s.match(/\d/g).join('');
    }
    
    var getNode = function(id) {
        return sigInst._core.graph.nodesIndex[id];
    }
    
    var getEdge = function(id) {
        return sigInst._core.graph.edgesIndex[id];
    }
    
    return {
        init: init
    };
});
