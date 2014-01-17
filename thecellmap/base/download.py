'''
Created on Jan 13, 2014

@author: matej
'''
import cPickle

from pandas.core.frame import DataFrame

from base.models import StrainData, Strain
from base.utils import write_excel_file, STYLE_NEG_STRINGENT, STYLE_NEG_SIGNIFICANT, STYLE_POS_STRINGENT, \
    STYLE_POS_SIGNIFICANT, STYLE_COR_SIGNIFICANT
import numpy as np
from django.utils.datastructures import SortedDict


ONLY = (
    'strain__gene__orf',
    'strain__gene__name',
    'strain__boonelab_id',
    'strain__allele',
)

def format_allele_col(orf, name, strainid, allele):
    strainid = strainid.lower()
    suffix = 'damp' in strainid and '_damp' or ''
    allele_col = (allele or name or orf).lower()
    
    if 'ts' not in strainid and 'damp' not in strainid:
        suffix = u'\u0394'
    
    if suffix:
        allele_col = '%s%s' % (allele_col, suffix)
    
    return allele_col

def strains_for_nodes(ds, nodes):
    with open(ds.static_path('nodes_inv.pickle')) as fp:
        nodes_inv = cPickle.load(fp)
    
    for node in nodes:
        strain = Strain.objects.get(pk=nodes_inv[int(node)][0])
        yield node, strain

def _collect_data(ds, nodes, callback, defer_data=False):
    with open(ds.static_path('nodes_inv.pickle')) as fp:
        nodes_inv = cPickle.load(fp)
    
    correlation_axis = ds.correlation_axis.through.objects.order_by('id').values_list(*ONLY)
    arrays = ds.arrays.through.objects.order_by('id').values_list(*ONLY)
    queries = ds.queries.through.objects.order_by('id').values_list(*ONLY)
    
    for node in nodes:
        strains = nodes_inv[int(node)]
        correlations = DataFrame(index=correlation_axis)
        scores = DataFrame()
        
        for data in ds.data.filter(strain__in=strains).select_related('strain__gene'):
            s = data.strain
            correlations[s.id] = data.correlations
            
            if data.type == StrainData.TYPE_QUERY:
                scores_axis = arrays
            elif data.type == StrainData.TYPE_ARRAY:
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
        
        scores = scores.groupby('target').agg({'score': np.mean,'pval': np.max}).reset_index().dropna()
        
        callback(s, correlations, scores)

def nodes_xls(ds, nodes, filename):
    output = write_excel_file(filename)
    
    if not nodes:
        output.add_sheet('EMPTY')
    else:
        output.add_instructions_sheet()
    
    instructions_content = []
    
    def write_sheet(strain, correlations, scores):
        instructions_content.append(strain.basic_id())
        output.add_sheet('%s correlations' % strain.basic_id(), ['ORF', 'Allele', 'Correlation'])
        for strainB, correlation in correlations.itertuples(index=False):
            output.write_correlation_row((strainB[0], format_allele_col(*strainB), correlation, ), style=correlation >= .2 and STYLE_COR_SIGNIFICANT)
        output.add_sheet('%s scores' % strain.basic_id(), ['ORF', 'Allele', 'Score', 'p-value', '', 'ORF', 'Allele', 'Score', 'p-value'])
        for strainB, pval, score in scores[scores.score <= 0].sort('score').itertuples(index=False):
            output.write_score_row_neg((strainB[0], format_allele_col(*strainB), score, pval), style=(score < -.16 and STYLE_NEG_STRINGENT) or (score < -.08 and STYLE_NEG_SIGNIFICANT) or None)
        output.reset_row(1)
        for strainB, pval, score in scores[scores.score > 0].sort('score', ascending=False).itertuples(index=False):
            output.write_score_row_pos((strainB[0], format_allele_col(*strainB), score, pval), style=(score > .16 and STYLE_POS_STRINGENT) or (score > .08 and STYLE_POS_SIGNIFICANT) or None)
    
    _collect_data(ds, nodes, write_sheet)
    
    output.write_instructions(', '.join(instructions_content))
    return output

def nodes_data(ds, nodes):
    data = SortedDict()
    
    _collect_data(ds, nodes, lambda x, y, z: data.setdefault(x, {'correlations': y, 'scores': z}))
    
    return data
