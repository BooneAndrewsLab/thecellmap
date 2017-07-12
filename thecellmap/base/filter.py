import django_filters

from base.models import Custom


class CustomFilter(django_filters.FilterSet):
    class Meta:
        model = Custom
        fields = ['user', 'hash', 'private', 'name', 'date', 'permanent']