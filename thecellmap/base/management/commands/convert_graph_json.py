'''
Created on Jan 7, 2014

@author: matej
'''
from base.utils import CellMapCommand
from django.core.management.base import CommandError
from json import encoder
import json
encoder.FLOAT_REPR = lambda x: '%.3f' % x

class Command(CellMapCommand):
    help = '''Create files necessary for visualization tool'''
    args = '<json_layout_file>'
    
    def handle(self, *args, **options):
        if len(args) != 1:
            raise CommandError('Must provide arguments: ' + self.args)
        
        input = self.get_path(args[0])
        with open(input) as fp:
            layout = json.load(fp)
        
        if 'edges' in layout:
            del layout['edges']
        layout['nodes'] = [{'id': int(n['id']), 'x': n['x'], 'y': n['y']} for n in layout['nodes']]
        
        self._dump_clean_json(layout, input)
    
    def _dump_clean_json(self, obj, f):
        with open(f, 'w') as out:
            out.write(json.dumps(obj).replace(' ', ''))
        