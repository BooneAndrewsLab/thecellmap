'''
Created on Jan 13, 2014

@author: matej
'''
import cPickle

from pandas.core.frame import DataFrame

from base.models import StrainData
from base.utils import write_excel_file, STYLE_NEG_STRINGENT, STYLE_NEG_SIGNIFICANT, STYLE_POS_STRINGENT, \
    STYLE_POS_SIGNIFICANT
import numpy as np


ONLY = (
    'strain__gene__orf',
    'strain__gene__name',
    'strain__allele',
)

def prepare_nodes(ds, nodes, filename):
    with open(ds.static_path('nodes_inv.pickle')) as fp:
        nodes_inv = cPickle.load(fp)
    
    correlation_axis = ds.correlation_axis.through.objects.order_by('id').values_list(*ONLY)
    arrays = ds.arrays.through.objects.order_by('id').values_list(*ONLY)
    queries = ds.queries.through.objects.order_by('id').values_list(*ONLY)
    
    output = write_excel_file(filename)
    
    if not nodes:
        output.add_sheet('EMPTY')
    
    for node in nodes:
        strains = nodes_inv[int(node)]
        correlations = DataFrame(index=correlation_axis)
        scores = DataFrame()
        
        for data in ds.data.filter(strain__in=strains).select_related('strain__gene'):
            s = data.strain
            correlations[s.id] = data.correlations
            
            if data.type == StrainData.QUERY:
                scores_axis = arrays
            elif data.type == StrainData.ARRAY:
                scores_axis = queries
            
            scores = scores.append(DataFrame({'target': scores_axis, 'score': data.scores, 'pval': data.pvalues}), ignore_index=True)
        
        """
            Correlations
        """
        correlations = correlations.mean(axis=1)
        correlations = correlations.reset_index()
        correlations.columns = ['strainB', 'correlation']
        correlations = correlations.groupby('strainB').mean().reset_index() # .drop((s.gene.orf, s.gene.name, s.allele))
        correlations = correlations.dropna().sort('correlation', ascending=False)
        
        output.add_sheet('%s correlations' % s.basic_id(), ['Strain B ORF', 'Strain B Name', 'Strain B allele', 'correlation'])
        for strainB, correlation in correlations.itertuples(index=False):
            output.write_row(strainB + (correlation, ), style=correlation >= .2 and STYLE_POS_SIGNIFICANT)
        
        scores = scores.groupby('target').agg({
                            'score': np.mean,
                            'pval': np.max
                        }).reset_index()
        scores = scores.dropna().sort('score')
        
        output.add_sheet('%s scores' % s.basic_id(), ['Strain B ORF', 'Strain B Name', 'Strain B allele', 'score', 'pvalue'])
        for strainB, pval, score in scores.itertuples(index=False):
            style = None
            if score <= -.16:
                style = STYLE_NEG_STRINGENT
            elif score <= -.08:
                style = STYLE_NEG_SIGNIFICANT
            elif score >= .16:
                style = STYLE_POS_STRINGENT
            elif score >= .08:
                style = STYLE_POS_SIGNIFICANT
            
            output.write_row(strainB + (score, pval), style=style)
    
    return output
