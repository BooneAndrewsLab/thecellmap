import json
import pickle
import os

from django.core.management.base import CommandError

from base.models import Dataset, Strain
from base.utils import CellMapCommand
from base.utils import print_queries
from thecellmap.settings import DATASET_PATH


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

        nodesjson = json.load(open(os.path.join(DATASET_PATH, ds.name, 'nodes.json')))
        nodespickle = pickle.load(open(os.path.join(DATASET_PATH, ds.name, 'nodes.pickle'), 'rb'))
        nodesmap = pickle.load(open(os.path.join(DATASET_PATH, ds.name, 'nodes_inv.pickle'), 'rb'))

        for node in nodesjson["nodes"]:
            s = strainmap[nodesmap[node["id"]][0]]
            gene = s.gene

            node["alel"] = s.allele
            node["name"] = gene.name
            node["orf"] = gene.orf
            node["label"] = s.label()
            node['aliases'] = gene.aliases
            node['isdu'] = gene.feature_qualifier == 'Dubious'
            node['isnf'] = gene.neighbor_effect

        for node in nodespickle:
            s = strainmap[nodesmap[node["id"]][0]]
            gene = s.gene

            node["alel"] = s.allele
            node["name"] = gene.name
            node["orf"] = gene.orf
            node["label"] = s.label()
            node['aliases'] = gene.aliases
            node['isdu'] = gene.feature_qualifier == 'Dubious'
            node['isnf'] = gene.neighbor_effect

        with open(os.path.join(DATASET_PATH, ds.name, 'nodes.json'), 'w') as out:
            out.write(json.dumps(nodesjson, separators=(',', ':')))

        pickle.dump(nodespickle, open(os.path.join(DATASET_PATH, ds.name, 'nodes.pickle'), 'wb'))
