""" Basic models, such as user profile """

import os

import dbarray
from django.contrib.auth.models import User
from django.db import models
from thecellmap import settings


class Gene(models.Model):
    primary_sgdid = models.CharField(max_length=10, help_text='Primary SGDID', unique=True, db_index=True)
    feature_qualifier = models.CharField(max_length=24, help_text='Feature qualifier')
    orf = models.CharField(max_length=16, help_text='Feature name', unique=True, db_index=True)
    name = models.CharField(max_length=16, blank=True, null=True, help_text='Standard gene name', unique=True, db_index=True)
    aliases = dbarray.CharArrayField(max_length=152, blank=True, null=True, help_text='Alias')
    secondary_sgdid = dbarray.CharArrayField(max_length=10, blank=True, null=True, help_text='Secondary SGDID')
    chromosome = models.SmallIntegerField(help_text='Chromosome')
    start = models.IntegerField(help_text='Start coordinate')
    stop = models.IntegerField(help_text='Stop coordinate')
    sorting_value = models.IntegerField()
    description = models.TextField()
    
    def as_object(self):
        return {'id':self.id, 'orf': self.orf, 'name': self.name, 'aliases': self.aliases}
    
    def __unicode__(self):
        return ('%s (%s)' % (self.orf, self.name or '')).replace(' ()', '')
    
    class Meta:
        ordering = ('sorting_value', )

class Strain(models.Model):
    gene = models.ForeignKey(Gene)
    allele = models.CharField(max_length=24, null=True, blank=True)
    boonelab_id = models.CharField(max_length=24, help_text="Boonelab strain id, ex: tsq123")
    genotype = models.CharField(max_length=512)
    mating_type = models.CharField(max_length=8)
    description = models.TextField(blank=True)
    
    def __unicode__(self):
        return self.full_id()
    
    def full_id(self):
        return '%s%s - %s' % (self.gene, self.allele and ' - %s' % self.allele or '', self.boonelab_id)
    
    def basic_id(self):
        return '%s%s' % (self.gene, self.allele and ' - %s' % self.allele or '')

class Dataset(models.Model):
    name = models.CharField(max_length=64, unique=True)
    queries = models.ManyToManyField(Strain, related_name='as_query')
    arrays = models.ManyToManyField(Strain, related_name='as_array')
    correlation_axis = models.ManyToManyField(Strain, related_name='as_correlation')
    is_default = models.BooleanField(default=False)
    is_published = models.BooleanField(default=False)
    description = models.TextField()
    date = models.DateField()
    
    def __unicode__(self):
        return self.name
    
    def static_path(self, *args):
        return os.path.join(settings.STATIC_ROOT, 'visualization', self.name, *args)
    
    def static_url(self, *args):
        return os.path.join(settings.STATIC_URL, 'visualization', self.name, *args)
    
    def correlation_axis_qs(self):
        return self.correlation_axis.through.objects.order_by('id').select_related('strain__gene')
    
    def has_permission(self, request):
        return self.is_published or request.user.is_authenticated() and request.user.is_active
    
    @staticmethod
    def pk_or_default(pk=None):
        return pk and Dataset.objects.get(pk=pk) or Dataset.get_default()
    
    @staticmethod
    def get_default():
        ds = Dataset.objects.order_by('-pk').filter(is_default=True)
        if ds.count(): return ds[0]
        ds = Dataset.objects.order_by('-pk')
        if ds.count(): return ds[0]
        raise Dataset.DoesNotExist()
    
    class Meta:
        ordering = ("date", )

class StrainData(models.Model):
    TYPE_QUERY = 'Q'
    TYPE_ARRAY = 'A'
    TYPE_CHOICES = (
        (TYPE_QUERY, 'Query'),
        (TYPE_ARRAY, 'Array'),
    )
    
    dataset = models.ForeignKey(Dataset, related_name='data')
    strain = models.ForeignKey(Strain)
    type = models.CharField(max_length=1, choices=TYPE_CHOICES, default=TYPE_QUERY)
    scores = dbarray.FloatArrayField()
    pvalues = dbarray.FloatArrayField()
    correlations = dbarray.FloatArrayField(null=True)
    
    def __unicode__(self):
        return '%s @ %s' % (self.strain, self.dataset)

class Annotation(models.Model):
    name = models.CharField(max_length=64)
    alias = models.CharField(max_length=64, null=True)
    date = models.DateField()
    description = models.TextField(blank=True)
    
    def __unicode__(self):
        return u'%s' % self.name
    
    class Meta:
        unique_together = (('name', 'date'), )

class Term(models.Model):
    annotation = models.ForeignKey(Annotation)
    name = models.CharField(max_length=128)
    alias = models.CharField(max_length=128)
    source = models.CharField(max_length=32)
    color = models.CharField(max_length=6)
    
    genes = models.ManyToManyField(Gene)
    
    def __unicode__(self):
        return u'%s' % self.name
    
    class Meta:
        unique_together = (('annotation', 'name', 'source'), )

class Custom(models.Model):
    TYPE_INTERACTION = 'I'
    TYPE_CORRELATION = 'C'
    TYPE_CHOICES = (
        (TYPE_INTERACTION, 'Interaction'),
        (TYPE_CORRELATION, 'Correlation'),
    )
    
    user = models.ForeignKey(User, null=True)
    hash = models.CharField(max_length=40, unique=True)
    private = models.BooleanField(default=False)
    name = models.CharField(max_length=40, null=True, blank=True)
    date = models.DateTimeField(auto_now_add=True)
    permanent = models.BooleanField(default=False)
    dataset = models.ForeignKey(Dataset, null=True)
    type = models.CharField(max_length=1, choices=TYPE_CHOICES, default=TYPE_CORRELATION)
    
    def path(self, *args):
        return os.path.join(settings.STATIC_ROOT, 'upload', 'custom', self.hash, *args)
    
    def static_url(self, *args):
        return os.path.join(settings.STATIC_URL, 'upload', 'custom', self.hash, *args)
    
    class Meta:
        unique_together = (('name', 'user'), )

Dataset.correlation_axis.through._meta.verbose_name = 'Correlations axis'
Dataset.correlation_axis.through._meta.verbose_name_plural = 'Correlations axes'

Dataset.queries.through._meta.verbose_name = 'Queries axis'
Dataset.queries.through._meta.verbose_name_plural = 'Queries axes'

Dataset.arrays.through._meta.verbose_name = 'Arrays axis'
Dataset.arrays.through._meta.verbose_name_plural = 'Arrays axes'

# from base.serializing import FloatArrayField, CharArrayField
# from rest_framework.serializers import ModelSerializer
# ModelSerializer.field_mapping[dbarray.FloatArrayField] = FloatArrayField
# ModelSerializer.field_mapping[dbarray.CharArrayField] = CharArrayField

