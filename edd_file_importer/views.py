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
from main.models.permission import StudyPermission
from main.views import load_study, StudyObjectMixin


class ImportView(StudyObjectMixin, generic.DetailView):
    template_name = 'edd_file_importer/import2.html'

    def get(self, request, *args, **kwargs):
        # load study to enforce permissions check... permissions should also be checked by back end
        # during user attempt to create the lines, but better to identify permissions errors before
        # loading the form
        pk = kwargs.get('pk')
        slug = kwargs.get('slug')
        load_study(request, pk=pk, slug=slug, permission_type=StudyPermission.CAN_EDIT)

        # render the template
        return super(ImportView, self).get(request, *args, **kwargs)
