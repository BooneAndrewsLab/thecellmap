'''
Created on Dec 13, 2013

@author: matej
'''
from base.models import Gene
from base.utils import CellMapCommand, orf_sorting_value
from django.core.management.base import BaseCommand
from optparse import make_option
import re
import urllib2

"""
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
"""

SGD_URL = 'http://downloads.yeastgenome.org/curation/chromosomal_feature/SGD_features.tab'
ORF = re.compile('Y[A-P][LR]\d{3}[WC].*')

field_map = {
    'primary_sgdid': 0,
    'feature_qualifier': 2,
    'orf': 3,
    'name': (4, lambda x: x or None),
    'aliases': (5, lambda x: x.split('|') or None),
    'secondary_sgdid': (7, lambda x: x.split('|') or None),
    'chromosome': 8,
    'start': 9,
    'stop': 10,
    'description': 15
}

class Command(CellMapCommand):
    help = 'Updates the Gene table from the latest SGD features file'
    
    option_list = BaseCommand.option_list + (
        make_option('-f', '--file',
            dest='local_file',
            help='Use file provided instead of downloading it from SGD'),
        )
    
    def handle(self, local_file=None, *args, **options):
        if local_file:
            content = self.get_fd(local_file)
        else:
            content = urllib2.urlopen(SGD_URL)
        
        existing = {g.primary_sgdid: g for g in Gene.objects.all()}
        
        for line in content.readlines():
            line = line.strip().split('\t')
            
            if line[1] not in ('ORF', 'pseudogene') or not ORF.match(line[3]): continue
            
            if line[0] in existing:
                g = existing[line[0]]
                updated = False
                
                for field, idx in field_map.iteritems():
                    oldval = getattr(g, field)
                    
                    if isinstance(idx, int):
                        val = line[idx]
                    else:
                        idx, fun = idx
                        val = fun(line[idx])
                    
                    if str(oldval) != str(val):
                        if not updated:
                            print 'New stuff for', g
                            updated = True
                        
                        print '\t%s: %s -> %s' % (field, oldval, val)
                        setattr(g, field, val)
                
                if updated:
                    if g.sorting_value != orf_sorting_value(g.orf):
                        g.sorting_value = orf_sorting_value(g.orf)
                    
                    print "\tSaving changes"
                    g.save()
            else:
                print "Inserting gene", line
                
                data = {}
                for field, idx in field_map.iteritems():
                    if isinstance(idx, int):
                        data[field] = line[idx]
                    else:
                        idx, fun = idx
                        data[field] = fun(line[idx])
                
                data['sorting_value'] = orf_sorting_value(data['orf'])
                
                Gene.objects.create(**data)
    