"""
This is an example settings/local.py file.
These settings overrides what's in settings/base.py
"""

from . import base


# To extend any settings from settings/base.py here's an example.
# If you don't need to extend any settings from base.py, you do not need
# to import base above
INSTALLED_APPS = base.INSTALLED_APPS + (
            'django_nose',
            'django_extensions',
        )

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': 'db/development.sqlite3',
        'USER': '',
        'PASSWORD': '',
        'HOST': '',
        'PORT': '',
        'CONN_MAX_AGE': 600,
    },
    # 'slave': {
    #     ...
    # },
}

# Recipients of traceback emails and other notifications.
ADMINS = (
    # ('Your Name', 'your_email@domain.com'),
)
MANAGERS = ADMINS

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

# SECURITY WARNING: don't run with debug turned on in production!
# Debugging displays nice error messages, but leaks memory. Set this to False
# on all server instances and True only for development.
DEBUG = TEMPLATE_DEBUG = True

# Is this a development instance? Set this to True on development/master
# instances and False on stage/prod.
DEV = True

# Hosts/domain names that are valid for this site; required if DEBUG is False
# See https://docs.djangoproject.com/en/1.5/ref/settings/#allowed-hosts
ALLOWED_HOSTS = []

# SECURITY WARNING: keep the secret key used in production secret!
# Hardcoded values can leak through source control. Consider loading
# the secret key from an environment variable or a file instead.
SECRET_KEY = 'j_t=nqdkbbrmuapo5qdnq(0gbbym&se7s0pk6v+$jxl1qww*60'

# Uncomment these to activate and customize Celery:
# CELERY_ALWAYS_EAGER = False  # required to activate celeryd
# BROKER_HOST = 'localhost'
# BROKER_PORT = 5672
# BROKER_USER = 'django'
# BROKER_PASSWORD = 'django'
# BROKER_VHOST = 'django'
# CELERY_RESULT_BACKEND = 'amqp'

## Log settings

LOGGING = {
    'version': 1,
    'disable_existing_loggers': True,
    'formatters': {
        'simple': {
            'format': '%(levelname)s %(message)s'
        },
    },
    'handlers': {
        'console': {
            'level':'DEBUG',
            'class':'logging.StreamHandler',
            'formatter': 'simple'
        }
    },
    'loggers': {
        'django.request': {
            'handlers': ['console',],
            'level': 'DEBUG',
        }
    }
}

INTERNAL_IPS = ('127.0.0.1', '192.168.0.18')

BOONELAB_MANAGEMENT_DB = {
    'host': '',
    'username': '',
    'password': '',
    'database': ''
}

EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_HOST_USER=""
EMAIL_HOST_PASSWORD=""
EMAIL_USE_TLS=True
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

REST_FRAMEWORK = {
    # Use hyperlinked styles by default.
    # Only used if the `serializer_class` attribute is not set on a view.
    'DEFAULT_MODEL_SERIALIZER_CLASS':
        'rest_framework.serializers.HyperlinkedModelSerializer',

    # Use Django's standard `django.contrib.auth` permissions,
    # or allow read-only access for unauthenticated users.
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.DjangoModelPermissionsOrAnonReadOnly'
    ],

    'PAGINATE_BY_PARAM': 'page_size',
}

ANONYMOUS_USER_ID = 131

COMPRESS_ENABLED=True

REQUIRE_ENVIRONMENT = 'base.nodejs.NodeJSEnvironment'
REQUIRE_DEBUG = False

NOTEBOOK_ARGUMENTS = [
    '--notebook-dir', 'notebooks',
    '--ip', '0.0.0.0',
]
