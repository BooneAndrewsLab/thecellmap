"""
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

import urllib2

from base.utils import is_integer, CellMapCommand, print_queries
from base.models import Gene
from django.db.transaction import atomic


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
         ('aliases', 5, lambda x: x and x.split('|') or []),
         ('primary_sgdid', 0, str),
         ('description', 15, str),
         ('chromosome', 8, lambda x: is_integer(x) and int(x) or Gene.CHROMOSOME_CODE[x]),
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
    
    def add_arguments(self, parser):
        parser.add_argument(
            '-f', '--file',
            dest='local_file',
            help='Use file provided instead of downloading it from SGD'
        )

    @print_queries
    @atomic
    def handle(self, *args, **options):
        genes = {g.primary_sgdid: g for g in Gene.objects.all()}
        
        if options['local_file']:
            features = self.get_fd(options['local_file'])
        else:
            features = urllib2.urlopen('http://downloads.yeastgenome.org/curation/chromosomal_feature/SGD_features.tab')
        
        i = 0
        for l in features:
            i += 1
            bits = l.strip('\n').split('\t')
            sgdid = bits[0]
            if bits[1] not in TYPES: continue # feature type
            
            gargs = {k: f(bits[v]) for k, v, f in FIELD2IDX}
            
            if sgdid in genes:
                gene = genes.pop(sgdid)
            else:
                print "Adding new gene item: ", sgdid, bits[3]
#                 gene = Gene.objects.create(
#                         **gargs
#                     )
                
                print sgdid, gene.orf, 'NEW GENE'
                for k, v in gargs.iteritems():
                    print '', '', k, '', v
                
                continue
            
            print i, gargs
            for k, v in list(gargs.iteritems()):
                curval = getattr(gene, k)
                if v == '' and (curval == None or curval == []):
                    del gargs[k]
                
                if curval == v:
                    del gargs[k]
            
            if gargs:
#                 print sgdid, gene.orf, 'UPDATE'
                for k, v in gargs.iteritems():
#                     print '', '', k, '"%s"' % getattr(gene, k), '"%s"' % v
                    if k == 'orf':
                        print 'ORF NAME CHANGE', sgdid, gene.orf, v
                    elif k == 'name':
                        print 'STANDARD NAME CHANGE', sgdid, gene.name, v
                
#                 Gene.objects.filter(pk=gene.pk).update(**gargs)
        features.close()
        
#         features = urllib2.urlopen('http://downloads.yeastgenome.org/curation/chromosomal_feature/deleted_merged_features.tab')
#         for l in features:
#             bits = l.strip('\n').split('\t')
#             sgdid = bits[6]
#             if bits[1] not in TYPES: continue # feature type
#             
#             gargs = {k: f(bits[v]) for k, v, f in FIELD2IDX_MERGE}
#             if bits[11]:
#                 gargs['vmemo'] += ';' + bits[11]
#             if len(gargs['vmemo']) > 1000:
#                 gargs['vmemo'] = gargs['vmemo'][:1000]
#             
#             if sgdid in genes:
#                 gene = genes.pop(sgdid)
#             else:
#                 if re.match('^YC[LR]X.+', bits[0]) or bits[0] == 'YCR097WA': continue
#                 
#                 print "NEW DELETED GENE??"
#             
#             for k, v in list(gargs.iteritems()):
#                 if getattr(gene, k) == v:
#                     del gargs[k]
#             
#             if gargs:
#                 for k, v in gargs.iteritems():
#                     print k, getattr(gene, k), ' ------------> ', v
#                 
#                 Gene.objects.filter(pk=gene.pk).update(**gargs)
#         features.close()
#         
#         xls.save()
#         
#         if self.pretend:
#             transaction.rollback()
#         else:
#             transaction.commit()
