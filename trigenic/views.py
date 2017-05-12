from django.db.models import Q
from django.http.response import JsonResponse
from django.views.decorators.http import require_GET

from base.utils import require_get_params, add_headers
from trigenic.models import TriStrainSet, TriStrain


@require_GET
@add_headers(**{'Access-Control-Allow-Origin': '*'})
@require_get_params(params=['gene', 'score_type'])
def scores(request):
    gene = request.GET['gene']
    typ = request.GET['score_type']
    
    result = {}
    
    if typ == 'query':
        strain_set = TriStrainSet.objects.filter(Q(double_mutant__gene1=gene) | Q(double_mutant__gene2=gene))
        
        if strain_set.count() == 0:
            return JsonResponse({'error': 'Selected gene was not screened as a query'})
        elif strain_set.count() > 1:
            return JsonResponse({'error': 'Selected gene returned more than one double mutant'})
        
        strain_set = strain_set.select_related()[0]
        
        score_dm = strain_set.double_mutant.get_query_scores(pvalue__lt=0.05)
        score_s1 = strain_set.single_mutant1.get_query_scores(pvalue__lt=0.05)
        score_s2 = strain_set.single_mutant2.get_query_scores(pvalue__lt=0.05)
        
        for g, s, p in score_dm.itertuples(index=False):
            result.setdefault('dm', {'strain': strain_set.double_mutant_id, 'scores': []})['scores'].append((g,s,p))
        for g, s, p in score_s1.itertuples(index=False):
            result.setdefault('s1', {'strain': strain_set.single_mutant1_id, 'scores': []})['scores'].append((g,s,p))
        for g, s, p in score_s2.itertuples(index=False):
            result.setdefault('s2', {'strain': strain_set.single_mutant2_id, 'scores': []})['scores'].append((g,s,p))
    else:
        strain = TriStrain.objects.filter((Q(gene1=gene) | Q(gene2=gene)), is_query=False)
        
        if strain.count() == 0:
            return JsonResponse({'error': 'Selected gene was not screened as an array'})
        
        strain = strain[0]
        scores = strain.get_array_scores(pvalue__lt=0.05)
        
        for g, s, p in scores.itertuples(index=False):
            result.setdefault('a', {'strain': strain.pk, 'scores': []})['scores'].append((g,s,p))
        
    return JsonResponse(result)
