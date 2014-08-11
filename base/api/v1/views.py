import math

from django.http.response import HttpResponseBadRequest, HttpResponse
from rest_framework import permissions, reverse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from base.models import Dataset, Strain, StrainData
from base.utils import gene_map
from serializers import DatasetDetailSerializer


@api_view(('GET',))
@permission_classes((AllowAny, ))
def api_root(request, format=None):
    return Response({
        'dataset': reverse.reverse('dataset-list', request=request, format=format),
    })

class DatasetPermission(permissions.BasePermission):
    def has_object_permission(self, request, view, dataset):
        return dataset.is_published or request.user.is_authenticated()

class DatasetList(APIView):
    queryset = Dataset.objects.all()
    
    def get(self, request, format=None):
        datasets = []
        for dataset in self.queryset:
            if dataset.has_permission(request):
                datasets.append(dataset)
        
        serializer = DatasetSerializer(datasets, context={'request': request}, many=True)
        return Response(serializer.data)

class DatasetDetail(APIView):
    queryset = Dataset.objects.all()
    permission_classes = (DatasetPermission, )
    
    def get_object(self, pk):
        dataset = self.queryset.get(pk=pk)
        self.check_object_permissions(self.request, dataset)
        return dataset
    
    def get(self, request, pk, format=None):
        dataset = self.get_object(pk)
        serializer = DatasetDetailSerializer(dataset)
        return Response(serializer.data)

class InteractionsDetail(APIView):
    queryset = Dataset.objects.all()
    
    def get(self, request):
        result = _path_parameter(request.GET.get('ds'), request.GET.get('q'))
        
        if type(result) is Response or type(result) is HttpResponse:
            return result
        
        serializer = result['serializer']
        strain_datas = result['strain_datas']
        dataset = result['dataset']
        terms = result['terms']
        
        strains_struct_func = lambda a: dict(zip(('name','orf','allele'), a))
        queries = map(strains_struct_func, dataset.queries.values_list('gene__name', 'gene__orf', 'allele'))
        arrays = map(strains_struct_func, dataset.arrays.values_list('gene__name', 'gene__orf', 'allele'))
        
        for datas, term in zip(strain_datas, terms):
            for d in datas:
                message = ''
                q = {
                     'name': d.strain.gene.name,
                     'orf': d.strain.gene.orf,
                     'allele': d.strain.allele,
                    }
                gi = []
                
                axis = queries
                types = ['query', 'array']
                if d.type == 'Q':
                    axis = arrays
                    types = types[::-1]
                
                if not (d.scores or d.pvalues):
                    message = 'No interaction data found for %s strain' %term
                
                for strain, score, pvalue in zip(axis, d.scores, d.pvalues):
                    if not (math.isnan(score) or math.isnan(pvalue)):
                        gi.append({types[0]: strain, 'score': score, 'p_value': pvalue})
                
                temp = {types[1]: q, 'gi': gi, 'searched_term': term}
                if message != '':
                    temp['message'] = message
                serializer.append(temp)
            
        return Response(serializer)

class CorrelationsDetail(APIView):
    queryset = Dataset.objects.all()
    
    def get(self, request):
        result = _path_parameter(request.GET.get('ds'), request.GET.get('q'))
        
        if type(result) is Response or type(result) is HttpResponse:
            return result
        
        serializer = result['serializer']
        strain_datas = result['strain_datas']
        dataset = result['dataset']
        terms = result['terms']
        
        strains_struct_func = lambda a: dict(zip(('name','orf','allele'), a))
        axis = map(strains_struct_func, dataset.correlation_axis.values_list('gene__name', 'gene__orf', 'allele'))
        
        for datas, term in zip(strain_datas, terms):
            for d in datas:
                message = ''
                q = {
                     'name': d.strain.gene.name,
                     'orf': d.strain.gene.orf,
                     'allele': d.strain.allele,
                    }
                correlations = []
                
                if not d.correlations:
                    message = 'No data found for %s strain' %term
                else:
                    for strain, corr in zip(axis, d.correlations):
                        if not math.isnan(corr):
                            correlations.append({'strain_B': strain, 'correlation': corr})
                
                temp = {'strain_A': q, 'correlations': correlations, 'searched_term': term}
                if message != '':
                    temp['message'] = message
                serializer.append(temp)
            
        return Response(serializer)

def _path_parameter(ds, terms):
    serializer = []
    strain_datas = []
    
    if terms is None or ds is None:
        return HttpResponseBadRequest('Invalid path parameters')
    
    try:
        dataset = Dataset.objects.get(pk=ds)
    except:
        return Response({'errors': {'errorType': '404 Not Found', 
                                                  'fieldName': 'dataset',
                                                  'message': 'No dataset found with id %s' %ds}})
    
    gmap = gene_map(keyfun=lambda a: a.upper())
    
    terms = terms.split('|')
    terms_upper = [a.upper() for a in terms]
    
    for s, o in zip(terms_upper, terms):
        if s in gmap:
            strain_datas.append(StrainData.objects.filter(strain__gene=gmap[s]).select_related('strain__gene').defer('pvalues', 'scores'))
        else:
            for strain in Strain.objects.filter(allele__isnull=False).select_related('gene'):
                gmap[strain.allele.upper()] = strain
            if s in gmap:
                strain_datas.append(StrainData.objects.filter(strain=gmap[s]).select_related('strain__gene').defer('pvalues', 'scores'))
            else:
                serializer.append({'message': 'No strain with name/orf/allele/alias %s' %o,
                                   'searched_term': o})
                terms.remove(o)
    
    if not len(strain_datas):
        return Response({'errors': {'errorType': '404 Not Found', 
                                    'fieldName': 'strain',
                                    'message': 'No strain found with name/orf/allele/alias %s' % ', '.join(map(str, terms))}})
    
    return {'serializer': serializer, 
            'strain_datas': strain_datas,
            'dataset': dataset,
            'terms': terms}
    