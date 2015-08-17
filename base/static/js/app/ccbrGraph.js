define([
    'jquery',
    'underscore',
    'backbone',
    'noUISlider',
    
    'scrollbar',
    
    'bootstrap',
    'sigma',
    
    'sigma.forcelayout',
    'sigma.highlight',
    'sigma.move',
    'sigma.rotate'
], function($, _, Backbone, nouislider) {
    var sigInst, vizdata = {};
    
    var init = function() {
        var DEFAULTS = {
            arrows: false,
            colorScheme: 'black',
            debug: true,
            downloadLimit: 30,
            hideLayouts: false,
            highlight: false,
            layout: null,
            layoutAlgo: ['fl'],
            layoutButtonHide: true,
            minDate: null,
            piImageWidth: 132,
            piImageHeight: 198,
            rootElement: '#network-container',
            runningLayout: null,
        };
        $.extend(opts, DEFAULTS);
        
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
//            if (!opts.runningLayout) toggleLayout();
            buildPIPanel(targets.content[0]);
        }).bind('downnodes', function(targets) {
            if (opts.runningLayout) toggleLayout();
        });
        
        loadAuthors();
        sigInst.hoverHighlight();
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
            }).resize();
        });
        $('#ui-placeholder').remove();
        
        //Create and initialize date cutoff bar
        var slider = $('#cutoff-bar-date')[0];
        nouislider.create(slider, {
            range: {
                min: opts['minDate'],
                max: new Date().getTime(),
            },
            step: 7 * 24 * 60 * 60 * 1000,
            start: opts['minDate'],
            orientation: 'horizontal',
            direction: 'ltr',
        });
        
        slider.noUiSlider.on('set', updateNetwork)
        
        //Initialize toggle layout button
        $('#btn-toggle-layout').click(function(e) {
            e.preventDefault();
            toggleLayout();
        });
        
        
        
        
        //Fade in UI
        setTimeout(function() {
            $('#ui').fadeIn(1000);
            toggleLayout();
        }, 1000);
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
                    $('#publication-list').append(
                        '<div class="panel panel-default panel-publication" data-pmid="' + a + '">\
                            <div class="panel-heading">' + e['articles'][a]['name'] + '</div>\
                            <div class="panel-body">\
                                <div class="row data-loading">\
                                    <div class="col-md-2"><label>Published in</label></div>\
                                    <div class="col-md-10"><span class="publication-date"></span></div>\
                                </div>\
                                <div class="row">\
                                    <div class="col-md-2"><label>Name</label></div>\
                                    <div class="col-md-10"><span class="publication-name">' + e['articles'][a]['name'] + '</span></div>\
                                </div>\
                                <div class="row">\
                                    <div class="col-md-2"><label>PubMed Link</label></div>\
                                    <div class="col-md-10"><a href="http://www.ncbi.nlm.nih.gov/pubmed/' + a +  '" class="publication-pubmed">http://www.ncbi.nlm.nih.gov/pubmed/' + a + '</a></div>\
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
                    uniPMID[a] = null;
                }
                
                var collaborator = e.source.id != id ? e.source.id : e.target.id;
                $('.panel-publication[data-pmid="'+ a + '"] .publication-collaborators').append('<div class="pi-icon pull-left" data-pi="' + collaborator + '"></div>');
            }
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
        
        $('.pi-image').css('background-position-x', -id * 132 + 'px');
        
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
                nodes.forEach(function(n) {
                    var node = {}
                    node.id = n.id;
                    node.label = n.name;
                    node.size = 2;
                    node.x = !isNaN(node.x) ? node.x : (Math.random() * 1000);
                    node.y = !isNaN(node.y) ? node.y : (Math.random() * 1000);
                    node.forceLabel = true;
                    
                    sigInst.addNode(node.id, node);
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
                    
                    edge.weight = edge.size = 1;
                    edge.color = '#FF9126';
//                    edge.color = '#3399FF'
                    
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
                //Visible degree scales size of the node
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
                
                //Color degree scales color of the node
                e.source.colorDegree++;
                e.target.colorDegree++;
            }
        });
        
        sigInst.iterNodes(function(n) {
            n.hidden = n.visibleDegree <= 0;
            if (n.degree > 2) n.size = Math.sqrt(n.visibleDegree * 25);
            if (!n.hidden) maxDegree = Math.max(maxDegree, n.colorDegree);
        });
        
        sigInst.iterNodes(function(n) {
            if (!n.hidden) {
                var c1 = hexToRgb('#66FF33'), c2 = hexToRgb('#006ED9'), g = n.colorDegree/maxDegree;
                n.color = 'rgb(' + parseInt((c2.r - c1.r) * g + c1.r) + ',' + parseInt((c2.g - c1.g) * g + c1.g) + ',' + parseInt((c2.b - c1.b) * g + c1.b) + ')';
            }
        });
        
        var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], date = new Date(val);
        $('#cutoff-label').html(months[date.getMonth()] + ', ' + date.getFullYear());
        
        sigInst.draw();
    }
    
    var toggleLayout = function() {
        if (!!opts.runningLayout) {
            sigInst.stopForceAtlas2();
            opts.runningLayout = false;
        } else {
            sigInst.startForceAtlas2();
            opts.runningLayout = true;
        }
        
        $('#btn-toggle-layout').find('.btn-primary').html(opts.runningLayout ? 'Pause Layout' : 'Restart Layout');
    }
    
    var hexToRgb = function(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
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