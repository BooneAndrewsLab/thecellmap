from optparse import make_option

from django.core.management.base import BaseCommand, CommandError

from base.models import Annotation
from base.utils import CellMapCommand


FORMAT_CHOICES = (
    'one2one',
    'orf2many',
    'term2many',
)

class Command(CellMapCommand):
    help = 'Exports an annotation standard'
    args = '<annotation>'
    
    option_list = BaseCommand.option_list + (
        make_option('-f', '--format',
            type='choice',
            choices=FORMAT_CHOICES,
            default=FORMAT_CHOICES[0],
            dest='format',
            help='Format of the input data, one of: [%s]' % (','.join(FORMAT_CHOICES))),
        )
    
    def handle(self, *args, **options):
        if len(args) != 1:
            raise CommandError('Must provide arguments: ' + self.args)
        
        annotation, = args
        annotation = Annotation.objects.get(name=annotation)
        
        print('\t'.join(('Complex', 'ORF')))
        for term in annotation.term_set.prefetch_related('genes'):
            for gene in term.genes.all():
                print('\t'.join((term.name, gene.orf)))
