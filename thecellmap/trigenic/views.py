from django.http.response import Http404
from django.views.decorators.http import require_GET

from trigenic.models import TriStrain


@require_GET
def scores(request):
    get = request.GET
    
#     if 's' not in get or 'g' not in get:
#         raise Http404()
#     
#     if 's' in get:
#         strain = TriStrain.objects.get(pk=get['s'])
    
    