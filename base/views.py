""" Views for the base application """

import datetime
import math
import os
import pickle

from django.conf import settings
from django.contrib.auth import login as django_login, logout as django_logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import PasswordChangeForm, AuthenticationForm
from django.db.models.aggregates import Max
from django.http.response import HttpResponseRedirect, Http404, HttpResponseForbidden, HttpResponseBadRequest
from django.shortcuts import render
from django.utils import simplejson
from django.views.decorators.http import require_POST, require_GET

from base.download import nodes_xls, strains_for_nodes, nodes_data, collect_scores, collect_correlations
from base.models import Dataset, Annotation, Term, Gene, Custom, Strain, Heatmap, RegionGroup, Region
from base.utils import print_queries, is_integer, JsonResponse


def _serve_dataset(request, dataset=None):
    dataset = Dataset.pk_or_default(dataset, request.user)
    print dataset 
    if request.user.is_authenticated() or dataset.is_published:
        return render(request, 'base/network.html', {
                'dataset': dataset,
                'annotations': Annotation.objects.all(),
                'regionGroups': RegionGroup.objects.all(),
                'can_bulk_download': os.path.isfile(dataset.static_path('dataset.txt'))
          })
    else:
        return HttpResponseForbidden("Permission Required")

def about(request):
    return render(request, 'base/about.html')

@login_required
def password_change(request):
    form = PasswordChangeForm(request.user)
    if request.POST:
        form = PasswordChangeForm(request.user, request.POST)
        if form.is_valid():
            form.save()
            return HttpResponseRedirect(request.GET.get('next', '/'))
    return render(request, 'base/generic_form.html', {
                'form': form,
                'suffix': 'Change password'
        })

def login(request):
    form = AuthenticationForm(request)
    if request.POST:
        form = AuthenticationForm(request, request.POST)
        if form.is_valid():
            django_login(request, form.get_user())
            return HttpResponseRedirect(request.GET.get('next', '/'))
    return render(request, 'base/generic_form.html', {
                'form': form,
                'suffix': 'Login'
        })

def logout(request):
    django_logout(request)
    return render(request, 'base/logout.html')

def home(request):
    return _serve_dataset(request)

def dataset(request, dataset_id):
    return _serve_dataset(request, dataset_id)

def heatmap(request, heatmap_id):
    heatmap = Heatmap.objects.get(pk=heatmap_id)
    return render(request, 'base/heatmap.html', {
            'heatmap': heatmap,
            })

def genes(request):
    genes = [g.as_object() for g in Gene.objects.all()]
    maxid = Gene.objects.aggregate(mx=Max('id'))['mx']
    for strain in Strain.objects.filter(allele__isnull=False).exclude(allele='').distinct('allele').select_related('gene'):
        maxid += 1
        genes.append({'orf': strain.gene.orf, 'aliases': strain.gene.aliases, 'id': maxid, 'name': strain.gene.name, 'alel': strain.allele})
    
    return JsonResponse(genes)

def custom_dataset(request, hash):
    custom = Custom.objects.get(hash=hash)
    
    if custom.private and custom.user != request.user:
        return HttpResponseForbidden("Sorry the network you're trying to access is private")
    
    if custom.dataset:
        if request.user.is_authenticated() or custom.dataset.is_published:
            return render(request, 'base/network.html', {
                    'dataset': custom.dataset,
                    'annotations': Annotation.objects.all(),
                    'can_bulk_download': False,
                    'extra': {
                            'id': hash,
                            'static_url': custom.static_url(),
                            'name': hash,
                            'type': custom.type,
                            'directed': custom.network_type == Custom.NET_DIRECTED,
                        },
              })
        else:
            return HttpResponseForbidden("Permission Required")
    else:
        return render(request, 'base/network.html', {
                'dataset': {
                    'id': hash,
                    'static_url': custom.static_url(),
                    'name': hash,
                    'type': custom.type,
                    'directed': custom.network_type == Custom.NET_DIRECTED,
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
    
    data = collect_scores(Dataset.pk_or_default(dataset_id, request.user), nodes)
    for s, t, w in data.itertuples(index=False):
        response.append({
            'id': '%04d%04d' % (s, t),
            's': int(s),
            't': int(t),
            'w': float(w)
         })
    
    return JsonResponse({'dataset': 'Interactions', 'edges': response})

@require_POST
def correlations(request, dataset_id=None):
    nodes = request.POST.getlist('nodes[]')
    if not nodes:
        raise Http404('No nodes requested')
    
    cutoff = request.POST.get('cutoff')
    if not cutoff:
        raise Http404('No cutoff requested')
    
    try:
        cutoff = float(cutoff)
    except ValueError:
        raise Http404('Cutoff is not a number')
    
    response = []
    
    data, new_nodes = collect_correlations(Dataset.pk_or_default(dataset_id, request.user), nodes, cutoff)
    for s, t, w in data.itertuples(index=False):
        response.append({
            'id': '%04d%04d' % (s, t),
            's': int(s),
            't': int(t),
            'w': float(w)
         })
    
    return JsonResponse({'dataset': 'Correlations', 'edges': response, 'node': list(new_nodes)})

@print_queries
def nodes_download(request, dataset_id=None):
    dataset = Dataset.pk_or_default(dataset_id, request.user)
    nodes = filter(is_integer, request.GET.getlist('n'))
    
    if not nodes:
        return HttpResponseRedirect(dataset.static_url('dataset.txt'))
    
    if len(nodes) > 20:
        return HttpResponseForbidden('Trying to download too many nodes')
    
    nodes_idx = set(map(int, nodes))
    
    labels = []
    for n in simplejson.load(open(dataset.static_path('nodes.json')))['nodes']:
        if n['id'] in nodes_idx:
            labels.append(n['label'])
    
    filename = 'tcm-%s-%s.xlsx' % ('_'.join(labels)[:(255-18)], datetime.datetime.now().strftime('%y%m%d'))
    
    return nodes_xls(
                 dataset, 
                 nodes, 
                 filename
        ).as_response()

def tabular(request, dataset_id=None):
    dataset = Dataset.pk_or_default(dataset_id, request.user)
    nodes = filter(is_integer, request.GET.getlist('n'))
    
    if not nodes:
        raise Http404('No nodes selected')
    
    return render(request, 'base/tabular.html', {
            'dataset': dataset,
            'strains': list(strains_for_nodes(dataset, nodes)),
            'nodes_url': dataset.static_url('nodes.json'),
      })

@print_queries
def tabular_data(request, dataset_id=None, node_id=None):
    if not node_id: raise Http404('Node ID is required')
    dataset = Dataset.pk_or_default(dataset_id, request.user)
    
    data = nodes_data(dataset, [node_id])
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
    
    for orf, term_id, term, color, alias in Term.genes.through.objects.filter(term__annotation=annotation_id).values_list('gene__orf', 'term_id', 'term__name', 'term__color', 'term__alias'):  # @UndefinedVariable
        response['map'].setdefault(orf, []).append(term_id)
        if term_id not in response['terms']:
            response['terms'][term_id] = {'name': term, 'color': color, 'alias': alias}
    
    return JsonResponse(response)

@require_GET
def circle_pack(request):
    try:
        node_num = int(request.GET['num'])
    except:
        return HttpResponseBadRequest('Input number of nodes')
    
    range =  os.path.join('packomania', '%i-%i' % (int(math.floor(node_num / 1000.0)) * 1000 + 1, 
                                (int(math.floor(node_num / 1000.0)) + 1) * 1000),
                                '%i-%i' % (int(math.floor(node_num / 100.0)) * 100 + 1, 
                                (int(math.floor(node_num / 100.0)) + 1) * 100), str(node_num) + '.json')
    
    if os.path.exists(os.path.join(settings.STATIC_ROOT, range)):
        return HttpResponseRedirect(os.path.join(settings.STATIC_URL, range))
    else:
        return JsonResponse([])

@print_queries
def region_group(request, dataset_id, region_group_id):
    response = {}
    regionGroup = RegionGroup.objects.select_related('dataset').get(id=region_group_id)
    
    if regionGroup.dataset.id != int(dataset_id):
        return HttpResponseBadRequest('Incorrect dataset')
    
    with open(regionGroup.dataset.static_path('nodes_inv.pickle')) as fp:
        nodes_inv = pickle.load(fp)
    
    nodes_inv_inv = {}
    for nid, sids in nodes_inv.iteritems():
        for sid in sids:
            nodes_inv_inv[sid] = nid
    
    for strain, degree, region, color in Region.vertices.through.objects.filter(region__region_group=region_group_id).values_list('strain', 'degree', 'region', 'region__color'):
        response.setdefault(region, {})
        response[region][degree] = nodes_inv_inv[strain]
        if color not in response[region]:
            response[region]['color'] = color
    
    return JsonResponse(response)

def foobar(request):
    return render(request, 'base/matrix.html')
