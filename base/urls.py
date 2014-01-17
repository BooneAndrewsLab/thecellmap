"""urlconf for the base application"""

from django.conf.urls import url, patterns


urlpatterns = patterns('base.views',
    url(r'^$', 'home', name='home'),
    url(r'^about/$', 'about', name='about'),
    url(r'^network/(?P<dataset_id>\d+)/$', 'dataset', name='dataset'),
    url(r'^network/(?P<dataset_id>\d+)/dl/$', 'nodes_download', name='nodes_download'),
    url(r'^network/(?P<dataset_id>\d+)/tabular/$', 'tabular', name='tabular'),
    url(r'^network/(?P<dataset_id>\d+)/tabular/(?P<node_id>\d+)/$', 'tabular_data', name='tabular_fetch'),
)
