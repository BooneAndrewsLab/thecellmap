"""
Created on Jan 13, 2014

@author: matej
"""
import pickle
import io
import json
import operator
import os
from functools import reduce

import numpy as np
from django.contrib import messages
from django.http.response import HttpResponse
from numpy.ma import corrcoef
from pandas.core.frame import DataFrame
from pandas.core.series import Series
from pandas.io.excel import ExcelWriter

from base.models import StrainData, Strain, Gene
from base.utils import write_excel_file, STYLE_NEG_STRINGENT, STYLE_NEG_SIGNIFICANT, STYLE_POS_STRINGENT, \
    STYLE_POS_SIGNIFICANT, STYLE_COR_SIGNIFICANT, print_queries, STYLE_NEIGHBOR

ONLY = (
    'strain__gene__orf',
    'strain__gene__name',
    'strain__boonelab_id',
    'strain__allele',
)


def format_allele_col(orf, name, strainid, allele):
    strainid = strainid.lower()
    suffix = '_damp' if 'damp' in strainid else ''
    allele_col = (allele or name or orf).lower()

    if not suffix and 'ts' not in strainid and 'damp' not in strainid:
        suffix = u'\u0394'
        name_bits = allele_col.split('-')
        name_bits[0] += suffix
        allele_col = '-'.join(name_bits)
    elif suffix:
        allele_col = '%s%s' % (allele_col, suffix)

    return allele_col


def strains_for_nodes(request, ds, nodes):
    with open(ds.static_path('nodes_inv.pickle'), 'rb') as fp:
        nodes_inv = pickle.load(fp)
    msg = []
    for node in nodes:
        if not node.isdigit():
            msg.append(node)
            continue

        strain = Strain.objects.get(pk=nodes_inv[int(node)][0])
        yield node, strain, strain.label()

    if msg:
        messages.warning(request, "One or more queried gene id's are malformed. "
                                  "If you pasted this url manually please make sure you pasted "
                                  "the correct text")


@print_queries
def collect_scores(ds, nodes):
    with open(ds.static_path('nodes_inv.pickle'), 'rb') as fp:
        nodes_inv = pickle.load(fp)

    nodes_inv_inv = {}
    for nid, sids in nodes_inv.items():
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

            dat = list(filter(lambda x: ((not np.isnan(x[2])) and np.abs(x[2]) >= .08 and x[3] < .05), zip([node]*len(scores_axis), scores_axis, scrs, pvals)))
            node_scores.extend(dat)
        node_scores = DataFrame.from_records(node_scores, columns=['source', 'target', 'score', 'pval']).sort_values(['target', 'pval'])
        node_scores = node_scores.groupby('target').filter(lambda x: len(x) < 2 or not reduce(operator.xor, x.score < 0)).groupby('target').first().reset_index()

        if scores is None:
            scores = node_scores
        else:
            scores = scores.append(node_scores, ignore_index=True)

    return scores.sort_values('score').reindex(columns=['source', 'target', 'score'])

@print_queries
def collect_correlations(ds, nodes, cutoff):
    nodes = map(int, nodes)

    with open(ds.static_path('nodes_inv.pickle'),'rb') as fp:
        nodes_inv = pickle.load(fp)

    nodes_inv_inv = {}
    for nid, sids in nodes_inv.items():
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
    correlations = correlations.dropna().sort_values('corr', ascending=False)
    correlations = correlations[correlations['corr'] > cutoff]

    return correlations, correlations['target'].unique()


def _collect_data(ds, nodes, callback, pval_thr=0.05, include_strain_id=False):
    with open(ds.static_path('nodes_inv.pickle'), 'rb') as fp:
        nodes_inv = pickle.load(fp)

    def get_axis(ax_obj):
        qs = ax_obj.filter(dataset=ds).order_by('id')

        if include_strain_id:
            return [(strain[0], strain[1], format_allele_col(*strain[1:])) for strain in qs.values_list(
                'strain__pk', *ONLY)]
        return [(strain[0], format_allele_col(*strain)) for strain in qs.values_list(*ONLY)]

    correlation_axis = get_axis(ds.correlation_axis.through.objects)
    arrays = get_axis(ds.arrays.through.objects)
    queries = get_axis(ds.queries.through.objects)

    for node in nodes:
        strains = nodes_inv[int(node)]
        correlations = DataFrame(index=correlation_axis)
        scores = DataFrame()
        s = None

        for data in ds.data.filter(strain__in=strains).select_related('strain__gene'):
            s = data.strain
            correlations[s.id] = data.correlations

            if data.type == StrainData.TYPE_QUERY:
                scores_axis = arrays
            else:
                scores_axis = queries

            scores = scores.append(DataFrame({
                'target': scores_axis,
                'score': data.scores,
                'pval': data.pvalues}), ignore_index=True)

        """
            Correlations
        """
        correlations = correlations.mean(axis=1)
        correlations = correlations.reset_index()
        correlations.columns = ['strainB', 'correlation']
        correlations = correlations.groupby('strainB').mean().reset_index()
        correlations = correlations.dropna().sort_values('correlation', ascending=False)

        scores = scores[scores.pval < pval_thr]
        scores = scores.sort_values(['target', 'pval']).reindex(columns=['target', 'pval', 'score'])

        if include_strain_id:  # merging array-query is different when we include strainid
            scores.loc[:, 'groupvalue'] = scores.target.apply(lambda x: x[1:])
            scores = scores.sort_values(['groupvalue', 'pval'])
            scores = scores.groupby('groupvalue').filter(lambda x: len(x) < 2 or not reduce(operator.xor, x.score < 0))
            scores = scores.groupby('groupvalue').first().reset_index()
            scores = scores.drop(columns="groupvalue")
        else:
            scores = scores.groupby('target').filter(lambda x: len(x) < 2 or not reduce(operator.xor, x.score < 0))
            scores = scores.groupby('target').first().reset_index()

        callback(s, node, correlations, scores)


def nodes_xls(ds, nodes, filename):
    output = write_excel_file(filename)

    if not nodes:
        output.add_sheet('EMPTY')
    else:
        output.add_instructions_sheet()

    instructions_content = []
    dubious = {g for g, in Gene.objects.filter(feature_qualifier='Dubious').values_list('orf')}

    def get_annotations(isneighbor, orf, allele):
        annotation = []
        if orf in dubious:
            annotation.append('Dubious')
        if isneighbor:
            annotation.append('Neighbor')
        if 'supp' in allele:
            annotation.append('Carries Suppressor Mutation')
        return ','.join(annotation)

    def write_sheet(strain, node, correlations, scores):
        neighbors = [n.orf for n in strain.gene.closest_neighbors(ds)]
        instructions_content.append(strain.basic_id())

        output.add_sheet('%s GI profile sim.' % strain.label(), ['ORF', 'Allele', 'Correlation', 'Annotations'])
        for strainB, correlation in correlations.itertuples(index=False):
            style = correlation >= .2 and STYLE_COR_SIGNIFICANT
            if strainB[0] in neighbors:
                style = STYLE_NEIGHBOR
            output.write_correlation_row(strainB + (correlation, get_annotations(strainB[0] in neighbors, *strainB)), style=style)

        output.add_sheet('%s GI scores' % strain.label(), ['ORF', 'Allele', 'Score', 'p-value', 'Annotations', '', 'ORF', 'Allele', 'Score', 'p-value', 'Annotations'])
        for strainB, pval, score in scores[(scores.score <= 0) & (scores.pval < 0.05)].sort_values('score').itertuples(index=False):
            style = (score < -.12 and STYLE_NEG_STRINGENT) or (score < -.08 and STYLE_NEG_SIGNIFICANT) or None
            if strainB[0] in neighbors:
                style = STYLE_NEIGHBOR
            output.write_score_row_neg(strainB + (score, pval, get_annotations(strainB[0] in neighbors, *strainB)), style=style)
        output.reset_row(1)
        for strainB, pval, score in scores[(scores.score > 0) & (scores.pval < 0.05)].sort_values('score', ascending=False).itertuples(index=False):
            style = (score > .16 and STYLE_POS_STRINGENT) or (score > .08 and STYLE_POS_SIGNIFICANT) or None
            if strainB[0] in neighbors:
                style = STYLE_NEIGHBOR
            output.write_score_row_pos(strainB + (score, pval, get_annotations(strainB[0] in neighbors, *strainB)), style=style)

    _collect_data(ds, nodes, write_sheet)

    output.write_instructions(', '.join(instructions_content))
    return output


def nodes_data(ds, nodes, pval_thr=0.05, include_strain_id=False):
    data = {}
    _collect_data(
        ds,
        nodes,
        lambda x, _, y, z: data.setdefault(x, {'correlations': y, 'scores': z}),
        pval_thr=pval_thr,
        include_strain_id=include_strain_id)

    return data


def xlsx_response(df, filename, **kwargs):
    output = io.BytesIO()
    w = ExcelWriter(output, engine='xlsxwriter')
    df.to_excel(w, **kwargs)
    w.save()

    output.seek(0)
    resp = HttpResponse(content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    resp['Content-Disposition'] = 'attachment; filename="%s"' % (filename, )
    resp.write(output.read())
    return resp

