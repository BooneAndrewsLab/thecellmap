'''
Created on Dec 13, 2013

@author: matej
'''
from StringIO import StringIO
import fileinput
import os
import re
import time
from types import NoneType

from django.core.management.base import BaseCommand, CommandError
from django.http.response import HttpResponse
from django.utils.datastructures import SortedDict
import openpyxl
from openpyxl.styles.fills import Fill
import xlwt

from base.models import Gene


STYLE_NEG_STRINGENT = '-str'
STYLE_NEG_SIGNIFICANT = '-sig'
STYLE_POS_STRINGENT = '+str'
STYLE_POS_SIGNIFICANT = '+sig'
STYLE_BOLD = 'bold'

STYLES = {
    STYLE_NEG_STRINGENT: ('dark_red', 'FFBF0000'),
    STYLE_NEG_SIGNIFICANT: ('red', 'FFFF0000'),
    STYLE_POS_STRINGENT: ('dark_green', 'FF00BF00'),
    STYLE_POS_SIGNIFICANT: ('green', 'FF00FF00'),
}

def get_xlwt_style(color):
    style = xlwt.XFStyle()
    pattern = xlwt.Pattern()
    pattern.pattern = xlwt.Pattern.SOLID_PATTERN
    pattern.pattern_fore_colour = xlwt.Style.colour_map[color]
    style.pattern = pattern
    return style

for typ in STYLES.keys():
    xc, xxc = STYLES[typ]
    STYLES[typ] = (get_xlwt_style(xc), xxc)

STYLES[STYLE_BOLD] = (xlwt.easyxf("font: bold on;"), STYLE_BOLD)

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

class GenericXlsWriter():
    def __init__(self, fd):
        self.workbook = self._create_wb()
        self.sheets = SortedDict()
        self.active_sheet = None
        self.fd = fd
    
    def _format_sheet_name(self, name):
        return name and name.replace(':', '-')[:31] or None
    
    def set_cur_sheet(self, sheet):
        self.active_sheet = sheet
    def get_cur_sheet(self):
        return self.active_sheet
    cur_sheet = property(get_cur_sheet, set_cur_sheet)
    
    def add_sheet(self, name, headers=None):
        name = self._format_sheet_name(name)
        
        if name in self.sheets:
            raise Exception('Sheet %s exists' % name)
        
        # TODO: name length fix and give warning as return value
        self.sheets[name] = {'sheet': self._add_sheet(name), 'row': 0}
        self.active_sheet = name
        
        if headers:
            self.write_row(headers, sheet=name, style=STYLE_BOLD)
    
    def write(self, row, col, value, sheet=None, **kwargs):
        sheet = self._format_sheet_name(sheet)
        
        if isinstance(sheet, (int, )):
            sheet = self.sheets.keys()[sheet]
        elif isinstance(sheet, (NoneType, )):
            sheet = self.active_sheet
        
        if sheet not in self.sheets:
            raise Exception('Sheet %s not in existing sheets' % sheet)
        
        sheet = self.sheets[sheet]
        self._write_cell(sheet['sheet'], row, col, value, **kwargs)
    
    def write_row(self, values, sheet=None, **kwargs):
        sheet = self._format_sheet_name(sheet)
        
        if isinstance(sheet, (int, )):
            sheet = self.sheets.keys()[sheet]
        elif isinstance(sheet, (NoneType, )):
            sheet = self.active_sheet
        
        if sheet not in self.sheets:
            raise Exception('Sheet %s not in existing sheets' % sheet)
        
        sheet = self.sheets[sheet]
        
        for col, val in enumerate(values):
            self._write_cell(sheet['sheet'], sheet['row'], col, val, **kwargs)
        sheet['row'] += 1
    
    writerow = write_row
    
    def save(self, seek=None):
        self._save()
        if isinstance(seek, (int, )):
            self.fd.seek(seek)
        return self.fd
    
    def as_response(self):
        response = HttpResponse(mimetype=self.mime)
        response['Content-Disposition'] = 'attachment; filename=%s' % (self.fd, )
        self.fd = response
        self.save()
        return response
    
    def sheets(self):
        return self.sheets.keys()

class XlsWriter(GenericXlsWriter):
    mime = 'application/vnd.ms-excel'
    
    def _create_wb(self):
        return xlwt.Workbook()
    
    def _add_sheet(self, name):
        ws = self.workbook.add_sheet(name) 
        ws.paper_size_code = 1 # US Letter
        return ws
    
    def _write_cell(self, sheet, row, col, value, style=None):
        if style:
            sheet.write(row, col, value, STYLES[style][0])
        else:
            sheet.write(row, col, value)
    
    def _save(self):
        self.workbook.save(self.fd)

class XlsxWriter(GenericXlsWriter):
    mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    
    def _create_wb(self):
        wb = openpyxl.workbook.Workbook()
        wb.remove_sheet(wb.get_active_sheet())
        return wb
    
    def _add_sheet(self, name):
        ws = self.workbook.create_sheet()
        ws.set_printer_settings(ws.PAPERSIZE_LETTER, ws.ORIENTATION_PORTRAIT) # leave this here just in case... 
        ws.page_setup.paperSize = ws.PAPERSIZE_LETTER # this actually sets the size
        ws.title = name
        return ws
    
    def _write_cell(self, sheet, row, col, value, style=None):
        cell = sheet.cell(row=row, column=col)
        cell.value = value
        
        if style == STYLE_BOLD:
            cell.style.font.bold = True
        elif style:
            cell.style.fill.fill_type = Fill.FILL_SOLID
            cell.style.fill.start_color.index = STYLES[style][1]
    
    def _save(self):
        self.workbook.save(self.fd)

def write_excel_file(fd=None, type='xls', override_ext=False):
    if isinstance(fd, (str, unicode)) and not override_ext:
        type = os.path.splitext(fd)[1].strip('.')
    elif fd == None:
        fd = StringIO()
    
    type = type.lower()
    
    if type == 'xls':
        return XlsWriter(fd)
    elif type == 'xlsx':
        return XlsxWriter(fd)
    
    raise BadXlsFile()

class BadXlsFile(Exception): pass
class XlsError(Exception): pass

is_integer = lambda x: not not re.match('\d+', x)