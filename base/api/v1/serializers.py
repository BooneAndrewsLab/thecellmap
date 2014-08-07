from rest_framework import serializers

from base.models import Dataset, Gene, Strain


class GeneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Gene
        fields = ('primary_sgdid', 'feature_qualifier', 'orf', 'name', 'aliases', 'description')

class StrainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Strain
        fields = ('gene', 'allele', 'genotype', 'mating_type')
        depth = 1

class DatasetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dataset
        fields = ('name', 'is_default', 'is_published', 'description', 'date')

class DatasetDetailSerializer(serializers.ModelSerializer):
    queries = serializers.PrimaryKeyRelatedField(many=True)
    
    class Meta:
        model = Dataset
        fields = ('name', 'is_default', 'is_published', 'description', 'date', 'queries')
