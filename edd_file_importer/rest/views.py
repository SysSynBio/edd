# coding: utf-8
import json
import logging
import uuid

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.db.models import Prefetch
from django_filters import filters as django_filters
from django.http import JsonResponse
from requests import codes
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework import mixins, viewsets
import celery

from .serializers import FileImportSerializer, ImportCategorySerializer
from ..models import Import, ImportCategory, ImportFormat, ImportFile
from ..tasks import attempt_status_transition, process_import_file
from ..utilities import CommunicationError, EDDImportError
from main.models import Measurement, MeasurementUnit
from edd.rest.views import EDDObjectFilter, StudyInternalsFilterMixin
from edd.utilities import JSONEncoder
from edd_file_importer import models
from main.importer.table import ImportBroker


logger = logging.getLogger(__name__)


class ImportFilter(EDDObjectFilter):
    file_format = line = django_filters.ModelChoiceFilter(
        name='import__file_format',
        queryset=models.ImportFormat.objects.all()
    )

    class Meta:
        model = models.Import
        fields = {
            'study': ['exact', 'in'],
            'protocol': ['exact', 'in'],
            'category': ['exact', 'in'],
            'status': ['exact', 'in'],
            'file_format': ['exact', 'in']
        }


# TODO: enforce user write permissions
class ImportFilterMixin(StudyInternalsFilterMixin):
    filter_class = ImportFilter
    serializer_class = FileImportSerializer
    _filter_joins = ['study']

    def get_queryset(self):
        qs = models.Import.objects.order_by('pk')
        return qs.select_related('created', 'updated')


class BaseImportsViewSet(ImportFilterMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = FileImportSerializer

    def get_queryset(self):
        return super(BaseImportsViewSet, self).get_queryset().filter(self.get_nested_filter())


class ImportCategoriesViewSet(viewsets.ReadOnlyModelViewSet):
    """
    View for getting ImportCategories and related content for display in the UI.  This REST-based
    implementation roughly approximates the result of a likely eventual GraphQL query result (but
    with less short-term effort)
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ImportCategorySerializer
    queryset = ImportCategory.objects.all()

    def get_queryset(self):
        # build a Prefetch object that allows us to sort returned ImportFormats in the defined
        # display_order for each ImportCategory. We'll also throw in a few select_related calls
        # in a first-pass attempt to reduce # queries.
        base_fields = ['object_ref', 'object_ref__updated', 'object_ref__created']
        ordered_fmts_qs = ImportFormat.objects.select_related(*base_fields)
        ordered_fmts_qs = ordered_fmts_qs.order_by('categoryformat__display_order')
        ordered_fmts_pf = Prefetch('file_formats', queryset=ordered_fmts_qs)

        # build the main queryset
        qs = ImportCategory.objects.all().select_related(*base_fields)
        qs = qs.prefetch_related(ordered_fmts_pf)
        qs = qs.prefetch_related('protocols')  # no defined ordering for protocols
        qs = qs.order_by('display_order')
        return qs


class StudyImportsViewSet(ImportFilterMixin, mixins.CreateModelMixin,
                          mixins.UpdateModelMixin, viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows users with study write permission to create, configure, and run a data
    import.
    """
    parsers = (JSONParser, MultiPartParser)  # multipart supports optional single-request upload
    permission_classes = [IsAuthenticated]
    serializer_class = FileImportSerializer

    def get_queryset(self):
        return super(StudyImportsViewSet, self).get_queryset().filter(self.get_nested_filter())

    def create(self, request, *args, **kwargs):

        study_pk = self.kwargs['study_pk']

        # unless required step 1 inputs or the file itself is missing, save the parameters
        # to the database. Further verification will be done in the background task responsible for
        # parsing / verification
        try:
            # grab request parameters, causing a KeyError for any minimally required params
            # missing in the request.
            file = request.data['file']
            time_units_pk = MeasurementUnit.objects.filter(unit_name='hours').values_list(
                                'pk', flat=True).get()

            import_context = {
                'uuid': request.data['uuid'],
                'study_id': study_pk,
                'category_id': request.data['category'],
                'protocol_id': request.data['protocol'],
                'file_format_id': request.data['file_format'],
                'status': Import.Status.CREATED,
                'x_units_id': request.data.get('x_units', time_units_pk),
                'y_units_id': request.data.get('y_units', None),
                'compartment': request.data.get('compartment', Measurement.Compartment.UNKNOWN),
            }

            # save user inputs to the database for handoff to a Celery worker
            with transaction.atomic():
                file_model = ImportFile.objects.create(file=file)
                import_context['file_id'] = file_model.pk
                import_ = Import.objects.create(**import_context)

            if not str(import_.uuid) == request.data['uuid']:
                logger.error('Saved UUID does NOT match input')

            process_import_file.delay(import_.pk, request.user.pk,
                                      request.data.get('status',  None),
                                      request.encoding or 'utf8', initial_upload=True)

            # return identifiers the clients (esp UI) can use to
            payload = json.dumps({'uuid': import_.uuid, 'pk': import_.pk}, cls=JSONEncoder)
            return JsonResponse(payload, status=codes.accepted, safe=False)

        except KeyError as k:
            logger.exception('Exception processing import upload')
            missing_key = k.args[0]
            return self._build_simple_err_response('Bad request', 'Missing required parameter',
                                                   status=codes.bad_request,
                                                   detail=missing_key)
        except ObjectDoesNotExist as o:
            logger.exception('Exception processing import upload')
            return self._build_simple_err_response(
                'Bad request',
                'Referenced a non-existent object',
                status=codes.bad_request,
                detail=o)
        except RuntimeError as r:
            logger.exception('Exception processing import upload')
            return self._build_simple_err_response(
                'Error',
                'An unexpected error occurred',
                status=codes.internal_server_error,
                detail=r)

    # TODO: simplify
    def partial_update(self, request, *args, **kwargs):
        """
        Handles HTTP PATCH requests, e.g. to adjust import parameters during multiple steps of
        the UI wizard.
        """

        user_pk = request.user.pk
        study_pk = self.kwargs['study_pk']
        import_pk = self.kwargs['pk']

        try:
            ui_payload = None
            new_upload = 'file' in request.data
            import_ = models.Import.objects.get(pk=import_pk)

            # reject changes if the import is already submitted
            if import_.status in (Import.Status.SUBMITTED, Import.Status.COMPLETED):
                msg = 'Modifications are not allowed once imports reach the {import_.status} state'
                return self._build_simple_err_response('Invalid state', msg,
                                                       codes.internal_server_error)

            # if file is changed or content needs post-processing, (re)parse and (re)process it
            process_file = new_upload or self._test_context_changed(request, import_)
            if process_file:

                # get the file to parse. it could be one uploaded in an earlier request
                if new_upload:
                    file = ImportFile.objects.create(request.data['file'])
                    import_.file = file

                # update all parameters from the request. Since this is a re-upload,
                # and essentially the same as creating a new import, we'll allow
                # redefinition of any user-editable parameter
                import_.status = Import.Status.CREATED
                import_.category_id = request.data.get('category', import_.category)
                import_.file_format = request.data.get('file_format', import_.file_format)
                import_.protocol = request.data.get('protocol', import_.protocol)
                import_.compartment = request.data.get('compartment', import_.compartment)
                import_.x_units = request.data.get('x_units', import_.x_units)
                import_.y_units = request.data.get('y_units', import_.y_units)
                import_.save()

                # schedule a task to process the file, and submit the import if requested
                process_import_file.delay(import_.pk, user_pk, request.get('status', None),
                                          request.encoding or 'utf8', initial_upload=False)
                ui_payload = json.dumps({
                    'uuid': import_.uuid,
                    'pk': import_.pk,
                    'status': import_.status
                })
                return JsonResponse(ui_payload, status=codes.accepted, safe=False)

            # otherwise, save changes and determine any additional missing inputs
            else:
                self._save_context(import_, request, study_pk, import_pk, user_pk)

                # if client requested a status transition, verify it and try to fulfill
                # raises EddImportError if unable to fulfill a request
                requested_status = request.data.get('status', None)
                if requested_status:
                        attempt_status_transition(import_, requested_status, self.request.user,
                                                  asynch=True)
                        return JsonResponse({}, status=codes.accepted)

            # if the file was parsed in an earlier request, e.g. in the first half of Step 3,
            # get cached parse results from Redis & from the EDD database, and return them to
            # the client.  This step requires re-querying EDD's DB for MeasurementTypes,
            # but needs less code and also skips potentially-expensive line/assay lookup and
            # external ID verification
            try:
                ui_payload = self._build_ui_payload_from_cache(import_)
            except EDDImportError as e:
                return self._build_err_response(e.aggregator, codes.internal_server_error)

            return JsonResponse(ui_payload, status=codes.ok, safe=False)

        except ObjectDoesNotExist as o:
            logger.exception('Exception processing import upload')
            return self._build_simple_err_response(
                'Bad request',
                'Referenced a non-existent object',
                status=codes.bad_request,
                detail=o)
        except EDDImportError as e:
            logger.exception('Exception processing import upload')
            return self._build_err_response(e.aggregator, codes.bad_request)
        except (celery.exceptions.OperationalError, CommunicationError, RuntimeError) as r:
            logger.exception('Exception processing import upload')
            return self._build_simple_err_response(
                'Error',
                'An unexpected error occurred',
                status=codes.internal_server_error,
                detail=r)

    def retrieve(self, request, *args, **kwargs):
        pass   # TODO

    def update(self, request, *args, **kwargs):
        pass  # TODO

    def _save_context(self, import_, request, study_pk, import_pk, user_pk):
        """
        Saves parameters to persistent storage that don't require reprocessing the file, but will
        affect the final stage of the import.  Note we purposefully don't let just anything
        through here, e.g. allowing client to change "study" or "status".
        """
        update_params = [param for param in ('x_units', 'y_units', 'compartment')
                         if param in request.data]
        logger.info(f'Updating import context for study {study_pk}, import {import_pk}, '
                    f'user {user_pk}')
        for param in update_params:
            setattr(import_, param, request.data.get(param))
        import_.save()

        # push the changes to Redis too
        broker = ImportBroker()
        context = json.loads(broker.load_context(import_.uuid))
        for param in update_params:
            context[param] = request.data[param]
        broker.set_context(import_.uuid, json.dumps(context))

    def _test_context_changed(self, request, import_):
        """
        Determines if client provided any Step 1 context that requires reprocessing the file,
        do it
        """
        #
        reprocessing_triggers = ('category', 'protocol', 'file_format')

        for key in reprocessing_triggers:
            if key in request.data and request.data[key] != getattr(import_, key):
                return True
        return False
