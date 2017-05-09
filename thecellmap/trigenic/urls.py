"""urlconf for the base application"""

from django.conf.urls import url

from .views import scores


urlpatterns = [
    url(r'^$', scores, name='scores'),
]
