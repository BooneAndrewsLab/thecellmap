import json
import pickle

from django.core.management.base import CommandError

from base.models import Gene, Dataset, Strain
from base.utils import CellMapCommand
from base.utils import print_queries

class Command(CellMapCommand):
    help = 'Updates nodes.json for dataset'
    
    @print_queries
    def handle(self, *args, **options):
        strainmap = {s.id: s for s in Strain.objects.select_related('gene')}
        dataset = Dataset.objects.get(name__iexact='MERGE')
        
        nodesjson = json.load(open(dataset.static_path('nodes.json')))
        nodespickle = pickle.load(open(dataset.static_path('nodes.pickle')))
        nodesmap = pickle.load(open(dataset.static_path('nodes_inv.pickle')))
        
        for node in nodesjson["nodes"]:
            s = strainmap[nodesmap[node["id"]][0]]
            gene = s.gene
             
            node["alel"] = s.allele
            node["name"] = gene.name
            node["orf"] = gene.orf
            node["aliases"] = gene.aliases
            suffix = 'damp' in s.boonelab_id.lower() and '_damp' or ''
            node["label"] = s.allele or (gene.name and (gene.name + suffix)) or (gene.orf + suffix)
         
        for node in nodespickle:
            s = strainmap[nodesmap[node["id"]][0]]
            gene = s.gene
             
            node["alel"] = s.allele
            node["name"] = gene.name
            node["orf"] = gene.orf
            node["aliases"] = gene.aliases
            suffix = 'damp' in s.boonelab_id.lower() and '_damp' or ''
            node["label"] = s.allele or (gene.name and (gene.name + suffix)) or (gene.orf + suffix)
         
        self._dump_clean_json(nodesjson, dataset.static_path('nodes.json'))
        pickle.dump(nodespickle, open(dataset.static_path('nodes.pickle'), 'w'))
    
    def _dump_clean_json(self, obj, f):
        with open(f, 'wb') as out:
            out.write(json.dumps(obj).replace(' ', ''))