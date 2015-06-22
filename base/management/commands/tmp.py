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
        for ele in self._get_elements('/home/yizhao/Downloads/science_3d.gexf', ['{http://www.gexf.net/1.1draft}node', 'node']):
            rcva = ele.find('{http://www.gexf.net/1.1draft/viz}position')
            nodes.append({
                'id' : int(ele.get('id')), 
                'x' : float(rcva.get('x')), 
                'y' : float(rcva.get('y')),
                'z' : float(rcva.get('z')),
            })
        
        for ele in self._get_elements('/home/yizhao/Downloads/science_3d.gexf', ['{http://www.gexf.net/1.1draft}edge', 'edge']):
            edges.append({
                'id' : int(ele.get('id')),
                's' : int(ele.get('source')),
                't' : int(ele.get('target')),
                'w' : float(ele.get('weight'))
            })
        
        self._dump_clean_json({'nodes': nodes, 'edges': edges}, '/home/yizhao/Downloads/science_3d.json')
    
    def _dump_clean_json(self, obj, f):
        with open(f, 'wb') as out:
            out.write(json.dumps(obj).replace(' ', ''))