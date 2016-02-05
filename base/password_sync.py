from base.models import UserProfile
from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver


@receiver(post_save, sender=User)
def create_user_profile_signal(sender, instance, **kwargs):
    if not UserProfile.objects.filter(user=instance).exists():
        profile = UserProfile.objects.create(user=instance, force_password_change=True)

@receiver(pre_save, sender=User)
def password_change_signal(sender, instance, update_fields, **kwargs):
    try:
        user = User.objects.get(username=instance.username)
        if not user.password == instance.password:
            UserProfile.objects.filter(user=user).update(force_password_change = False)
    except User.DoesNotExist:
        pass