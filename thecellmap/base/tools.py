from datetime import datetime
import hashlib
import os
from time import time

from django.core.exceptions import ValidationError
from django.core.urlresolvers import reverse
from django.forms.fields import CharField
from django.forms.forms import Form
from django.forms.models import ModelChoiceField, ModelForm
from django.forms.widgets import Textarea
from django.http.response import HttpResponseBadRequest, HttpResponseRedirect, \
    HttpResponseForbidden
from django.shortcuts import render

from base.filter import CustomFilter
from base.models import Annotation, Term, Custom
from base.utils import gene_map, write_excel_file, JsonResponse
from django.contrib.auth.decorators import login_required


### FORMS ###
class AnnotationsForm(Form):
    annotation = ModelChoiceField(Annotation.objects)
    genes = CharField(widget=Textarea)

class CustomForm(ModelForm):
    def clean(self):
        cleaned_data = self.cleaned_data
        if len(cleaned_data['name']) > 32:
            self._errors.setdefault('name', self.error_class()).append("Name must be under 32 characters.")
        return cleaned_data
    
    class Meta:
        model = Custom
        fields = ['name', 'private', 'permanent']

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
        private = request.POST['private'].lower() == 'true'
        
        hash = hashlib.sha1()
        hash.update(str(time()) + nodes + layout + dataset)
        hash = hash.hexdigest()
        
        name = request.POST.get('name', hash)
        
        custom, _created = Custom.objects.get_or_create(
                user=request.user.is_authenticated() and request.user or None, 
                hash=hash, 
                private=private,
                name=name)
        
        os.makedirs(custom.path())
        
        with open(custom.path('nodes.json'), 'w') as fp:
            fp.write(nodes)
        
        with open(custom.path('layout.json'), 'w') as fp:
            fp.write(layout)
        
        with open(custom.path('correlations.json'), 'w') as fp:
            fp.write(dataset)
        
        return JsonResponse({'url': reverse('custom_dataset', args=(hash,))})
    
    return render(request, 'base/custom.html')

@login_required
def edit(request):
    f = CustomFilter(request.GET, queryset=Custom.objects.filter(user=request.user).exclude(name=""))
    
    if request.POST:
        selection = request.POST.getlist('selection')
        selection = Custom.objects.filter(id__in=selection)
        
        action = request.POST.get('action')
        if action == 'delete':
            selection.delete()
        elif action == 'renew':
            selection.update(date=datetime.now())
            
    return render(request, 'base/edit.html', {'filter': f})

@login_required
def edit_dataset(request, id):
    custom = Custom.objects.get(id=id)
    
    if request.user != custom.user:
        return HttpResponseForbidden("Permission Required")
    
    if request.POST:
        form = CustomForm(request.POST, instance=custom)
        if form.is_valid():
            if "update" in request.POST:
                form.save()
            elif "delete" in request.POST:
                custom.delete()
            return HttpResponseRedirect(reverse("tools_edit"))
    else:
        form = CustomForm(instance=custom)
    
    return render(request, 'base/editdataset.html', {'form': form})
