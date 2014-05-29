(function() {
    var results = null, genes = null;
    
    $(document).ready(function() {
        $.get(genes_url, function(data) {
            genes = {};
            data.forEach(function(gene) {
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
                    
                    data.results.fields.forEach(function(field) {
                        table.find('thead tr').append('<th>' + field + '</th>');
                    });
                    
                    data.results.rows.forEach(function(r) {
                        row = $('<tr>');
                        data.results.fields.forEach(function(f) {
                            row.append('<td>' + r[f] + '</td>');
                        });
                        body.append(row);
                    });
                    
                    $("#file-contents").append(table);
                    $("#generate-btn").removeClass('disabled');
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
                        id = g, obj = {label: g, orf: g};
                    }
                    
                    nodes.push(obj);
                    seen[id] = null;
                    layout.push({x: Math.random() * 2000 - 1000, y: Math.random() * 2000 - 1000, id: id});
                    if (idx == 0) src = id;
                    else if (idx == 1) dst = id;
                });
                
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
