require.config({
    paths: {
        'jquery': 'libs/jquery-2.1.4.min',
        'bootstrap': 'libs/bootstrap.min',
        'bootstrap-sortable': 'libs/bootstrap-sortable',
        'bootstrap-tabdrop': 'libs/bootstrap-tabdrop',
        'select2': 'libs/select2',
        'mmenu': 'libs/jquery.mmenu.all.min',
        'hammer':'libs/hammer.min',
        'ladda': 'libs/ladda',
        'spin': 'libs/ladda-spin',
        'filedownload': 'libs/jquery.fileDownload'
    },
    shim: {
        'bootstrap': ['jquery'],
        'select2': ['jquery'],
        'bootstrap-sortable': ['bootstrap'],
        'bootstrap-tabdrop': ['bootstrap'],
        'mmenu':['jquery'],
        'ladda':['spin'],
        'filedownload': ['jquery'],
    }
});

require([
    'jquery','spin','ladda','mmenu', 'bootstrap-sortable', 'bootstrap-tabdrop', 'select2','hammer','filedownload'
], function($,Spinner,Ladda) {
    //selection node array keeps track of already selected strains, prevents users from selecting duplicates
    var selectionNode = [];
    $('.tab-pane[data-node]').each(function(){selectionNode.push($(this).data('node'))});
    var nodeNeighbors = {};

    //download function, for single strain and download all
    var downloading = function(e){
        //single
        if ($(this).hasClass('downloadable')){
            var l = Ladda.create(this);
            var id = $(this).parent('a').attr('title')
            $.fileDownload('../dl/?n=' + $(this).data('node'), {
                prepareCallback: function (url) { 
                    l.start();
                },
                successCallback: function(url) {
                    l.stop();
                    
                },
                failCallback: function(responseHtml, url) {
                },
                cookieName: id
            });
        };
        //download all
        if ($(this).hasClass('dlall') || $(this).hasClass('mmenu-dl')){
            var l = Ladda.create(this);
            if (selectionNode.length == 1){
                var id = $('.list-group-item.active.round').attr('title')
                l.start();
                $.fileDownload('../dl/' + window.location.search, {
                    successCallback: function(url) {
                        l.stop();
                    },
                    failCallback: function(responseHtml, url) {
                    },
                    cookieName: id
                });
            }
            else if (selectionNode.length <= 20){
                l.start();
                $.fileDownload('../dl/' + window.location.search, {
                    successCallback: function(url) {
                        l.stop();
                    },
                    failCallback: function(responseHtml, url) {
                    },
                    cookieName: 'fileDownload'
                });
            }
            else{
                $(".col-xs-12").prepend('<div class="alert alert-warning fade in">\
                                             <button class="close pull-left" aria-hidden="true" data-dismiss="alert" type="button">x</button>\
                                             Too many strains to selected.  "Download All" is limited to a maximum of 20 strains.\
                                         </div>');
            }
        }
        e.stopPropagation();
        e.preventDefault();
    };
    
    //add strain function;
    var newStrain = function(e, stateChange){
            var selected = e.val;
            strain = strainMap[selected];
            if (selectionNode.indexOf(strain.id) != -1) {
                return;
            }
            
            selectionNode.push(strain.id);
            var strainTitle = strain.verboseName;
            if (strain.verboseName.length > 10){
                strain.verboseName = strain.verboseName.substring(0,7) + '...'
            }
            //append new selected strain to mmenu list
            $('#strain-tabs').find('.mm-listview').append('<li  id ="strain-tab' + strain.id + '">\
                                                               <a class="strain-links" href="#tab' + strain.id + '" data-toggle="tab" title=' + strainTitle + '>\
                                                                   <button class="btn btn-xs btn-danger pull-left" >\
                                                                       <span class="glyphicon glyphicon-remove"></span>\
                                                                   </button>\
                                                                   <button class="btn downloadable btn-xs ladda-button" data-node="' + strain.id + '"\
                                                                   data-style="slide-down" data-spinner-color="#222">\
                                                                       <span class = "ladda-label">\
                                                                           <span class="glyphicon glyphicon-download-alt"></span>\
                                                                       </span>\
                                                                   </button>\
                                                                   '+ strain.orf + ' (' + strainTitle + ')'+'\
                                                               </a>\
                                                           </li>');
            //append download ability to newly added strain
            $('#mmenu .downloadable[data-node="' + strain.id + '"]').click(downloading);
            //add removal ability to new strain
            $('#mmenu .downloadable[data-node="' + strain.id + '"]').prev('.btn-danger').click(function(e){
                var removalID = $(this).next('.downloadable').data('node');
                $('.list-group#strain-tabs-large a[href="#tab'+removalID+'"]').children('.btn-danger').click();
                if (selectionNode.length == 0){
                    API.close();
                }
                e.stopPropagation();
                e.preventDefault();
            });
            //refresh mmenu list
            API.init( $("#strain-tabs") );
            //append new selected strain to list group
            $('#strain-tabs-large').append('<a class="list-group-item round" href="#tab' + strain.id + '" data-toggle="tab" title=' + strainTitle + '>\
                                                ' + strain.verboseName + ''+'\
                                                <button class="btn btn-xs btn-danger pull-left" >\
                                                    <span class="glyphicon glyphicon-remove"></span>\
                                                </button>\
                                                <button class="btn downloadable btn-warning list-strains ladda-button btn-xs" data-node=' + strain.id + ' \
                                                data-style="slide-down" data-spinner-color="#222">\
                                                <span class="ladda-label">\
                                                    <span class="glyphicon glyphicon-download-alt"></span>\
                                                </span>\
                                                </button>\
                                            </a>');
            //add download ability to strain
            $('#strain-tabs-large .downloadable[data-node="' + strain.id + '"]').click(downloading);
            //add removal ability to strain
            $('.list-group#strain-tabs-large .downloadable[data-node="' + strain.id + '"]').prev('.btn-danger').click(function(e){
                var removalID = $(this).next('.downloadable').data('node');
                
                if ($(this).parent().hasClass('active') && $(this).parent().next('.list-group-item.round').length !== 0){
                    $(this).parent().next('.list-group-item.round').click();
                }
                if ($(this).parent().hasClass('active') && $(this).parent().next('.list-group-item.round').length == 0 && $(this).parent().prev('.list-group-item.round').length !== 0){
                    $(this).parent().prev('.list-group-item.round').click();
                }
                $($(this).parent().attr('href')).remove();
                var index = selectionNode.indexOf(removalID);
                if (index > -1) {
                    selectionNode.splice(index, 1);
                }
                $("#mmenu li#strain-tab"+removalID).remove();
                $(this).parent().remove();
                
                changeUrl();
                e.stopPropagation();
                e.preventDefault();
            });
            //add new tab-pane for new strain
            $('#strain-tabs-content').append('<div class="tab-pane" id="tab' + strain.id + '" data-node=' + strain.id + ' data-label="' + strainTitle +'"> </div>');
            //cause newly added strain to load and display
            $('#mmenu a[href="#tab' + strain.id + '"]').click();
            //close searchbar box
            $('.gene-search-input').select2('close');
            //update URL
            if (stateChange == null){
                changeUrl();
            }
            //hide/unhide menus
            $('.alert').addClass('hidden');
            $('.removeable').removeClass('hidden')
            hammerSwitch = 1;
            if (stateChange == null){
                e.preventDefault();
            }
        };

    //adds entries to the table up to the cut off value, keeps track of the cut off value for the load more button
    var add_to_table = function(tbody, data, val_idx, node_id) {
      if (data.length == 0) return;
      var i, row, isNeighbor, ele = tbody.find('.row-more');
      var ctf =  data[0][val_idx] < 0 ? -1 : 1;
      var func = data[0][val_idx] < 0 ? Math.max : Math.min;
      data.forEach(function (line) {
          row = '';
          isNeighbor = nodeNeighbors[node_id].indexOf(line[0]) != -1;
          for (i = 0; i < line.length; i++) {
              val = line[i];
              if (isNeighbor && i == line.length - 1) {
                  row += '<td data-value="' + val + '">' + val + '<span class="badge pull-right" data-toggle="tooltip" data-placement="top" title="This gene is located immediately adjacent to the selected gene">Neighbor</span></td>';
              } else {
                  row += '<td data-value="' + val + '">' + val + '</td>';
              }
          }
          
          ctf = func(line[val_idx], ctf);
          if (isNeighbor) {
              row = $('<tr class="nf">' + row + '</tr>');
              row.find('.badge').tooltip();
              tbody.append(row);
              
          } else {
              tbody.append('<tr>' + row + '</tr>');
          }
      });
      var location = tbody.parent().parent()
      location.find('.load-more').data('cutoff', ctf);
    }
    
    //url changing function
    var changeUrl = function(){
        var url = '?n=' + selectionNode[0]
        for (var j = 1, k = selectionNode.length; j<k; j++){
            url = url + '&n=' +selectionNode[j]
        }
        if (selectionNode.length == 0){
            url = '?';
            $('.alert').removeClass('hidden');
            $('.removeable').addClass('hidden');
            
            hammerSwitch = 0;
        }
        history.pushState({},'',url);
    }
    
    //turn on touch responsive elements
    var hammerSwitch = 1;
    
    //generate strain tables
    var load_strain = function(target) {
        //function applies to strains when they are first loaded
        if (!$.trim(target.html()) && !target.hasClass('data-loading')) {
            var node_id = parseInt(target.data('node'));
//            var strain = selectionNode.get(node_id);
            console.log(selectionNode);
            target.addClass('data-loading');
            
            //spinner for when table is loading
            var spinner = new Spinner({top: '30px',position: 'relative'}).spin()
            target.append(spinner.el)
            
            $.get(node_id + '/', function(d) {
                //generate all three tables for the strain upon loading (tables contain no entries at this point)
                // set up table for current strain by editing the html
                var tableSelect = '.tab-pane[data-node="'+node_id+'"] .Ctables ';
                $('.master').clone().removeClass('master hidden').appendTo(target);
                $(tableSelect + '.correlations').attr('id',"c" + node_id);
                $(tableSelect + '.negative').attr('id',"s" + node_id);
                $(tableSelect + '.positive').attr('id',"q" + node_id);
                $(tableSelect + '.correlations .panel-title').append(target.data('label') + ': Profile Similarities');
                $(tableSelect + '.negative .panel-title').append(target.data('label') + ': Negative Interactions');
                $(tableSelect + '.positive .panel-title').append(target.data('label') + ': Positive Interactions');
                
                if (!!d.neighbor_effect) {
                    var msg = "Genetic interaction profile may have a modest neighbor effect"; 
                    $(tableSelect + '.correlations .panel').removeClass('panel-default').addClass('panel-danger');
                    $(tableSelect + '.negative .panel').removeClass('panel-default').addClass('panel-danger');
                    $(tableSelect + '.positive .panel').removeClass('panel-default').addClass('panel-danger');
                    
                    $(tableSelect + '.correlations .panel-heading').append('<small>' + msg + '</small>');
                    $(tableSelect + '.negative .panel-heading').append('<small>' + msg + '</small>');
                    $(tableSelect + '.positive .panel-heading').append('<small>' + msg + '</small>');
                }
                
                nodeNeighbors[node_id] = d.neighbors;
                
                //fill tabels with entries up to cut off point
                add_to_table($('#c' + node_id + ' tbody'), d.correlations, 2, node_id);
                add_to_table($('#q' + node_id + ' .score-pos tbody'), d.scores_pos, 2, node_id);
                add_to_table($('#s' + node_id + ' .score-neg tbody'), d.scores_neg, 2, node_id);
                //sets the table when the stain first loads to match the current selected table
                target.find($(".right.list-group a.active").data('target')).addClass('active');
                //signals end of loading for tables
                target.removeClass('data-loading');
                spinner.stop();
                $(".table-fade").fadeTo('2000',1.0);
                //set up sortablity on tables
                $('.table.sortable').removeClass('sortable');
                $('.tab-pane[data-node="'+node_id+'"] .table').addClass('sortable');
                $.bootstrapSortable(false);
                $('.table').addClass('sortable');
                //Load All Button
                target.find('.load-more').click(function() {
                    var clicked = $(this);
                    //sets ladda button for loading visuals on button
                    var l = Ladda.create(this);
                    l.start();
                    //function start delayed to ensure ladda animations don't suddenly stop
                    setTimeout(function(){
                        var data = {};
                        data[clicked.data('ds')] = clicked.data('cutoff');
                        var id = parseInt(clicked.closest('.tab-pane[data-node]').data('node'));
                        var location = clicked.closest('.panel-body');
                        $.get(id + "/", data, function(d) {
                            add_to_table(location.find('tbody'), d, 2, id);
                            clicked.remove();
                            update_links();
                        });
                    },500);
                });
                update_links();
            });
        }
    };
    
    //following two click events ensure table selector is consistent between mobile and desktop
    //in list group table selector transfer same selection to mmenuT and load the selected table
    $(".right.list-group a").click(function(){
        $('.right.list-group a.active').removeClass('active');
        $(this).addClass('active');
        $('#mmenuT li.active').removeClass('mm-selected active');
        $('#mmenuT li a[data-target="'+$(this).data('target')+'"]').parent().addClass('mm-selected active');
        $('.tab-pane.active .tab-pane.active').removeClass('active');
        $('.tab-pane.active '+$(".right.list-group a.active").data('target')+'').addClass('active');
    });
    //in mmenuT table simply clicks the list group version
    $("#mmenuT a").click(function(){
        $(".right.list-group a[data-target='" +$(this).data('target')+ "']").click();
    });
    
    //provides links on table entries
    var update_links = function() {
        $('.tab-pane.active table tbody tr td:first-child:not([colspan=3]):not([colspan=4])').click(function() {
            window.open('http://www.yeastgenome.org/cgi-bin/locus.fpl?locus=' + $(this).data('value'), '_blank');
        });
    }
    var strainMap = {};
    
    //search function select2 set up
    var initSelect2 = function() {
        $.getJSON(opts['nodesUrl'], function(data) {
            var autocomp = [], strain, tokens;
            for (i in data.nodes) {
                strain = data.nodes[i];
                strain.o = strain.orf.toLowerCase();
                tokens = [strain.o];
                strain.n = strain.name && strain.name.toLowerCase();
                if (!!strain.n) tokens.push(strain.n);
                strain.a = strain.alel && strain.alel.toLowerCase();
                if (!!strain.a) tokens.push(strain.a);
                strain.verboseName = strain.label || strain.alel || strain.name || strain.orf;
                strain.terms = strain.terms || tokens;
                strainMap[strain.id] = strain;
                autocomp.push({
                    value: strain.verboseName,
                    tokens: strain.terms,
                    id: strain.id
                });
            }
            //generates searchbox
            var tokenizing = false;
            $("input.gene-search-input").select2({
                multiple: true,
                minimumInputLength: 2,
                containerCssClass: 'form-control', 
                placeholder: 'Search for more genes...',
                allowClear: true,
                width: '100%!important',
                tokenSeparators: [",", " ", "\t", "\n"],
                initSelection: function (element, callback) {
                    var id = $(element).val(), strain, result = [];
                    id.split(",").forEach(function(x) {
                        if (x !== "") {
                            strain = strainMap[x];
                            
                            result.push({
                                text: strain.verboseName,
                                id: strain.id
                            });
                        }
                    });
                    callback(result);
                },
                tokenizer: function (input, selection, selectCallback, opts) {
                    var original = input, // store the original so we can compare and know if we need to tell the search to update its text
                    dupe = false, // check for whether a token we extracted represents a duplicate selected choice
                    token, // token
                    index, // position at which the separator was found
                    i, l, // looping variables
                    separator; // the matched separator
                    
                    if (!opts.createSearchChoice || !opts.tokenSeparators || opts.tokenSeparators.length < 1) return undefined;
                    
                    tokenizing = true;
                    while (true) {
                        index = -1;
                        for (i = 0, l = opts.tokenSeparators.length; i < l; i++) {
                            separator = opts.tokenSeparators[i];
                            index = input.indexOf(separator);
                            if (index >= 0) break;
                        }
                        if (index < 0) break; // did not find any token separator in the input string, bail
                        token = input.substring(0, index);
                        input = input.substring(index + separator.length);
                        if (token.length > 0) {
                            var tokens = opts.createSearchChoice.call(this, token, selection);
                            if (tokens !== undefined && tokens !== null) {
                                if( Object.prototype.toString.call( tokens ) !== '[object Array]' ) tokens = [tokens];
                                tokens.forEach(function(token) {
                                    if (opts.id(token) !== undefined && opts.id(token) !== null) {
                                        dupe = false;
                                        for (i = 0, l = selection.length; i < l; i++) {
                                            if (opts.id(token) == opts.id(selection[i])) {
                                                dupe = true; break;
                                            }
                                        } 
                                        if (!dupe) {
                                            selectCallback(token);
                                            
                                        }
                                    }
                                });
                            }
                        }
                    }
                    tokenizing = false;
                    if (original!==input) return input;
                },
                
                createSearchChoice: function(term) {
                    
                    var wildcard = term.indexOf('*') != -1;
                    term = term.replace('*', '').toLowerCase();
                    if (term.length > 0) {
                        var results = [], seen = {};
                        autocomp.forEach(function(node) {
                            
                            node.tokens.forEach(function(token) {
                                
                                if (!seen.hasOwnProperty(node.id) && ((wildcard && token.toLowerCase().startsWith(term)) || token.toLowerCase() === term)) {
                                    
                                    results.push({id: node.id, text: node.value });
                                    seen[node.id] = 0;
                                    return;
                                }
                            });
                        });
                        if (results.length !== 0) return results;
                    }
                },
                
                query: function(query) {
                    if (query.term === undefined) {
                        query.callback({results: []});
                        return;
                    }
                    var data = {results: []}, term = query.term.replace('*', '').toLowerCase();
                    autocomp.forEach(function(node) {
                        if (query.term.length == 0){
                            
                            data.results.push({id: node.id, text: node.value });
                        } else {
                            for (var x in node.tokens) {
                                if (node.tokens[x].toLowerCase().indexOf(term) !== -1) {
                                    var duplicate = 0;
                                    //check if search entry is already a selected strain
                                    for (var j = 0, k = selectionNode.length; j<k; j++){
                                        if(node.id == selectionNode[j]){
                                            duplicate = 1;
                                        }
                                    }
                                    if(!duplicate){
                                        data.results.push({id: node.id, text: node.value });
                                        break;
                                    }
                                }
                            }
                        }
                    });
                    data.results = data.results.slice(0, 6);
                    query.callback(data);
                },
                data: autocomp,
            //add new strain to each list that contains strains 
            
            }).on('select2-selecting', newStrain);
            //fade in searchbar
            $(".tab-sfade").fadeTo('1000',1.0);

        });
    }
    
    //shorten strain names in tabs if needed
    $('.list-group-item.round').each(function(){
        if ($(this).text().trim().length > 10){
            var id = $(this).children('.downloadable').data('node');
            $(this).text($(this).text().trim().substring(0,7) + '...');
            $(this).append('<button class="btn btn-xs btn-danger pull-left" >\
                                                         <span class="glyphicon glyphicon-remove"></span>\
                                                     </button>\
                                                     <button class="btn downloadable btn-warning list-strains ladda-button btn-xs" data-node='+id+' \
                                                     data-style="slide-down" data-spinner-color="#222">\
                                                     <span class="ladda-label">\
                                                         <span class="glyphicon glyphicon-download-alt"></span>\
                                                     </span>\
                                                     </button>');
        }       
     });
    
    //initalize searchbar
    initSelect2();
    //following two click event functions link the strain tabs for list group and mmenu
    //mmenu simply clicks the equivalent list group item
    $('#mmenu').on('click', 'a', function(e) {
        if(!$(this).hasClass('dropdown-toggle')){
            $('.list-group#strain-tabs-large a[href="'+$(this).attr('href')+'"]').click();
            e.preventDefault();
        }
    });
    //list group item performs changes to both list group and mmenu
    $('.list-group#strain-tabs-large').on('click', 'a', function(e) {
        var id = $(this).children('.downloadable').data('node');
        $('.left.list-group a.active').removeClass('active');
        load_strain($($(this).attr('href')));
        $(this).addClass('active');
        $('#mmenu li.active.mm-selected').removeClass('active mm-selected')
        $('#mmenu li#strain-tab'+id).addClass('active mm-selected')
        e.preventDefault();
    });
    
    //set remove strain button
    $('.list-group#strain-tabs-large .btn-danger').click(function(e){
            var removalID = $(this).next('.downloadable').data('node');
            if ($(this).parent().hasClass('active') && $(this).parent().next('.list-group-item.round').length !== 0){
                $(this).parent().next('.list-group-item.round').click();
            }
            if ($(this).parent().hasClass('active') && $(this).parent().next('.list-group-item.round').length == 0 && $(this).parent().prev('.list-group-item.round').length !== 0){
                $(this).parent().prev('.list-group-item.round').click();
            }
            $($(this).parent().attr('href')).remove();
            var index = selectionNode.indexOf(removalID);
            if (index > -1) {
                selectionNode.splice(index, 1);
            }
            $("#mmenu li#strain-tab"+removalID).remove();
            $(this).parent().remove();
            changeUrl();
            e.stopPropagation();
            e.preventDefault();
    });
    $('#mmenu .btn-danger.pull-left').click(function(e){
            var removalID = $(this).next('.downloadable').data('node');
            $('.list-group#strain-tabs-large a[href="#tab'+removalID+'"]').children('.btn-danger').click();
            if (selectionNode.length == 0){
                API.close();
            }
            e.stopPropagation();
            e.preventDefault();
    });
    
    //set download all button
    $(document).on("click", ".list-group#strain-tabs-large .btn.dlall, #mmenu #download-all .btn", downloading);
    
    //loads deafualt strain or warning message when page first loaded
    if (selectionNode.length!==0){
        load_strain($('.container .tab-pane.active'));
        $('.removeable').removeClass('hidden')
    };
    if (selectionNode.length==0){
        $('.alert').removeClass('hidden');
        $('.removeable').addClass('hidden')
        hammerSwitch = 0;
    }
    $(".tab-fade").fadeTo('1000',1.0);
    
    //update page based on web history
    window.onpopstate = function(){
        //if url is empty remove strains
        if (window.location.search===""){
            var tab = $('a.list-group-item.round .btn-danger')
            if (tab.parent().hasClass('active') && tab.parent().next('.list-group-item.round').length !== 0){
                tab.parent().next('.list-group-item.round').click();
            }
            if (tab.parent().hasClass('active') && tab.parent().next('.list-group-item.round').length == 0 && tab.parent().prev('.list-group-item.round').length !== 0){
                tab.parent().prev('.list-group-item.round').click();
            }
            $(tab.parent().attr('href')).remove();
            selectionNode = []
            $("#mmenu li.active").remove();
            tab.parent().remove(); 
            $('.alert').removeClass('hidden');
            $('.removeable').addClass('hidden');
            hammerSwitch = 0;
        }
        //check selectionNode vs urlnodes
        else{
            var supposedStrains = window.location.search;
            var track = 0;
            var SSlist = [];
            var added = '';
            for (i in supposedStrains){
                if (supposedStrains[i]==='='){
                    track = 1;
                }
                if (supposedStrains[i]==='&'){
                    track = 0;
                }
                if (track == 0 && added!== ''){
                    SSlist.push(parseInt(added));
                    added = '';
                }
                if (track == 1 && supposedStrains[i]!=='='){
                    added = added + supposedStrains[i];
                }
            }
            SSlist.push(parseInt(added));
            //add strains
            if (SSlist.length > selectionNode.length){
                for (i in SSlist){
                    if ($.inArray(SSlist[i],selectionNode)==-1){
                        var id = SSlist[i];
                        newStrain({val:id},1);
                    }
                }
            }
            //remove strains
            if (SSlist.length < selectionNode.length){
                for (i in selectionNode){
                        if ($.inArray(selectionNode[i],SSlist)==-1){
                            var id = selectionNode[i];
                            var tab = $('a.list-group-item.round[href="#tab'+id+'"] .btn-danger')
                            var removalID = tab.next('.downloadable').data('node');
                            
                            if (tab.parent().hasClass('active') && tab.parent().next('.list-group-item.round').length !== 0){
                                tab.parent().next('.list-group-item.round').click();
                            }
                            if (tab.parent().hasClass('active') && tab.parent().next('.list-group-item.round').length == 0 && tab.parent().prev('.list-group-item.round').length !== 0){
                                tab.parent().prev('.list-group-item.round').click();
                            }
                            $(tab.parent().attr('href')).remove();
                            var index = selectionNode.indexOf(removalID);
                            if (index > -1) {
                                selectionNode.splice(index, 1);
                            }
                            $("#mmenu li#strain-tab"+removalID).remove();
                            tab.parent().remove();
                            
                    }
                }
            }
        }
    }

    //generate mmenu of strain tabs
    $("#mmenu").mmenu({
        //options
        navbar:{
            title:"Strains"
        }
    }, {//configuration
        offCanvas:{
            pageSelector:".content,header"
            }
        });
    $("#mmenu").removeClass('hidden')
    var API = $("#mmenu").data( "mmenu" );

    //generate mmenu of table tabs
    $("#mmenuT").mmenu({
        offCanvas:{
          position: "right"
        },
        //options
        navbar:{
            title:"Tables"
        }
    },{
    offCanvas:{
        pageSelector:".content,header",
        }
    });
    $("#mmenuT").removeClass('hidden');
    var API2 = $("#mmenuT").data( "mmenu" );
    $("#mmenuT ul li a").click(function() {
        API2.close();
    });
    $(".tabs-hidden").removeClass('hidden');
    
    //set download buttons
    $('#mmenu .downloadable, #strain-tabs-large .downloadable').click(downloading);
    

    //Hammer swipe functionality for mobile sized screens
    //set touchable areas on page
    var hammerTarget = document.getElementById('tabPage');
    var hammerMmenu = document.getElementById('mmenu');
    var hammerMmenuT = document.getElementById('mmenuT');
    var mc = new Hammer(hammerTarget);
    var mcMmenu = new Hammer(hammerMmenu);
    var mcMmenuT = new Hammer(hammerMmenuT);
    
    // listen to events...
    mc.on("swipeleft swiperight", function(ev) {
        if (($(".hidden-xs").is(':hidden')) &&hammerSwitch==1){
            switch(ev.type){
            case 'swiperight': API.open();API2.close(); break;
            case 'swipeleft': API.close();API2.open(); break;
            }
        }
    });
    mcMmenu.on("swipeleft", function(ev) {
        if (ev.type == 'swipeleft' && hammerSwitch==1){
            mpanel = 0;
            API.close();
        }
    });   
    mcMmenuT.on("swiperight", function(ev) {
        if (ev.type == 'swiperight' && hammerSwitch==1){
            mpanel = 0;
            API2.close();
        }
    });
    
    window.show_table = function(data) {
        var i;
        for (i = 0; i < data.length; i++) {
            newStrain({val:data[i]}, 1);
        }
    };
});
