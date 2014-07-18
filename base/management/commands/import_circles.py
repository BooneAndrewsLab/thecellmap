import json
import math
from os.path import os

from django.core.management.base import CommandError

from base.utils import CellMapCommand
from thecellmap import settings
from glob import glob
import re


class Command(CellMapCommand):
    help = '''import packomania data'''
    args = '<path_to_downloaded_file>'
    
    def handle(self, *args, **options):
        if len(args) != 1: 
            raise CommandError('Must provide a path')
        
        files = []
        r = re.compile('[^0-9]*([0-9]+)[^0-9]*[.]txt')
        
        for f in glob(os.path.join(args[0], '*.txt')):
            m = r.match(os.path.split(f)[1])
            if m:
                files.append((int(m.group(1)), f))
        
        files.sort()
        prev_num = 0
        
        for num, filepath in files:
            prev_num += 1
            
            if prev_num != num:
                break
             
            file = open(os.path.join(filepath), 'r')
            data = [];
               
            for line in file:
                l = line.split()
                data.append({'x': round(float(l[1]), 5), 'y': round(float(l[2]), 5)})
              
            filename = str(num) + '.json'
               
            path = os.path.join(settings.STATIC_ROOT, 'packomania', 
                                '%i-%i' % (int(math.floor(num / 1000.0)) * 1000 + 1, (int(math.floor(num / 1000.0)) + 1) * 1000),
                                '%i-%i' % (int(math.floor(num / 100.0)) * 100 + 1, (int(math.floor(num / 100.0)) + 1) * 100))
               
            if not os.path.exists(path):
                os.makedirs(path)
               
            self._dump_clean_json(data, os.path.join(path, filename))
    
    def _dump_clean_json(self, obj, f):
        with open(f, 'w') as out:
            out.write(json.dumps(obj).replace(' ', ''))
