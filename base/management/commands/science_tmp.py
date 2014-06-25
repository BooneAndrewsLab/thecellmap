import json
import pickle

from base.models import Strain
from base.utils import CellMapCommand


class Command(CellMapCommand):
    def handle(self, *args, **options):
        nodes, edges = json.load(open('/home/matej/science_converted.json'))
        
        strains = {s.boonelab_id.lower(): s for s in Strain.objects.select_related('gene')}
        
        for node in nodes:
            node['strain_ids'] = []
            for strain in node['strains']:
                strain = strain.split('_')[1].lower()
                
                if strain in strains:
                    node['strain_ids'].append(strains[strain])
        
        id_map = pickle.load(open('/home/matej/dev/workspace/thecellmap/static/visualization/Science/nodes_inv.pickle'))
        strain_map = {}
        for k, v in id_map.iteritems():
            for i in v:
                strain_map[i] = k
        
        old_map = {}
        
        for node in nodes:
            nodeid = None
            for i in node['strain_ids']:
                if i.id in strain_map:
                    nodeid = strain_map[i.id]
            
            if not nodeid or nodeid in old_map:
                pass
#                 print node
            else:
                old_map.setdefault(nodeid, []).append(node)
                node['newid'] = nodeid
        
        for k, v in old_map.iteritems():
            if len(v) > 1:
                print k
                for i in v:
                    print '\t', i
        
        layout = {}
        layout['nodes'] = [{'id': n['newid'], 'x': n['x'], 'y': n['y']} for n in nodes if 'newid' in n]
        
        self._dump_clean_json(layout, '/home/matej/dev/workspace/thecellmap/static/visualization/Science/layout.json')
    
    def _dump_clean_json(self, obj, f):
        with open(f, 'w') as out:
            out.write(json.dumps(obj).replace(' ', ''))
        