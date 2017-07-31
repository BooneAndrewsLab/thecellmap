from django import forms
from django.core import validators
from django.core.exceptions import ValidationError
from django.utils.translation import ugettext_lazy as _
from rest_framework.fields import WritableField


class CharArrayField(WritableField):
    type_name = 'CharArrayField'
    type_label = 'string array'
    form_field_class = forms.CharField
    empty = []

    default_error_messages = {
        'invalid': _("'%s' value must be a string array."),
    }

    def from_native(self, value):
        if value in validators.EMPTY_VALUES:
            return None
        
        print(value)
        
        try:
            return str(value)
        except (TypeError, ValueError):
            msg = self.error_messages['invalid'] % value
            raise ValidationError(msg)


class FloatArrayField(WritableField):
    type_name = 'FloatArrayField'
    type_label = 'float array'
    form_field_class = forms.CharField
    empty = []

    default_error_messages = {
        'invalid': _("'%s' value must be a float array."),
    }

    def from_native(self, value):
        if value in validators.EMPTY_VALUES:
            return None
        
        print(value)
        
        try:
            return float(value)
        except (TypeError, ValueError):
            msg = self.error_messages['invalid'] % value
            raise ValidationError(msg)
