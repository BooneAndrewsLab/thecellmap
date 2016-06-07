from datetime import datetime
import hashlib
import json
import os
from time import time

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.core.urlresolvers import reverse
from django.forms.fields import CharField, BooleanField
from django.forms.forms import Form
from django.forms.models import ModelChoiceField, ModelForm
from django.forms.widgets import Textarea, HiddenInput
from django.http.response import HttpResponseBadRequest, HttpResponseRedirect, \
    HttpResponseForbidden
from django.shortcuts import render

from base.download import collect_score_matrix
from base.filter import CustomFilter
from base.models import Annotation, Term, Custom, Strain, Gene, Dataset
from base.utils import gene_map, write_excel_file, JsonResponse


### FORMS ###
class AnnotationsForm(Form):
    annotation = ModelChoiceField(Annotation.objects)
    genes = CharField(widget=Textarea)
    downloadType = CharField(widget=HiddenInput, initial="xls")
    autoRemove = BooleanField(widget=HiddenInput, initial=False, required=False)

class CustomForm(ModelForm):
    def clean(self):
        cleaned_data = super(CustomForm, self).clean()
        
        if len(cleaned_data['name']) > 32:
            self._errors.setdefault('name', self.error_class()).append("Name must be under 32 characters.")
        
        if not self.instance.permanent and cleaned_data['permanent']:
            custom = Custom.objects.filter(user=self.instance.user, permanent=True)
            if custom.count() >= 10:
                self._errors.setdefault('permanent', self.error_class()).append("Only 10 permanent datasets allowed per user.")
        
        return cleaned_data
    
    def validate_unique(self):
        exclude = self._get_validation_exclusions()
        exclude.remove('user')
        try:
            self.instance.validate_unique(exclude=exclude)
        except ValidationError:
            self._errors.setdefault('name', self.error_class()).append("Custom dataset with this name already exists.")
    
    class Meta:
        model = Custom
        fields = ['name', 'private', 'permanent']

def annotations(request):
    form = AnnotationsForm()
    
    if request.POST:
        form = AnnotationsForm(request.POST)
        
        if form.is_valid():
            print form.cleaned_data['autoRemove']
            genes = form.cleaned_data['genes'].splitlines()
            annotation = form.cleaned_data['annotation']
            response = write_excel_file('annotated_genes_%s.%s' % ((datetime.now().strftime('%Y%m%d-%H%M%S')), form.cleaned_data['downloadType']), override_ext=True)
            response.add_sheet("Annotated", ['Input label', 'Label', 'ORF', 'Name', 'Annotations'])
            
            gmap = gene_map(keyfun=lambda x: x.upper())
            
            """ Add alleles to the map """
            for strain in Strain.objects.filter(allele__isnull=False).exclude(allele='').select_related('gene'):
                gmap[strain.allele.upper()] = strain
            
            tmap = {}
            for tg in Term.genes.through.objects.filter(term__annotation=annotation).select_related('term'):  # @UndefinedVariable
                tmap.setdefault(tg.gene_id, []).append(tg.term)
            
            for g, gene in [(g, gmap.get(g.upper())) for g in genes]:
                row = [g]
                
                if isinstance(gene, Gene):
                    row += [gene.name or gene.orf, gene.orf, gene.name, ';'.join([(hasattr(t, 'name') and t.name or t) for t in tmap.get(gene.id, ['NOT ANNOTATED'])])]
                elif isinstance(gene, Strain):
                    strain = gene
                    gene = gene.gene
                    row += [strain.allele, gene.orf, gene.name, ';'.join([(hasattr(t, 'name') and t.name or t) for t in tmap.get(gene.id, ['NOT ANNOTATED'])])]
                
                if gene is not None or not form.cleaned_data['autoRemove']:
                    response.write_row(row)
            
            return response.as_response()
    print form
    
    return render(request, 'base/annotations.html', {
            'form': form,
            'page_name': 'annotation',
      })

def custom(request):
    if request.POST:
        if 'selection' in request.POST and 'action' in request.POST:
            selection = request.POST.getlist('selection')
            selection = Custom.objects.filter(id__in=selection)
             
            action = request.POST.get('action')
            if action == 'delete':
                selection.delete()
            elif action == 'renew':
                selection.update(date=datetime.now())
        elif 'nodes' in request.POST and 'layout' in request.POST and 'dataset' in request.POST:
            nodes = request.POST['nodes']
            dataset = request.POST['dataset']
            layout = request.POST['layout']
            private = request.POST['private'].lower() == 'true'
            type = request.POST['type']
            network_type = request.POST['network-type']
            scores = []
            
            if request.POST['overlay']:
                try:
                    overlay = Dataset.objects.get(pk=request.POST['overlay'])
                except:
                    return HttpResponseBadRequest("dataset does not exist")
                
                if not request.user.is_authenticated() or overlay.is_published:
                    return HttpResponseForbidden('Permission Required')
                
                scores = collect_score_matrix(overlay, nodes, dataset)
            else:
                overlay = None
            
            hash = hashlib.sha1()
            hash.update(str(time()) + nodes + layout + dataset)
            hash = hash.hexdigest()
            
            if 'name' in request.POST and request.POST['name']:
                name = request.POST['name']
            else:
                name = hash
            
            custom, _created = Custom.objects.get_or_create(
                    user=request.user.is_authenticated() and request.user or None, 
                    hash=hash, 
                    private=private,
                    name=name,
                    dataset=overlay,
                    type=type,
                    network_type=network_type)
            
            os.makedirs(custom.path())
            
            with open(custom.path('nodes.json'), 'w') as fp:
                fp.write(nodes)
            
            with open(custom.path('layout.json'), 'w') as fp:
                fp.write(layout)
            
            dfilename = 'correlations.json' if type == 'C' else 'interactions.json'
            with open(custom.path(dfilename), 'w') as fp:
                fp.write(dataset)
            
            if scores:
                with open(custom.path('scores.json'), 'w') as fp:
                    fp.write(json.dumps(scores).replace(' ', ''))
            
            return JsonResponse({'url': reverse('custom_dataset', args=(hash,))})
        else:
            return HttpResponseBadRequest('missing values')
    
    datasets = []
    
    for data in Dataset.objects.all():
        if request.user.is_authenticated() or data.is_published:
            datasets.append(data)
    
    f = '';
    if request.user.is_authenticated():
        f = CustomFilter(request.GET, queryset=Custom.objects.filter(user=request.user).extra(where=["CHAR_LENGTH(name) <= 32"]).order_by("name"))
    
    return render(request, 'base/custom.html', {
            'page_name': 'custom_upload',
            'datasets': datasets,
            'filter': f, 
        })

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
            return HttpResponseRedirect(reverse("tools_custom"))
    else:
        form = CustomForm(instance=custom)
    
    return render(request, 'base/editdataset.html', {'form': form})
