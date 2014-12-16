from base.utils import CellMapCommand, RE_ORF, open_excel_file, orf_sorting_value
from base.models import Gene


class Command(CellMapCommand):
    def handle(self, *args, **options):
        genes = {}
        
        for g in Gene.objects.all():
            genes[g.orf] = g
#             for a in filter(RE_ORF.match, g.aliases):
#                 if a not in genes:
#                     genes[a] = g
        
#         with open('/home/matej/deleted_merged_features.tab') as f:
#             for l in f:
#                 orf, qualifier, ch, start, stop, wc, sgdid, secid, _, _, desc, note, d = l.strip().split('\t')
#                 
#                 if not RE_ORF.match(orf):
#                     continue
#                 
#                 if orf not in genes:
#                     print orf
#                     Gene.objects.create(
#                             primary_sgdid=sgdid,
#                             feature_qualifier=qualifier,
#                             orf=orf,
#                             secondary_sgdid=secid,
#                             chromosome=ch,
#                             start=start,
#                             stop=stop,
#                             sorting_value=orf_sorting_value(orf),
#                             description=desc
#                         )
        
        
        xls = open_excel_file('/home/matej/todo/collections/SN_collection_clean.xls')
        for l in xls[1:]:
            orf = l[0].strip()
            if orf not in genes:
                print 'MISSING', orf
                continue
            g = genes[orf]
            if g.orf != orf:
                print 'ALIAS', orf
                
        
        xls = open_excel_file('/home/matej/todo/collections/DMA_collection_clean.xls')
        for l in xls[1:]:
            orf = l[0].strip().upper()
            if orf not in genes:
                print 'MISSING', orf
                continue
            g = genes[orf]
            if g.orf != orf:
                print 'ALIAS', orf
        