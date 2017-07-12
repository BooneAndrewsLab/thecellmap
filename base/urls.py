"""urlconf for the base application"""

from django.conf.urls import url, include
from django.contrib.sitemaps import GenericSitemap, Sitemap
from django.contrib.sitemaps.views import sitemap
from django.urls import reverse
from django.views.generic import TemplateView
from django.views.generic.base import RedirectView

from base.models import Dataset
from base import views, tools

class StaticViewSitemap(Sitemap):
    priority = 0.5
    changefreq = 'daily'

    def items(self):
        return ['home', 'about', 'resources', 'tools_custom', 'tools_annotations']

    def location(self, item):
        return reverse(item)

sitemaps = {
    'network': GenericSitemap({'queryset': Dataset.objects.filter(is_published=True), 'data_field': 'date'}),
    'static': StaticViewSitemap,
}

urlpatterns = [
    url(r'^favicon[.]ico$', RedirectView.as_view(url='/static/favicon.ico')),
    
    url(r'^tools/annotations/', tools.annotations, name='tools_annotations'),
    url(r'^tools/custom/', tools.custom, name='tools_custom'),
    url(r'^tools/edit/(?P<id>[0-9]+)/$', tools.edit_dataset, name="tools_edit_dataset"),
    
#     url(r'^api/', include('base.api.v1.urls')),

    url(r'^$', views.home, name='home'),
    url(r'^about/$', views.about, name='about'),
    url(r'^costanzo2016/$', views.resources, name='resources'),
    url(r'^login/$', views.login, name='login'),
    url(r'^logout/$', views.logout, name='logout'),
    url(r'^password_change/$', views.password_change, name='password_change'),
    url(r'^network/(?P<dataset_id>\d+)/$', views.dataset, name='dataset'),
    url(r'^network/(?P<dataset_id>\d+)/interactions/$', views.interactions, name='interactions'),
    url(r'^network/(?P<dataset_id>\d+)/correlations/$', views.correlations, name='correlations'),
    url(r'^network/(?P<dataset_id>\d+)/dl/$', views.nodes_download, name='nodes_download'),
    url(r'^network/(?P<dataset_id>\d+)/tabular/$', views.tabular, name='tabular'),
    url(r'^network/(?P<dataset_id>\d+)/tabular/(?P<node_id>\d+)/$', views.tabular_data, name='tabular_fetch'),
    url(r'^network/(?P<dataset_id>\d+)/safe/$', views.safe, name='safe'),
    url(r'^network/(?P<custom_hash>.{40})/$', views.custom_dataset, name='custom_dataset'),
    # default dataset urls
    url(r'^interactions/$', views.interactions, name='interactions_default'),
    url(r'^correlations/$', views.correlations, name='correlations_default'),
    url(r'^dl/$', views.nodes_download, name='nodes_download_default'),
    url(r'^tabular/$', views.tabular, name='tabular_default'),
    url(r'^tabular/(?P<node_id>\d+)/$', views.tabular_data, name='tabular_fetch_default'),
    # annotation urls
    url(r'^annotation/(?P<annotation_id>\d+)/$', views.annotation, name='annotation'),
    # region urls
    url(r'^region_group/(?P<dataset_id>\d+)/(?P<region_group_id>\d+)/$', views.region_group, name='region_group'),
    url(r'^genes/$', views.genes, name='genes'),
    # contact
#     url(r'^contact/', include('contact_form.urls')),
    url(r'^circlepack/$', views.circle_pack, name='circle_pack'),
    url(r'^ui/advance/$', TemplateView.as_view(template_name='ui/ui.html'), name='advance_ui'),
    url(r'^ui/simple/$', TemplateView.as_view(template_name='ui/simple_ui.html'), name='simple_ui'),
    url(r'^ui/draw/$', TemplateView.as_view(template_name='ui/draw_ui.html'), name='draw_ui'),
    url(r'^ui/base/$', TemplateView.as_view(template_name='ui/base_ui.html'), name='base_ui'),
    
    url(r'^3D/(?P<dataset_id>\d+)/$', views.three_demension, name='three_demension'),
    url(r'^ccbr_collaboration/$', views.ccbr_collaboration, name='ccbr_collaboration'),
    url(r'^ccbr_collaboration/citations/(?P<title>.+)/$', views.publication_citations, name='publication_citations'),

    url(r'^sitemap\.xml$', sitemap, {'sitemaps': sitemaps}, name='django.contrib.sitemaps.views.sitemap'),

    url(r'^load_test/$', views.load_test, name='load_test'),
]
