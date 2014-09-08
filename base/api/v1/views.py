import math

from django.http.response import HttpResponseBadRequest, HttpResponse
from rest_framework import permissions, reverse, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView, exception_handler

from base.models import Dataset, Strain, StrainData
from base.utils import gene_map
from serializers import DatasetDetailSerializer, DatasetSerializer
from rest_framework.renderers import JSONRenderer

@api_view(('GET',))
@permission_classes((AllowAny, ))
def api_root(request, format=None):
    """
        Returns a list of available linked api options.
    """
    
    return Response({
        'dataset': reverse.reverse('dataset-list', request=request, format=format),
        'interaction': reverse.reverse('interactions', request=request, format=format),
        'correlations': reverse.reverse('correlations', request=request, format=format)
    })

class DatasetPermission(permissions.BasePermission):
    def has_object_permission(self, request, view, dataset):
        return dataset.has_permission(request)

class DatasetList(APIView):
    """
        Returns a list of datasets available for the current user.
    """
    
    queryset = Dataset.objects.all()
    
    def get(self, request, format=None):
        datasets = []
        for dataset in self.queryset:
            if dataset.has_permission(request):
                datasets.append(dataset)
        
        serializer = DatasetSerializer(datasets, context={'request': request}, many=True)
        return Response(serializer.data)

class DatasetDetail(APIView):
    """
        Returns the detailed view of the requested dataset if the dataset with primary key exists,
        returns not found error and error message if not.
        If user is not authorized to the dataset, authentication error and message will be returned.
    """
    
    model = Dataset
    permission_classes = (DatasetPermission, )
    
    def get(self, request, pk, format=None):
        try:
            dataset = Dataset.objects.get(pk=pk)
        except:
            return Response({'errors': {'errorType': 'not_found', 
                                              'fieldName': {'ds': 'dataset'},
                                              'message': 'No dataset found with id %s' %pk}},
                        status=status.HTTP_404_NOT_FOUND)
        
        self.check_object_permissions(self.request, dataset)
        serializer = DatasetDetailSerializer(dataset)
        return Response(serializer.data)

""" 
    super class for all dataset interactions/correlations
"""
class DatasetSkeleton(APIView):
    model = Dataset
    permission_classes = (DatasetPermission, )
    
    def get(self, request, pk, format=None):
        try:
            dataset = Dataset.objects.get(pk=pk)
        except:
            return Response({'errors': {'errorType': 'not_found', 
                                              'fieldName': {'ds': 'dataset'},
                                              'message': 'No dataset found with id %s' %pk}},
                        status=status.HTTP_404_NOT_FOUND)
        
        self.check_object_permissions(self.request, dataset)
        strains_struct_func = lambda a: dict(zip(('name','orf','allele'), a))
        data = map(strains_struct_func, self.axis(dataset).values_list('gene__name', 'gene__orf', 'allele'))
        
        return Response(data)
    
    def axis(self, d):
        raise NotImplementedError()

class DatasetArrayInteractions(DatasetSkeleton):
    """
        Returns all screened arrays for the requested dataset if the dataset with primary key exists,
        returns not found error and error message if not.
        If user is not authorized to the dataset, authentication error and message will be returned.
    """
    
    def axis(self, d):
        return d.arrays

class DatasetQueryInteractions(DatasetSkeleton):
    """
        Returns all screened queries for the requested dataset if the dataset with primary key exists,
        returns not found error and error message if not.
        If user is not authorized to the dataset, authentication error and message will be returned.
    """
    
    def axis(self, d):
        return d.queries

class DatasetCorrelations(DatasetSkeleton):
    """
        Returns all screened correlations for the requested dataset if the dataset with primary key exists,
        returns not found error and error message if not.
        If user is not authorized to the dataset, authentication error and message will be returned.
    """
    
    def axis(self, d):
        return d.correlation_axis

class InteractionsDetail(APIView):
    """
        Returns the genetic interactions for the request strain within the requested dataset,
        returns validation error and error message if query parameters are invalid,
        returns not found error and error message if strain with name/orf/allele/alias or dataset with primary key is not found.
        If user is not authorized to the dataset, authentication error and message will be returned.
        
        q -- strain name/orf/allele/alias seperated by '|' character<br><b>Example: </b> YGL078C or nop2-3
        ds -- dataset id <br><b>Example: </b> 2
    """
    
    model = Dataset
    permission_classes = (DatasetPermission, )
    
    def get(self, request):
        result = _path_parameter(request.GET.get('ds'), request.GET.get('q'))
        
        if type(result) is Response:
            return result
        
        serializer = result['serializer']
        strain_datas = result['strain_datas']
        dataset = result['dataset']
        terms = result['terms']
        
        self.check_object_permissions(self.request, dataset)
        
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
    """
        Returns the correlations for the request strain within the requested dataset,
        returns validation error and error message if query parameters are invalid,
        returns not found error and error message if strain with name/orf/allele/alias or dataset with primary key is not found.
        If user is not authorized to the dataset, authentication error and message will be returned.
        
        q -- strain name/orf/allele/alias seperated by '|' character<br><b>Example: </b> YMR140W|SIP5
        ds -- dataset id <br><b>Example: </b> 2
    """
    
    model = Dataset
    permission_classes = (DatasetPermission, )
    
    def get(self, request):
        result = _path_parameter(request.GET.get('ds'), request.GET.get('q'))
        
        if type(result) is Response:
            return result
        
        serializer = result['serializer']
        strain_datas = result['strain_datas']
        dataset = result['dataset']
        terms = result['terms']
        
        self.check_object_permissions(self.request, dataset)
        
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
        return Response({'error': {'errorType': 'validation',
                                   'fieldName': {'ds': 'dataset', 'q': 'strain'},
                                   'message': 'Invalid path parameters'}}, 
                        status=status.HTTP_400_BAD_REQUEST)
    
    try:
        dataset = Dataset.objects.get(pk=ds)
    except:
        return Response({'errors': {'errorType': 'not_found', 
                                                  'fieldName': {'ds': 'dataset'},
                                                  'message': 'No dataset found with id %s' %ds}},
                        status=status.HTTP_404_NOT_FOUND)
    
    gmap = gene_map(keyfun=lambda a: a.upper())
    
    terms = terms.split('|')
    original = list(terms)
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
        return Response({'errors': {'errorType': 'not_found', 
                                    'fieldName': {'q': 'strain'},
                                    'message': 'No strain found with name/orf/allele/alias %s' % ', '.join(map(str, original))}},
                        status=status.HTTP_404_NOT_FOUND)
    
    return {'serializer': serializer, 
            'strain_datas': strain_datas,
            'dataset': dataset,
            'terms': terms}
