from __builtin__ import sorted
from datetime import datetime, timedelta
from optparse import make_option
import shutil

from django.core.management.base import BaseCommand

from base.models import Custom
from django.core.mail import mail_admins
import os
from django.conf import settings


class Command(BaseCommand):
    help = '''Delete or lists expired custom datasets'''
    option_list = BaseCommand.option_list + (
        make_option('-l', '--list',
            action='store_true',
            dest='if_list',
            help='List the expired custom datasets, instead of deleting them'),
        make_option('-d', '--delete_days',
            type='int',
            dest='days',
            default=7,
            help='Delete buy x number of days'),
        )
    
    def handle(self, *args, **options):
        expire = datetime.utcnow().replace() - timedelta(days=options['days'])
        custom = Custom.objects.filter(date__lte=expire).order_by('user', 'name')
        problem = []
        
        if options['if_list']:
            for c in custom:
                print c.user, c.name
        else:
            for c in custom:
                if os.path.isdir(c.path()):
                    shutil.rmtree(c.path())
                else:
                    problem.append(c.path())
            
            parent = os.path.join(settings.STATIC_ROOT, 'upload', 'custom')
            for subpath in os.listdir(parent):
                if not Custom.objects.filter(hash=subpath):
                    shutil.rmtree(os.path.join(parent, subpath))
            
            custom.delete()
        
        if problem:
            mail_admins('Custom dataset deletion error', 'The following path could not be found. \n' + '\n'.join(problem))