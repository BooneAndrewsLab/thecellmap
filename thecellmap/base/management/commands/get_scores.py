from django.core.management.base import CommandError
from pandas.core.frame import DataFrame

from base.models import Dataset
from base.utils import CellMapCommand
from pandas.tools.merge import concat


class Command(CellMapCommand):
    help = '''Download scores for specific orfs'''
    args = '<dataset_name> <file_with_orfs> <output file prefix>'
    
    def handle(self, *args, **options):
        if len(args) != 3:
            raise CommandError('Must provide arguments: ' + self.args)
        
        dataset, orf_file, output = args
        
        try:
            dataset = Dataset.objects.get(name=dataset)
        except Dataset.DoesNotExist:
            raise CommandError('Dataset "%s" does not exist.' % dataset)
        
        orf_file = self.get_fd(orf_file)
        orfs = {o.upper().strip() for o in orf_file}
        
        data1 = self.scores(dataset, orfs, dataset.queries, dataset.arrays)
        data1 = data1.reindex(columns=['b_orf', 'b_allele', 'a_orf', 'a_allele', 'scores', 'pvalues'])
        data1.columns = ['query ORF', 'query allele', 'array ORF', 'array allele', 'score', 'pvalue']
        data2 = self.scores(dataset, orfs, dataset.arrays, dataset.queries)
        data2 = data2.reindex(columns=['a_orf', 'a_allele', 'b_orf', 'b_allele', 'scores', 'pvalues'])
        data2.columns = ['query ORF', 'query allele', 'array ORF', 'array allele', 'score', 'pvalue']
        
        data1.to_csv(output + 'queries.csv', index=False)
        data2.to_csv(output + 'arrays.csv', index=False)
        
        data = concat([data1, data2], ignore_index=True)
        data.to_csv(output + 'combined.csv', index=False)
        
        data.groupby(['query ORF', 'query allele', 'array ORF', 'array allele']).mean().reset_index().to_csv(output + 'combined_mean.csv', index=False)
    
    def scores(self, dataset, orfs, x, y):
        strains = {s for s in x.select_related('gene') if s.gene.orf in orfs}
        strain_map = {s.id: s for s in strains}
        
        score_arr = []
        pvalue_arr = []
        for scores, pvalues, strain in dataset.data.filter(strain__in=strains).values_list('scores', 'pvalues', 'strain'):
            score_arr.append((strain_map[strain], scores))
            pvalue_arr.append((strain_map[strain], pvalues))
        
        scores = DataFrame.from_items(score_arr, [i for i in y.select_related('gene')], orient='index').unstack()
        pvalues = DataFrame.from_items(pvalue_arr, [i for i in y.select_related('gene')], orient='index').unstack()
        
        df = DataFrame.from_dict({'scores': scores, 'pvalues': pvalues}).reset_index()
        df.columns = ['a', 'b', 'scores', 'pvalues']
        
        df['a_orf'] = df.a.apply(lambda x: x.gene.orf)
        df['a_allele'] = df.a.apply(lambda x: x.allele or x.gene.name or x.gene.orf)
        df['b_orf'] = df.b.apply(lambda x: x.gene.orf)
        df['b_allele'] = df.b.apply(lambda x: x.allele or x.gene.name or x.gene.orf)
        return df.dropna().drop(['a', 'b'], axis=1)
