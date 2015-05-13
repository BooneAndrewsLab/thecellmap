'''
Created on Dec 16, 2013

@author: matej
'''
from optparse import make_option

from django.core.management.base import CommandError, BaseCommand
from django.db.transaction import commit_on_success, commit_manually
from pandas.core.frame import DataFrame

from base.models import Strain, Gene, Region, RegionGroup, Vertex, Dataset, Term
from base.utils import CellMapCommand, gene_map, open_excel_file, rollback_on_fail
from django.db import transaction
from datetime import datetime


class Command(CellMapCommand):
    help = 'Imports a region data file'
    args = '<region_csv> <dataset name> <region group name>'
    
    option_list = BaseCommand.option_list + (
        make_option('-a', '--alias',
            dest='r_group_alias',
            help='Region group alias'),
        make_option('-d', '--description',
            dest='desc',
            help='Description of region group'),)
    
    @commit_manually
    @commit_on_success
    @rollback_on_fail
    def handle(self, *args, **options):
        if len(args) != 3:
            raise CommandError('Must provide arguments: ' + self.args)
        
        file = open_excel_file(self.get_path(args[0]))
        
        try:
            dataset = Dataset.objects.get(name=args[1])
        except Dataset.DoesNotExist:
            raise CommandError('Dataset %s not found' % args[1])
        
        smap = {}
        for s in Strain.objects.all().select_related('gene'):
            smap[s.label()] = s
        
        unknown = []
        regions = {}
        for r in file:
            for c in [x for x in r[1:] if x]:
#           for c in filter(lambda x: bool(x), r[1:]):
                s = smap.get(c)
                if not s:
                    unknown.append(c)
                    continue
                regions.setdefault(r[0], []).append(s)
        
        if unknown:
            raise CommandError('Labels not found: ' + ''.join(unknown))
        
        r_group = RegionGroup.objects.create(
                    name=args[2],
                    alias=options.get('r_group_alias'),
                    date=datetime.now(),
                    description=options.get('desc') or '',
                    dataset=dataset,)
        
        for region, strains in regions.iteritems():
            r = Region.objects.create(name=region, alias=region, region_group=r_group)
            i = 0
            
            for strain in strains:
                v = Vertex.objects.create(
                    degree=i,
                    strain = strain,
                    region = r)
                i += 1
        
        for t in Term.objects.filter(annotation__name=args[2]):
            r = Region.objects.get(name=t.name)
            r.color = t.color
            r.save()
