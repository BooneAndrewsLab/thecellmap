"""urlconf for the base application"""

from django.conf.urls import url, patterns, include
from django.views.generic import TemplateView
from rest_framework.urls import template_name


urlpatterns = patterns('base.views',
    url(r'^$', 'home', name='home'),
    url(r'^about/$', 'about', name='about'),
    url(r'^login/$', 'login', name='login'),
    url(r'^logout/$', 'logout', name='logout'),
    url(r'^password_change/$', 'password_change', name='password_change'),
    url(r'^network/(?P<dataset_id>\d+)/$', 'dataset', name='dataset'),
    url(r'^network/(?P<dataset_id>\d+)/interactions/$', 'interactions', name='interactions'),
    url(r'^network/(?P<dataset_id>\d+)/correlations/$', 'correlations', name='correlations'),
    url(r'^network/(?P<dataset_id>\d+)/dl/$', 'nodes_download', name='nodes_download'),
    url(r'^network/(?P<dataset_id>\d+)/tabular/$', 'tabular', name='tabular'),
    url(r'^network/(?P<dataset_id>\d+)/tabular/(?P<node_id>\d+)/$', 'tabular_data', name='tabular_fetch'),
    url(r'^network/(?P<hash>.{40})/$', 'custom_dataset', name='custom_dataset'),
    url(r'^heatmap/(?P<heatmap_id>\d+)/$', 'heatmap', name='heatmap'),
    
    # default dataset urls
    url(r'^interactions/$', 'interactions', name='interactions_default'),
    url(r'^correlations/$', 'correlations', name='correlations_default'),
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
    
    url(r'^circlepack/$', 'circle_pack', name='circle_pack'),
    url(r'^ui/advance/$', TemplateView.as_view(template_name='ui/ui.html'), name='advance_ui'),
    url(r'^ui/simple/$', TemplateView.as_view(template_name='ui/simple_ui.html'), name='simple_ui'),
    url(r'^ui/base/$', TemplateView.as_view(template_name='ui/base_ui.html'), name='base_ui')
)

urlpatterns += patterns('base.tools',
    # annotations
    url(r'^tools/annotations/', 'annotations', name='tools_annotations'),
    url(r'^tools/custom/', 'custom', name='tools_custom'),
    url(r'^tools/edit/$', 'edit', name="tools_edit"),
    url(r'^tools/edit/(?P<id>[0-9]+)/$', 'edit_dataset', name="tools_edit_dataset"),
)

urlpatterns += patterns('base.api',
    url(r'^api/', include('base.api.v1.urls')),

)
