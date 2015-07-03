'''
Created on Dec 16, 2013

@author: matej
'''

from django.contrib import admin
from django.utils.safestring import mark_safe

from base.models import Gene, Strain, StrainData, Dataset, Annotation, Term, Custom, RegionGroup, Region
from _csv import list_dialects


class GeneAdmin(admin.ModelAdmin):
    list_display = ('primary_sgdid', 'feature_qualifier', 'orf', 'name', 'chromosome', 'start', 'stop', 'description')
    search_fields = ('orf', 'name')

class StrainAdmin(admin.ModelAdmin):
    list_display = ('gene', 'allele', 'boonelab_id', 'genotype', 'mating_type', 'description')
    search_fields = ('gene__orf', 'gene__name', 'boonelab_id', 'allele')
    
    raw_id_fields = ('gene', )

class StrainDataAdmin(admin.ModelAdmin):
    list_display = ('dataset', 'strain')
    search_fields = ('strain__gene__orf', 'strain__gene__name')
    
    raw_id_fields = ('strain', )

class DatasetAdmin(admin.ModelAdmin):
    list_display = ('name', 'verbose_name', 'is_default', 'is_published', 'number_of_queries', 'number_of_arrays', 'number_of_correlations', 'description')
    exclude = ('queries', 'arrays', 'correlation_axis')
    
    def number_of_queries(self, ds):
        return ds.queries.count()

    def number_of_arrays(self, ds):
        return ds.arrays.count()
    
    def number_of_correlations(self, ds):
        return ds.correlation_axis.count()

class AnnotationAdmin(admin.ModelAdmin):
    list_display = ('name', 'alias', 'date', 'description', 'number_of_terms')
    
    def number_of_terms(self, ds):
        return ds.term_set.count()

class TermAdmin(admin.ModelAdmin):
    list_display = ('annotation', 'name', 'alias', 'term_color', 'number_of_genes')
    exclude = ('genes', )
    list_filter = ('annotation', )
    search_fields = ('name', )
    
    def number_of_genes(self, ds):
        return ds.genes.count()
    
    def term_color(self, term):
        return mark_safe('<span style="color: #%s; font-weight: bold;">%s</span>' % (term.color, term.color))

class QueriesAdmin(admin.ModelAdmin):
    list_display = ('dataset', 'strain')
    search_fields = ('strain__gene__orf', 'strain__gene__name')
    list_filter = ('dataset', )
    raw_id_fields = ('strain', )
    
    verbose_name = 'vooo'
    verbose_name_plural = 'boooo'

class ArraysAdmin(admin.ModelAdmin):
    list_display = ('dataset', 'strain')
    search_fields = ('strain__gene__orf', 'strain__gene__name')
    list_filter = ('dataset', )
    raw_id_fields = ('strain', )

class CorrelationsAdmin(admin.ModelAdmin):
    list_display = ('dataset', 'strain')
    search_fields = ('strain__gene__orf', 'strain__gene__name')
    list_filter = ('dataset', )
    raw_id_fields = ('strain', )

class CustomAdmin(admin.ModelAdmin):
    list_display = ('user', 'hash', 'private', 'name', 'date', 'permanent')

class RegionGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'alias', 'description', 'date')

class RegionAdmin(admin.ModelAdmin):
    list_display = ('name', 'alias', 'region_group', 'region_color')
    
    def region_color(self, region):
        return mark_safe('<span style="color: #%s; font-weight: bold;">%s</span>' % (region.color, region.color))

admin.site.register(Gene, GeneAdmin)
admin.site.register(Strain, StrainAdmin)
admin.site.register(StrainData, StrainDataAdmin)
admin.site.register(Dataset, DatasetAdmin)
admin.site.register(Annotation, AnnotationAdmin)
admin.site.register(Term, TermAdmin)
admin.site.register(Custom, CustomAdmin)
admin.site.register(RegionGroup, RegionGroupAdmin)
admin.site.register(Region, RegionAdmin)

admin.site.register(Dataset.queries.through, QueriesAdmin)  # @UndefinedVariable
admin.site.register(Dataset.arrays.through, ArraysAdmin)  # @UndefinedVariable
admin.site.register(Dataset.correlation_axis.through, CorrelationsAdmin)  # @UndefinedVariable
