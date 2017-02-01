"""
Created on Dec 13, 2013

@author: matej

SGD_features.tab

This file replaced the previous chromosomal_feature.tab file. This file
is updated weekly (Saturday).
Highlights of the changes include:

1. It contains information on current chromosomal features in SGD,
including information about Dubious ORFs. It also contains the
coordinates of intron, exons, and other subfeatures that are located
within a chromosomal feature.

2. The relationship between subfeatures and the feature in which they
are located is identified by the feature name in column #7 (parent
feature). For example, the parent feature of the intron found in
ACT1/YFL039C will be YFL039C. The parent feature of YFL039C is
chromosome 6.

3. The coordinates of all features are in chromosomal coordinates.

4. Replacement of several feature types to be more consistent with
Genbank files and other model organism databases. ORF is now gene,
exon is now CDS.

Columns within SGD_features.tab:

1.   Primary SGDID (mandatory)
2.   Feature type (mandatory)
3.   Feature qualifier (optional)
4.   Feature name (optional)
5.   Standard gene name (optional)
6.   Alias (optional, multiples separated by |)
7.   Parent feature name (optional)
8.   Secondary SGDID (optional, multiples separated by |)
9.   Chromosome (optional)
10.  Start_coordinate (optional)
11.  Stop_coordinate (optional)
12.  Strand (optional)
13.  Genetic position (optional)
14.  Coordinate version (optional)
15.  Sequence version (optional)
16.  Description (optional)

The SGD_features.tab file is complemented by the GFF3 file, see below,
called saccharomyces_cerevisiae.gff

http://downloads.yeastgenome.org/curation/chromosomal_feature/SGD_features.tab
http://downloads.yeastgenome.org/curation/chromosomal_feature/deleted_merged_features.tab
"""
import json
from optparse import make_option
import pickle
import re
import urllib2

from django.core.management.base import BaseCommand

from base.models import Gene, Dataset, Strain
from base.utils import CellMapCommand, orf_sorting_value, is_integer
from base.utils import print_queries


ORF = re.compile('Y[A-P][LR]\d{3}[WC].*')

TYPES = {
         'pseudogene',
         'telomerase_RNA_gene',
         'ORF|Deleted',
         'tRNA_gene',
         'pseudogene|Merged',
         'ORF|Merged',
         'blocked_reading_frame',
         'ORF',
         'pseudogene|Deleted',
         'transposable_element_gene|Deleted',
         'transposable_element_gene',
         'snoRNA_gene'
}

FIELD2IDX = (
         ('orf', 3, str),
         ('name', 4, str),
         ('aliases', 5, str),
         ('primary_sgdid', 0, str),
         ('description', 15, str),
         ('chromosome', 8, lambda x: Gene.CHROMOSOME_CODE.get(x, int(x))),
         ('start', 9, int),
         ('stop', 10, int),
         ('feature_qualifier', 2, str)
)

FIELD2IDX_MERGE = (
         ('orf', 0, str),
         ('chromosome', 2, int),
         ('primary_sgdid', 6, str),
         ('description', 10, str),
         ('start', 3, lambda x: x and int(x) or None),
         ('stop', 4, lambda x: x and int(x) or None),
)

class Command(CellMapCommand):
    help = 'Updates the Gene table from the latest SGD features file'
    
    option_list = BaseCommand.option_list + (
        make_option('-f', '--file',
            dest='local_file',
            help='Use file provided instead of downloading it from SGD'),
        )
    
    @print_queries
    def handle(self, local_file=None, *args, **options):
        genes = {g.primary_sgdid: g for g in Gene.objects.all()}
        
        features = urllib2.urlopen('http://downloads.yeastgenome.org/curation/chromosomal_feature/SGD_features.tab')
        for l in features:
            bits = l.strip('\n').split('\t')
            sgdid = bits[0]
            if bits[1] not in TYPES: continue # feature type
            
            gargs = {k: f(bits[v]) for k, v, f in FIELD2IDX}
            
            if sgdid in genes:
                gene = genes.pop(sgdid)
            else:
                print "Adding new gene item: ", sgdid, bits[3]
#                 gene = Gene.objects.create(
#                         noriginidf_id=GENE_ORIGIN_SC,
#                         **gargs
#                     )
#                 
#                 xls.write_row([sgdid, gene.cgeneorf, 'NEW GENE'])
#                 for k, v in gargs.iteritems():
#                     xls.write_row(['', '', k, '', v])
                
                continue
            
            for k, v in list(gargs.iteritems()):
                if getattr(gene, k) == v:
                    del gargs[k]
            
            if gargs:
#                 xls.write_row([sgdid, gene.cgeneorf, 'UPDATE'])
                for k, v in gargs.iteritems():
#                     xls.write_row(['', '', k, getattr(gene, k), v])
                    if k == 'cgeneorf':
                        print 'ORF NAME CHANGE'
#                         xls.write_row(["ORF name change", sgdid, gene.cgeneorf, v], 'Critical changes')
                    elif k == 'cgenename':
                        print 'STANDARD NAME CHANGE'
#                         xls.write_row(["Standard name change", sgdid, gene.cgenename, v], 'Critical changes')
                
#                 Gene.objects.filter(pk=gene.pk).update(**gargs)
        features.close()
        
        return
        
        
        
        
        
#         if local_file:
#             content = self.get_fd(local_file)
#         else:
#             content = urllib2.urlopen('http://downloads.yeastgenome.org/curation/chromosomal_feature/SGD_features.tab')
#          
#         existing = {g.primary_sgdid: g for g in Gene.objects.all()}
#          
#         for line in content.readlines():
#             line = line.strip().split('\t')
#              
#             if line[1] not in ('ORF', 'pseudogene') or not ORF.match(line[3]): continue
#              
#             if line[0] in existing:
#                 g = existing[line[0]]
#                 updated = False
#                  
#                 for field, idx in field_map.iteritems():
#                     oldval = getattr(g, field)
#                      
#                     if isinstance(idx, int):
#                         val = line[idx]
#                     else:
#                         idx, fun = idx
#                         val = fun(line[idx])
#                      
#                     if str(oldval) != str(val):
#                         if not updated:
#                             print 'New stuff for', g
#                             updated = True
#                          
#                         print '\t%s: %s -> %s' % (field, oldval, val)
#                         setattr(g, field, val)
#                  
#                 if updated:
#                     if g.sorting_value != orf_sorting_value(g.orf):
#                         g.sorting_value = orf_sorting_value(g.orf)
#                      
#                     print "\tSaving changes"
#                     g.save()
#             else:
#                 print "Inserting gene", line
#                  
#                 data = {}
#                 for field, idx in field_map.iteritems():
#                     if isinstance(idx, int):
#                         data[field] = line[idx]
#                     else:
#                         idx, fun = idx
#                         data[field] = fun(line[idx])
#                  
#                 data['sorting_value'] = orf_sorting_value(data['orf'])
#                  
#                 Gene.objects.create(**data)
#         
#         strainmap = {s.id: s for s in Strain.objects.select_related('gene')}
#         
#         for data in Dataset.objects.all():
#             nodesjson = json.load(open(data.static_path('nodes.json')))
#             nodespickle = pickle.load(open(data.static_path('nodes.pickle')))
#             nodesmap = pickle.load(open(data.static_path('nodes_inv.pickle')))
#             
#             for node in nodesjson["nodes"]:
#                 s = strainmap[nodesmap[node["id"]][0]]
#                 gene = s.gene
#                 
#                 node["alel"] = s.allele
#                 node["name"] = gene.name
#                 node["orf"] = gene.orf
#                 suffix = 'damp' in s.boonelab_id.lower() and '_damp' or ''
#                 node["label"] = s.allele or (gene.name and (gene.name + suffix)) or (gene.orf + suffix)
#             
#             for node in nodespickle:
#                 s = strainmap[nodesmap[node["id"]][0]]
#                 gene = s.gene
#                 
#                 node["alel"] = s.allele
#                 node["name"] = gene.name
#                 node["orf"] = gene.orf
#                 suffix = 'damp' in s.boonelab_id.lower() and '_damp' or ''
#                 node["label"] = s.allele or (gene.name and (gene.name + suffix)) or (gene.orf + suffix)
#             
#             self._dump_clean_json(nodesjson, data.static_path('nodes.json'))
#             pickle.dump(nodespickle, open(data.static_path('nodes.pickle'), 'w'))
    
    def _dump_clean_json(self, obj, f):
        with open(f, 'wb') as out:
            out.write(json.dumps(obj).replace(' ', ''))
