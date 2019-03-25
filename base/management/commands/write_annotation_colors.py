"""
Created on May 07, 2014

@author: matej
"""
import re

from django.core.management.base import CommandError
from django.db.transaction import atomic

from base.models import Annotation
from base.utils import CellMapCommand

COLOUR_RE = re.compile('^[#]?[0-9A-Fa-f]{6}$')


class Command(CellMapCommand):
    help = '''Write predefined colors for an annotation'''
    args = '<annotation_alias> <list_of_colors in hex format no hashes comma separated>'

    @atomic
    def handle(self, *args, **options):
        if len(args) != 2:
            raise CommandError('Wrong number of arguments')

        annotation, colours = args

        try:
            annotation = Annotation.objects.get(alias__iexact=annotation)
        except Annotation.DoesNotExist:
            raise CommandError('Annotation %s does not exist' % (annotation,))

        colours = colours.split(',')
        for c in colours:
            if not COLOUR_RE.match(c):
                raise CommandError('%s is not a valid color' % (c,))

        colours = [c.replace('#', '').upper() for c in colours]

        if len(colours) != annotation.term_set.count():
            raise CommandError('Number of colours (%s) must match the number of terms (%s)' % (
                len(colours), annotation.term_set.count()))

        for term, colour in zip(annotation.term_set.all(), colours):
            term.color = colour
            term.save()
