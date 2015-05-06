from os.path import os
import csv

from base.models import Dataset, StrainData
from base.utils import CellMapCommand


class Command(CellMapCommand):
    help = '''create csv file for dataset'''
    args = '<dataset name>'
    
    def handle(self, *args, **options):
        if len(args) != 1:
            raise CommandError('Must provide arguments: ' + self.args)
        
        dataset = Dataset.objects.get(name__iexact=args[0])
        outpath = dataset.static_path()
        
        if not os.path.exists(outpath):
            os.makedirs(outpath)
        
        queries_axis = [id for id, in dataset.queries.through.objects.filter(dataset=dataset).order_by('id').values_list('strain_id')]
        data = dataset.data.filter(type=StrainData.TYPE_QUERY).values_list('strain', 'scores')
        
        arrays_axis = []
        scores = []
        
        for q, s in data:
            arrays_axis.append(q)
            scores.append(s)
        
        with open(os.path.join(outpath, 'scores_matrix.csv'), 'wb') as csvfile:
            spamwriter = csv.writer(csvfile, delimiter=',',
                                    quotechar='|', quoting=csv.QUOTE_MINIMAL)
            spamwriter.writerow([''] + arrays_axis)
            for q, s in zip(queries_axis, scores):
                spamwriter.writerow([q] + s)
