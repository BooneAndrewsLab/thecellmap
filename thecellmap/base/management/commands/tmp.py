'''
Created on Dec 13, 2013

@author: matej
'''
from base.utils import CellMapCommand
import re
import xlwt
from xlwt.Style import colour_map

PAT = re.compile('_T\d+', re.IGNORECASE)

class Command(CellMapCommand):
    def make_style(self, name):
        style = xlwt.XFStyle()
        pattern = xlwt.Pattern()
        pattern.pattern = xlwt.Pattern.SOLID_PATTERN
        pattern.pattern_fore_colour = xlwt.Style.colour_map[name]
        style.pattern = pattern
        return style
    
    def handle(self, *args, **options):
        wb = xlwt.Workbook()
        sheet = wb.add_sheet('palette')
        sheet.paper_size_code = 1
        
        xlwt.add_palette_colour("red_stringent", 0x21)
        wb.set_colour_RGB(0x21, 204, 51, 51)
        xlwt.add_palette_colour("red_lenient", 0x22)
        wb.set_colour_RGB(0x22, 255, 153, 153)
        xlwt.add_palette_colour("green_stringent", 0x23)
        wb.set_colour_RGB(0x23, 0, 153, 51)
        xlwt.add_palette_colour("green_lenient", 0x24)
        wb.set_colour_RGB(0x24, 153, 204, 153)
        
        row = 0
        for k, v in colour_map.iteritems():
            style = self.make_style(k)
            sheet.write(row, 0, k, style)
            sheet.write(row, 1, v, style)
            row += 1
        
        wb.save("/home/matej/palette.xls")