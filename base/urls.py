"""urlconf for the base application"""

from django.conf.urls import url, patterns, include


urlpatterns = patterns('base.views',
    url(r'^$', 'home', name='home'),
    url(r'^about/$', 'about', name='about'),
    url(r'^login/$', 'login', name='login'),
    url(r'^logout/$', 'logout', name='logout'),
    url(r'^network/(?P<dataset_id>\d+)/$', 'dataset', name='dataset'),
    url(r'^network/(?P<dataset_id>\d+)/interactions/$', 'interactions', name='interactions'),
    url(r'^network/(?P<dataset_id>\d+)/dl/$', 'nodes_download', name='nodes_download'),
    url(r'^network/(?P<dataset_id>\d+)/tabular/$', 'tabular', name='tabular'),
    url(r'^network/(?P<dataset_id>\d+)/tabular/(?P<node_id>\d+)/$', 'tabular_data', name='tabular_fetch'),
    url(r'^network/(?P<hash>.{40})/$', 'custom_dataset', name='custom_dataset'),
    
    # default dataset urls
    url(r'^interactions/$', 'interactions', name='interactions_default'),
    url(r'^dl/$', 'nodes_download', name='nodes_download_default'),
    url(r'^tabular/$', 'tabular', name='tabular_default'),
    url(r'^tabular/(?P<node_id>\d+)/$', 'tabular_data', name='tabular_fetch_default'),
    
    # annotation urls
    url(r'^annotation/(?P<annotation_id>\d+)/$', 'annotation', name='annotation'),
    
    url(r'^genes/$', 'genes', name='genes'),
    
    # contact
    url(r'^contact/', include('contact_form.urls')),
    
    # DEBUG
    url(r'^testingdebug/$', 'foobar', name='foobar'),
)

urlpatterns += patterns('base.tools',
    # annotations
    url(r'^tools/annotations/', 'annotations', name='tools_annotations'),
    url(r'^tools/custom/', 'custom', name='tools_custom'),
)