'''
Created on Dec 13, 2013

@author: matej
'''
from base.utils import CellMapCommand
from pandas.core.frame import DataFrame
from datetime import datetime
import urllib2


NODES = [2720, 2464, 1701, 5635, 5200, 358, 208, 1738, 1403, 3444, 680, 4621, 1775, 3735, 4026, 4399, 5638, 3760, 1353, 5587, 812, 725, 1616, 274, 2924, 5531, 2894, 49, 5218, 1535, 6420, 51, 1194, 3560, 1382, 3973, 1288, 6491, 3419, 2932, 3859, 3395, 4431, 3637, 3651, 6464, 1342, 327, 2757, 5026]
URL = 'http://localhost:8000/dl/?%s'
COLUMNS = ['number_of_genes', 'time', 'file_size']

class Command(CellMapCommand):
    def handle(self, *args, **options):
        df = DataFrame(None, columns=COLUMNS)
        
        for n in (50, ):
            for _ in xrange(5): # repeats
                start = datetime.now()
                f = urllib2.urlopen(URL % ('&'.join(['n=%s' % x for x in NODES[:n]]),))
                content = f.read()
                df = df.append(dict(zip(COLUMNS, [n, (datetime.now() - start).total_seconds(), len(content)])), ignore_index=True)
                print (datetime.now() - start).total_seconds(), len(content)
                
            print df
        
        m = df.groupby('number_of_genes').mean()
        m.to_csv('/home/matej/times.csv')
        print m
