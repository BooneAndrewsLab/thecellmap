'''
Created on Jan 06, 2014

@author: matej
'''
import shutil

from django.core.management.base import CommandError
from django.db import connection
from django.db.transaction import commit_on_success

from base.models import Dataset, StrainData
from base.utils import CellMapCommand, print_queries


class Command(CellMapCommand):
    help = 'Delete a dataset'
    args = '<dataset name>'
    
    @print_queries
    @commit_on_success
    def handle(self, *args, **options):
        if len(args) != 1:
            raise CommandError('Must provide arguments: ' + self.args)
        
        dataset = Dataset.objects.get(name__iexact=args[0])
        outpath = dataset.static_path()
        
        if dataset.customs.count() > 0:
            raise CommandError('Delete custom datasets first')
        
        cur = connection.cursor()
        delete_stmt = "DELETE FROM %s WHERE dataset_id=%%s;"
        
        cur.execute(delete_stmt % StrainData._meta.db_table, [dataset.pk])
        cur.execute(delete_stmt % Dataset.queries.through._meta.db_table, [dataset.pk])
        cur.execute(delete_stmt % Dataset.arrays.through._meta.db_table, [dataset.pk])
        cur.execute(delete_stmt % Dataset.correlation_axis.through._meta.db_table, [dataset.pk])
        
        cur.execute("DELETE FROM %s WHERE id=%%s;" % Dataset._meta.db_table, [dataset.pk])
        
        shutil.rmtree(outpath)