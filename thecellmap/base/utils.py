'''
Created on Dec 13, 2013

@author: matej
'''
from django.core.management.base import BaseCommand, CommandError
import fileinput
import os
from base.models import Gene
import time

class CellMapCommand(BaseCommand):
    def get_path(self, filepath, required=True):
        if not required and filepath is None:
            return None
        if filepath is None:
            raise CommandError('File argument is required')
        
        if '~' in filepath:
            filepath = os.path.expanduser(filepath)
        
        return os.path.abspath(filepath)
        
    def get_fd(self, filepath, mode='r', required=True):
        filepath = self.get_path(filepath, required)
        if not filepath: return None
        
        if mode == 'r' and not os.path.isfile(filepath):
            raise CommandError('%s is not a file' % filepath)
        
        if filepath.endswith('.gz'):
            return fileinput.hook_compressed(filepath, mode)
        return open(filepath, mode)

def orf_comparator(x,y):
    if not cmp(x[:2],y[:2]) and x[2] == 'L' and y[2] == 'L':
        return -cmp(x, y)
    return cmp(x, y)

def orf_sorting_value(orf):
    orf = orf.split('_', 1)[0]
    return ord(orf[1])*10000 + (1000 + (orf[2] == 'L' and -int(orf[3:6]) or int(orf[3:6])+1))

def ordered_orfs(orfs):
    return sorted(orfs, cmp=orf_comparator)

def gene_map():
    genemap = {}
    for g in Gene.objects.all():
        genemap[g.orf] = g
        genemap[g.name] = g
        for a in g.aliases:
            if a not in genemap:
                genemap[a] = g
    return genemap

COLORS = {'blue':34, 'cyan':36, 'green':32, 'grey':30, 'magenta':35, 'red':31, 'white':37, 'yellow':33}
RESET = '\033[0m'

def print_queries(func, filter=None):
    """ Print all queries executed in this funnction. """
    def wrapper1(init_self, *args, **kwargs):
        from django.db import connection
        sqltime, longest, numshown = 0.0, 0.0, 0
        initqueries = len(connection.queries)
        starttime = time.time()
        result = func(init_self, *args, **kwargs)
        for query in connection.queries[initqueries:]:
            sqltime += float(query['time'].strip('[]s'))
            longest = max(longest, float(query['time'].strip('[]s')))
            if not filter or filter in query['sql']:
                numshown += 1
                querystr = colored('\n[%ss] ' % query['time'], 'yellow')
                querystr += colored(query['sql'], 'blue')
                print querystr
        numqueries = len(connection.queries) - initqueries
        numhidden = numqueries - numshown
        runtime = round(time.time() - starttime, 3)
        proctime = round(runtime - sqltime, 3)
        print colored("------", 'blue')
        print colored('Total Time:  %ss' % runtime, 'yellow')
        print colored('Proc Time:   %ss' % proctime, 'yellow')
        print colored('Query Time:  %ss (longest: %ss)' % (sqltime, longest), 'yellow')
        print colored('Num Queries: %s (%s hidden)\n' % (numqueries, numhidden), 'yellow')
        return result
    return wrapper1

def colored(text, color=None):
    """ Colorize text {red, green, yellow, blue, magenta, cyan, white}. """
    if os.getenv('ANSI_COLORS_DISABLED') is None:
        fmt_str = '\033[%dm%s'
        if color is not None:
            text = fmt_str % (COLORS[color], text)
        text += RESET
    return text