from django.core.management.base import CommandError
from pandas.core.frame import DataFrame

from base.utils import CellMapCommand
import scipy.cluster.hierarchy as sch


class Command(CellMapCommand):
    help = '''Cluster protein complex similarity matrix'''
    args = '<path_to_matrix>'
    
    def handle(self, *args, **options):
        if len(args) != 1:
            raise CommandError('Problems')
        
        df = DataFrame.from_csv(args[0])
        
        Y = sch.linkage(df, method='single')
        Z = sch.dendrogram(Y)
        
        index = [df.columns[i] for i in Z['leaves']]
        
        D = df.reindex(index)[index]
