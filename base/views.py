""" Views for the base application """

import datetime

from django.core.urlresolvers import reverse
from django.http.response import HttpResponseRedirect, Http404
from django.shortcuts import render

from base.download import nodes_xls, strains_for_nodes, nodes_data, format_allele_col
from base.models import Dataset
from base.utils import print_queries, is_integer, JsonResponse


def home(request):
    ds = Dataset.objects.filter(is_default=True)
    if not ds.count():
        # fallback
        ds = Dataset.objects.all()
    
    return HttpResponseRedirect(reverse('dataset', args=(ds[0].pk, )))

def about(request):
    return render(request, 'base/about.html')

def dataset(request, dataset_id):
    ds = Dataset.objects.get(pk=dataset_id)
    
    return render(request, 'base/network.html', {
            'dataset': ds,
      })

@print_queries
def nodes_download(request, dataset_id):
    dataset = Dataset.objects.get(pk=dataset_id)
    nodes = filter(is_integer, request.GET.getlist('n'))
    
    if not nodes:
        return HttpResponseRedirect(dataset.static_url('dataset.txt'))
    
    return nodes_xls(
                 dataset, 
                 nodes, 
                 'thecellmap_data_%s.xls' % (datetime.datetime.now().strftime('%y%m%d'), )
        ).as_response()

def tabular(request, dataset_id):
    dataset = Dataset.objects.get(pk=dataset_id)
    nodes = filter(is_integer, request.GET.getlist('n'))
    
    if not nodes:
        raise Http404('No nodes selected')
    
    return render(request, 'base/tabular.html', {
            'dataset': dataset,
            'strains': list(strains_for_nodes(dataset, nodes))
      })

def tabular_data(request, dataset_id, node_id):
    data = nodes_data(Dataset.objects.get(pk=dataset_id), [node_id])
    response = {'correlations': [], 'scores': []}
    data = data[data.keys()[0]]
    c = data['correlations']
    s = data['scores']
        
    for strain, correlation in c[c.correlation > .2].itertuples(index=False):
        response['correlations'].append([strain[0], format_allele_col(*strain), '%.3f' % correlation])
    
    for strain, pval, score in s[(s.score.abs() > 0.08) & (s.pval < 0.05)].sort('score').itertuples(index=False):
        response['scores'].append([strain[0], format_allele_col(*strain), '%.3f' % score, '%.2e' % pval])
    
    return JsonResponse(response)
