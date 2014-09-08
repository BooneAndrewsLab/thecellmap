'''
Created on Dec 13, 2013

@author: matej
'''
import cPickle

from base.utils import CellMapCommand
from base.models import Strain
import json
import random
import decimal
import xlrd

class Command(CellMapCommand):
    def handle(self, *args, **options):
        workbook = xlrd.open_workbook('/home/yizhao/Downloads/CC_MP_redgreen_clustered_140526.xls')
        sheet = workbook.sheet_by_index(0)
        
        terms = [term.split('|')[0] for term in sheet.col_values(0)]
        
        nodes = []
        layout = []
        i = 0
         
        for row_num in range(sheet.nrows):
            for col_num in range(sheet.ncols):
                if row_num == 0 or col_num == 0:
                    continue
                 
                weight = float(sheet.cell(row_num, col_num).value)
                 
                nodes.append({
                               "id": i,
                               "row_name": terms[row_num],
                               "col_name": terms[col_num],
                               "weight": weight,
                               })
                
                layout.append({
                               "id": i,
                               "x": col_num - 1,
                               "y": row_num - 1,
                               })
                
                i += 1
        
        self._dump_clean_json({'nodes': nodes}, '/home/yizhao/workspace/thecellmap-head/static/visualization/heatmap/heatmap-testing/nodes.json')
        self._dump_clean_json({'nodes': layout}, '/home/yizhao/workspace/thecellmap-head/static/visualization/heatmap/heatmap-testing/layout.json')
        
    def _dump_clean_json(self, obj, f):
        with open(f, 'wb') as out:
            out.write(json.dumps(obj).replace(' ', ''))
        