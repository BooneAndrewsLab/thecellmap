""" Views for the base application """

import datetime
import io
import json
import math
import os
import pickle
from urllib.parse import urlencode
import urllib.request

from bs4 import BeautifulSoup
from django import forms
from django.conf import settings
from django.contrib.auth import login as django_login, logout as django_logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import PasswordChangeForm, AuthenticationForm
from django.db.models.aggregates import Max
from django.http.response import HttpResponseRedirect, Http404, HttpResponseForbidden, HttpResponseBadRequest, \
    HttpResponse
from django.shortcuts import render
from django.urls.base import reverse_lazy
from django.utils.decorators import method_decorator
from django.utils.safestring import mark_safe
from django.views.decorators.cache import never_cache
from django.views.decorators.clickjacking import xframe_options_exempt
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET
from django.views.generic.base import TemplateView, ContextMixin
from django.views.generic.edit import FormView
from django_tables2 import tables, SingleTableMixin, columns
from io import BytesIO
from scipy.stats import hypergeom
from sga.safe import Safe

from base.download import nodes_xls, strains_for_nodes, nodes_data, collect_scores, collect_correlations
from base.models import Dataset, Annotation, Term, Gene, Custom, Strain, RegionGroup, Region
from base.utils import print_queries, is_integer, JsonResponse, \
    safe_excel_sheetname, float_column, CharListArea, TableDataFrameMixin
import pandas as p


USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:27.0) Gecko/20100101 Firefox/27.0'

def _serve_dataset(request, dataset=None, override_auth=False):
    dataset = Dataset.pk_or_default(dataset, request.user)
    
    if override_auth or request.user.is_authenticated or dataset.is_published:
        context = {
                'layout': request.GET.get('l', 'layout.json'),
                'dataset': dataset,
                'annotations': Annotation.objects.filter(enabled=True).order_by('name'),
                'regionGroups': RegionGroup.objects.filter(dataset=dataset),
                'can_bulk_download': os.path.isfile(dataset.static_path('dataset.txt')),
                'ui': request.COOKIES.get('selectedUi') or 'simple',
        }
        
        if request.POST:
            frmt = request.POST.get('format', 'json')
            typ = request.POST.get('type', 'safe')
            if frmt == 'json' and typ == 'safe':
                context['load_safe'] = mark_safe(json.dumps(json.loads(request.POST.get('data', '[]'))))
        
        response = render(request, 'base/network.html', context)
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

def login(request, nxt='/'):
    form = AuthenticationForm(request)
    
    if request.POST:
        form = AuthenticationForm(request, request.POST)
        if form.is_valid():
            first_time = form.get_user().last_login is None
            django_login(request, form.get_user())
            if first_time:
                request.user.last_login = None
                request.user.save(update_fields=['last_login'])
            
            return HttpResponseRedirect(request.GET.get('next', nxt))
    return render(request, 'base/generic_form.html', {
                'form': form,
                'suffix': 'Login'
        })

@never_cache
def logout(request):
    django_logout(request)
    return render(request, 'base/logout.html')

@csrf_exempt
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
        if request.user.is_authenticated or custom.dataset.is_published:
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
    return JsonResponse({'dataset': 'Correlations', 'edges': response, 'node': new_nodes.tolist()})

@print_queries
def nodes_download(request, dataset_id=None):
    dataset = Dataset.pk_or_default(dataset_id, request.user)
    nodes = list(filter(is_integer, request.GET.getlist('n')))
    
    if not nodes:
        return HttpResponseRedirect(dataset.static_url('dataset.txt'))
    print("len(nodes)",len(nodes))
    if len(nodes) > 20:
        return HttpResponseForbidden('Trying to download too many nodes')
    
    nodes_idx = set(list(map(int, nodes)))

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
    
    if request.user.is_authenticated or dataset.is_published:
        strains = list(strains_for_nodes(request, dataset, nodes))
        return render(request, 'base/tabular.html', {
            'dataset': dataset,
            'strains': strains,
            'nodes_url': dataset.static_url('nodes.json'),
            })
    else:
        return login(request, "?"+request.META['QUERY_STRING'])

def three_demension(request, dataset_id):
    dataset = Dataset.pk_or_default(dataset_id, request.user)
    if request.user.is_authenticated or dataset.is_published:
        return render(request, 'base/3D.html', {
                'dataset': dataset,
                'annotations': [Annotation.objects.get(name='SAFE analysis')],
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
    
    with open(dataset.static_path('nodes_inv.pickle'),'rb') as fp:
        nodes_inv = pickle.load(fp)
    
    gene = Gene.objects.distinct().get(strain__in=nodes_inv[int(node_id)])
    neighbors = gene.closest_neighbors(dataset)
    
    data = nodes_data(dataset, [node_id])
    response = {
        'correlations': [], 
        'scores_pos': [], 
        'scores_neg': [], 
        'neighbor_effect': gene.neighbor_effect, 
        'neighbors': [n.orf for n in neighbors]
    }
    data = data[list(data)[0]]
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
    
    for strain, pval, score in s[s.score < 0].sort_values('score').itertuples(index=False):
        response['scores_neg'].append(strain + ('%.3f' % score, '%.2e' % pval, ))
    
    for strain, pval, score in s[s.score > 0].sort_values('score', ascending=False).itertuples(index=False):
        response['scores_pos'].append(strain + ('%.3f' % score, '%.2e' % pval))
    
    return JsonResponse(response)

def _tabular_more_scores(request, scores):
    try:
        cutoff = float(request.GET['s'])
    except:
        return HttpResponseBadRequest('Cutoff is not a number (float)')
    
    if cutoff < 0:
        scores = scores[(scores.score < 0) & (scores.score > cutoff)].sort_values('score')
    else:
        scores = scores[(scores.score >= 0) & (scores.score < cutoff)].sort_values('score', ascending=False)
    
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
    response = {'terms': {}, 'map': {}, 'smap': {}}
    
    for orf, term_id, term, color, alias in Term.genes.through.objects.filter(term__annotation=annotation_id).values_list('gene__orf', 'term_id', 'term__name', 'term__color', 'term__alias'):  # @UndefinedVariable
        response['map'].setdefault(orf, []).append(term_id)
        if term_id not in response['terms']:
            response['terms'][term_id] = {'name': term, 'color': color, 'alias': alias}
    
    if 'ds' in request.GET and request.GET.get('ds'):
        dataset = Dataset.objects.get(pk=request.GET.get('ds'))
        with open(dataset.static_path('nodes_inv.pickle'),'rb') as fp:
            nodes_inv = pickle.load(fp)
        
        nodes_inv_inv = {}
        for nid, sids in nodes_inv.items():
            for sid in sids:
                nodes_inv_inv[sid] = nid
        
        for strain_id, term_id, term, color, alias in Term.strains.through.objects.filter(term__annotation=annotation_id).values_list('strain_id', 'term_id', 'term__name', 'term__color', 'term__alias'):  # @UndefinedVariable
            if strain_id in nodes_inv_inv:
                response['smap'].setdefault(nodes_inv_inv[strain_id], set()).add(term_id)
            if term_id not in response['terms']:
                response['terms'][term_id] = {'name': term, 'color': color, 'alias': alias}
        
        for k in response['smap']:
            response['smap'][k] = list(response['smap'][k])
        
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
    
    with open(regionGroup.dataset.static_path('nodes_inv.pickle'),'rb') as fp:
        nodes_inv = pickle.load(fp)
    
    nodes_inv_inv = {}
    for nid, sids in nodes_inv.items():
        for sid in sids:
            nodes_inv_inv[sid] = nid
    
    for strain, degree, region, alias, color, anchor, align in Region.vertices.through.objects.filter( # @UndefinedVariable
                    region__region_group=region_group_id
                ).values_list(
                    'strain', 
                    'degree', 
                    'region', 
                    'region__alias', 
                    'region__color',
                    'region__label_anchor',
                    'region__label_align'):
        response.setdefault(region, {})
        response[region][degree] = nodes_inv_inv[strain]
        response[region]['color'] = color
        response[region]['name'] = alias.split('$NEWLINE$')
        if anchor and align:
            response[region]['label'] = {'anchor': nodes_inv_inv[anchor], 'align': align}
    
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
        req = urllib.request(url, headers={'User-Agent': USER_AGENT})
        data = urllib.request.urlopen(req)
        data = data.read()
        
        soup = BeautifulSoup(data)
        for tag in soup.findAll('a'):
            if tag.get('href', '').startswith('/scholar?cites'):
                if hasattr(tag, 'string') and tag.string.startswith('Cited by'):
                    citations = int(tag.string.replace('Cited by ', ''))
    except:
        pass
    
    return JsonResponse({'cited': citations})

@require_POST
def safe(request, dataset_id=None):
    dataset = Dataset.pk_or_default(dataset_id, request.user)
    result = {}
    
    if request.POST.get('safe-type') == 'selected':
        node = int(request.POST.get('node'))
        result['_selected_node'] = node
        data = collect_scores(Dataset.pk_or_default(dataset_id, request.user), [node])
        neg_thr = request.POST.get('neg')
        pos_thr = request.POST.get('pos')
        
        attributes = []
        for s, t, w in data.itertuples(index=False):
            row = [None, 0, 0]
            
            if w < 0:
                if neg_thr == 'unused':
                    continue
                elif neg_thr == 'stringent' and w >= -.12:
                    continue
                row[1] = 1
            else:
                if pos_thr == 'unused':
                    continue
                elif pos_thr == 'stringent' and w <= .16:
                    continue
                row[2] = 1
            
            if int(s) == node:
                row[0] = t
            else:
                row[0] = s
            
            attributes.append(row)
        
        attributes = p.DataFrame(attributes, columns=['node', 'negatives', 'positives']).set_index('node')
        
        safe = Safe(dataset.static_path('safe_layout.csv'), attributes, dataset.static_path('safe_neighbors.csv'))
        safe.prepare_attributes()
        
        enrichments = safe.calculate()
    else:
        nodes_list = {}
        
        i = 1
        while True:
            hit_list = request.POST.get('hit_list-%d' % (i, ))
            
            if not hit_list: break
            
            hit_list = hit_list.strip().lower().split()
            hit_list_name = request.POST.get('name-%d' % (i, ))
            
            nodes_list[hit_list_name] = hit_list
            i += 1
        
        if not nodes_list:
            raise Http404('Empty query')
        
        search_map = {}
        for n in json.load(open(dataset.static_path('nodes.json')))['nodes']:
            search_map.setdefault(n['label'].lower(), set()).add(n['id'])
            search_map.setdefault(n['orf'].lower(), set()).add(n['id'])
            if n['name']: search_map.setdefault(n['name'].lower(), set()).add(n['id'])
            if n['alel']: search_map.setdefault(n['alel'].lower(), set()).add(n['id'])
            for a in n['aliases']:
                search_map.setdefault(a.lower(), set()).add(n['id'])
        
        frames = []
        for hitname, nodes in nodes_list.items():
            attributes = []
            seen = set()
            for n in nodes:
                for m in search_map.get(n, []):
                    if m in seen: continue
                    
                    attributes.append((m, 1))
                    seen.add(m)
            attributes = p.DataFrame(attributes, columns=['node', hitname]).set_index('node')
            frames.append(attributes)
        
        attributes = p.concat(frames, axis=1).fillna(0)
        
        safe = Safe(dataset.static_path('safe_layout.csv'), attributes, dataset.static_path('safe_neighbors.csv'))
        safe.prepare_attributes()
        
        enrichments = safe.calculate()
    
    if 'dl' in request.POST:
        with open(dataset.static_path('nodes_inv.pickle'),'rb') as fp:
            nodes_inv = pickle.load(fp)
        
        annotation = Annotation.objects.get(pk=request.POST.get('annotation', dataset.default_annotation_id))
        
        nodes_inv_inv = {}
        for nid, sids in nodes_inv.items():
            for sid in sids:
                nodes_inv_inv[sid] = nid
        
        terms = {}
        node_in_terms = {}
        all_annotated = 0
        for term in Term.objects.filter(annotation=annotation).prefetch_related('strains', 'genes__strain_set'):
            term_nodes = set()
            
            if annotation.version == Annotation.VERSION_STRAINS:
                for strain in term.strains.all():
                    if strain.pk in nodes_inv_inv:
                        term_nodes.add(nodes_inv_inv[strain.pk])
            else:
                for gene in term.genes.all():
                    for strain in gene.strain_set.all():
                        if strain.pk in nodes_inv_inv:
                            term_nodes.add(nodes_inv_inv[strain.pk])
            
            terms[term] = term_nodes
            all_annotated += len(term_nodes)
            
            for n in term_nodes:
                node_in_terms.setdefault(n, []).append(term)
        
        node_map = {}
        for n in json.load(open(dataset.static_path('nodes.json')))['nodes']:
            node_map[n['id']] = n
        
        enrichments = enrichments.loc[enrichments.any(axis=1)]
        
        output = io.BytesIO()
        res_data = p.ExcelWriter(output, engine='xlsxwriter')
        
        gene_lists = []
        
        for col in enrichments:
            attr_nodes = safe.attributes[col]
            attr_nodes = set(attr_nodes[attr_nodes.astype(bool)].index)
            enr_nodes = set((enrichments[col][enrichments[col] > 0]).index)
            
            data2 = []
            
            for term, term_nodes in terms.items():
                k1 = len(enr_nodes.intersection(term_nodes).intersection(attr_nodes))
                M1 = all_annotated
                n1 = len(enr_nodes.intersection(attr_nodes))
                N1 = len(term_nodes.intersection(attr_nodes))
                
                if k1:
                    fold1 = (k1 * all_annotated) / float(n1 * len(term_nodes)) # N1
                    
                    gene_lists.append(((col, term, enr_nodes.intersection(term_nodes).intersection(attr_nodes))))
#                     ','.join([node_map[n]['label'] for n in enr_nodes.intersection(term_nodes).intersection(attr_nodes)])
                    
                    data2.append((
                            term.alias, 
                            hypergeom.pmf(k1, M1, n1, N1), 
                            fold1,
                            '%d / %d, %.1f%%' % (n1, len(attr_nodes), n1 * 100. / len(attr_nodes)),
                            '%d / %d, %.1f%%' % (k1, n1, k1 * 100. / n1),
                            '%d / %d, %.1f%%' % (len(term_nodes), all_annotated, len(term_nodes) * 100. / all_annotated),
                        ))
                
            colnames = ['Term', 'p-value', 'fold change', 'Fraction of input gene list annotated to a bioprocess cluster', 'Cluster frequency', 'Background frequency']
            
            p.DataFrame(data2, columns=colnames).sort_values('p-value').to_excel(res_data, index=None, sheet_name=col[:31])
            res_data.sheets[col[:31]].write(len(data2) + 2, 0, 'Please see spreadsheets to the right for gene lists')
        
        bold = res_data.book.add_format({'bold': True})
        
        enrichments.loc[:,'ORF'] = [node_map[i]['orf'] for i in enrichments.index]
        enrichments.loc[:,'Name'] = [node_map[i]['name'] for i in enrichments.index]
        enrichments.loc[:,'Allele'] = [node_map[i]['label'] for i in enrichments.index]
        enrichments.loc[:,'Feature Qualifier'] = [(node_map[i]['isdu'] and 'Dubious' or '') for i in enrichments.index]
        enrichments.loc[:,'Annotations'] = [','.join([t.alias for t in node_in_terms.get(i, [])]) for i in enrichments.index]
        
        enrichments = enrichments.reindex(columns=list(enrichments.columns[-5:]) + list(enrichments.columns[:-5]))
        enrichments = enrichments.sort_values(enrichments.columns[5], ascending=False)
        
        enrichments.to_excel(res_data, index=None, sheet_name='SAFE enrichment scores')
        
        for col, term, nodes in gene_lists:
            ct_data = [(node_map[n]['orf'], node_map[n]['name'], node_map[n]['label'].lower(), node_map[n]['isdu'] and 'Dubious' or '') for n in nodes]
            
            sheetname = safe_excel_sheetname('%s; %s' % (col, term.alias))[:31]
            
            p.DataFrame(
                    ct_data, columns=['ORF', 'Name', 'Allele', 'Feature Qualifier']
                ).sort_values('ORF'
                ).to_excel(res_data, index=None, sheet_name=sheetname, startrow=2)
            
            sheet = res_data.sheets[sheetname]
            sheet.write(0, 0, term.name, bold)
        
        res_data.save()
        
        output.seek(0)
        
        label = 'custom'
        if request.POST.get('safe-type') == 'selected':
            label = node_map[node]['label']
        
        filename = 'tcm-safe-%s-%s.xlsx' % (label, datetime.datetime.now().strftime('%y%m%d'))
#         filename = 'tcm-safe_enrichments-%s.xlsx' % (datetime.datetime.now().strftime('%y%m%d'), )
        response = HttpResponse(content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response['Content-Disposition'] = 'attachment; filename=%s' % (filename, )
        response.write(output.read())
        return response
    
    for col in enrichments:
        result[col] = enrichments[enrichments[col] > 0].astype(float).to_dict()[col]
        for k in result[col].keys():
            (result[col])[int(k)] = result[col].pop(k)

    return JsonResponse(result)


class EnrichmentForm(forms.Form):
    genes = CharListArea()
    background = CharListArea()
    annotation = forms.ModelChoiceField(Annotation.objects)


class EnrichmentView(FormView):
    template_name = 'base/generic_form.html'
    form_class = EnrichmentForm
    success_url = reverse_lazy('enrichment_result')

    def get_context_data(self, **kwargs):
        ctx = super(EnrichmentView, self).get_context_data(**kwargs)
        ctx['title'] = 'Functional enrichment'
        return ctx

    def form_valid(self, form):
        data = form.cleaned_data

        annot = data['annotation'].get_annotations()
        query = set(data['genes'])
        background = set(data['background'])

        m = len(background)  # M
        nn = len(query)  # N

        vals = []
        for term, term_genes in annot.items():
            category = background.intersection(term_genes)
            n = len(category)
            hits = query.intersection(category)
            x = len(hits)

            if 0 in (n, x):
                # either no genes in this term or no hits in this term
                continue

            vals.append(term + (hypergeom.sf(x - 1, m, n, nn), x, n, nn, m))

        df = p.DataFrame(vals, columns=['go_id', 'go_name', 'pval', 'hits_in_term', 'term_size', 'all_hits',
                                        'all_background'])
        df = df.sort_values('pval')
        df.loc[:, 'bonferroni'] = df.pval * df.shape[0]
        df.loc[:, 'bonferroni'] = df.loc[:, 'bonferroni'].clip(upper=1)
        df.loc[:, 'fold_enrichment'] = (df.hits_in_term / df.all_hits) / (df.term_size / df.all_background)

        df = df.loc[df.hits_in_term > 0]

        self.request.session['enrichment'] = df.to_dict('records')

        return super(EnrichmentView, self).form_valid(form)


class EnrichmentResultTable(TableDataFrameMixin, tables.Table):
    go_id = columns.Column(verbose_name='GO ID')
    go_name = columns.Column(verbose_name='Ontology')
    bonferroni = float_column('%.2e')(verbose_name='P-value (Bonferroni)')
    pval = float_column('%.2e')(verbose_name='P-value')
    hits_in_term = columns.Column()
    term_size = columns.Column()
    all_hits = columns.Column()
    all_background = columns.Column()
    fold_enrichment = float_column('%.3f')()

    class Meta:
        template = 'includes/table.html'


@method_decorator(never_cache, name='dispatch')
class EnrichmentResultView(SingleTableMixin, TemplateView):
    template_name = 'base/enrichment.html'
    table_class = EnrichmentResultTable
    table_pagination = False

    def get(self, request, *args, **kwargs):
        if 'download_' in request.GET:
            return self.get_table().to_excel_response('tcm_enrichment_result')

        return super(EnrichmentResultView, self).get(request, *args, **kwargs)

    def get_table_data(self):
        return self.request.session['enrichment']
