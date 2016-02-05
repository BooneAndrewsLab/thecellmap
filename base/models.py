""" Basic models, such as user profile """

import os

import dbarray
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.db import models
from django.db.models import signals
from django.http.response import Http404
from thecellmap import settings


class Gene(models.Model):
    primary_sgdid = models.CharField(max_length=10, help_text='Primary SGDID', unique=True, db_index=True)
    feature_qualifier = models.CharField(max_length=32, help_text='Feature qualifier')
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
    
    def label(self):
        suffix = 'damp' in self.boonelab_id.lower() and '_damp' or ''
        return self.allele or (self.gene.name and (self.gene.name + suffix)) or (self.gene.orf + suffix)

class Dataset(models.Model):
    name = models.CharField(max_length=64, unique=True)
    queries = models.ManyToManyField(Strain, related_name='as_query')
    arrays = models.ManyToManyField(Strain, related_name='as_array')
    correlation_axis = models.ManyToManyField(Strain, related_name='as_correlation')
    is_default = models.BooleanField(default=False)
    is_published = models.BooleanField(default=False)
    description = models.TextField()
    date = models.DateField()
    verbose_name = models.CharField(max_length=64)
    public_description = models.TextField()
    
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
    def pk_or_default(pk=None, user=None):
        if pk:
            try:
                return Dataset.objects.get(pk=pk)
            except Dataset.DoesNotExist:
                raise Http404
        
        return Dataset._get_default(user)
    
    @staticmethod
    def _get_default(user=None):
        datasets = list(Dataset.objects.order_by('-pk'))
        if user.is_authenticated():
            ds = filter(lambda x: x.is_default and not x.is_published, datasets)
            if ds: return ds[0]
        
        ds = filter(lambda x: x.is_default and x.is_published, datasets)
        if ds: return ds[0]
        if datasets: return datasets[0]
        raise Dataset.DoesNotExist()
    
    def get_absolute_url(self):
        return reverse('dataset', kwargs={'dataset_id': self.pk})
    
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
    user = models.ForeignKey(User, null=True, blank=True)
    
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
    
    NET_UNDIRECTED = 'U'
    NET_DIRECTED = 'D'
    NET_CHOICES = (
        (NET_UNDIRECTED, 'Undirected'),
        (NET_DIRECTED, 'Directed'),
    )
    
    user = models.ForeignKey(User, null=True)
    hash = models.CharField(max_length=40, unique=True)
    private = models.BooleanField(default=False)
    name = models.CharField(max_length=40, null=True, blank=True)
    date = models.DateTimeField(auto_now_add=True)
    permanent = models.BooleanField(default=False)
    dataset = models.ForeignKey(Dataset, null=True, related_name='customs')
    type = models.CharField(max_length=1, choices=TYPE_CHOICES, default=TYPE_CORRELATION)
    network_type = models.CharField(max_length=1, choices=NET_CHOICES, default=NET_UNDIRECTED)
    
    def path(self, *args):
        return os.path.join(settings.STATIC_ROOT, 'upload', 'custom', self.hash, *args)
    
    def static_url(self, *args):
        return os.path.join(settings.STATIC_URL, 'upload', 'custom', self.hash, *args)
    
    class Meta:
        unique_together = (('name', 'user'), )

class RegionGroup(models.Model):
    name = models.CharField(max_length=64)
    alias = models.CharField(max_length=64, null=True, blank=True)
    date = models.DateField()
    description = models.TextField(blank=True)
    dataset = models.ForeignKey(Dataset)
    
    def __unicode__(self):
        return self.name

class Region(models.Model):
    name = models.CharField(max_length=64)
    alias = models.CharField(max_length=64, null=True)
    region_group = models.ForeignKey(RegionGroup, related_name='regions')
    color = models.CharField(max_length=6)
    
    vertices = models.ManyToManyField(Strain, through='Vertex')

class Vertex(models.Model):
    region = models.ForeignKey(Region)
    strain = models.ForeignKey(Strain)
    degree = models.SmallIntegerField()
    
    class Meta:
        unique_together = (('region', 'degree'), ('region', 'strain'), )
        ordering = ('region', 'degree', )

class UserProfile(models.Model):
    user = models.OneToOneField(User, related_name='profile')
    force_password_change = models.BooleanField(default=False)

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

