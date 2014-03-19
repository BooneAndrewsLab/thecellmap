'''
Created on Dec 13, 2013

@author: matej
'''
import cPickle

from base.utils import CellMapCommand
from base.models import Strain
import json


class Command(CellMapCommand):
    def handle(self, *args, **options):
        layout = cPickle.load(open('/home/matej/bla.pikl'))
        strains = {s.boonelab_id.upper(): s.id for s in Strain.objects.all()}
        nodes_map = cPickle.load(open('/home/matej/dev/workspace/thecellmap/static/visualization/Science/nodes_inv.pickle'))
        
        nodes = {}
        for node_id, strain_ids in nodes_map.iteritems():
            for strain_id in strain_ids:
                nodes[strain_id] = node_id
        
        result = []
        for l in layout:
            if not l['sid']: continue
            
            strain_id = strains.get(l['sid'].upper())
            if strain_id:
                l.pop('sid')
                l['id'] = nodes[strain_id]
                result.append(l)
        
        self._dump_clean_json({'nodes': result}, '/home/matej/dev/workspace/thecellmap/static/visualization/Science/layout.json')
        
    def _dump_clean_json(self, obj, f):
        with open(f, 'wb') as out:
            out.write(json.dumps(obj).replace(' ', ''))
        