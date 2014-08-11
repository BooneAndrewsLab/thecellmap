from django.conf.urls import url, patterns
from rest_framework.urlpatterns import format_suffix_patterns

from views import DatasetList, DatasetDetail, InteractionsDetail, CorrelationsDetail


urlpatterns = patterns('base.api.v1.views',
    url(r'^$', 'api_root'),
    url(r'^dataset/list/$', DatasetList.as_view(), name='dataset-list'),
    url(r'^dataset/(?P<pk>[0-9]+)/$', DatasetDetail.as_view(), name='dataset-detail'),
    url(r'^interactions/$', InteractionsDetail.as_view()),
    url(r'^correlations/$', CorrelationsDetail.as_view())
)

urlpatterns = format_suffix_patterns(urlpatterns)