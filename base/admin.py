'''
Created on Dec 16, 2013

@author: matej
'''

from django.contrib import admin

from base.models import Gene, Strain, StrainData, Dataset, Annotation, Term


class GeneAdmin(admin.ModelAdmin):
    list_display = ('primary_sgdid', 'feature_qualifier', 'orf', 'name', 'chromosome', 'start', 'stop', 'description')
    search_fields = ('orf', 'name')

class StrainAdmin(admin.ModelAdmin):
    list_display = ('gene', 'allele', 'boonelab_id', 'genotype', 'mating_type', 'description')
    raw_id_fields = ('gene', )

class StrainDataAdmin(admin.ModelAdmin):
    list_display = ('dataset', 'strain')

class DatasetAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_default', 'number_of_queries', 'number_of_arrays', 'number_of_correlations', 'description')
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
    list_display = ('annotation', 'name', 'alias', 'number_of_genes')
    exclude = ('genes', )
    list_filter = ('annotation', )
    
    def number_of_genes(self, ds):
        return ds.genes.count()

admin.site.register(Gene, GeneAdmin)
admin.site.register(Strain, StrainAdmin)
admin.site.register(StrainData, StrainDataAdmin)
admin.site.register(Dataset, DatasetAdmin)
admin.site.register(Annotation, AnnotationAdmin)
admin.site.register(Term, TermAdmin)
