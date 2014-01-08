""" Views for the base application """

from django.shortcuts import render
from base.models import Dataset
from base.forms import TabularForm
from django.http.response import HttpResponseRedirect
from django.core.urlresolvers import reverse

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