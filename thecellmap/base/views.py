""" Views for the base application """

import datetime

from django.http.response import HttpResponseRedirect, Http404
from django.shortcuts import render

from base.download import nodes_xls, strains_for_nodes, nodes_data
from base.models import Dataset
from base.utils import print_queries, is_integer, JsonResponse


def _serve_dataset(request, dataset=None):
    return render(request, 'base/network.html', {
            'dataset': dataset or Dataset.get_default(),
      })

def about(request):
    return render(request, 'base/about.html')

def home(request):
    return _serve_dataset(request)

def dataset(request, dataset_id):
    return _serve_dataset(request, Dataset.objects.get(pk=dataset_id))

@print_queries
def nodes_download(request, dataset_id=None):
    dataset = dataset_id and Dataset.objects.get(pk=dataset_id) or Dataset.get_default()
    nodes = filter(is_integer, request.GET.getlist('n'))
    
    if not nodes:
        return HttpResponseRedirect(dataset.static_url('dataset.txt'))
    
    return nodes_xls(
                 dataset, 
                 nodes, 
                 'thecellmap_data_%s.xls' % (datetime.datetime.now().strftime('%y%m%d'), )
        ).as_response()

def tabular(request, dataset_id=None):
    dataset = dataset_id and Dataset.objects.get(pk=dataset_id) or Dataset.get_default()
    nodes = filter(is_integer, request.GET.getlist('n'))
    
    if not nodes:
        raise Http404('No nodes selected')
    
    return render(request, 'base/tabular.html', {
            'dataset': dataset,
            'strains': list(strains_for_nodes(dataset, nodes))
      })

def tabular_data(request, dataset_id=None, node_id=None):
    if not node_id: raise Http404('Node ID is required')
    data = nodes_data(dataset_id and Dataset.objects.get(pk=dataset_id) or Dataset.get_default(), [node_id])
    response = {'correlations': [], 'scores_pos': [], 'scores_neg': []}
    data = data[data.keys()[0]]
    c = data['correlations']
    c = c[c.correlation > .2]
    
    s = data['scores']
    s = s[(s.score.abs() > 0.08) & (s.pval < 0.05)]
    
    for strain, correlation in c.itertuples(index=False):
        response['correlations'].append(strain + ('%.3f' % correlation, ))
    
    for strain, pval, score in s[s.score < 0].sort('score').itertuples(index=False):
        response['scores_neg'].append(strain + ('%.3f' % score, '%.2e' % pval, ))
    
    for strain, pval, score in s[s.score > 0].sort('score', ascending=False).itertuples(index=False):
        response['scores_pos'].append(strain + ('%.3f' % score, '%.2e' % pval))
    
    return JsonResponse(response)
