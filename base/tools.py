from datetime import datetime

from django.forms.fields import CharField, BooleanField
from django.forms.forms import Form
from django.forms.models import ModelChoiceField
from django.forms.widgets import Textarea, HiddenInput
from django.shortcuts import render

from base.models import Annotation, Term, Strain, Gene
from base.utils import gene_map, write_excel_file


class AnnotationsForm(Form):
    annotation = ModelChoiceField(Annotation.objects)
    genes = CharField(widget=Textarea)
    downloadType = CharField(widget=HiddenInput, initial="xls")
    autoRemove = BooleanField(widget=HiddenInput, initial=False, required=False)


def annotations(request):
    form = AnnotationsForm()

    if request.POST:
        form = AnnotationsForm(request.POST)

        if form.is_valid():
            print(form.cleaned_data['autoRemove'])
            genes = form.cleaned_data['genes'].splitlines()
            annotation = form.cleaned_data['annotation']
            response = write_excel_file('annotated_genes_%s.%s' % (
            (datetime.now().strftime('%Y%m%d-%H%M%S')), form.cleaned_data['downloadType']), override_ext=True)
            response.add_sheet("Annotated", ['Input label', 'Label', 'ORF', 'Name', 'Annotations'])

            gmap = gene_map(keyfun=lambda x: x.upper())

            """ Add alleles to the map """
            for strain in Strain.objects.filter(allele__isnull=False).exclude(allele='').select_related('gene'):
                gmap[strain.allele.upper()] = strain

            tmap = {}
            for tg in Term.genes.through.objects.filter(term__annotation=annotation).select_related(
                    'term'):  # @UndefinedVariable
                tmap.setdefault(tg.gene_id, []).append(tg.term)

            for g, gene in [(g, gmap.get(g.upper())) for g in genes]:
                row = [g]

                if isinstance(gene, Gene):
                    row += [gene.name or gene.orf, gene.orf, gene.name, ';'.join(
                        [(hasattr(t, 'name') and t.name or t) for t in tmap.get(gene.id, ['NOT ANNOTATED'])])]
                elif isinstance(gene, Strain):
                    strain = gene
                    gene = gene.gene
                    row += [strain.allele, gene.orf, gene.name, ';'.join(
                        [(hasattr(t, 'name') and t.name or t) for t in tmap.get(gene.id, ['NOT ANNOTATED'])])]

                if gene is not None or not form.cleaned_data['autoRemove']:
                    response.write_row(row)

            return response.as_response()
    print(form)

    return render(request, 'base/annotations.html', {
        'form': form,
        'page_name': 'annotation',
    })
