from rest_framework import serializers

from base.models import Dataset


class DatasetSerializer(serializers.ModelSerializer):
    dataset_detail = serializers.HyperlinkedIdentityField(view_name='dataset-detail',)
    
    class Meta:
        model = Dataset
        fields = ('name', 'id', 'dataset_detail')

class DatasetDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dataset
        fields = ('name', 'is_default', 'is_published', 'description', 'date',)
