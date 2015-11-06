from os.path import os
import csv

from base.models import Dataset, StrainData, Strain
from base.utils import CellMapCommand
import math

class Command(CellMapCommand):
    help = '''create csv file for dataset'''
    args = '<dataset name>'
    
    def handle(self, *args, **options):
        if len(args) != 1:
            raise CommandError('Must provide arguments: ' + self.args)
        
        dataset = Dataset.objects.get(name__iexact=args[0])
        outpath = dataset.static_path()
        
        smap = {}
        for s in Strain.objects.all().select_related('gene'):
            smap[s.id] = s.label()
        
        if not os.path.exists(outpath):
            os.makedirs(outpath)
        
        arrays_axis = [smap[id] for id, in dataset.arrays.through.objects.filter(dataset=dataset).order_by('id').values_list('strain_id')]
        
        data = dataset.data.filter(type=StrainData.TYPE_QUERY).values_list('strain', 'scores')
        scores = []
        
        with open(os.path.join(outpath, 'scores_matrix.csv'), 'wb') as csvfile:
            csvwriter = csv.writer(csvfile, delimiter=',',
                                    quotechar='|', quoting=csv.QUOTE_MINIMAL)
            
            csvwriter.writerow(['Source', 'Target', 'Weight'])
            for q, s in data:
                for (target, weight) in zip(arrays_axis, s):
                    if not math.isnan(weight):
                        csvwriter.writerow([smap[q], target, weight])
                break
