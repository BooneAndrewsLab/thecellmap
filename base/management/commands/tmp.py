from lxml import etree as ET
import json
from base.utils import CellMapCommand


class Command(CellMapCommand):
    def _get_elements(self, fp, tags):
       '''
           Convenience and memory management function
           that iterates required tags
       '''
       context = iter(ET.iterparse(fp, events=('start', 'end')))
       _, root = next(context)  # get root element
       for event, elem in context:
           if event == 'end' and elem.tag in tags:
               yield elem
               root.clear()  # preserve memory
    
    def handle(self, *args, **options):
        nodes = [];
        edges = [];
        for ele in self._get_elements('/home/yizhao/Downloads/time1.gexf', ['{http://www.gexf.net/1.2draft}node', 'node']):
            rcva = ele.find('{http://www.gexf.net/1.2draft/viz}position')
            nodes.append({
                'id' : int(ele.get('id')), 
                'x' : float(rcva.get('x')) * 10, 
                'y' : float(rcva.get('y')) * 10,
                'z' : float(rcva.get('z')) * 10,
            })
        for ele in self._get_elements('/home/yizhao/Downloads/time1.gexf', ['{http://www.gexf.net/1.2draft}edge', 'edge']):
            edges.append({
                'id' : int(ele.get('id')),
                's' : int(ele.get('source')),
                't' : int(ele.get('target')),
                'w' : float(ele.get('weight'))
            })
        
        self._dump_clean_json({'nodes': nodes, 'edges': edges}, '/home/yizhao/workspace/thecellmap/static/visualization/Science/3d.json')
    
    def _dump_clean_json(self, obj, f):
        with open(f, 'wb') as out:
            out.write(json.dumps(obj).replace(' ', ''))