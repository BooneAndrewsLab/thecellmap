'''
Created on Dec 16, 2013

@author: matej
'''
from datetime import datetime
from optparse import make_option
import re

from django.core.management.base import CommandError, BaseCommand
from django.db.transaction import commit_on_success
from pandas.core.frame import DataFrame
from pandas.core.index import MultiIndex
from pandas.io.parsers import read_table
from pandas.util.testing import assert_frame_equal
import psycopg2

from base.models import Strain, Dataset, StrainData
from base.utils import CellMapCommand, gene_map
import numpy as np
from thecellmap.settings.local import BOONELAB_MANAGEMENT_DB


QUERIES = ('tsq', 'sn', 'damp', 'y')

def correlation_comparator(x, y):
    xidx = (re.sub('\d+', '', x.boonelab_id) in QUERIES) + 0
    yidx = (re.sub('\d+', '', y.boonelab_id) in QUERIES) + 0
    xorf = x.gene.orf
    yorf = y.gene.orf
    if xidx == yidx:
        if not cmp(xorf[:2],yorf[:2]) and xorf[2] == 'L' and yorf[2] == 'L':
            return -cmp(xorf, yorf)
        return cmp(xorf, yorf)
    return xidx - yidx

class Command(CellMapCommand):
    help = 'Imports a dataset from a release file'
    args = '<release_file> <correlations_file> <name>'
    
    option_list = BaseCommand.option_list + (
        make_option('-d', '--default',
            dest='is_default',
            action='store_true',
            default=False,
            help='Set this dataset as default'),
        )
    
    seen_strains = set()
    parsed_scores = False
    
    @commit_on_success
    def handle(self, *args, **options):
        if len(args) != 3:
            raise CommandError('Must provide arguments: ' + self.args)
        
        is_default = options['is_default']
        
        release_file, correlations_file, dataset_name = args
        release_file = self.get_path(release_file)
        
        correlations_file = self.get_fd(correlations_file)
        
        self.genemap = gene_map()
        
        self.old_strains = self.get_old_strains()
        self.current_strains = {s.boonelab_id: s for s in Strain.objects.select_related()}
        
        self.seen_strains.update(self.current_strains.keys())
        self.seen_strains.update(self.old_strains.keys())
        
        scores = self.parse_scores(self.get_fd(release_file))
        correlations = self.parse_correlations(correlations_file)
        
        ds = Dataset.objects.create(
            name=dataset_name,
            is_default=is_default,
            date=datetime.now()
        )
         
        for query, row in scores.iterrows():
            ds.queries.add(query)
            c = None
            if query in correlations.columns:
                c = correlations[query]
            
            StrainData.objects.create(
                dataset=ds,
                strain=query,
                scores=row['score'],
                pvalues=row['pval'],
                correlations=c
            )
         
        tscores = scores.score.T
        tpvals = scores.pval.T
         
        for array in tscores.index:
            ds.arrays.add(array)
            c = None
            if array in correlations.columns:
                c = correlations[array]
            
            StrainData.objects.create(
                dataset=ds,
                strain=array,
                type=StrainData.TYPE_ARRAY,
                scores=tscores.ix[array],
                pvalues=tpvals.ix[array],
                correlations=c
            )
        
        for c in correlations.index:
            ds.correlation_axis.add(c)
        
        if is_default:
            Dataset.objects.exclude(pk=ds.pk).update(is_default=True)
    
    def parse_correlations(self, path):
        print 'Parsing correlations'
        corr = read_table(
                        path, 
                        sep='\t', 
                        header=None, 
                        names=['q', 'a', 'corr'],
#                         usecols=[0, 2, 4],
                    )
        
        corr = corr.pivot('q', 'a', 'corr')
        union = list(set(corr.index).union(corr.columns))
        
        indices = DataFrame(zip(union, map(lambda x: self.check_strain(x), union)), columns=('id', 'strain'))
        indices = indices[indices.strain != False]
        group = indices.groupby('strain')
        cnt = group.count()
        
        mask = np.zeros(len(indices), np.bool)
        for dup in (cnt[cnt.strain > 1]).index:
            print "Dropping duplicate", dup
            mask |= indices.strain == dup
        
        indices = indices[~mask]
        indices.set_index('strain', inplace=True)
        indices = indices.reindex(sorted(indices.index, cmp=correlation_comparator))
        
        corr = corr.reindex(indices.id, indices.id, copy=False)
        corr.index = indices.index
        corr.columns = indices.index
        
        try:
            assert_frame_equal(corr, corr.T, check_dtype=False, check_names=False)
            print "Matrix already symmetric"
        except:
            nanmask = np.isnan(corr)
            tnanmask = np.isnan(corr.T)
             
            if (~nanmask & ~tnanmask).sum().sum() > 0:
                # We would sum reciprocal values!! Check that each pair appears only once
                raise CommandError("Problem with correlation matrix.")
             
            corr[nanmask] = 0
            corr += corr.T
            corr[nanmask & tnanmask] = np.nan
        
        return corr
    
    def parse_scores(self, path):
        print 'Parsing scores'
        scores = read_table(
                        path, 
                        sep='\t', 
                        header=0, 
                        names=['qorf', 'aorf', 'score', 'pval'],
                        usecols=[0, 1, 2, 3],
                    )
        
        """ TODO: TEMPORARY CODE """
#         scores['abssc'] = scores.score.abs()
#         scores = scores.sort('abssc', ascending=False).groupby(('qorf', 'aorf'), as_index=False).first()
#         scores = scores.drop('abssc', axis=1)
        """ TODO: TEMPORARY CODE """
        
        scores = scores.pivot('qorf', 'aorf')
        
        indices = self.cleanup_axis_strains(scores.index)
        scores = scores.reindex(index=indices.id, copy=False)
        scores.index = indices.strain
        
        drop_columns = set()
        new_columns = []
        for val, aorf in scores.columns:
            strain = self.check_strain(aorf)
            if not strain:
                drop_columns.add(aorf)
            else:
                new_columns.append((val, strain))
        
        if drop_columns:
            print "Dropping arrays:", ','.join(drop_columns)
            scores = scores.drop(drop_columns, axis=1, level=1)
        scores.columns = MultiIndex.from_tuples(new_columns, names=['data', 'array'])
        
        self.parsed_scores = True
        
        return scores
    
    def cleanup_axis_strains(self, ids):
        indices = DataFrame(zip(ids, map(lambda x: self.check_strain(x), ids)), columns=('id', 'strain'))
        indices = indices[indices.strain != False]
        group = indices.groupby('strain')
        cnt = group.count()
        
        mask = np.zeros(len(indices), np.bool)
        for dup in (cnt[cnt.strain > 1]).index:
            print "Dropping duplicate", dup
            mask |= indices.strain == dup
        
        return indices[~mask]
    
    def check_strain(self, id):
        if '+' in id:
            return False
        
        if ',' in id:
            found = False
            for tmpid in id.split(','):
                if '_' in tmpid:
                    tmp = tmpid.split('_')[1].lower()
                else:
                    tmp = tmpid.lower()
                
                if tmp in self.seen_strains:
                    found = True
                    id = tmpid
                    break
            
            if not found:
                raise Exception("Nowhere to be found any of: %s" % id)
        
        if '_' in id:
            id = id.split('_')[1].lower()
        else:
            id = id.lower()
        
        if id not in self.old_strains:
            return False
        
        if id not in self.current_strains:
            self.current_strains[id] = self.create_strain(id, self.old_strains[id])
        
        if not self.current_strains[id]:
            return False
        
        self.seen_strains.add(id)
        
        return self.current_strains[id]
    
    def create_strain(self, id, data):
        orf, name, aliases, allele, genotype, mating = data
        q = [x for x in ([orf, name] + (aliases)) if x]
        gene = None
        for item in q:
            if item in self.genemap:
                gene = self.genemap[item]
                break
        
        if gene:
            print "Creating new strain:", id, gene
            return Strain.objects.create(
                gene=gene,
                allele=allele,
                boonelab_id=id,
                genotype=genotype,
                mating_type=mating
            )
    
    def get_old_strains(self):
        result = {}
        
        db = BOONELAB_MANAGEMENT_DB
        
        with psycopg2.connect(database=db['database'], user=db['username'], password=db['password'], host=db['host']) as conn:
            with conn.cursor() as cur:
                cur.execute("""SELECT 
    calias, nstockid, cgeneorf, cgenename, caliases, callele, cgenotype, cmatingtype
FROM core_yeaststrain
    INNER JOIN core_gene ON ngeneidf = ngeneid
    INNER JOIN core_straincollection ON ncollectionidf = ncollectionid
    INNER JOIN core_matingtype ON nmatingtypeidf = nmatingtypeid
WHERE 
    noriginidf = 2;""")
                
                for col, stock, orf, name, aliases, allele, genotype, mating in cur.fetchall():
                    result['%s%s' % (col.lower(), stock)] = (orf, name, aliases and aliases.split('|') or [], allele, genotype, mating)
        
        return result

