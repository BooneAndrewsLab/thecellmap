from django.contrib import admin

from trigenic.models import TriStrainSet


class TriStrainSetAdmin(admin.ModelAdmin):
    list_display = ('double_mutant', 'single_mutant1', 'single_mutant2')

admin.site.register(TriStrainSet, TriStrainSetAdmin)