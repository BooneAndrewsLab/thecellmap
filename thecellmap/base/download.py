'''
Created on Jan 13, 2014

@author: matej
'''
import cPickle
import json
import operator
import os

from django.core.paginator import Paginator
from numpy.ma import corrcoef
from pandas.core.frame import DataFrame
from pandas.core.series import Series

from base.models import StrainData, Strain
from base.utils import write_excel_file, STYLE_NEG_STRINGENT, STYLE_NEG_SIGNIFICANT, STYLE_POS_STRINGENT, \
    STYLE_POS_SIGNIFICANT, STYLE_COR_SIGNIFICANT, print_queries
import numpy as np
from django.contrib import messages


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

def strains_for_nodes(request, ds, nodes):
    with open(ds.static_path('nodes_inv.pickle')) as fp:
        nodes_inv = cPickle.load(fp)
    
    msg = []
    for node in nodes:
        if not node.isdigit():
            msg.append(node)
            continue
        
        strain = Strain.objects.get(pk=nodes_inv[int(node)][0])
        yield node, strain, strain.label()
    
    if msg:
        messages.warning(request, "One or more queried gene id's are malformed. If you pasted this url manually please make sure you pasted the correct text")

@print_queries
def collect_scores(ds, nodes):
    with open(ds.static_path('nodes_inv.pickle')) as fp:
        nodes_inv = cPickle.load(fp)
    
    nodes_inv_inv = {}
    for nid, sids in nodes_inv.iteritems():
        for sid in sids:
            nodes_inv_inv[sid] = nid
    
    arrays = [nodes_inv_inv[strain] for strain, in ds.arrays.through.objects.filter(dataset=ds).order_by('id').values_list('strain_id')]
    queries = [nodes_inv_inv[strain] for strain, in ds.queries.through.objects.filter(dataset=ds).order_by('id').values_list('strain_id')]
    
    scores = None
    
    nodes = set(map(int, nodes))
    
    for node in nodes:
        node = int(node)
        strains = nodes_inv[node]
        
        node_scores = []
        for typ, scrs, pvals in ds.data.filter(strain__in=strains).values_list('type', 'scores', 'pvalues'):
            if typ == StrainData.TYPE_QUERY:
                scores_axis = arrays
            elif typ == StrainData.TYPE_ARRAY:
                scores_axis = queries
            
            dat = filter(lambda x: ((not np.isnan(x[2])) and np.abs(x[2]) >= .08 and x[3] < .05), zip([node]*len(scores_axis), scores_axis, scrs, pvals))
            node_scores.extend(dat)
        
        node_scores = DataFrame.from_records(node_scores, columns=['source', 'target', 'score', 'pval']).sort(['target', 'pval'])
        node_scores = node_scores.groupby('target').filter(lambda x: len(x) < 2 or not operator.xor(*(x.score < 0))).groupby('target').first().reset_index()
        
        if scores is None:
            scores = node_scores
        else:
            scores = scores.append(node_scores, ignore_index=True)
        
    return scores.sort('score').reindex(columns=['source', 'target', 'score'])

@print_queries
def collect_correlations(ds, nodes, cutoff):
    nodes = map(int, nodes)
    
    with open(ds.static_path('nodes_inv.pickle')) as fp:
        nodes_inv = cPickle.load(fp)
    
    nodes_inv_inv = {}
    for nid, sids in nodes_inv.iteritems():
        for sid in sids:
            nodes_inv_inv[sid] = nid
    
    strains = set()
    for n in nodes:
        for s in nodes_inv[n]:
            strains.add(s)
    
    axis = [nodes_inv_inv[strain] for strain, in ds.correlation_axis.through.objects.filter(dataset=ds).order_by('id').values_list('strain_id')]
    
    correlations = DataFrame()
    for s in strains:
        data = ds.data.get(strain=s)
        correlations = correlations.append(DataFrame({'source': nodes_inv_inv[s], 'target': axis, 'corr': data.correlations}))
    
    correlations = correlations.groupby(('source', 'target')).mean().reset_index()
    correlations = correlations.dropna().sort('corr', ascending=False)
    correlations = correlations[correlations['corr'] > cutoff]
    
    return correlations, correlations['target'].unique()

def collect_score_matrix(ds, nodes, data):
    data = json.loads(data)['edges']
    
    nmap = {}
    for n in json.loads(nodes)['nodes']:
        nmap[n['id']] = n
    
    smap = {}
    for s in Strain.objects.all().select_related('gene'):
        smap[s.label()] = s
        smap[s.pk] = s
        smap[s.gene.orf] = s
        smap[s.gene.name] = s
    
    with open(ds.static_path('nodes_inv.pickle')) as fp:
        nodes_inv = cPickle.load(fp)
    
    nodes_inv_inv = {}
    for nid, sids in nodes_inv.iteritems():
        for sid in sids:
            nodes_inv_inv[sid] = nid
    
    source = data[0]['s']
    targets = []
    weights = []
    
    for e in data:
        if 'label' in nmap[e['t']] and nmap[e['t']]['label'] in smap:
            targets.append(smap[nmap[e['t']]['label']].id)
            weights.append(float(e['w']))
    
    df = DataFrame.from_csv(os.path.join(ds.static_path(), 'scores_matrix.csv'))
    new_row = Series(weights, targets, dtype=np.float64)
    df.columns = df.columns.astype(new_row.index.dtype)
    
    new_row = new_row.groupby(lambda x: x).mean()
    
    df = df.reindex(columns=set(df.columns).intersection(new_row.index))
    new_row = new_row.reindex(index=df.columns)
    
    mask_new_row = ~np.isnan(new_row.values)
    
    results = []
    fubar = []
    for idx, row in df.iterrows():
        new_mask = ~np.isnan(row.values)
        
        mask = mask_new_row & new_mask
        if not np.sum(mask): continue
        
        corr = corrcoef(new_row[mask], row[mask])[0, 1]
        
        results.append({'s': source, 't': idx, 'w': corr})
        fubar.append((results[-1]['w'], smap[idx], np.sum(new_mask), np.sum(mask)))
        
        if corr < 0:
            continue
    
    print sorted(fubar, reverse=True)[:5]
    
#     for w,x,s,ss in sorted(fubar, reverse=True):
#         print '\t'.join(map(str, (w,x.gene, x.allele, x.boonelab_id,s,ss)))
    
    return results

def _collect_data(ds, nodes, callback, defer_data=False):
    with open(ds.static_path('nodes_inv.pickle')) as fp:
        nodes_inv = cPickle.load(fp)
    
    correlation_axis = [(strain[0], format_allele_col(*strain)) for strain in ds.correlation_axis.through.objects.filter(dataset=ds).order_by('id').values_list(*ONLY)]
    arrays = [(strain[0], format_allele_col(*strain)) for strain in ds.arrays.through.objects.filter(dataset=ds).order_by('id').values_list(*ONLY)]
    queries = [(strain[0], format_allele_col(*strain)) for strain in ds.queries.through.objects.filter(dataset=ds).order_by('id').values_list(*ONLY)]
    
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
        
        scores = scores[scores.pval < 0.05].sort(['target', 'pval']).reindex(columns=['target', 'pval', 'score'])
        scores = scores.groupby('target').filter(lambda x: len(x) < 2 or not operator.xor(*(x.score < 0))).groupby('target').first().reset_index()
        
        callback(s, node, correlations, scores)

def nodes_xls(ds, nodes, filename):
    output = write_excel_file(filename)
    
    if not nodes:
        output.add_sheet('EMPTY')
    else:
        output.add_instructions_sheet()
    
    instructions_content = []
    
    def write_sheet(strain, node, correlations, scores):
        instructions_content.append(strain.basic_id())
        output.add_sheet('%s GI profile sim.' % strain.label(), ['ORF', 'Allele', 'Correlation'])
        for strainB, correlation in correlations.itertuples(index=False):
            output.write_correlation_row(strainB + (correlation, ), style=correlation >= .2 and STYLE_COR_SIGNIFICANT)
        output.add_sheet('%s GI scores' % strain.label(), ['ORF', 'Allele', 'Score', 'p-value', '', 'ORF', 'Allele', 'Score', 'p-value'])
        for strainB, pval, score in scores[(scores.score <= 0) & (scores.pval < 0.05)].sort('score').itertuples(index=False):
            output.write_score_row_neg(strainB + (score, pval), style=(score < -.16 and STYLE_NEG_STRINGENT) or (score < -.08 and STYLE_NEG_SIGNIFICANT) or None)
        output.reset_row(1)
        for strainB, pval, score in scores[(scores.score > 0) & (scores.pval < 0.05)].sort('score', ascending=False).itertuples(index=False):
            output.write_score_row_pos(strainB + (score, pval), style=(score > .16 and STYLE_POS_STRINGENT) or (score > .08 and STYLE_POS_SIGNIFICANT) or None)
    
    _collect_data(ds, nodes, write_sheet)
    
    output.write_instructions(', '.join(instructions_content))
    return output

def nodes_data(ds, nodes):
    data = {}
    _collect_data(ds, nodes, lambda x, _, y, z: data.setdefault(x, {'correlations': y, 'scores': z}))
    
    return data
