import io

from django.db.models import Q
from django.http.response import JsonResponse, HttpResponse
from django.views.decorators.http import require_GET

from base.download import xlsx_response
from base.utils import require_get_params, add_headers
import pandas as p

from .models import TriStrainSet, TriStrain


def _get_scores(request):
    gene = request.GET['gene']
    strain = request.GET['strain']
    typ = request.GET['score_type']
    
    result = {}
    
    if typ == 'query':
        strain_set = TriStrainSet.objects.filter(Q(double_mutant__gene1=gene) | Q(double_mutant__gene2=gene))
        
        if strain:
            strain_set = strain_set.filter(pk=strain)
        
        if strain_set.count() == 0:
            return {'error': 'Selected gene was not screened as a query'}
        elif strain_set.count() > 1:
            return {'error': 'Selected gene returned more than one double mutant',
                    'strains': [
                            s.pk for s in strain_set
                        ]
                }
        
        strain_set = strain_set.select_related()[0]
        
        score_dm = strain_set.double_mutant.get_query_scores(pvalue__lt=0.05, score__lt=0)
        score_s1 = strain_set.single_mutant1.get_query_scores(pvalue__lt=0.05)
        score_s2 = strain_set.single_mutant2.get_query_scores(pvalue__lt=0.05)
        
        for g, s, p in score_dm.itertuples(index=False):
            result.setdefault('dm', {'strain': strain_set.double_mutant_id, 'scores': []})['scores'].append((int(g),float(s),float(p)))
        for g, s, p in score_s1.itertuples(index=False):
            result.setdefault('s1', {'strain': strain_set.single_mutant1_id, 'scores': []})['scores'].append((int(g),float(s),float(p)))
        for g, s, p in score_s2.itertuples(index=False):
            result.setdefault('s2', {'strain': strain_set.single_mutant2_id, 'scores': []})['scores'].append((int(g),float(s),float(p)))
    else:
        strain = TriStrain.objects.filter((Q(gene1=gene) | Q(gene2=gene)), is_query=False)
        
        if strain.count() == 0:
            return {'error': 'Selected gene was not screened as an array'}
        
        strain = strain[0]
        scores = strain.get_array_scores(Q(query__is_double_mutant=True, score__lt=0) | Q(query__is_double_mutant=False), pvalue__lt=0.05)
        
        for g, s, p in scores.itertuples(index=False):
            result.setdefault('a', {'strain': strain.pk, 'scores': []})['scores'].append(((int(g),float(s),float(p))))
    
    return result

def list_to_df(scores, strains, short=False):
    df = p.DataFrame(scores, columns=['g', 'Score', 'p-value'])
    
    index = []
    for g in df['g']:
        s = strains[g]
        row = [s.gene1.orf, s.gene1.name, '', '', s.allele, s.boonelab_id, s.is_double_mutant and 'Trigenic' or 'Digenic']
        if s.is_double_mutant:
            row[2] = s.gene2.orf
            row[3] = s.gene2.name
        
        index.append(row)
    
    idx = p.MultiIndex.from_tuples(index, names=['ORF 1', 'Gene 1', 'ORF 2', 'Gene 2', 'Allele', 'Strain ID', 'Interaction Type'])
    if short:
        idx = idx.droplevel(['ORF 2', 'Gene 2'])
    
    df.index = idx
    
    return df

def download(request):
    scores = _get_scores(request)
    
    if request.GET.get('score_type') == 'query':
        strains = [scores[k]['strain'] for k in scores]
        for k in scores:
            strains += [g for g, _, _ in scores[k]['scores']]
        strains = {s.pk: s for s in TriStrain.objects.filter(pk__in=strains).select_related('gene1', 'gene2')}
        
        output = io.BytesIO()
        w = p.ExcelWriter(output, engine='xlsxwriter')
        
        filebits = []
        
        for k in scores:
            df = list_to_df(scores[k]['scores'], strains, short=True)
            filebits.append(strains[scores[k]['strain']].verbose_name_short())
            df.to_excel(
                w, 
                sheet_name=strains[scores[k]['strain']].verbose_name(), 
                columns=['Score', 'p-value'],)
        
        w.save()
        output.seek(0)
        
        resp = HttpResponse(content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        resp['Content-Disposition'] = 'attachment; filename="kuzmin2017_scores_%s.xlsx"' % (','.join(filebits), )
        resp.write(output.read())
        return resp

    else:
        strains = {s.pk: s for s in TriStrain.objects.filter(pk__in=[g for g,_,_ in scores['a']['scores']] + [scores['a']['strain']]).select_related('gene1', 'gene2')}
        df = list_to_df(scores['a']['scores'], strains)
        
        return xlsx_response(
            df, 
            'kuzmin2017_scores_%s.xlsx' % (strains[scores['a']['strain']].verbose_name_short(), ), 
            sheet_name=strains[scores['a']['strain']].verbose_name(),
            columns=['Score', 'p-value'],
        )

@require_GET
@add_headers(**{'Access-Control-Allow-Origin': '*'})
@require_get_params(params=['gene', 'score_type'])
def scores(request):
    if 'download' in request.GET:
        return download(request)
    return JsonResponse(_get_scores(request))
