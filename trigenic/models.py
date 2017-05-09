from __future__ import unicode_literals

from django.db import models

from base.models import Gene


class TriStrain(models.Model):
    gene1 = models.ForeignKey(Gene, related_name='strains1')
    gene2 = models.ForeignKey(Gene, null=True, blank=True, related_name='strains2')
    
    boonelab_id = models.TextField()
    allele = models.TextField()
    genotype = models.TextField()

class TriScores(models.Model):
    query = models.ForeignKey(TriStrain, related_name='query_scores')
    array = models.ForeignKey(TriStrain, related_name='array_scores')
    score = models.FloatField()
    pvalue = models.FloatField()
