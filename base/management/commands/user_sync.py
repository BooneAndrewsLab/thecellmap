from django.contrib.auth.models import User
from django.core.mail import mail_admins
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = '''Check if boonelab and thecellmap users are syncronized'''

    def handle(self, *args, **options):
        is_sync = True
        name = []
        
        for labUser in User.objects.using('boonelab'):
            try:
                siteUser = User.objects.all().get(username=labUser.username)
            except User.DoesNotExist:
                is_sync = False
                name.append(labUser.username)
            
            if labUser.password != siteUser.password:
                is_sync = False
                name.append(labUser.username)
        
        if not is_sync:
            mail_admins('Account sync error', 'Synchronization error between boonelab_management and thecellmap accounts. \n' + '\n'.join(name))