(function() {
    var results = null, genes = null, maxid = 0;
    
    $(document).ready(function() {
        $.get(genes_url, function(data) {
            genes = {};
            data.forEach(function(gene) {
                maxid = Math.max(gene.id, maxid);
                genes[gene.orf] = gene;
                gene.label = gene.orf;
                if (gene.name != '') {
                    gene.label = gene.name;
                    genes[gene.name] = gene;
                }
                gene.aliases.forEach(function(a) {
                    if (genes.hasOwnProperty(a) == -1) genes[a] = gene;
                });
            });
        });
        
        $('input[type=file]').bootstrapFileInput();
        $('input[type=file]').click(function() {
            this.value = null;
            $("#file-contents").empty();
            $("#generate-btn").addClass('disabled');
        }).change(function() {
            $(this).parse({
                before: function(data) {
                    if (genes == null) {
                        alert("FOOBAR");
                    }
                },
                error: function(data) {
                },
                complete: function(data) {
                    results = data.results;
                    var table = $('#data-table').clone().removeAttr('id'), body = table.find('tbody'), row;
                    var ids = ['source', 'target', 'weight'], numOfField = [0, 0, 0], i = 0;
                    data.results.fields.forEach(function(field) {
                        table.find('thead tr').append('<th><div class="btn-group"><a class="btn dropdown-toggle" data-toggle="dropdown" href="#">'
                                + field + '<span class="caret"></span></a><ul class="dropdown-menu">'
                                + '<li data-field="source" class=source><a href="#">source</a></li>'
                                + '<li data-field="target" class=target><a href="#">target</a></li>'
                                + '<li data-field="weight" class=weight><a href="#">weight</a></li>'
                                + '</ul></div></th>');
                        i++;
                        
                        for (var j = 0; j < 3; j++) {
                            if (field == ids[j])
                                numOfField[j]++;
                        }
                    });
                    
                    data.results.rows.forEach(function(r) {
                        row = $('<tr>');
                        data.results.fields.forEach(function(f) {
                            row.append('<td>' + r[f] + '</td>');
                        });
                        body.append(row);
                    });
                    
                    $("#file-contents").append(table);
                    
                    $('.dropdown-menu li').click(function() {
                        var newField = $(this).closest("li").data("field");
                        var field = $(this).closest("div").find("a").text().replace("sourcetargetweight","").toLowerCase();
                        
                        data.results.rows.forEach(function(r) {
                            r[newField] = r[field];
                        });
                        
                        $(this).parents('.btn-group').find('.dropdown-toggle').html($(this).text()
                                + '<span class="caret"></span>');
                        
                        for (j = 0; j < 3; j++) {
                            if (newField == ids[j])
                                numOfField[j]++;
                            if (field == ids[j])
                                numOfField[j]--;
                        }
                        
                        if (numOfField[0] == 1 && numOfField[1] == 1 && numOfField[2] < 2) {
                            $("#generate-btn").removeClass('disabled');
                        }
                        else
                            $("#generate-btn").addClass('disabled');
                    });
                    
                    if (numOfField[0] == 1 && numOfField[1] == 1) {
                        $("#generate-btn").removeClass('disabled');
                    }
                }
            });
        });
        
        $("#generate-btn").click(function() {
            var gene, seen = {}, src, dst, id, obj;
            var nodes = [], layout = [], dataset = [];
            
            // nodes.json
            results.rows.forEach(function(row) {
                [row.source, row.target].forEach(function(g, idx) {
                    if (genes.hasOwnProperty(g)) {
                        gene = genes[g];
                        if (seen.hasOwnProperty(gene.id)) return;
                        id = gene.id, obj = gene;
                    } else {
                        if (seen.hasOwnProperty(g)) return;
                        id = ++maxid, obj = {label: g, orf: g, id: maxid};
                        seen[g] = null;
                    }
                    
                    nodes.push(obj);
                    seen[id] = null;
                    layout.push({x: Math.random() * 2000 - 1000, y: Math.random() * 2000 - 1000, id: id});
                    if (idx == 0) src = id;
                    else if (idx == 1) dst = id;
                });
                if (row.weight == null || row.weight == undefined) row.weight == 0.1;
                dataset.push({s: src, t: dst, w: row.weight});
            });
            
            $.ajax({
                dataType: 'json', 
                data: {
                       csrfmiddlewaretoken: $.cookie('csrftoken'), 
                       nodes: JSON.stringify({nodes: nodes}), 
                       layout: JSON.stringify({nodes: layout}), 
                       dataset: JSON.stringify({edges: dataset})},
                type: 'post',
                url: '.', 
                success: function(data) {
                    window.location.href = data['url'];
                }
            }).always(function() { 
                console.log('done');
            }).fail(function(e) { 
                console.log('failed', e);
            });
        });
    });
})();
