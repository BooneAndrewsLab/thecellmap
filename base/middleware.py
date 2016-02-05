import re

from base.models import UserProfile
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect


class PasswordChangeMiddleware:
    def process_request(self, request):
        if request.user.is_authenticated() and \
            not re.match(reverse('password_change'), request.path):
            
            profile = UserProfile.objects.get(user=request.user)
            if profile.force_password_change:
                return HttpResponseRedirect(reverse('password_change'))