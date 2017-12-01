from __future__ import unicode_literals

from django.db import models
from django.db.models import F
from base.models import Gene
import pandas as p
from django.db.models.expressions import Case, When
from django.db.models import Q


class TriStrain(models.Model):
    gene1 = models.ForeignKey(Gene, related_name='strains1')
    gene2 = models.ForeignKey(Gene, null=True, blank=True, related_name='strains2')
    
    boonelab_id = models.TextField()
    allele = models.TextField()
    genotype = models.TextField()
    
    is_double_mutant = models.BooleanField()
    is_query = models.BooleanField()
    
    def verbose_name_short(self):
        name = ''
        
        if self.gene1.name:
            name += self.gene1.name
        else:
            name += self.gene1.orf
        
        if self.is_double_mutant:
            name += '-'
            
            if self.gene2.name:
                name += self.gene2.name
            else:
                name += self.gene2.orf
        
        return name
    
    def verbose_name(self):
        name = '%s - ' % (self.boonelab_id, )
        
        if self.gene1.name:
            name += self.gene1.name
        else:
            name += self.gene1.orf
        
        if self.is_double_mutant:
            name += ' x '
            
            if self.gene2.name:
                name += self.gene2.name
            else:
                name += self.gene2.orf
        
        return name
    
    def to_dict(self):
        return {
            'g1': self.gene1_id,
            'g2': self.gene2_id,
            'a': self.allele,
            'g': self.genotype,
            'sid': self.boonelab_id,
            'dm': self.is_double_mutant,
            'q': self.is_query
        }
    
    def get_single_mutant_gene(self):
        if self.gene1.orf == 'YDL227C':
            return self.gene2
        return self.gene1
    
    def _get_scores(self, field, strain_field, *args, **kwargs):
#         data = field.filter(*args, **kwargs).select_related().order_by('score')
        if strain_field=='array': # Query scores
            is_dm = kwargs['dm']
            if is_dm==False:
                data = field.annotate(abs=Case(
                                      When(score__gte=0, then=F('score')),
                                      When(score__lt=0, then=0-F('score')),
                                      )).filter(pvalue__lt=0.05,abs__gt=0.08).select_related().order_by('score')
            else:
                data = field.filter(pvalue__lt=0.05,score__lt=-0.08).select_related().order_by('score')
        else: # Array scores
            data = field.annotate(abs=Case(
                    When( Q(query__is_double_mutant=False) & Q(score__gte=0), then=F('score')),
                    When( Q(query__is_double_mutant=False) & Q(score__lt=0), then=0-F('score')),
                    )).filter(Q(query__is_double_mutant=True,score__lt=-0.08) | Q(query__is_double_mutant=False,abs__gt=0.08), pvalue__lt=0.05).select_related().order_by('score')
        return p.DataFrame(
                list(data.values_list(
                    strain_field, 
                    'score', 
                    'pvalue')),
                columns=['strain', 'score', 'pvalue']
            )
    
    def get_query_scores(self, *args, **kwargs):
        return self._get_scores(self.query_scores, 'array', *args, **kwargs)
    
    def get_array_scores(self, *args, **kwargs):
        return self._get_scores(self.array_scores, 'query', *args, **kwargs)
    
    def __str__(self):
        return self.boonelab_id

class TriStrainSet(models.Model):
    double_mutant = models.ForeignKey(TriStrain, related_name='double_in_set')
    single_mutant1 = models.ForeignKey(TriStrain, related_name='single1_in_set')
    single_mutant2 = models.ForeignKey(TriStrain, related_name='single2_in_set')

class TriScores(models.Model):
    query = models.ForeignKey(TriStrain, related_name='query_scores')
    array = models.ForeignKey(TriStrain, related_name='array_scores')
    score = models.FloatField()
    pvalue = models.FloatField()
