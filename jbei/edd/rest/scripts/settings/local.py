"""
Defines custom settings used by scripts in jbei.edd.rest.scripts.
"""

####################################################################################################
# Application URL's.
# Defaults target test servers to prevent accidental corruption / creation of
# real data.
####################################################################################################
LOCAL_DOCKER_EDD_URL = 'http://localhost'
LOCAL_DEVELOPMENT = 'http://local-development'
DOCKER_CONTAINER_INTERNAL_URL = 'http://localhost:8000'
EDD_TEST_URL = 'https://edd-test.jbei.org'
ONSITE_LOCAL_EDD_URL = 'https://mforrer-mr.dhcp.lbl.gov'
EDD_URL = EDD_TEST_URL
VERIFY_EDD_CERT = EDD_URL not in (LOCAL_DEVELOPMENT, LOCAL_DOCKER_EDD_URL,
                                  DOCKER_CONTAINER_INTERNAL_URL, ONSITE_LOCAL_EDD_URL)

LOCAL_ICE_URL = 'https://localhost:8443'
ICE_TEST_INSECURE_URL = 'http://registry-test.jbei.org:8443'
ICE_TEST_URL = 'https://registry-test.jbei.org'
ICE_URL = ICE_TEST_URL
VERIFY_ICE_CERT = True

DEFAULT_LOCALE = b'en_US.UTF-8'  # override Docker container default to work in OSX

ICE_REQUEST_TIMEOUT = (180, 180)
EDD_REQUEST_TIMEOUT = (180, 180)

# Replace default logging config to add detail for non-edd modules / set debug log levels
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'simple': {
            #'format': '%(asctime)s Thread %(thread)d %(name)-12s$%(funcName)s:%(lineno)s %(
            # levelname)-8s %('
            #         'message)s',
            # 'format': '%(asctime)s %(name)-12s %(levelname)-8s '
            #           '%(message)s ($%(funcName)s():%(lineno)s)',
            'format': '%(asctime)s %(name)-12s %(levelname)-8s '
                      '%(message)s',
        },
    },
    # 'filters': {
    #     'require_debug_true': {
    #         '()': 'django.utils.log.RequireDebugTrue',
    #     },
    # },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
            #'stream': 'ext://sys.stdout'
        },
    },
    'loggers': {
        # specify formatting for Django log messages, and also force tracebacks for uncaught
        # exceptions to be logged. Without this, django only logs cryptic 1-liners for uncaught
        # exceptions...see SYNBIO-1262 for an example where this was very misleading.
         'jbei': {
             'level': 'DEBUG',
             'handlers': ['console', ],
         },
          '__main__': {
             'level': 'DEBUG',
             'handlers': ['console', ],
         },
         'root': {
             'level': 'INFO',
             'handlers': ['console', ],
         },
         # 'jbei': {
         #     'level': 'DEBUG',
         #     'handlers': ['console', ],
         # },
    },
}
