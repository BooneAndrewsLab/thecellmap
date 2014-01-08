'''
Created on Dec 17, 2013

@author: matej
'''

from crispy_forms.bootstrap import FormActions, Accordion, AccordionGroup
from crispy_forms.helper import FormHelper
from crispy_forms.layout import Layout, Submit, Field, Div
from django import forms

class TabularForm(forms.Form):
    genes = forms.CharField(
        widget = forms.Textarea(),
    )
    
    genes_as = forms.MultipleChoiceField(
        choices = (
            ('queries', "Queries"), 
            ('arrays', 'Arrays'),
            ('pairs', 'Pairs')
        ),
        initial = ('queries', 'arrays'),
        widget = forms.CheckboxSelectMultiple,
        help_text = "<strong>Note:</strong> Searched genes should appear as",
    )
    
    cutoff = forms.ChoiceField(
        choices = (
            ('no', "No cutoff"), 
            ('intermed', "Itermediate (p<0.05 and |score|>0.08 and |correlation|>0.1)"),
            ('string', "Stringent (p<0.05 and |score|>0.12 and |correlation|>0.1)"),
        ),
        widget = forms.RadioSelect,
        initial = 'intermed',
    )
    
    helper = FormHelper()
    helper.form_class = 'form-horizontal'
    helper.label_class = 'col-lg-2'
    helper.field_class = 'col-lg-10'
    helper.layout = Layout(
        Div(
            Div(
                Field('genes', rows="3", css_class='input-xlarge'),
                css_class="panel-body"
            ), 
            css_class="panel panel-default"),
        Div(
            Accordion(
                AccordionGroup('Advanced options ', 
                    Field('genes_as', style="background: #FAFAFA; padding: 10px;", css_class="extra"),
                    'cutoff',
                    active=False,
                ),
                active=False,
            ),
            style="margin-bottom: 20px;"
        ),
        Div(
            Div(
                FormActions(
                    Submit('search', 'Search', css_class="btn-primary"),
                ),
                css_class="panel-body"
            ), 
            css_class="panel panel-default"),
    )