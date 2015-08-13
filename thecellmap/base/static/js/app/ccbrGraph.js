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
            labelThreshold: 36,
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
                            <div class="panel-heading">' + e['articles'][a] + '</div>\
                            <div class="panel-body">\
                                <div class="row">\
                                    <div class="col-md-2"><label>Name</label></div>\
                                    <div class="col-md-10"><span class="publication-name">' + e['articles'][a] + '</span></div>\
                                </div>\
                                <div class="row">\
                                    <div class="col-md-2"><label>PubMed Link</label></div>\
                                    <div class="col-md-10"><a href="http://www.ncbi.nlm.nih.gov/pubmed/' + a +  '" class="publication-pubmed">http://www.ncbi.nlm.nih.gov/pubmed/' + a + '</a></div>\
                                </div>\
                                <div class="row">\
                                    <div class="col-md-2"><label>Collaborators</label></div>\
                                    <div class="col-md-10"><div class="publication-collaborators"></div></div>\
                                </div>\
                                <div class="row">\
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
                    el.css('background-position-x', parseInt(el.data('pi')) * -75 + 'px');
                });
                
                $('#publication-list').mCustomScrollbar('scrollTo', heading, { scrollInertia: 1000 });
                
                setTimeout(function() {
                    var pmid = $('.panel-active').parent().data('pmid');
                    $.ajax({
                        url: 'http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=text&id=PMID' + pmid + '&rettype=abstract', 
                        dataType : 'text',
                        success: function(abs) {
                            var maxStr = 0, paragraphs = abs.split('\n\n');
                            for (var p in paragraphs) {
                                if (paragraphs[p].indexOf('Author information') == -1) maxStr = paragraphs[p].length > paragraphs[maxStr].length ? p : maxStr;
                            }
                            $('.panel-publication[data-pmid="' + pmid + '"] .publication-abstract').html(paragraphs[maxStr]).slideDown(700);
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
                vizdata['edges'] = edges, vizdata['articles'] = {};
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
                    e.date = time;
                    
                    edge.weight = edge.size = 1;
                    edge.color = '#FF9126';
                    
                    var addedEdge = getEdge(edge.id);
                    if (!addedEdge) {
                        sigInst.addEdge(edge.id, edge.source, edge.target, edge);
                        addedEdge = getEdge(edge.id);
                        addedEdge.date = time;
                        addedEdge.articles = {};
                        addedEdge.articles[e.pmid] = e.at;
                        addedEdge.absweight = Math.abs(addedEdge.weight);
                        
                    } else {
                        if (time < addedEdge.date) addedEdge.date = time;
                        if (!addedEdge.articles.hasOwnProperty(e.pmid)) addedEdge.articles[e.pmid] = e.at
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
        
        sigInst.iterNodes(function(n) {
            n.visibleDegree = 0;
            n.colorDegree = 0;
        }).iterEdges(function(e) {
            e.hidden = e.date > val;
            e.size = 1;
            e.weight = 1;
            
            if (!e.hidden) {
                _.each(vizdata['edges'], function(edge) {
                    if (e.id == (edge.s + '+' + edge.t) && edge.date < val) {
                        if (e.weight < 7) e.weight++;
                        e.size++;
                    }
                });
                
//                //Color degree scales color of the node
//                if (!uniPMID.hasOwnProperty(e.pmid)) {
//                    e.source.colorDegree++;
//                    e.target.colorDegree++;
//                    uniPMID[e.pmid] = null;
//                }
//                
//                //Visible degree scales size of the node
//                e.source.visibleDegree++;
//                e.target.visibleDegree++;
                
                //Visible degree scales color of the node
                for (var a in e.articles) {
                    if (!uniPMID.hasOwnProperty(a)) {
                        e.source.visibleDegree++;
                        e.target.visibleDegree++;
                        uniPMID[a] = null;
                    }
                }
                
                //Color degree scales size of the node
                e.source.colorDegree++;
                e.target.colorDegree++;
            }
        });
        
        var maxDegree = 0;
        sigInst.iterNodes(function(n) {
            if (n.degree > 2) n.size = Math.sqrt(n.visibleDegree * 25);
            n.hidden = n.visibleDegree <= 0;
            if (!n.hidden) maxDegree = Math.max(maxDegree, n.colorDegree);
        }).iterNodes(function(n) {
            n.color = shadeColor('#01AEF0', -Math.log(n.colorDegree/maxDegree) * 100);
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
    
    var shadeColor = function(color, percent) {
        var r = Math.min(parseInt(parseInt(color.substring(1,3),16) * (100 + percent) / 100), 255);
        var g = Math.min(parseInt(parseInt(color.substring(3,5),16) * (100 + percent) / 100), 255);
        var b = Math.min(parseInt(parseInt(color.substring(5,7),16) * (100 + percent) / 100), 255);
        
        return '#' + ((r.toString(16).length==1)?'0' + r.toString(16):r.toString(16)) +
                     ((g.toString(16).length==1)?'0' + g.toString(16):g.toString(16)) +
                     ((b.toString(16).length==1)?'0' + b.toString(16):b.toString(16));
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