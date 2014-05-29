from base.models import Dataset


def datasets(request):
    return {'datasetlist': Dataset.objects.order_by("-date")}