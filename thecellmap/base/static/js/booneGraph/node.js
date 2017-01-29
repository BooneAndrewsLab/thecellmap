define([
    'jquery',
    'underscore',
    'underscore.strings',
    'backbone',
    'strainModel',
    
    'annotation',
    'layout',
    'settings',
    'utils',
    
    'select2',
    'sigma.searchlocator',
], function($, _, _str, Backbone, StrainModel, 
    Annotation, Layout, Settings, Utils) {
    
    var initSelect2 = function (callback) {
        $.ajax({
            url : opts.urls['nodes'],
            dataType : 'json',
            success : function(data) {
                var strains = vizdata['strains'], nodes = data['nodes'], annotations = vizdata['annotations'], i;
                
                var autocomp = [], tokens, node;
                autocomp.length = nodes.length;
                for (i in nodes) {
                    node = nodes[i];
                    
                    node['o'] = node.orf.toLowerCase();
                    node['n'] = node.name && node.name.toLowerCase();
                    node['a'] = node.alel && node.alel.toLowerCase();
                    node['aliases'] = node.aliases;
                    node['verboseName'] = node.label || node.alel || node.name || node.orf;
                    
                    tokens = [node.o];
                    if (!!node.n) tokens.push(node.n);
                    if (!!node.a) tokens.push(node.a);
                    
                    node['terms'] = tokens;
                    vizdata.index[node.id] = i;
                    
                    var tokens = node.terms;
                    for (a in node.aliases) {
                        if (node.aliases[a].length) tokens.push(node.aliases[a]);
                    }
                    
                    autocomp[i] = {
                        value: node.verboseName,
                        tokens: tokens,
                        id: node.id,
                    };
                }
                
                strains.reset(nodes);
                
//                    addAttributeLayouts();
                
                var tokenizing = false, selChoices, preSelectSize = 0;
                $('input.gene-search-input').select2({
                    multiple: true,
                    minimumInputLength: 2,
                    containerCssClass: 'form-control', 
                    placeholder: 'Search TheCellMap',
                    allowClear: true,
                    width: '350px',
                    tokenSeparators: [',', ' ', '\t', '\n'],
                    initSelection: function (element, callback) {
                        var id = $(element).val(), strain, result = [];
                        id.split(',').forEach(function(x) {
                            if (x !== '') {
                                var annot = state.get('annotation');
                                if (x.indexOf('annot') == 0) {
                                    x = parseInt(x.replace('annot', ''));
                                    for (var term in annotations.get(annot).get('terms')) {
                                        if (x == term) {
                                            result.push({
                                                text: 'Annotation: ' + annotations.get(annot).get('terms')[term].name,
                                                id: 'annot' + x
                                            });
                                        }
                                    }
                                } else if (x.indexOf('action_loadannot') == 0) {
                                    x = x.replace('action_loadannot', '');
                                    result.push({
                                        text: 'Load:' + x,
                                        id: 'action_loadannot' + x
                                    });
                                } else if (x.indexOf('action_selectall') == 0) {
                                    x = x.replace('action_selectall', '');
                                    result.push({
                                        text: 'Select all following strains',
                                        id: 'action_selectall'
                                    });
                                } else {
                                    strain = Utils.getStrain(x);
                                    if (!!strain) {
                                        result.push({
                                            text: strain.get('verboseName'),
                                            id: strain.get('id')
                                        });
                                    } else {
                                        result.push({
                                            text: 'Custom data',
                                            id: x
                                        });
                                    }
                                }
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
                        separator,
                        wasTokenizing = false; // the matched separator
                        
                        if (!opts.createSearchChoice || !opts.tokenSeparators || opts.tokenSeparators.length < 1) return undefined;
                        if (input.split(/[\s,\t\n]/).length > 1 && !/[\s,\t\n]/.test(input.slice(-1))) {
                            input = input.split(/[\s,\t\n]/).join() + ',';
                        } else if (Math.abs(preSelectSize - input.length) >= 2 && preSelectSize >= 2) {
                            input = input + ',';
                            preSelectSize = 0;
                        } else {
                            preSelectSize = input.length;
                        }
                        
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
                                    if( Object.prototype.toString.call( tokens ) !== '[object Array]' ) {
                                        tokens = [tokens];
                                    }
                                    
                                    tokens.forEach(function(token) {
                                        if (opts.id(token) !== undefined && opts.id(token) !== null) {
                                            dupe = false;
                                            for (i = 0, l = selection.length; i < l; i++) {
                                                if (opts.id(token) == opts.id(selection[i])) {
                                                    dupe = true; break;
                                                }
                                            }
                                            
                                            if (!dupe) {
                                                wasTokenizing = true;
                                                selectCallback(token);
                                            }
                                        }
                                    });
                                }
                            }
                        }
                        
                        tokenizing = false;
                        if (wasTokenizing)
                            $('input.gene-search-input').trigger('change');
                        
                        if (original !== input) return input;
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
                                        var text = node.value.toLowerCase().indexOf(node.tokens[x].toLowerCase()) != -1 ? node.value : node.value + '  -  ' + node.tokens[x]
                                        data.results.push({id: node.id, text: text});
                                        break;
                                    }
                                }
                            }
                        });
                        
                        if (annotations.get(state.get('annotation'))) {
                            var aterm, aterms = annotations.get(state.get('annotation')).get('terms'), acount = 0;
                            
                            for (aterm in aterms) {
                                if (aterms.hasOwnProperty(aterm) && aterms[aterm].name.toLowerCase().indexOf(term) != -1) {
                                    data.results.unshift({id: 'annot' + aterm, text: 'Annotation: ' + aterms[aterm].name });
                                    acount++;
                                }
                                if (acount > 2) break; // List only 3 terms max
                            }
                        }
                        
                        var acount = 0;
                        $(opts.annotations).each(function(idx, annotation) {
                            if (('load ' + annotation.name.toLowerCase()).indexOf(term) != -1 && annotation.name != state.get('annotation')) {
                                data.results.unshift({id: 'action_loadannot ' + annotation.name, text: 'Load: ' + annotation.name});
                                acount++;
                            }
                            
                            if (acount > 1) return false;
                        });
                        
                        var currentSel = state.get('selection');
                        selChoices = data.results.filter(function(r) {
                            return (r.id + '').indexOf('action') == -1 && currentSel.indexOf(r.id + '') == -1;
                        });
                        
                        data.results = data.results.slice(0, 6);
                        
                        if (data.results.length > 1) {
                            data.results.push({id: 'action_selectall', text: 'Select all ' + selChoices.length + ' matched strains'});
                        }
                        
                        query.callback(data);
                    },
                    data: autocomp,
                }).on('change', function(evt, a, b, c) {
                    if (tokenizing) return;
//                    console.log('change');
                    var selected = Utils.getSelectedNodes(true), selection = Utils.getSelection();
                    var reselect, numVisibleSelected = 0, strain, actualSelection;
                    preSelectSize = 2;
                    
                    for (var i in selection) {
                        if (selection[i].indexOf('action_loadannot ') != -1) {
                            Annotation.loadAnnotation(selection[i].replace('action_loadannot ', ''));
                            actionAnnot = false;
                        } else if (selection[i].indexOf('action_selectall') != -1) {
                            selChoices = _.pluck(selChoices, 'id');
                            $('input.gene-search-input').select2('val', Utils.getSelectedNodes().concat(selChoices), true);
                            reselect = true;
                        }
                    }
                    
                    if (reselect) return;
                    
                    var moveOn = true, found = false;
                    sigInst.iterNodes(function(node) {
                        if (node.id.indexOf('tmp_') != -1) return;
                        if (state.get('showCircular')) var tmpNode = Utils.getNode('tmp_' + node.id);
                        
                        if ($.inArray(node.id + '', selected) >= 0) {
                            if (tmpNode) tmpNode.selected = true;
                            node.selected = found = true;
                            
                            if (node.hidden) {
                                if (!selected.hasOwnProperty(node.id)) {
                                    Utils.messageUser('Gene you\'re looking for is below current threshold.');
                                }
                            } else {
                                if (tmpNode) tmpNode.forceLabel = true;
                                node.forceLabel = true;
                                numVisibleSelected++;
                            }
                            
                        } else {
                            if (tmpNode) tmpNode.selected = tmpNode.forceLabel = false;
                            node.selected = node.forceLabel = false;
                        }
                    });
                    
                    var diff = $(selected).not(state.get('selection')).get(), missingNodes = { labels: [], ids: [] };
                    _.each(diff, function(n) {
                        var node = Utils.getNode(n), strain = Utils.getStrain(n);
                        if (!node) {
                            missingNodes['labels'].push(strain['attributes']['verboseName']);
                            missingNodes['ids'].push(strain['attributes']['id'] + '');
                        }
                    });
                    
                    if (missingNodes['ids'].length) {
                        Utils.messageUser('Genetic interaction profile similarities for "' + missingNodes['labels'].join() + '" do ' +
                                'not exceed the default Pearson correlation coefficient (PCC) threshold.', null, missingNodes['ids']);
                    } else {
                        $('#panel-alerts').hide();
                    }
                    
                    actualSelection = $(selected).not(missingNodes['ids']).get();
                    
                    sigInst.drawingProperties({drawSelectedPin: actualSelection.length < 10});
                    
//                    sigInst.draw(1, -1, 1); // TODO: fix this to redraw only nodes, there is a bug where the edges would disappear
                    sigInst.draw();
                    
                    if (state.get('selection').length > 0) {
                        state.set('preselect', state.get('selection'));
                    }
                    
                    if (state.get('annotation') == 'None' && state.get('showRegions') && actualSelection.length > 0) {
                        Annotation.loadAnnotation(opts.default_annotation);
                    }
                    
                    state.set('selection', actualSelection);
                    
                    if (!!actualSelection.length && !state.get('isInitializing') && state.get('step') < 1) {
                        state.set('step', 1);
                    }
                    
                    var maxHeight = Math.min($('.search-bar .select2-choices li').length / 4, 3);
                    $('.search-bar .select2-choices').css('max-height', Math.max(Math.round(maxHeight), 1) * 34 + 'px');
                });
                
                if (callback) callback();
            }
        });
    }
    
    var applyCutoff = function(cutoff) {
        var isArray = $.isArray(cutoff), selected = Utils.getSelectedNodes(), strain;
        var showCircular = state.get('showCircular');
        
        if (isArray) {
            state.set('cutoffInteraction', cutoff);
        } else {
            state.set('cutoffCorrelation', cutoff);
        }
        
        sigInst.iterNodes(function(node) {
            node.visibleDegree = node.degree;
        }).iterEdges(function(edge) {
            if (isArray) {
                if (edge.id.indexOf('tmp') != -1 && showCircular) {
                    edge.hidden = (cutoff[0] < edge.weight && edge.weight < cutoff[1]);
                } else if (edge.id.indexOf('tmp') == -1 && showCircular && edge._hidden) {
                    edge.hidden = edge._hidden;
                } else {
                    edge.hidden = (cutoff[0] < edge.weight && edge.weight < cutoff[1]) || edge.ds != state.get('dataset');
                }
            } else {
                edge.hidden = Math.abs(edge.weight) < cutoff || edge.ds != state.get('dataset');
            }
            
            if (edge.hidden || edge.source._hidden || edge.target._hidden) {
                edge.source.visibleDegree--;
                edge.target.visibleDegree--;
            }
        }).iterNodes(function(node) {
            strain = Utils.getStrain(node.id);
            node.hidden = ((node._hidden || node.visibleDegree <= 0) && selected.indexOf(strain.get('id') + '') == -1); // either we manually hid the node or it's not connected to anything
        });
        
        state.set('showRegions', false);
        Settings.updateLabels();
        Annotation.rebuildLegend();
        
        if (state.get('showCircular')) {
            Layout.circularFunc(state.get('centerNode'));
        }
        if (state.get('dataset') == 0 && state.get('subnetworks')) applyNeighbourhood(1);
        
        sigInst.draw();
    }
    
    var applyNeighbourhood = function(level) {
        state.set('showRegions', false);
        state.set('subnetworks', true);
        
        state.set('step', 2);
        
        var selected = Utils.getSelectedNodes(false, true), localSelected = {}, tmpSelected, strain;
        if (selected.length < 1) return;
        
        _.each(selected, function(id) {
            localSelected[id] = null;
        });
        
        for (var l = 0; l < level; l++) {
            tmpSelected = {};
            sigInst.iterEdges(function(edge) {
                if ((!edge.source._hidden && !edge.target._hidden) && 
                    (localSelected.hasOwnProperty(edge.source.id) || localSelected.hasOwnProperty(edge.target.id)) &&
                    edge.ds == state.get('dataset') && !edge.hidden) {
                    tmpSelected[edge.source.id] = null;
                    tmpSelected[edge.target.id] = null;
                }
            });
            localSelected = $.extend({}, localSelected, tmpSelected);
        }
        
        sigInst.iterNodes(function(node) {
//            if (node.type == 'pin') {
//                node.hidden = node._hidden = true;
//                return;
//            }
            
            strain = Utils.getStrain(node.id);
            if (!localSelected.hasOwnProperty(strain.id)) {
                node.hidden = true;
            }
        });
        
        sigInst.draw();
        Settings.updateLabels();
        
        var layoutType = 'force';
        if (state.get('annotation') != 'None') {
            Annotation.rebuildLegend();
            layoutType = 'force+';
        }
        if (Utils.countVisibleNodes() > 2) Layout.toggleLayout(layoutType);
    }
    
    var showNodeModal = function(id) {
        var modal = $('#modal-edit-node'), node = Utils.getNode(id), strain = Utils.getStrain(id), data = vizdata['annotations'].get(state.get('annotation'));
        var annot, term, color;
        
        modal.find('.modal-title').html('Node details: "' + node.label + '"');
        
        modal.find('#node-orf').html(strain.get('orf'));
        modal.find('#node-name').html(strain.get('name'));
        modal.find('#node-allele').html(strain.get('alel'));
        
        modal.find('#edit-node-id').val(id);
        modal.find('#edit-node-label').val(node.label);
        modal.find('#edit-node-color').parent().colorpicker('setValue', node.color);
//        modal.find('#edit-node-color').val(node.color).focus().blur().change();
        modal.find('#edit-node-label-force').prop('checked', !!node.forceLabel);
        modal.find('#edit-node-size-multiplier').val(node.size_mult || 1);
        
        $('#node-annotation-table').empty();
        
        annot = data.get('map')[strain.get('orf')] || ['-1'];
        
        var terms = data.get('terms'), colorPalette = data.get('colorPalette');
        if (annot.length > 1) {
            term = terms['-2'];
            $('#node-annotation-table').append('<tr class="annotation-row" data-term="' + term.idx + '">\
                    <td><div class="input-group bs-colorpicker annotation-color">\
                        <input type="hidden" value="' + colorPalette[term.idx] + '" class="form-control" />\
                        <span class="input-group-addon"><i></i></span>\
                    </div></td>\
                    <td>' + term.name + '</td>\
                    <td><input type="radio" name="dominant"></td></tr>');
        }
        
        annot.forEach(function(a) {
            if (terms.hasOwnProperty(a)) {
                term = terms[a];
                color = colorPalette[term.idx];
            }
            
            $('#node-annotation-table').append('<tr class="annotation-row" data-term="' + term.idx + '">\
                    <td><div class="input-group bs-colorpicker annotation-color">\
                        <input type="hidden" value="' + color + '" class="form-control" />\
                        <span class="input-group-addon"><i></i></span>\
                    </div></td>\
                    <td>' + term.name + '</td>\
                    <td><input type="radio" name="dominant"></td></tr>');
        });
        
        $('#node-annotation-table input[value="' + node.color + '"]').closest('tr').find('input[type="radio"]').prop('checked', true);
        
        $('#node-annotation-table .bs-colorpicker').colorpicker().on('changeColor', function(e){
            if ($(this).closest('tr').find('input[name=dominant]').prop('checked')) {
                modal.find('#edit-node-color').parent().colorpicker('setValue', e.color.toHex());
            }
        });
        
        $('#node-annotation-table input[name=dominant]').change(function() {
            modal.find('#edit-node-color').parent().colorpicker(
                    'setValue', 
                    $('#node-annotation-table input[name=dominant]:checked').closest('tr').find('.bs-colorpicker').colorpicker('getValue'));
        });
        
        modal.modal('show');
    }
    
    var editNode = function() {
        var modal = $('#modal-edit-node');
        var node = Utils.getNode(parseInt(modal.find('#edit-node-id').val())), colorsChanged = false;
        node.label = modal.find('#edit-node-label').val();
        node.color = modal.find('#edit-node-color').parent().colorpicker('getValue').toUpperCase();
        node.forceLabel = modal.find('#edit-node-label-force').prop('checked');
        node.size_mult = parseInt(modal.find('#style-slider-snsize')[0].noUiSlider.get());
        node.size = node.size_init * node.size_mult;
        modal.find('.annotation-color').each(function() {
            var color = $(this).colorpicker('getValue'), annotation = vizdata['annotations'].get(state.get('annotation'));
            console.log(color);
            if (annotation.get('colorPalette')[$(this).closest('tr').data('term')] != color) {
                annotation.get('colorPalette')[$(this).closest('tr').data('term')] = color;
                colorsChanged = true;
            }
        });
        
        if (colorsChanged) {
            Annotation.applyAnnotationColors();
            Annotation.rebuildLegend();
        } else {
            sigInst.draw();
        }
        modal.modal('hide');
    }
    
    return {
        initSelect2: initSelect2,
        
        applyCutoff: applyCutoff,
        applyNeighbourhood: applyNeighbourhood,
        showNodeModal: showNodeModal,
        editNode: editNode,
    };
});