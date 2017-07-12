from django.conf.urls import url, include
from rest_framework.urlpatterns import format_suffix_patterns
from base.api.v1 import views
from views import DatasetList, DatasetDetail, DatasetQueryInteractions, DatasetArrayInteractions, DatasetCorrelations, InteractionsDetail, CorrelationsDetail

urlpatterns = [
    url(r'^$', views.api_root),
    url(r'^auth/', include('rest_framework.urls', namespace='rest_framework')),
    url(r'^dataset/list/$', DatasetList.as_view(), name='dataset-list'),
    url(r'^dataset/show/(?P<pk>[0-9]+)/$', DatasetDetail.as_view(), name='dataset-detail'),
    url(r'^dataset/queries/(?P<pk>[0-9]+)/$', DatasetQueryInteractions.as_view(), name='dataset-queries'),
    url(r'^dataset/arrays/(?P<pk>[0-9]+)/$', DatasetArrayInteractions.as_view(), name='dataset-arrays'),
    url(r'^dataset/correlations/(?P<pk>[0-9]+)/$', DatasetCorrelations.as_view(), name='dataset-correlations'),
    url(r'^interactions/$', InteractionsDetail.as_view(), name='interactions'),
    url(r'^correlations/$', CorrelationsDetail.as_view(), name='correlations'),
    url(r'^docs/', include('rest_framework_swagger.urls')),
    ]

urlpatterns = format_suffix_patterns(urlpatterns)