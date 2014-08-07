from django.conf.urls import url, patterns, include

from viewsets import router


urlpatterns = patterns('',
    url(r'^', include(router.urls)),
)
