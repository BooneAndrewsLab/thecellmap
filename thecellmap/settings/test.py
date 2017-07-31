"""
This is an example settings/test.py file.
Use this settings file when running tests.
These settings overrides what's in settings/base.py
"""

from .base import *


# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.postgresql_psycopg2',
#         'NAME': 'thecellmap',
#         'USER': 'thecellmap',
#         'PASSWORD': 'thecellmap',
#         'HOST': '192.168.0.19',
#         'PORT': '5432',
#     'CONN_MAX_AGE': 600,
#     },
#     'boonelab': {
#         'ENGINE': 'django.db.backends.postgresql_psycopg2',
#         'NAME': 'boonelab_management',
#         'USER': 'SGATest',
#         'PASSWORD': 'sga1234',
#         'HOST': '192.168.0.8',
#         'PORT': '5432',
#     },
# }

SECRET_KEY = 'j_t=nqdkbbrmuapo5qdnq(0gbbym&se7s0pk6v+$jxl1qww*60'
