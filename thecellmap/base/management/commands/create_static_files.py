'''
Created on Jan 06, 2014

@author: matej
'''
import cPickle
from json import encoder
import json
import os

from django.core.management.base import CommandError
from django.db.models import Q
# from django.db.transaction import commit_on_success
from pandas.core.frame import DataFrame
from pandas.core.index import MultiIndex

from base.models import Dataset, Strain
from base.utils import CellMapCommand, print_queries
import numpy as np


encoder.FLOAT_REPR = lambda o: format(o, '.3f')
COLOURS = ['w', 'b', 'r']

class Command(CellMapCommand):
    help = 'Generate static files needed to visualize a dataset'
    args = '<dataset name>'
    
    @print_queries
#     @commit_on_success
    def handle(self, *args, **options):
        if len(args) != 1:
            raise CommandError('Must provide arguments: ' + self.args)
        
        dataset = Dataset.objects.get(name__iexact=args[0])
#         outpath = dataset.static_path()
        outpath = '/home/matej/teststatic/'
        
#         if os.path.exists(outpath):
#             raise CommandError('Files already exist')
        
        if not os.path.exists(outpath): # TODO: REMOVE THIS
            os.makedirs(outpath)
        
        nodes = {}
        nodes_map = {}
        nodes_inverse_map = {}
        for id, orf, name, allele, strain_id in Strain.objects.filter(
                    Q(as_query=dataset) |
                    Q(as_array=dataset) |
                    Q(as_correlation=dataset)).distinct(
                ).values_list(
                    'id',
                    'gene__orf',
                    'gene__name',
                    'allele',
                    'boonelab_id',
                ):
            suffix = 'damp' in strain_id.lower() and '_damp' or ''
            label = allele or (name and (name + suffix)) or (orf + suffix)
            
            if label not in nodes:
                nodes[label] = {
                        'id': len(nodes) + 1,
                        'orf': orf,
                        'name': name,
                        'alel': allele,
                        'label': label,
                    }
            
            nodes_map[id] = nodes[label]['id']
            nodes_inverse_map.setdefault(nodes[label]['id'], []).append(id)
        
        nodes = nodes.values()
        
        cPickle.dump(nodes, open(os.path.join(outpath, 'nodes.pickle'), 'wb'))
        cPickle.dump(nodes_inverse_map, open(os.path.join(outpath, 'nodes_inv.pickle'), 'wb'))
        self._dump_clean_json({'nodes': nodes}, os.path.join(outpath, 'nodes.json'))
        
        correlation_axis = [id for id, in dataset.correlation_axis.through.objects.filter(dataset=dataset).order_by('id').values_list('strain_id')]
        corr_multiindex = MultiIndex.from_tuples(zip(correlation_axis, map(nodes_map.get, correlation_axis)), names=['strain', 'node'])
        
        correlation = DataFrame.from_items(list(dataset.data.filter(correlations__isnull=False).values_list('strain', 'correlations')))
        correlation.index = corr_multiindex
        correlation = correlation.reindex(columns=correlation_axis)
        correlation.columns = corr_multiindex
        correlation = correlation.groupby(level=1).mean().groupby(level=1, axis=1).mean()
        correlation.index.name = 'a'
        correlation.columns.name = 'b'
        
        lowmask = DataFrame(np.tril(np.ones(correlation.shape)), index=correlation.index, columns=correlation.columns, dtype=bool)
        correlation[lowmask] = np.nan
        correlation = correlation[correlation > .2]
        correlation = correlation.stack().reset_index()
        correlation.columns = ['source', 'target', 'weight']
        
        correlation_obj = [{ 's': int(a), 't': int(b), 'w': float(c)} for a, b, c in correlation.itertuples(index=False)]
        self._dump_clean_json(
                {'edges': correlation_obj, 'dataset': 'Correlations'}, 
                os.path.join(outpath, 'correlations.json')
            )
        
        correlation.to_csv(os.path.join(outpath, 'layout.csv'), index=False)
        
    def _dump_clean_json(self, obj, f):
        with open(f, 'wb') as out:
            out.write(json.dumps(obj).replace(' ', ''))
    