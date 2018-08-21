import json
import logging
import re
import uuid

import collections
from django.conf import settings
from django.contrib import messages
from django.http import Http404, HttpResponse, HttpResponseRedirect, JsonResponse, QueryDict
from django.shortcuts import get_object_or_404, render
from django.template.defaulttags import register
from django.urls import reverse
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext as _
from django.views import View, generic
from django.views.decorators.csrf import ensure_csrf_cookie
from requests import codes
from rest_framework.exceptions import MethodNotAllowed


from edd import utilities
from edd.notify.backend import RedisBroker
from main.importer.parser import guess_extension, ImportFileTypeFlags
from main.views import StudyObjectMixin

# for reference, see main.views.ImportTableView
class ImportView(generic.TemplateView):
    template_name = 'edd_file_importer/import2.html'
