(function() {
    var results = null, genes = null, maxid = 0, seen;
    var workbook, processFun, nodeAttrs;
    
    function getGeneObj(label, nodes, layout) {
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
        
        if (nodeAttrs.hasOwnProperty(label)) {
            // Add any extra annotation
            obj.attributes = nodeAttrs[label];
        };
        
        nodes.push(obj);
        layout.push({x: Math.random() * 2000 - 1000, y: Math.random() * 2000 - 1000, id: id});
        
        seen[id] = obj;
        return obj;
    }
    
    function processXlsWorkbook(workbook, nodes, layout, dataset) {
        var gene, src, dst, id, obj, h;
        nodeAttrs = {};
        seen = {};
        
        if (workbook.SheetNames.indexOf('nodes') != -1) {
            XLS.utils.sheet_to_row_object_array(workbook.Sheets['nodes']).forEach(function(row) {
                obj = {};
                for (h in row) {
                    if (row.hasOwnProperty(h) && h.indexOf('__') != 0 && h != "node") {
                        obj[h] = row[h];
                    }
                }
                nodeAttrs[row.node] = obj;
            });
        }
        
        XLS.utils.sheet_to_row_object_array(workbook.Sheets['edges']).forEach(function(row) {
            obj = {};
            for (h in row) if (row.hasOwnProperty(h) && h.indexOf('__') != 0) obj[h] = row[h];
            
            src = getGeneObj(obj.source, nodes, layout);
            dst = getGeneObj(obj.target, nodes, layout);
            
            if (row.weight == null || row.weight == undefined) row.weight = 0.1;
            dataset.push({s: src.id, t: dst.id, w: row.weight});
        });
    };
    
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
            var f = this.files[0];
            var reader = new FileReader();
            var name = f.name;
            reader.onload = function(e) {
                var data = e.target.result;
                workbook = XLS.read(data, {type:'binary'});
                processFun = processXlsWorkbook;
                
                processXlsWorkbook(workbook, [], [], []);
                
                $("#generate-btn").removeClass('disabled');
            };
            reader.readAsBinaryString(f);
        });
        
        $("#generate-btn").click(function() {
            var nodes = [], layout = [], dataset = [];
            
            processFun(workbook, nodes, layout, dataset);
            
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
