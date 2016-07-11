""" Views for the base application """

import datetime
import json
import math
import os
import pickle
from urllib import urlencode
import urllib2

from bs4 import BeautifulSoup
from django.conf import settings
from django.contrib.auth import login as django_login, logout as django_logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import PasswordChangeForm, AuthenticationForm
from django.db.models.aggregates import Max
from django.http.response import HttpResponseRedirect, Http404, HttpResponseForbidden, HttpResponseBadRequest
from django.shortcuts import render
from django.views.decorators.clickjacking import xframe_options_exempt
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.cache import never_cache

from base.download import nodes_xls, strains_for_nodes, nodes_data, collect_scores, collect_correlations
from base.models import Dataset, Annotation, Term, Gene, Custom, Strain, RegionGroup, Region
from base.utils import print_queries, is_integer, JsonResponse


USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:27.0) Gecko/20100101 Firefox/27.0'

def _serve_dataset(request, dataset=None, override_auth=False):
    dataset = Dataset.pk_or_default(dataset, request.user)
    
    if override_auth or request.user.is_authenticated() or dataset.is_published:
        response = render(request, 'base/network.html', {
                'dataset': dataset,
                'annotations': Annotation.objects.filter(enabled=True).order_by('name'),
                'regionGroups': RegionGroup.objects.filter(dataset=dataset),
                'can_bulk_download': os.path.isfile(dataset.static_path('dataset.txt')),
                'ui': request.COOKIES.get('selectedUi') or 'simple',
        })
        return response
    else:
        return login(request)
#         return HttpResponseForbidden("Permission Required")

def about(request):
    return render(request, 'base/about.html')

def resources(request):
    return render(request, 'base/resources.html')

@login_required
def password_change(request):
    form = PasswordChangeForm(request.user)
    if request.POST:
        form = PasswordChangeForm(request.user, request.POST)
        if form.is_valid():
            form.save()
            request.user.last_login = datetime.datetime.now()
            request.user.save(update_fields=['last_login'])
            return HttpResponseRedirect(request.GET.get('next', '/'))
    return render(request, 'base/generic_form.html', {
                'form': form,
                'suffix': 'Change password'
        })

def login(request, next='/'):
    form = AuthenticationForm(request)
    if request.POST:
        form = AuthenticationForm(request, request.POST)
        if form.is_valid():
            first_time = form.get_user().last_login is None
            django_login(request, form.get_user())
            if first_time:
                request.user.last_login = None
                request.user.save(update_fields=['last_login'])
            return HttpResponseRedirect(request.GET.get('next', next))
    return render(request, 'base/generic_form.html', {
                'form': form,
                'suffix': 'Login'
        })

@never_cache
def logout(request):
    django_logout(request)
    return render(request, 'base/logout.html')

def home(request):
    return _serve_dataset(request)

def dataset(request, dataset_id):
    return _serve_dataset(request, dataset_id)

def load_test(request):
    return _serve_dataset(request, override_auth=True)

def genes(request):
    genes = [g.as_object() for g in Gene.objects.all()]
    maxid = Gene.objects.aggregate(mx=Max('id'))['mx']
    for strain in Strain.objects.filter(allele__isnull=False).exclude(allele='').distinct('allele').select_related('gene'):
        maxid += 1
        genes.append({'orf': strain.gene.orf, 'aliases': strain.gene.aliases, 'id': maxid, 'name': strain.gene.name, 'alel': strain.allele})
    
    return JsonResponse(genes)

def custom_dataset(request, custom_hash):
    custom = Custom.objects.get(hash=custom_hash)
    
    if custom.private and custom.user != request.user:
        return HttpResponseForbidden("Sorry the network you're trying to access is private")
    
    if custom.dataset:
        if request.user.is_authenticated() or custom.dataset.is_published:
            return render(request, 'base/network.html', {
                    'dataset': custom.dataset,
                    'annotations': Annotation.objects.filter(enabled=True).order_by('name'),
                    'can_bulk_download': False,
                    'extra': {
                        'id': custom_hash,
                        'static_url': custom.static_url(),
                        'name': custom_hash,
                        'type': custom.type,
                        'directed': custom.network_type == Custom.NET_DIRECTED,
                    },
                    'regionGroups': RegionGroup.objects.filter(dataset=custom.dataset),
                    'ui': request.COOKIES.get('selectedUi') or 'simple',
              })
        else:
            return HttpResponseForbidden("Permission Required")
    else:
        return render(request, 'base/network.html', {
                'dataset': {
                    'id': custom_hash,
                    'static_url': custom.static_url(),
                    'name': custom_hash,
                    'type': custom.type,
                    'directed': custom.network_type == Custom.NET_DIRECTED,
                },
                'annotations': Annotation.objects.filter(enabled=True).order_by('name'),
                'can_bulk_download': False,
                'ui': request.COOKIES.get('selectedUi') or 'simple',
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
    for n in json.load(open(dataset.static_path('nodes.json')))['nodes']:
        if n['id'] in nodes_idx:
            labels.append(n['label'])
    
    filename = 'tcm-%s-%s.xls' % ('_'.join(labels)[:(255-18)], datetime.datetime.now().strftime('%y%m%d'))
    response = nodes_xls(
                 dataset, 
                 nodes, 
                 filename
        ).as_response()
    if len(labels) == 1:
        response.set_cookie('_'.join(labels)[:(255-18)], "true")
    else:
        response.set_cookie('fileDownload', "true")
    return response

def tabular(request, dataset_id=None):
    dataset = Dataset.pk_or_default(dataset_id, request.user)
    nodes = filter(is_integer, request.GET.getlist('n'))
    
    if request.user.is_authenticated() or dataset.is_published:
        return render(request, 'base/tabular.html', {
            'dataset': dataset,
            'strains': list(strains_for_nodes(dataset, nodes)),
            'nodes_url': dataset.static_url('nodes.json'),
            })
    else:
        return login(request, "?"+request.META['QUERY_STRING'])

def three_demension(request, dataset_id):
    dataset = Dataset.pk_or_default(dataset_id, request.user)
    if request.user.is_authenticated() or dataset.is_published:
        return render(request, 'base/3D.html', {
                'dataset': dataset,
                'annotations': [Annotation.objects.get(name='SAFE')],
        })
    
    return HttpResponseForbidden()

@xframe_options_exempt
def ccbr_collaboration(request):
    return render(request, 'base/collaboration.html', {
                'root': settings.STATIC_URL,
                'nohead': 'nohead' in request.GET
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
    
    range_str =  os.path.join('packomania', '%i-%i' % (int(math.floor(node_num / 1000.0)) * 1000 + 1, 
                                (int(math.floor(node_num / 1000.0)) + 1) * 1000),
                                '%i-%i' % (int(math.floor(node_num / 100.0)) * 100 + 1, 
                                (int(math.floor(node_num / 100.0)) + 1) * 100), str(node_num) + '.json')
    
    if os.path.exists(os.path.join(settings.STATIC_ROOT, range_str)):
        return HttpResponseRedirect(os.path.join(settings.STATIC_URL, range_str))
    else:
        return JsonResponse([])

@print_queries
def region_group(request, dataset_id, region_group_id):
    response = {}
    regionGroup = RegionGroup.objects.select_related('dataset').get(id=region_group_id)
    
    if regionGroup.dataset.id != int(dataset_id):
        return JsonResponse(response)
    
    with open(regionGroup.dataset.static_path('nodes_inv.pickle')) as fp:
        nodes_inv = pickle.load(fp)
    
    nodes_inv_inv = {}
    for nid, sids in nodes_inv.iteritems():
        for sid in sids:
            nodes_inv_inv[sid] = nid
    
    for strain, degree, region, alias, color in Region.vertices.through.objects.filter(region__region_group=region_group_id).values_list('strain', 'degree', 'region', 'region__alias', 'region__color'):  # @UndefinedVariable
        response.setdefault(region, {})
        response[region][degree] = nodes_inv_inv[strain]
        if color not in response[region]:
            response[region]['color'] = color
        if alias not in response[region]:
            response[region]['name'] = alias
    
    return JsonResponse(response)

def publication_citations(request, title):
    params = {
        'as_epq': title,
        'as_q': '',
        'as_occt': 'any',
        'as_sdt': '0,5',
        'as_vis': '0',
        'hl': 'en',
        'num': '1'
    }
    url = 'http://scholar.google.com/scholar?' + urlencode(params)
    
    citations = None
    
    try:
        req = urllib2.Request(url, headers={'User-Agent': USER_AGENT})
        data = urllib2.urlopen(req)
        data = data.read()
        
        soup = BeautifulSoup(data)
        for tag in soup.findAll('a'):
            if tag.get('href', '').startswith('/scholar?cites'):
                if hasattr(tag, 'string') and tag.string.startswith('Cited by'):
                    citations = int(tag.string.replace('Cited by ', ''))
    except:
        pass
    
    return JsonResponse({'cited': citations})
