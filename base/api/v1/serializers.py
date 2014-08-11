from rest_framework import serializers

from base.models import Dataset, Gene, Strain


class DatasetSerializer(serializers.ModelSerializer):
    detail = serializers.HyperlinkedIdentityField(view_name='dataset-detail',)
    
    class Meta:
        model = Dataset
        fields = ('name', 'id', 'detail')

class DatasetDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dataset
        fields = ('name', 'is_default', 'is_published', 'description', 'date',)