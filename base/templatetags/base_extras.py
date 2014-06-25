'''
Created on Dec 17, 2013

@author: matej
'''

from datetime import datetime, timedelta

from django import template
from numpy import floor


register = template.Library()

@register.filter
def col_md_part(value):
    value = int(value)
    if value > 12:
        raise template.TemplateSyntaxError("Maximum 12 columns allowed, you have %d" % value)
    
    return int(floor(12. / value))

@register.filter
def expire_date(value):
    now = datetime.utcnow().replace()
    value = (value + timedelta(days=7)).replace(tzinfo=None)
    
    delta = (value - now)
    
    return delta - timedelta(microseconds=delta.microseconds)