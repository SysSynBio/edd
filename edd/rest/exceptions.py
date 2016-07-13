"""
Defines custom Exception classes used by EDD's REST framework.
"""

def NotImplementedException(APIException):
    status_code= 503

    def init(detail):
        super(NotImplementedException.__class__, self).__init__(detail)