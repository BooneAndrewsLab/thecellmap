""" Views for the base application """

import datetime

from django.contrib.staticfiles.storage import staticfiles_storage
from django.core.urlresolvers import reverse
from django.http.response import HttpResponseRedirect
from django.shortcuts import render

from base.download import prepare_nodes
from base.forms import TabularForm
from base.models import Dataset
from base.utils import print_queries, is_integer


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

def tabular(request):
    return render(request, 'base/tabular.html', {
            'form': TabularForm()
      })

@print_queries
def nodes_download(request, dataset_id):
    dataset = Dataset.objects.get(pk=dataset_id)
    nodes = filter(is_integer, request.GET.getlist('n'))
    
    if not nodes:
        return HttpResponseRedirect(dataset.static_url('dataset.txt'))
    
    return prepare_nodes(
                 dataset, 
                 nodes, 
                 'thecellmap_data_%s.xls' % (datetime.datetime.now().strftime('%y%m%d'), )
        ).as_response()
