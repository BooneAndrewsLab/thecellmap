'''
Created on Dec 16, 2013

@author: matej
'''
from optparse import make_option

from django.core.management.base import CommandError, BaseCommand
from django.db.transaction import commit_on_success
from pandas.core.frame import DataFrame

from base.models import Annotation, Term
from base.utils import CellMapCommand, gene_map, open_excel_file


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
        )
    
    @commit_on_success
    def handle(self, *args, **options):
        if len(args) != 2:
            raise CommandError('Must provide arguments: ' + self.args)
        
        xin = open_excel_file(args[0])
        genemap = gene_map()
        
        data = DataFrame.from_records(xin[:], columns=('orf', 'name', 'annotation'))
        
        annotation = Annotation.objects.create(
                name=args[1],
                alias=options['alias'],
                date=options['annot_date'],
            )
        
        terms = {}
        
        for orf, _, geneterms in data.itertuples(index=False):
            if orf not in genemap:
                print 'SKIPPING', orf
                continue
            
            geneterm, source = geneterms.strip().split('|', 1)
            
            if geneterm not in terms:
                term = Term.objects.create(
                        annotation=annotation,
                        name=geneterm,
                        alias=geneterm,
                        source=source or None
                    )
                terms[geneterm] = term
            
            terms[geneterm].genes.add(genemap[orf])
            