define([
    'jquery',
    'underscore',
    'backbone',
    'jquery.cookie',
    'settings',
    
    'bootstrap',
    'fileReader',
    'jquery.parser',
    'select2',
    'xls',
    'xlsx',
    'wizard',
], function($, _, Backbone, Cookies, Settings) {
    var results = null, genes = null, maxid = 0, seen, workbook, nodeAttrs, wizard;
    var networkName, fileType, isFirst = true, isPrivate = localStorage.getItem('isPrivate') || false, overlay = null, dataType = 'C', networkType = 'U';
    var colMap = {
        source: null,
        target: null,
        weight: null,
        nodes: null,
        x: null,
        y: null
    };
    var sheetMap = {
        edges: null,
        nodes: null
    };
    var annotMap = {};
    
    var getGeneObj = function (label, nodes, layout) {
        var gene, id, obj;
        
        if (genes.hasOwnProperty(label)) {
            gene = genes[label];
            if (seen.hasOwnProperty(gene.id)) return seen[gene.id];
            id = gene.id, obj = gene;
        } else {
            if (seen.hasOwnProperty(label)) return seen[label];
            id = ++maxid, obj = {orf: label, id: maxid, label: label};
            seen[label] = obj;
        }
        if (nodeAttrs && nodeAttrs.hasOwnProperty(label)) {
            // Add any extra annotation
            obj.attributes = nodeAttrs[label];
        };

        nodes.push(obj);
        if (obj.attributes != undefined && obj.attributes['x'] != undefined && obj.attributes['y'] != undefined) {
            layout.push({x: parseFloat(obj.attributes['x']), y: parseFloat(obj.attributes['y']), id: id});
            delete obj.attributes['x'];
            delete obj.attributes['y'];
        } else {
            layout.push({x: Math.random() * 2000 - 1000, y: Math.random() * 2000 - 1000, id: id});
        }
        seen[id] = obj;
        return obj;
    }
    
    var processWorkbook = function(workbook, nodes, layout, dataset, annotations) {
        var gene, src, dst, id, obj, h, an;
        nodeAttrs = {};
        seen = {};
        
        if (workbook.SheetNames.indexOf(sheetMap['nodes']) != -1) {
            toArray(workbook.Sheets[sheetMap['nodes']]).forEach(function(row) {
                obj = {};
                
                for (h in row)
                    if (row.hasOwnProperty(h) && h.indexOf('__') != 0 && h != colMap['nodes'] && annotMap[h] != null) {
                        obj[annotMap[h]] = row[h];
                        
                        if (!annotations.hasOwnProperty(annotMap[h]))
                            annotations[annotMap[h]] = {terms: {}, map: {}, idx: {}, i: 0};
                        
                        an = annotations[annotMap[h]];
                        if (!an.idx.hasOwnProperty(row[h])) an.idx[row[h]] = an.i++;
                        if (!an.terms.hasOwnProperty(an.idx[row[h]])) an.terms[an.idx[row[h]]] = {name: row[h]};
                        
                        if (!an.map.hasOwnProperty(row[colMap['nodes']])) an.map[row[colMap['nodes']]] = [];
                        an.map[row[colMap['nodes']]].push(an.idx[row[h]]);
                    }
                nodeAttrs[row[colMap['nodes']]] = obj;
            });
        }
        
        toArray(workbook.Sheets[sheetMap['edges']]).forEach(function(row) {
            obj = {};
            for (h in row) if (row.hasOwnProperty(h) && h.indexOf('__') != 0) obj[h] = row[h];
            
            src = getGeneObj(obj[colMap['source']], nodes, layout);
            dst = getGeneObj(obj[colMap['target']], nodes, layout);
            
            if (colMap['weight'] == null) row[colMap['weight']] = 0.21;
            dataset.push({s: src.id, t: dst.id, w: row[colMap['weight']] });
        });
    };
    
    var processCsv = function(data, nodes, layout, dataset) {
        var gene, src, dst, id, obj; 
        seen = {};
        data.results.rows.forEach(function(row) {
            [row[colMap['source']], row[colMap['target']]].forEach(function(g, idx) {
                gene = getGeneObj(g, nodes, layout);
                if (idx == 0) src = gene.id;
                else if (idx == 1) dst = gene.id;
            });
            if (colMap['weight'] == null) row[colMap['weight']] = 0.21;
            dataset.push({s: src, t: dst, w: row[colMap['weight']] });
        });
    }
    
    var loadSheets = function(workbook) {
        $('#on-load').addClass('hidden');
        $('#after-load').removeClass('hidden');
        $('#sheet-selection .list-group').empty();
        
        for (var i = 0; i < workbook.SheetNames.length; i++) {
            var id = workbook.SheetNames[i].replace(/[\. ,:]+/g, '-');
            
            $('#sheet-selection .list-group').append('<li class="list-group-item">Sheet: ' + workbook.SheetNames[i] +
                    '<select id="' + id + '" class="sheet-selection pull-right"><option></option>\
                    <option value="default">Not in Use</option><option value="edges">Edges</option><option value="nodes">Nodes</option></select>');
            $('#' + id).select2({
                placeholder: 'Sheet',
                minimumResultsForSearch: -1
            });
            
            for (key in sheetMap) {
                var name = id.replace('sheet', '').replace(/[\. ,:]+/g, '');
                var diff = levDist(key, name.toLowerCase()), maxLength = Math.max(key.length, name.length);
                
                if (diff/maxLength < 0.5 || (key == 'edges' && workbook.SheetNames.length == 1)) {
                    sheetMap[key] = workbook.SheetNames[i];
                    $('#' + id).val(key).change();
                }
            }
            
            if (sheetMap['nodes'] == null) {
                wizard.cards['nodes-column'].disable();
            } else {
                wizard.cards['nodes-column'].enable();
            }
        }
        
        $('.wizard-buttons-container').removeClass('hidden');
        $('#sheet-selection select').on('change', function(e) {
            var index = $(this).attr('id'), val = e.val, selects = $('select').not('#' + index);
            for (key in sheetMap) {
                if (sheetMap[key] == index) sheetMap[key] = null;
            }
            if (val != 'default') {
                sheetMap[val] = index;
                for (var i = 0; i < selects.length; i++) if ($(selects[i]).find('option:selected').val() == val) $(selects[i]).val('default').change();
            }
            if (sheetMap['nodes'] == null) {
                wizard.cards['nodes-column'].disable();
            } else {
                wizard.cards['nodes-column'].enable();
            }
            isFirst = true;
        });
    }
    
    var loadTable = function(workbook) {
        $('.selection').empty();
        
        for (var i = 0; i < workbook.SheetNames.length; i++) {
            var sheet = workbook.SheetNames[i], sheetId = sheet.replace(/[\. ,:]+/g, '-');
            var sheetData = toArray(workbook.Sheets[sheet]);
            
            var table = $('#data-table').clone().removeAttr('id'), body = table.find('tbody'), row;
            
            if (sheet == sheetMap['nodes'] && wizard.cards['nodes-column'].isDisabled()) continue;
             
            for (field in sheetData[0]) {
                var fieldId = field.replace(/[\. ,:-]+/g, '');
                
                if (field == '__rowNum__') continue;
                if (sheet == sheetMap['edges']) {
                    table.find('thead tr').append('<th><select id="' + fieldId + '" class="column-selection">\
                            <option></option><option value="default">Not in Use</option><option value="source">Source</option>\
                            <option value="target">Target</option><option value="weight">Weight</option></select></th>');
                    
                    table.find('#' + fieldId).select2({
                        minimumResultsForSearch: -1,
                        width: '150px'
                    });
                } else if (sheet == sheetMap['nodes']) {
                    table.find('thead tr').append('<th><input type="hidden" class="column-input" id="' + fieldId + '"></th>');
                    table.find('#' + fieldId).select2({
                        createSearchChoice:function(term, data) { 
                            if ($(data).filter(function() {return this.text.localeCompare(term)===0;}).length === 0) return {id:term, text:term}; 
                        },
                        multiple: false,
                        data: [{id: 'default', text: 'Not in Use'}, {id: 'nodes', text: 'Nodes'}, {id: 'x', text: 'X-Coordinates'}, {id: 'y', text: 'Y-Coordinates'}],
                        width: '150px'
                    });
                }
                
                for (key in colMap) {
                    var diff = levDist(key, fieldId.toLowerCase()), maxLength = Math.max(key.length, fieldId.length);
                    if (diff/maxLength < 0.5 && colMap[key] == null) {
                        colMap[key] = field;
                        table.find('#' + fieldId).val(key).change();
                    }
                }
            }
            autoColumn(sheet, sheetData);
            for (field in sheetData[0]) {
                var fieldId = field.replace(/[\. ,:-]+/g, ''), inMap = false;
                if (field == '__rowNum__') continue;
                for (key in colMap) if (fieldId == colMap[key]) inMap = true;
                if (!inMap && annotMap[fieldId] == null) {
                    table.find('#' + fieldId).select2('data', {id: fieldId, text: fieldId});
                    annotMap[fieldId] = fieldId;
                } else if (annotMap[fieldId] != null) {
                    table.find('#' + fieldId).select2('data', {id: annotMap[fieldId], text: annotMap[fieldId]});
                }
            }
            for (key in colMap) {
                if (colMap[key] != null) {
                    table.find('#' + colMap[key]).val(key).change();
                    if (key == 'x' || key == 'y') annotMap[colMap[key]] = key;
                }
            }
            count = 0;
            sheetData.forEach(function(r) {
                row = $('<tr></tr>');
                for (cell in r) {
                    if (count >= 5) break;
                    if (cell == '__rowNum__') continue;
                    row.append('<td>' + r[cell] + '</td>');
                }
                if (count < 5) body.append(row);
                count++;
            });
            for (key in sheetMap) if (sheet == sheetMap[key]) $('#selection-' + key).append(table);
        }
        isFirst = false;
        $('.column-selection select').on('change', function(e) {
            var index = $(this).attr('id'), val = e.val, selects = $('.column-selection select').not('#' + index);
            for (key in colMap) if (colMap[key] == index) colMap[key] = null;
            if (val != 'default') {
                colMap[val] = index;
                for (var i = 0; i < selects.length; i++) if ($(selects[i]).find('option:selected').val() == val) $(selects[i]).val('default').change();
            }
        });
        
        $('.column-input').on('change', function(e) {
            var index = $(this).attr('id'), val = e.val, selects = $('.column-input').not('#' + index);
            if (val != 'nodes' && val != 'default') {
                for (key in colMap) if (colMap[key] == index) colMap[key] = null;
                annotMap[index] = val;
                if (val == 'x' || val == 'y') colMap[val] = index;
            } else {
                for (key in colMap) if (colMap[key] == index) colMap[key] = null;
                if (val != 'default') {
                    colMap[val] = index;
                } else {
                    annotMap[index] = null;
                }
            }
            if (val != 'default') for (var i = 0; i < selects.length; i++) if ($(selects[i]).val() == val) $(selects[i]).val('default').change();
        });
    }
    
    var loadCsv = function(data, name) {
        $('#sheet-selection .list-group').empty();
        $('#edges-column-selection').find('.selection').empty();
        $('#on-load').addClass('hidden');
        $('#after-load').removeClass('hidden');
        $('#sheet-selection .list-group').append('<li class="list-group-item">Sheet: ' + name.replace('.csv', '') + '\
                <select id="edges-sheet" class="sheet-selection pull-right"><option></option>\
                <option value="edges">Edges</option></select>');
        $('#edges-sheet').select2({
            minimumResultsForSearch: -1
        });
        $('#edges-sheet').val('edges').change();
        
        var table = $('#data-table').clone().removeAttr('id'), body = table.find('tbody'), row;
        autoColumn(null, data.results.rows);
        
        data.results.fields.forEach(function(field) {
            table.find('thead tr').append('<th><select id="' + field + '" class="column-selection column-selection-button">\
                    <option></option><option value="default">Not in Use</option><option value="source">Source</option>\
                    <option value="target">Target</option><option value="weight">Weight</option></select></th>');
            table.find('#' + field).select2({
                minimumResultsForSearch: -1
            });
            
            for (key in colMap) {
                var diff = levDist(key, field.toLowerCase()), maxLength = Math.max(key.length, field.length);
                if (diff/maxLength < 0.5 && colMap[key] == null) {
                    colMap[key] = field;
                    table.find('#' + field).val(key).change();
                } else if (colMap[key] != null) {
                    table.find('#' + colMap[key]).val(key).change();
                }
            }
        });
        
        count = 0;
        data.results.rows.forEach(function(r) {
            row = $('<tr></tr>');
            for (cell in r) {
                if (count >= 5) break;
                row.append('<td>' + r[cell] + '</td>');
            }
            if (count < 5) body.append(row);
            count++;
        });
        
        isFirst = false;
        
        $('#edges-column-selection').find('.selection').append(table);
        $('.wizard-buttons-container').removeClass('hidden');
        $('.column-selection select').on('change', function(e) {
            var index = $(this).attr('id'), val = e.val;
            var selects = $('.column-selection select').not('#' + index);
            
            for (key in colMap) if (colMap[key] == index) colMap[key] = null;
            if (val != 'default') {
                colMap[val] = index;
                for (var i = 0; i < selects.length; i++) {
                    if ($(selects[i]).find('option:selected').val() == val)
                        $(selects[i]).val('default').change();
                }
            }
        });
    }
    
    var autoColumn = function(sheet, data) {
        var i = 0, rows = [];
        data.forEach(function(row) {
            if (i > 30) return;
            rows.push(row);
            i++;
        });
        
        var sortedData = {};
        rows.forEach(function(row) {
            for (cell in row) {
                if (sortedData[cell] == undefined) sortedData[cell] = [];
                sortedData[cell].push(row[cell]);
            }
        });
        
        for (col in sortedData) {
            var s = t = w = 0;
            if (sheet == sheetMap['edges']) {
                sortedData[col].forEach(function(value) {
                    _.each(genes, function(gene) {
                        if (gene.orf == value){
                            if (colMap['source'] == null ) {
                                s++;
                            } else if (colMap['target'] == null) {
                                n++;
                            }
                        }
                    });
                    if ($.isNumeric(value)) w++;
                });
                if (Math.max(s, t, w) == s && colMap['source'] == null) colMap['source'] = col;
                else if (Math.max(s, t, w) == t && colMap['target'] == null) colMap['target'] = col;
                else if (Math.max(s, t, w) == w && colMap['weight'] == null && s != w && t != w) colMap['weight'] = col;
            } else if (sheet == sheetMap['nodes']) {
                var n = x = y = z = 0;
                sortedData[col].forEach(function(value) {
                    _.each(genes, function(gene) {
                        if (gene.orf == value && colMap['node'] == null ) s++;
                    });
                    if ($.isNumeric(value)) {
                        if (colMap['x'] == null) {
                            x++;
                        } else if (colMap['y'] == null) {
                            y++;
                        }
                    } else {
                        z++;
                    }
                });
                if (Math.max(n, x, y) == n && colMap['nodes'] == null) colMap['nodes'] = col;
                else if (Math.max(x, y, z) == x && colMap['x'] == null) colMap['x'] = col;
                else if (Math.max(x, y, z) == y && colMap['y'] == null) colMap['y'] = col;
            }
        }
    }
    
    var messageUser = function(id, text) {
        var alert = $('<div class= "alert alert-danger fade in"> \
            <button class="close" aria-hidden="true" data-dismiss="alert" type="button">x</button> \
            ' + text + ' </div>');
        $('#' + id).empty();
        $('#' + id).append(alert);
        alert.alert();
    }
    
    var toArray = function(sheet) {
        if (fileType == 'xls') {
            return XLS.utils.sheet_to_row_object_array(sheet);
        } else if (fileType == 'xlsx') {
            return XLSX.utils.sheet_to_row_object_array(sheet);
        }
    }
    
    var levDist = function(s, t) {
        var d = [], n = s.length, m = t.length;
        if (n == 0) return m;
        if (m == 0) return n;
        for (var i = n; i >= 0; i--) d[i] = [];
        for (var i = n; i >= 0; i--) d[i][0] = i;
        for (var j = m; j >= 0; j--) d[0][j] = j;
        for (var i = 1; i <= n; i++) {
            var s_i = s.charAt(i - 1);
            for (var j = 1; j <= m; j++) {
                if (i == j && d[i][j] > 4) return n;
                var t_j = t.charAt(j - 1), cost = (s_i == t_j) ? 0 : 1;
                var mi = d[i - 1][j] + 1, b = d[i][j - 1] + 1, c = d[i - 1][j - 1] + cost;
                if (b < mi) mi = b;
                if (c < mi) mi = c;
                d[i][j] = mi;
                if (i > 1 && j > 1 && s_i == t.charAt(j - 2) && s.charAt(i - 2) == t_j) {
                    d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
                }
            }
        }
        return d[n][m];
    }
    
    var init = function() {
        Settings.initialize();
        $.get(opts['genesUrl'], function(data) {
            genes = {};
            data.forEach(function(gene) {
                maxid = Math.max(gene.id, maxid);
                if (!!gene.alel) {
                    genes[gene.alel] = gene;
                    return;
                }
                genes[gene.orf] = gene;
                gene.label = gene.orf;
                if (gene.name != '' && gene.name != null) {
                    gene.label = gene.name;
                    genes[gene.name] = gene;
                }
                if (gene.aliases != null) {
                    gene.aliases.forEach(function(a) {
                        if (genes.hasOwnProperty(a) == -1) genes[a] = gene;
                    });
                }
            });
        });
        
        wizard = $('#custom-setting-wizard').wizard({contentHeight: 500, contentWidth: 800});
        
        wizard.cards['sheet-selection'].on('validate', function(card) {
            $('alerts-panel-sheets').empty();
            if (fileType != 'csv' && sheetMap['edges'] == null) {
                messageUser('alerts-panel-sheets', 'Must have an <strong>edges</strong> sheet');
                return false;
            }
            if (fileType != 'csv' && isFirst) loadTable(workbook);
            $('.alert-danger').addClass('hidden');
            return true;
        });
        
        wizard.cards['nodes-column'].on('validate', function(card) {
            $('alerts-panel-nodes').empty();
            if (colMap['nodes'] == null && !wizard.cards['nodes-column'].isDisabled()) {
                messageUser('alerts-panel-nodes', 'Must have a <strong>nodes</strong> column');
                return false;
            } else if (colMap['x'] != null && colMap['y'] == null) {
                messageUser('alerts-panel-nodes', 'Must have a <strong>Y-Coordinate</strong> column');
                return false;
            } else if (colMap['y'] != null && colMap['x'] == null) {
                messageUser('alerts-panel-nodes', 'Must have a <strong>X-Coordinate</strong> column');
                return false
            }
            $('.alert-danger').addClass('hidden');
            return true;
        });
        
        wizard.cards['edges-column'].on('validate', function(card) {
            $('alerts-panel-edges').empty();
            if (colMap['source'] == null || colMap['target'] == null) {
                messageUser('alerts-panel-edges', 'Must have a <strong>source</strong> and <strong>target</strong> column');
                return false;
            }
            return true;
        });
        
        if (wizard.cards['settings-card'] != undefined) {
            wizard.cards['settings-card'].on('validate', function(card) {
                var val = $('#network-name').val();
                if ((val != null || val != undefined) && val.length > 32) {
                    messageUser('alerts-panel-settings-card', 'The name of the network must be under <strong>32</strong> characters.');
                    return false;
                }
                networkName = $('#network-name').val();
                return true;
            });
        }
        
        $('.modal').on('hidden.bs.modal', function (e) {
            $('#on-load').removeClass('hidden');
            $('#after-load').addClass('hidden');
            $('#sheet-selection .list-group').empty();
            for (key in colMap) colMap[key] = null;
            for (key in sheetMap) sheetMap[key] = null;
            annotMap = {};
            isFirst = true;
        });
        
        $('.modal').on('show.bs.modal', function (e) {
            if (isPrivate == settings.get('isPrivate')) {
                $('#network-private').prop('checked', isPrivate);
            } else {
                $('#network-private').prop('checked', settings.get('isPrivate'));
            }
        });
        
        $('#network-private').change(function() {
            isPrivate = this.checked;
        });
        
        $('#overlay-selection').change(function() {
            overlay = $(this).val();
        });
        
        $('#dataset-type').change(function() {
            dataType = $(this).val();
        });
        
        $('#network-type').change(function() {
            networkType = $(this).val();
        });
        
        $('input[type=file]').bootstrapFileInput();
        $('input[type=file]').click(function() {
            this.value = null;
        }).change(function() {
            var f = this.files[0], reader = new FileReader(), name = f.name;
            fileType = name.split('.').pop();
            wizard.show();
            $('.wizard-buttons-container').addClass('hidden');
            if (fileType != 'csv') {
                setTimeout(function() {
                    reader.onload = function(e) {
                        var data = e.target.result;
                        if (fileType == 'xls') {
                            workbook = XLS.read(data, {type:'binary'});
                        } else if (fileType == 'xlsx') {
                            workbook = XLSX.read(data, {type:'binary'});
                        } else {
                            alert('Incompatible file types');
                        }
                        loadSheets(workbook);
                    };
                    reader.readAsBinaryString(f);
                }, 500);
            } else {
                $(this).parse({
                    before: function(data) {
                    },
                    error: function(data) {
                    },
                    complete: function(data) {
                        wizard.cards['nodes-column'].disable();
                        workbook = data;
                        loadCsv(workbook, name);
                    }
                });
            }
            
        });
        
        wizard.on('submit', function(wizard) {
            var nodes = [], layout = [], dataset = [], annotations = {};
            if (fileType != 'csv') {
                processWorkbook(workbook, nodes, layout, dataset, annotations);
            } else {
                processCsv(workbook, nodes, layout, dataset);
            }
            
            $.ajax({
                dataType: 'json', 
                data: {
                   'csrfmiddlewaretoken': Cookies.get('csrftoken'), 
                   'nodes': JSON.stringify({nodes: nodes}), 
                   'layout': JSON.stringify({nodes: layout}), 
                   'dataset': JSON.stringify({edges: dataset}),
                   'private': isPrivate,
                   'name': networkName,
                   'overlay': overlay,
                   'type': dataType,
                   'network-type': networkType
                },
                type: 'post',
                url: '.', 
                success: function(data) {
                    window.location.href = data['url'];
                }
            }).always(function() { 
            }).fail(function(e) { 
            });
        });
    };
    
    return {
        init: init
    };
});