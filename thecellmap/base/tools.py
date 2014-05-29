from datetime import datetime

from django.forms.fields import CharField
from django.forms.forms import Form
from django.forms.models import ModelChoiceField
from django.forms.widgets import Textarea
from django.shortcuts import render

from base.models import Annotation, Term
from base.utils import gene_map, write_excel_file


### FORMS ###
class AnnotationsForm(Form):
    annotation = ModelChoiceField(Annotation.objects)
    genes = CharField(widget=Textarea)

def annotations(request):
    form = AnnotationsForm()
    
    if request.POST:
        form = AnnotationsForm(request.POST)
        
        if form.is_valid():
            genes = form.cleaned_data['genes'].splitlines()
            annotation = form.cleaned_data['annotation']
            response = write_excel_file('annotated_genes_%s.xls' % (datetime.now().strftime('%Y%m%d-%H%M%S'), ))
            response.add_sheet("Annotated", ['Input label', 'Label', 'ORF', 'Name', 'Annotations'])
            
            gmap = gene_map()
            tmap = {}
            for tg in Term.genes.through.objects.filter(term__annotation=annotation).select_related('term'):  # @UndefinedVariable
                tmap.setdefault(tg.gene_id, []).append(tg.term)
            
            for g, gene in [(g, gmap.get(g)) for g in genes]:
                row = [g]
                if gene:
                    row += [gene.name or gene.orf, gene.orf, gene.name, ';'.join([(hasattr(t, 'name') and t.name or t) for t in tmap.get(gene.id, ['NOT ANNOTATED'])])]
                response.write_row(row)
            
            return response.as_response()
    
    return render(request, 'base/annotations.html', {
            'form': form,
      })
