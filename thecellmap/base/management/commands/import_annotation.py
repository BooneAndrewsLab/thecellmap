from optparse import make_option

from django.core.management.base import CommandError, BaseCommand
from django.db.transaction import commit_on_success
from pandas.core.frame import DataFrame

from base.models import Annotation, Term
from base.utils import CellMapCommand, gene_map, open_excel_file
from datetime import datetime


FORMAT_CHOICES = (
    'orf2many',
    'term2many',
    'orf2list',
)

class Command(CellMapCommand):
    help = 'Imports a dataset from a release file'
    args = '<annotation_xls> <name>'
    
    option_list = BaseCommand.option_list + (
        make_option('-d', '--date',
            dest='annot_date',
            help='Date of this annotation creation'),
        make_option('-a', '--alias',
            dest='alias',
            help='Alias for this annotation'),
        make_option('-f', '--format',
            type='choice',
            choices=FORMAT_CHOICES,
            default=FORMAT_CHOICES[0],
            dest='format',
            help='Format of the input data, one of: [%s]' % (','.join(FORMAT_CHOICES))),
        )
    
    @commit_on_success
    def handle(self, *args, **options):
        if len(args) != 2:
            raise CommandError('Must provide arguments: ' + self.args)
        
        xin, name = args
        xin = open_excel_file(self.get_path(xin))
        genemap = gene_map()
        
        getattr(self, options['format'])(xin, genemap, name, options)
    
    def term2many(self, xin, genemap, name, options):
        annotation = Annotation.objects.create(
                name=name,
                alias=options['alias'],
                date=options['annot_date'] or datetime.now(),
            )
        
        for term, orfs in xin:
            geneterm, source = term.strip().split('|', 1)
            
            term = Term.objects.create(
                    annotation=annotation,
                    name=geneterm,
                    alias=geneterm,
                    source=source or None
                )
            
            for gene in [genemap[g] for g in orfs.split(',') if g in genemap]:
                term.genes.add(gene)
    
    def orf2many(self, xin, genemap, name, options):
        data = DataFrame.from_records(xin[:], columns=('orf', 'annotation'))
        
        annotation = Annotation.objects.create(
                name=name,
                alias=options['alias'],
                date=options['annot_date'] or datetime.now(),
            )
        
        terms = {}
        
        for orf, geneterms in data.itertuples(index=False):
            if orf not in genemap:
                print 'SKIPPING', orf
                continue
            
            if '|' in geneterms:
                geneterm, source = geneterms.strip().split('|', 1)
            else:
                geneterm = geneterms.strip()
                source = None
            
            if geneterm not in terms:
                term = Term.objects.create(
                        annotation=annotation,
                        name=geneterm,
                        alias=geneterm,
                        source=source or None
                    )
                terms[geneterm] = term
            
            terms[geneterm].genes.add(genemap[orf])
            
    def orf2list(self, xin, genemap, name, options):
        data = DataFrame.from_records(xin[:], columns=('orf', 'annotations'))
        
        annotation = Annotation.objects.create(
                name=name,
                alias=options['alias'],
                date=options['annot_date'] or datetime.now(),
            )
        
        terms = {}
        
        for orf, geneterms in data.itertuples(index=False):
            if orf not in genemap:
                print 'SKIPPING', orf
                continue
            
            for geneterm in [x.strip() for x in geneterms.split(',')]:
                if geneterm not in terms:
                    term = Term.objects.create(
                            annotation=annotation,
                            name=geneterm,
                            alias=geneterm,
                        )
                    terms[geneterm] = term
                
                terms[geneterm].genes.add(genemap[orf])
            