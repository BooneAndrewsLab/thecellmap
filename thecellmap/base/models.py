""" Basic models, such as user profile """

from django.db import models
import dbarray
from thecellmap import settings
import os

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
    description = models.TextField()
    
    def __unicode__(self):
        return '%s%s - %s' % (self.gene, self.allele and ' - %s' % self.allele or '', self.boonelab_id)

class Dataset(models.Model):
    name = models.CharField(max_length=64, unique=True)
    queries = models.ManyToManyField(Strain, related_name='as_query')
    arrays = models.ManyToManyField(Strain, related_name='as_array')
    correlation_axis = models.ManyToManyField(Strain, related_name='as_correlation')
    is_default = models.BooleanField(default=False)
    description = models.TextField()
    
    def __unicode__(self):
        return self.name
    
    def static_path(self):
        return os.path.join(settings.STATIC_ROOT, 'visualization', self.name)
    
    def static_url(self):
        return os.path.join(settings.STATIC_URL, 'visualization', self.name)

class StrainData(models.Model):
    dataset = models.ForeignKey(Dataset, related_name='data')
    strain = models.ForeignKey(Strain)
    scores = dbarray.FloatArrayField()
    pvalues = dbarray.FloatArrayField()
    correlations = dbarray.FloatArrayField()
    
    def __unicode__(self):
        return '%s @ %s' % (self.strain, self.dataset)
    