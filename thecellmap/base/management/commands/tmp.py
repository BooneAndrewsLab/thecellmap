'''
Created on Dec 13, 2013

@author: matej
'''
from base.utils import CellMapCommand
import re

PAT = re.compile('_T\d+', re.IGNORECASE)

class Command(CellMapCommand):
    def handle(self, *args, **options):
        pairs = {}
        duplicates = set()
        
        with open('/home/matej/release_sga_fg_merge_121004_scored_130422_unfiltered.txt') as f:
            f.readline() # skip header
            line_num = 1
            
            for l in f.readlines():
                l = l.split() 
                key = PAT.sub('', l[0]), PAT.sub('', l[2])
                
                pairs.setdefault(key, []).append(line_num)
                if len(pairs[key]) - 1:
                    duplicates.add(key)
                
                line_num += 1
        
        for q, a in duplicates:
            print '\t'.join((q, a, ','.join(map(str, pairs[(q,a)]))))
        
        