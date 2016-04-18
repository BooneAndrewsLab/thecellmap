'''
Created on Dec 16, 2013

@author: matej
'''
from optparse import make_option

from django.core.management.base import CommandError, BaseCommand
from pandas.core.frame import DataFrame

from base.models import Annotation, Term
from base.utils import CellMapCommand, gene_map, open_excel_file


class Command(CellMapCommand):
    help = 'Imports a dataset from a release file'
    args = '<annotation_xls>'
    
    option_list = BaseCommand.option_list + (
        make_option('-d', '--date',
            dest='annot_date',
            help='Date of this annotation creation'),
        )
    
    def handle(self, *args, **options):
        if len(args) != 1:
            raise CommandError('Must provide arguments: ' + self.args)
        
        annot_date = options['annot_date']
        xin = open_excel_file(args[0])
        genemap = gene_map()
        
        data = DataFrame.from_records(xin[1:], columns=[x.lower() for x in xin[0]])
        data = data.set_index('orf')
        
        groups = {}
        
        for annotation_group in xin.sheets()[1:]:
            xin.open_sheet(annotation_group)
            groups[annotation_group.lower()] = {}
            annotation = Annotation.objects.create(
                    name=annotation_group,
                    alias=annotation_group,
                    date=annot_date,
                )
             
            for line in xin:
                enu, name = line[:2]
                alias = len(line) > 2 and line[2] or line[1]
                term = Term.objects.create(
                        annotation=annotation,
                        name=name,
                        alias=alias
                    )
                 
                groups[annotation_group.lower()][int(enu)] = term
        
        for group, terms in groups.iteritems():
            groupdata = data[group]
            for orf, geneterms in groupdata.iteritems():
                geneterms = str(geneterms).strip(', ')
                if not geneterms: continue
                
                geneterms = map(lambda x: int(float(x)), geneterms.split(','))
                
                if orf not in genemap:
                    print 'SKIPPING', orf
                    continue
                
                for geneterm in geneterms:
                    terms[geneterm].genes.add(genemap[orf])
                