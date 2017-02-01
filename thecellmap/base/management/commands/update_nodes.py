import json
import pickle

from base.models import Dataset, Strain, Gene
from base.utils import CellMapCommand
from base.utils import print_queries
from django.core.management.base import CommandError


class Command(CellMapCommand):
    help = 'Updates nodes.json and nodes.pickle for the given dataset'
    
    def add_arguments(self, parser):
        # Positional arguments
        parser.add_argument('dataset_name')
    
    @print_queries
    def handle(self, *args, **options):
        if 'dataset_name' not in options:
            raise CommandError("Specify dataset to update")
        
        ds = Dataset.objects.get(name=options['dataset_name'])
        strainmap = {s.id: s for s in Strain.objects.select_related('gene')}
        
        nodesjson = json.load(open(ds.static_path('nodes.json')))
        nodespickle = pickle.load(open(ds.static_path('nodes.pickle')))
        nodesmap = pickle.load(open(ds.static_path('nodes_inv.pickle')))
         
        for node in nodesjson["nodes"]:
            s = strainmap[nodesmap[node["id"]][0]]
            gene = s.gene
             
            node["alel"] = s.allele
            node["name"] = gene.name
            node["orf"] = gene.orf
            suffix = 'damp' in s.boonelab_id.lower() and '_damp' or ''
            node["label"] = s.allele or (gene.name and (gene.name + suffix)) or (gene.orf + suffix)
            node['aliases'] = gene.aliases_encoded()
            node['isdu'] = gene.feature_qualifier == 'Dubious'
            node['isnf'] = gene.neighbor_effect
         
        for node in nodespickle:
            s = strainmap[nodesmap[node["id"]][0]]
            gene = s.gene
             
            node["alel"] = s.allele
            node["name"] = gene.name
            node["orf"] = gene.orf
            suffix = 'damp' in s.boonelab_id.lower() and '_damp' or ''
            node["label"] = s.allele or (gene.name and (gene.name + suffix)) or (gene.orf + suffix)
            node['aliases'] = gene.aliases
            node['isdu'] = gene.feature_qualifier == 'Dubious'
            node['isnf'] = gene.neighbor_effect
         
        self._dump_clean_json(nodesjson, ds.static_path('nodes.json'))
        pickle.dump(nodespickle, open(ds.static_path('nodes.pickle'), 'w'))
    
    def _dump_clean_json(self, obj, f):
        with open(f, 'wb') as out:
            out.write(json.dumps(obj).replace(' ', '').replace(Gene.MAGIC, ' '))
