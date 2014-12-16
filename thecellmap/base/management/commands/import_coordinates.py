import cPickle

from django.core.management.base import CommandError
from django.db.transaction import commit_on_success

from base.models import Dataset
from base.utils import CellMapCommand, dump_clean_json


class Command(CellMapCommand):
    help = 'Imports an existing layout for a dataset. Layout must have 3 columns: label, x, y'
    args = '<dataset_name> <layout_file>'
    
    @commit_on_success
    def handle(self, *args, **options):
        if len(args) != 2:
            raise CommandError('Must provide arguments: ' + self.args)
        
        dataset, coordinates = args
        
        dataset = Dataset.objects.get(name=dataset)
        coordinates = self.get_fd(coordinates)
        
#         nodesmap = {}
        nodes = {}
        layout = []
        newnodes = []
        with open(dataset.static_path('nodes.pickle')) as fp:
            nodes = cPickle.load(fp)
            for n in nodes:
                nodes[n['id']] = n
#                 nodesmap[n['label'].lower()] = n
        
        strain2node = {}
        
        with open(dataset.static_path('nodes_inv.pickle')) as fp:
            nodes_inv = cPickle.load(fp)
            for nodeid, nodestrains in nodes_inv.iteritems():
                for s in nodestrains:
                    strain2node[s] = nodeid
        
        strainmap = {}
        strains = list(dataset.correlation_axis.select_related())
        for s in strains:
            if s.allele:
                strainmap.setdefault(s.allele.lower(), []).append(s)
            strainmap.setdefault(s.gene.orf.lower(), []).append(s)
            if s.gene.name:
                strainmap.setdefault(s.gene.name.lower(), []).append(s)
        
        seen_nodes = {}
        for l in coordinates:
            label, x, y = l.lower().strip().split()
            label = label.strip()
            
            if label not in strainmap:
                gotit = False
                for s in strains:
                    if s.genotype.lower().startswith(label + ':') or s.genotype.lower().startswith(label + '^'):
#                         print 'Got it', label, s.genotype
                        gotit = True
                        break
                
                if not gotit:
#                     print 'Skipping', label
                    continue
            else:
                s = strainmap[label][0]
            
            nodeid = strain2node[s.pk]
            newnodes.append({
                    'id': nodeid,
                    'orf': s.gene.orf,
                    'name': s.gene.name,
                    'alel': s.allele,
                    'label': s.label(),
                })
            
            if nodeid in seen_nodes:
                print 'duplicate', seen_nodes[nodeid] + [(label, s)]
                continue
            seen_nodes.setdefault(nodeid, []).append((label, s))
            
            layout.append({'x': float(x), 'y': float(y), 'id': nodeid})
        
        dump_clean_json({'nodes': layout}, '/home/matej/newlayout.json')
