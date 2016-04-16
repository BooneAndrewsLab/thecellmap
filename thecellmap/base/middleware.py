import re

from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect


class PasswordChangeMiddleware:
    def process_request(self, request):
        if request.user.is_authenticated() and \
            not re.match(reverse('password_change'), request.path):
            
            if request.user.last_login == None:
                return HttpResponseRedirect(reverse('password_change'))
            