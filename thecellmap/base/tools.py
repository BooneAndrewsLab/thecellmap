from datetime import datetime
import hashlib
import os
from time import time

from django.core.urlresolvers import reverse
from django.forms.fields import CharField
from django.forms.forms import Form
from django.forms.models import ModelChoiceField
from django.forms.widgets import Textarea
from django.http.response import HttpResponseBadRequest
from django.shortcuts import render

from base.models import Annotation, Term, Custom
from base.utils import gene_map, write_excel_file, JsonResponse


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

def custom(request):
    if request.POST:
        if 'nodes' not in request.POST or 'layout' not in request.POST or 'dataset' not in request.POST:
            return HttpResponseBadRequest('missing values')
        
        nodes = request.POST['nodes']
        layout = request.POST['layout']
        dataset = request.POST['dataset']
        
        hash = hashlib.sha1()
        hash.update(str(time()) + nodes + layout + dataset)
        hash = hash.hexdigest()
        
        custom, _created = Custom.objects.get_or_create(user=request.user.is_authenticated() and request.user or None, hash=hash)
        
        os.makedirs(custom.path())
        
        with open(custom.path('nodes.json'), 'w') as fp:
            fp.write(nodes)
        
        with open(custom.path('layout.json'), 'w') as fp:
            fp.write(layout)
        
        with open(custom.path('correlations.json'), 'w') as fp:
            fp.write(dataset)
        
        return JsonResponse({'url': reverse('custom_dataset', args=(hash,))})
    
    return render(request, 'base/custom.html')
