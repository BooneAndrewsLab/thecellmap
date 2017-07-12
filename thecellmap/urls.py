""" Default urlconf for thecellmap """

from django.conf.urls import include, url
from django.contrib import admin

def bad(request):
    """ Simulates a server error """
    1 / 0

urlpatterns = [
    url(r'^admin/', admin.site.urls),
    url(r'^bad/$', bad),
    url(r'^trigenic/', include('trigenic.urls')),
    url(r'', include('base.urls')),
    ]