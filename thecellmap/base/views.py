""" Views for the base application """

import datetime
import os

from django.contrib.auth import authenticate, login as django_login, logout as django_logout
from django.core.exceptions import ValidationError
from django.forms.fields import CharField
from django.forms.forms import Form
from django.forms.widgets import PasswordInput
from django.http.response import HttpResponseRedirect, Http404, HttpResponseForbidden, HttpResponseBadRequest
from django.shortcuts import render
from django.views.decorators.http import require_POST

from base.download import nodes_xls, strains_for_nodes, nodes_data, collect_scores
from base.models import Dataset, Annotation, Term, Gene, Custom, Strain
from base.utils import print_queries, is_integer, JsonResponse
from django.db.models.aggregates import Max


class LoginForm(Form):
    username = CharField()
    password = CharField(widget=PasswordInput)
    
    def clean(self):
        cleaned_data = super(LoginForm, self).clean()
        if 'username' not in cleaned_data or 'password' not in cleaned_data:
            return cleaned_data
        user = authenticate(username=cleaned_data['username'], password=cleaned_data['password'])
        if user is not None:
            if not user.is_active:
                raise ValidationError('Your account has been disabled')
        else:
            raise ValidationError('Wrong username or password')
        cleaned_data['user'] = user
        return cleaned_data

def _serve_dataset(request, dataset=None):
    dataset = dataset or Dataset.get_default()
    if request.user.is_authenticated() or dataset.is_published:
        return render(request, 'base/network.html', {
                'dataset': dataset,
                'annotations': Annotation.objects.all(),
                'can_bulk_download': os.path.isfile(dataset.static_path('dataset.txt'))
          })
    else:
        return HttpResponseForbidden("Permission Required")

def about(request):
    return render(request, 'base/about.html')

def login(request):
    form = LoginForm()
    if request.POST:
        form = LoginForm(request.POST)
        if form.is_valid():
            django_login(request, form.cleaned_data['user'])
            return HttpResponseRedirect(request.GET.get('next', '/'))
    return render(request, 'base/login.html', {
                'form': form
        })

def logout(request):
    django_logout(request)
    return render(request, 'base/logout.html')

def home(request):
    return _serve_dataset(request)

def dataset(request, dataset_id):
    return _serve_dataset(request, Dataset.objects.get(pk=dataset_id))

def genes(request):
    genes = [g.as_object() for g in Gene.objects.all()]
    maxid = Gene.objects.aggregate(mx=Max('id'))['mx']
    for strain in Strain.objects.filter(allele__isnull=False).exclude(allele='').distinct('allele').select_related('gene'):
        maxid += 1
        genes.append({'orf': strain.gene.orf, 'aliases': strain.gene.aliases, 'id': maxid, 'name': strain.gene.name, 'alel': strain.allele})
    
    return JsonResponse(genes)

def custom_dataset(request, hash):
    custom = Custom.objects.get(hash=hash)
    
    return render(request, 'base/network.html', {
            'dataset': {
                'id': hash,
                'static_url': custom.static_url(),
                'name': hash,
                
            },
            'annotations': Annotation.objects.all(),
            'can_bulk_download': False
      })

@require_POST
def interactions(request, dataset_id=None):
    nodes = request.POST.getlist('nodes[]')
    if not nodes:
        raise Http404('No nodes requested')
    
    response = []
    
    data = collect_scores(Dataset.pk_or_default(dataset_id), nodes)
    for s, t, w in data.itertuples(index=False):
        response.append({
            'id': '%04d%04d' % (s, t),
            's': int(s),
            't': int(t),
            'w': float(w)
         })
    
    return JsonResponse({'dataset': 'Interactions', 'edges': response})

@print_queries
def nodes_download(request, dataset_id=None):
    dataset = dataset_id and Dataset.objects.get(pk=dataset_id) or Dataset.get_default()
    nodes = filter(is_integer, request.GET.getlist('n'))
    
    if not nodes:
        return HttpResponseRedirect(dataset.static_url('dataset.txt'))
    
    if len(nodes) > 20:
        return HttpResponseForbidden('Trying to download too many nodes')
    
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

@print_queries
def tabular_data(request, dataset_id=None, node_id=None):
    if not node_id: raise Http404('Node ID is required')
    data = nodes_data(dataset_id and Dataset.objects.get(pk=dataset_id) or Dataset.get_default(), [node_id])
    response = {'correlations': [], 'scores_pos': [], 'scores_neg': []}
    data = data[data.keys()[0]]
    c = data['correlations']
    s = data['scores']
    s = s[s.pval < 0.05]
    
    if 's' in request.GET:
        return _tabular_more_scores(request, s)
    elif 'c' in request.GET:
        return _tabular_more_correlations(request, c)
    
    c = c[c.correlation > .2]
    s = s[s.score.abs() > 0.08]
    
    for strain, correlation in c.itertuples(index=False):
        response['correlations'].append(strain + ('%.3f' % correlation, ))
    
    for strain, pval, score in s[s.score < 0].sort('score').itertuples(index=False):
        response['scores_neg'].append(strain + ('%.3f' % score, '%.2e' % pval, ))
    
    for strain, pval, score in s[s.score > 0].sort('score', ascending=False).itertuples(index=False):
        response['scores_pos'].append(strain + ('%.3f' % score, '%.2e' % pval))
    
    return JsonResponse(response)

def _tabular_more_scores(request, scores):
    try:
        cutoff = float(request.GET['s'])
    except:
        return HttpResponseBadRequest('Cutoff is not a number (float)')
    
    if cutoff < 0:
        scores = scores[(scores.score < 0) & (scores.score > cutoff)].sort('score')
    else:
        scores = scores[(scores.score >= 0) & (scores.score < cutoff)].sort('score', ascending=False)
    
    response = []
    for strain, pval, score in scores.itertuples(index=False):
        response.append(strain + ('%.3f' % score, '%.2e' % pval, ))
    
    return JsonResponse(response)

def _tabular_more_correlations(request, correlations):
    try:
        cutoff = float(request.GET['c'])
    except:
        return HttpResponseBadRequest('Cutoff is not a number (float)')
    
    correlations = correlations[(correlations.correlation < cutoff) & (correlations.correlation >= 0)]
    
    response = []
    for strain, correlation in correlations.itertuples(index=False):
        response.append(strain + ('%.3f' % correlation, ))
    
    return JsonResponse(response)

@print_queries
def annotation(request, annotation_id):
    response = {'terms': {}, 'map': {}}
    
    for orf, term_id, term, color in Term.genes.through.objects.filter(term__annotation=annotation_id).values_list('gene__orf', 'term_id', 'term__name', 'term__color'):  # @UndefinedVariable
        response['map'].setdefault(orf, []).append(term_id)
        if term_id not in response['terms']:
            response['terms'][term_id] = {'name': term, 'color': color}
    
    return JsonResponse(response)

def foobar(request):
    return render(request, 'base/matrix.html')
