from base.models import Dataset, Custom
from django.db.models import Q

def datasets(request):
    lists = {'datasetlist': Dataset.objects.order_by("-date")}
    if not request.user.is_anonymous():
        lists['customlist'] = Custom.objects.filter(user=request.user
                        ).exclude(Q(name="") | Q(name__isnull=True)).order_by("-date")
    return lists