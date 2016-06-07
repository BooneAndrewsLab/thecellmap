'''
Created on Jan 06, 2014

@author: matej
'''
from django.db.transaction import atomic
import psycopg2

from base.utils import CellMapCommand, print_queries, orf_sorting_value, RE_ORF
from thecellmap.settings.local import BOONELAB_MANAGEMENT_DB
from base.models import Gene


class Command(CellMapCommand):
    help = 'Import gene table from boonelab management'
    
    @print_queries
    @atomic
    def handle(self, *args, **options):
        db = BOONELAB_MANAGEMENT_DB
        
        with psycopg2.connect(database=db['database'], user=db['username'], password=db['password'], host=db['host']) as conn:
            with conn.cursor() as cur:
                cur.execute("""SELECT cgenencbi, cqualifier, cgeneorf, cgenename, caliases, nchromosome, nstartcoord, nstopcoord, vmemo
                FROM core_gene WHERE noriginidf=2;""")
                
                for sgdid, qual, orf, name, alias, chrom, start, stop, desc in cur.fetchall():
                    if RE_ORF.match(orf):
                        val = orf_sorting_value(orf)
                    else:
                        val = 0
                    
                    if alias:
                        alias = alias.split('|')
                    else:
                        alias = []
                    
                    print orf, start, stop
                    
                    Gene.objects.create(
                        primary_sgdid=sgdid,
                        feature_qualifier=qual or '',
                        orf=orf,
                        name=name or None,
                        aliases=alias,
                        chromosome=chrom,
                        start=start or -1,
                        stop=stop or -1,
                        sorting_value=val,
                        description=desc)
                    