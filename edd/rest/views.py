"""
Defines the supported views for EDD's REST framework. This class is a work in progress.

Assuming Django REST Framework (DRF) will be adopted in EDD, new and existing views should be
ported to this class over time. Many REST resources are currently defined in main/views.py,
but are not making use of DRF.
"""
import re

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from requests import HTTPError

from edd.rest.serializers import (LineSerializer, MetadataGroupSerializer, MetadataTypeSerializer,
                                  StrainSerializer, StudySerializer, UserSerializer)
from jbei.edd.rest.constants import (QUERY_ACTIVE_OBJECTS_ONLY, QUERY_ALL_OBJECTS, CASE_SENSITIVE_PARAM,
                                     QUERY_INACTIVE_OBJECTS_ONLY, LINE_ACTIVE_STATUS_PARAM,
                                     LINES_ACTIVE_DEFAULT,
                                     METADATA_TYPE_CONTEXT, METADATA_TYPE_GROUP,
                                     METADATA_TYPE_I18N, METADATA_TYPE_LOCALE,
                                     METADATA_TYPE_NAME_REGEX,
                                     STRAIN_CASE_SENSITIVE, STRAIN_NAME, STRAIN_NAME_REGEX,
                                     STRAIN_REGISTRY_ID, STRAIN_REGISTRY_URL_REGEX)
from jbei.ice.rest.ice import IceApi
from jbei.rest.auth import HmacAuth
from jbei.rest.utils import is_numeric_pk
from main.models import Line, MetadataType, Strain, Study, StudyPermission, User, MetadataGroup
from rest_framework import (status, viewsets)
from rest_framework.exceptions import APIException, ParseError, ValidationError
from rest_framework.relations import StringRelatedField
from rest_framework.response import Response

import logging

logger = logging.getLogger(__name__)

# class IsStudyReadable(permissions.BasePermission):
#     """
#     Custom permission to only allow owners of an object to edit it.
#     """
#
#     def has_object_permission(self, request, view, study):
#
#         # studies are only available to users who have read permissions on them
#         return study.user_can_read(request.user)

STRAIN_NESTED_RESOURCE_PARENT_PREFIX = r'strain'

STUDY_URL_KWARG ='study'
BASE_STRAIN_URL_KWARG = 'id'  # NOTE: value impacts url kwarg names for nested resources
HTTP_MUTATOR_METHODS = ('POST', 'PUT', 'PATCH', 'UPDATE', 'DELETE')

# TODO: consider for all models below:
#   queryset = Strain.objects.none()  # Required for DjangoModelPermissions bc of get_queryset()
                                      # override. See http://www.django-rest-framework.org/api-guide/permissions/#djangomodelpermissions
#   permissionClasses = (IsAuthenticated,) for views dependent on custom Study permissions


class MetadataTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that supports viewing and searching .EDD's metadata types
    TODO: implement/confirm access controls for unsafe methods, then make writable
    """
    queryset = MetadataType.objects.all()  # must be defined for DjangoModelPermissions
    serializer_class = MetadataTypeSerializer

    def get_queryset(self):
        pk = self.kwargs.get('pk', None)

        queryset = MetadataType.objects.all()
        if pk:
            queryset = queryset.filter(pk=pk)

        params = self.request.query_params
        if params:
            group_id = params.get(METADATA_TYPE_GROUP)
            if group_id:
                if is_numeric_pk(group_id):
                    queryset = queryset.filter(group=group_id)
                else:
                    queryset = queryset.filter(group__group_name=group_id)

            for_context = params.get(METADATA_TYPE_CONTEXT)
            if for_context:
                queryset = queryset.filter(for_context=for_context)

            type_i18n = params.get(METADATA_TYPE_I18N)
            if type_i18n:
                queryset = queryset.filter(type_i18n=type_i18n)

            queryset = _do_optional_regex_filter(params, queryset, 'type_name',
                                                 METADATA_TYPE_NAME_REGEX,
                                                 METADATA_TYPE_LOCALE,)
        return queryset


def _do_optional_regex_filter(query_params_dict, queryset, data_member_name, regex_param_name,
                              locale_param_name):
    """
    Implements consistent regular expression matching behavior for EDD's REST API. Applies
    default behaviors re: case-sensitivity to all regex-based searches in the REST API.
    :param queryset: the queryset to filter based on the regular expression parameter
    :param data_member_name the django model data member name to be filtered according to the regex,
    if present
    :param regex_param_name: the query parameter name REST API clients use to pass the regular
    expression used for the search
    :param locale_param_name: the query parameter name REST API clients use to pass the locale used
    to determine which strings the regular expression is tested against
    :return: the queryset, filtered using the regex, if available
    """
    # TODO: do something with locale, which we've at least forced clients to provide to simplify
    # future full i18n support

    regex_value = query_params_dict.get(regex_param_name)
    if not regex_value:
        return queryset

    case_sensitive_search = CASE_SENSITIVE_PARAM in query_params_dict
    search_type = 'regex' if case_sensitive_search else 'iregex'
    filter_param = '%(data_member_name)s__%(search_type)s' % {
        'data_member_name': data_member_name,
        'search_type': search_type
    }

    return queryset.filter(**{filter_param: regex_value})


class MetadataGroupViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that supports view-only access to EDD's metadata groups.
    TODO: implement/confirm access controls for unsafe methods, then make this writable
    """
    queryset = MetadataGroup.objects.all()  # must be defined for DjangoModelPermissions
    serializer_class = MetadataGroupSerializer


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows privileged users to get read-only information on the current set of
    EDD user accounts.
    """
    serializer_class = UserSerializer

    def get_queryset(self):
        return User.objects.filter(self.kwargs['user'])


class StrainViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users with appropriate access to get strain information.
    Support is provided for:

    1) Flexible searching of strains
    2) Access to a detailed view of a strain, based on local numeric primary key OR on the UUID
    from ICE
    """
    serializer_class = StrainSerializer
    lookup_url_kwarg = BASE_STRAIN_URL_KWARG
    #lookup_value_regex = PK_OR_UUID_REGEX # TODO: implement or remove

    def get_object(self):
        """
        Overrides the default implementation to provide flexible lookup for Strain detail
        views (either based on local numeric primary key, or based on the strain UUID from ICE
        """
        filters = {}  # unlike the example, just do all the filtering in get_queryset() for
                      # consistency
        queryset = self.get_queryset()

        obj = get_object_or_404(queryset, **filters)
        self.check_object_permissions(self.request, obj)
        return obj

    def get_queryset(self):
        """
        Overrides the default implementation to provide:
        * flexible filtering based on a number of useful input parameters
        * flexible strain lookup by local numeric pk OR by UUID from ICE
        :return:
        """

        logger.debug('in %s' % self.get_queryset.__name__)
        # parse optional query parameters

        # build a query, filtering by the provided user inputs
        query = Strain.objects.all()

        # if a strain UUID or local numeric pk was provided, get it
        if self.kwargs:
            strain_id_filter = self.kwargs.get(self.lookup_url_kwarg)
            if is_numeric_pk(strain_id_filter):
                query = Strain.objects.filter(pk=strain_id_filter)
            else:
                query = Strain.objects.filter(registry_id=strain_id_filter)
        # otherwise, we're searching strains, so filter them according to the provided params
        else:
            query_params = self.request.query_params
            strain_id_filter = query_params.get(self.lookup_url_kwarg)
            local_pk_filter = query_params.get('pk')
            registry_id_filter = query_params.get(STRAIN_REGISTRY_ID)
            registry_url_regex_filter = query_params.get(STRAIN_REGISTRY_URL_REGEX)
            case_sensitive = query_params.get(STRAIN_CASE_SENSITIVE)
            name_filter = query_params.get(STRAIN_NAME)

            # if provided an ambiguously-defined unique ID for the strain, apply it based
            # on the format of the provided value
            if strain_id_filter:
                if is_numeric_pk(strain_id_filter):
                    query = query.filter(pk=strain_id_filter)
                else:
                    query = query.filter(registry_id=strain_id_filter)

            if local_pk_filter:
                query = query.filter(pk=local_pk_filter)

            if registry_id_filter:
                query = query.filter(registry_id=registry_id_filter)

            if registry_url_regex_filter:
                if case_sensitive:
                    query = query.filter(registry_url__regex=registry_url_regex_filter)
                else:
                    query = query.filter(registry_url__iregex=registry_url_regex_filter)

            if name_filter:
                if case_sensitive:
                    query = query.filter(name__contains=name_filter)
                else:
                    query = query.filter(name__icontains=name_filter)

            query = _do_optional_regex_filter(query_params, query, 'name', STRAIN_NAME_REGEX, None)

        query = query.select_related('object_ref')

        logger.debug('StrainViewSet query count=%d' % query.count())
        if query.count() < 10:
            logger.debug(query)

        return query


class LineViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows Lines to we viewed or edited.
    TODO: add edit/create capability back in, based on study-level permissions
    """
    queryset = Line.objects.all()
    serializer_class = LineSerializer
    contact = StringRelatedField(many=False)
    experimenter = StringRelatedField(many=False)

    def get_queryset(self):
        query = Line.objects.all()

        # filter by line active status, applying the default (only active lines)
        active_status = self.request.query_params.get(LINE_ACTIVE_STATUS_PARAM,
                                                      LINES_ACTIVE_DEFAULT)
        query = filter_by_active_status(query, active_status, '')
        query = query.select_related('object_ref')
        return query


def filter_by_active_status(queryset, active_status=QUERY_ACTIVE_OBJECTS_ONLY, query_prefix=''):
    """
    A helper method for queryset filtering based on a standard set of HTTP request
    parameter values that indicate whether EddObjects should be considered in the query based on
    their 'active' status.

    For a single object class A related to the ORM model class B returned from the query, a call to
    filter_by_active_status() will filter the query according to A's 'active' status. Note
    that this filtering by active status will result in the queryset returning one row for each
    relations of A to B, so clients will often want to use distinct() to limit the returned
    results.  A typical use of this method is to control which lines are considered
    in a query.

    Example 1 : Finding only active Lines. This is slightly more code than to just filter the
                query directly, but that wouldn't be standard across REST resource implementations.

    queryset = Line.objects.all()
    queryset = filter_by_active_status(queryset, active_status=ACTIVE_ONLY,
                                       query_prefix='').distinct()

    Example 2: Finding Strains associated with a Study by active lines

    queryset = Strain.objects.filter(line__study__pk=study_id)
    queryset = filter_by_active_status(queryset, active_status=ACTIVE_ONLY,
                                       query_prefix=('line__')).distinct()

    :param queryset: the base queryset to apply filtering to
    :param active_status: the HTTP request query parameter whose value implies the type of
    filtering to apply based on active status. If this isn't one of the recognized values,
    the default behavior is applied, filtering out inactive objects. See
    constants.ACTIVE_STATUS_OPTIONS.
    :param query_prefix: an optional keyword prefix indicating the relationship of the filtered
    class to the model we're querying (see examples above)
    :return: the input query, filtered according to the parameters
    """
    active_status = active_status.lower()

    # just return the parameter if no extra filtering is required
    if active_status == QUERY_ALL_OBJECTS:
        return queryset

    # construct an ORM query keyword based on the relationship of the filtered model class to the
    # Django model class being queried. For example 1 above, when querying Line.objects.all(),
    # we prepend '' and come up with Q(active=True). For example 2, when querying
    # Strain, we prepend 'line__' and get Q(line__active=True)
    query_keyword = '%sactive' % query_prefix
    active_value = (active_status != QUERY_INACTIVE_OBJECTS_ONLY)  # return requested status,
                                                                   # or active objects only if
                                                                   # input was bad
    print('Active query %s' % str({query_keyword: active_value})) # TODO: remove debug stmt
    active_criterion = Q(**{query_keyword: active_value})
    return queryset.filter(active_criterion)


class StudyViewSet(viewsets.ReadOnlyModelViewSet):  # read-only for now...see TODO below
    """
    API endpoint that provides read-only access to studies, subject to user/role read access
    controls. Study write access is a TODO.
    """
    serializer_class = StudySerializer
    contact = StringRelatedField(many=False)

    def get_queryset(self):
        study_pk = self.kwargs.get('pk')

        user = self.request.user

        permission = StudyPermission.WRITE if self.request.method in HTTP_MUTATOR_METHODS else \
                     StudyPermission.READ

        # if the user's admin / staff role gives read access to all Studies, don't bother querying
        # the database for specific permissions defined on this study
        if permission == StudyPermission.READ and Study.user_role_can_read(user):
            study_query = Study.objects.filter(pk=study_pk)
        else:
            user_permission_q = Study.user_permission_q(user, permission)
            # NOTE: distinct is required since this query can return multiple rows for the same
            # study, one per permission that gives this user access to it
            study_query = Study.objects.filter(user_permission_q, pk=study_pk).distinct()

        return study_query

    def create(self, request, *args, **kwargs):
        if not Study.user_can_create(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)

        return super(StudyViewSet, self).create(request, *args, **kwargs)

    # TODO: test whether update / destroy are protected by get_queryset, or whether they need
        # separate permissions checks to protect them. Then change back to a ModelViewSet.


NUMERIC_PK_PATTERN = re.compile('^\d+$')

# Notes on DRF nested views:
# lookup_url_kwargs doesn't seem to be used/respected by nested routers in the same way as plain DRF
#           - see StrainStudiesView for an example that works, but isn't clearly the most clear yet


class StrainStudiesView(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows read-only access to the studies a given strain is used in (subject to
    user/role read access privileges on the studies).
    """
    serializer_class = StudySerializer
    lookup_url_kwarg = 'study_pk'

    def get_object(self):
        """
        Overrides the default implementation to provide flexible lookup for nested strain
        views (either based on local numeric primary key, or based on the strain UUID from ICE
        """
        filters = {}  # unlike the example, just do all the filtering in get_queryset() for
                      # consistency
        queryset = self.get_queryset()

        obj = get_object_or_404(queryset, **filters)
        self.check_object_permissions(self.request, obj) # verify class-level strain access. study
                                                         # permissions are enforced in
                                                         # get_queryset()
        return obj

    def get_queryset(self):
        kwarg = '%s_%s' % (STRAIN_NESTED_RESOURCE_PARENT_PREFIX, BASE_STRAIN_URL_KWARG)
        # get the strain identifier, which could be either a numeric (local) primary key, or a UUID
        strain_id = self.kwargs.get(kwarg)

        print('lookup_url_kwarg = %s, kwargs = %s' % (str(self.lookup_url_kwarg), str(self.kwargs)))

        # figure out which it is
        strain_pk = strain_id if is_numeric_pk(strain_id) else None
        strain_uuid = strain_id if not strain_pk else None

        print('strain_pk=%s, strain_uuid=%s' % (strain_pk, strain_uuid))

        line_active_status = self.request.query_params.get(LINE_ACTIVE_STATUS_PARAM,
                                                        LINES_ACTIVE_DEFAULT)
        user = self.request.user

        # only allow superusers through, since this is strain-related data that should only be
        # accessible to sysadmins
        if not user.is_superuser:
            #  TODO: user group / merge in recent changes / throw PermissionsError or whatever
            return Response(status=status.HTTP_403_FORBIDDEN)

        studies_query = None
        if strain_pk:
            studies_query = Study.objects.filter(line__strains__pk=strain_pk)
        else:
            studies_query = Study.objects.filter(line__strains__registry_id=strain_uuid)

        # filter by line active status, applying the default (only active lines)
        studies_query = filter_by_active_status(studies_query, active_status=line_active_status,
                                                query_prefix='line__')

        study_pk = self.kwargs.get(self.lookup_url_kwarg)
        if study_pk:
            studies_query = studies_query.filter(pk=study_pk)

        # enforce EDD's custom access controls for readability of the associated studies. Note:
        # at present this isn't strictly necessary because of the sysadmin check above but best
        # to enforce programatically in case the implementation of Study's access controls
        # changes later on

        if not Study.user_role_can_read(user):
            study_user_permission_q = Study.user_permission_q(user, StudyPermission.READ,
                                                              keyword_prefix='line__study__')
            studies_query = studies_query.filter(study_user_permission_q)

        studies_query = studies_query.distinct()  # required by both line activity and studies
                                                  # permissions queries

        return studies_query


class StudyStrainsView(viewsets.ReadOnlyModelViewSet):
    """
        API endpoint that allows read-only viewing the unique strains used within a specific study
    """
    serializer_class = StrainSerializer
    STUDY_URL_KWARG = 'study_pk'
    STRAIN_URL_KWARG = 'pk'

    # override

    def get_object(self):
        """
            Overrides the default implementation to provide flexible lookup for nested strain
            views (either based on local numeric primary key, or based on the strain UUID from ICE
            """
        filters = {}  # unlike the example, just do all the filtering in get_queryset() for
        # consistency
        queryset = self.get_queryset()
        obj = get_object_or_404(queryset, **filters)
        self.check_object_permissions(self.request, obj)
        return obj

    def get_queryset(self):
        print(self.kwargs)

        # extract URL arguments
        study_id = self.kwargs[self.STUDY_URL_KWARG]

        study_id_is_pk = is_numeric_pk(study_id)
        line_active_status = self.request.query_params.get(LINE_ACTIVE_STATUS_PARAM,
                                                           LINES_ACTIVE_DEFAULT)
        user = self.request.user

        # build the query, enforcing EDD's custom study access controls. Normally we'd require
        # sysadmin access to view strains, but the names/descriptions of strains in the study should
        # be visible to users with read access to a study that measures them
        study_user_permission_q = Study.user_permission_q(user, StudyPermission.READ,
                                                          keyword_prefix='line__study__')
        if study_id_is_pk:
            strain_query = Strain.objects.filter(study_user_permission_q, line__study__pk=study_id)
        else:
            logger.error("Non-numeric study IDs aren't supported.")
            return Strain.objects.none()

        strain_id = self.kwargs.get(self.STRAIN_URL_KWARG)
        if strain_id:
            strain_id_is_pk = is_numeric_pk(strain_id)

            if strain_id_is_pk:
                strain_query = strain_query.filter(pk=strain_id)
            else:
                strain_query = strain_query.filter(registry_id=strain_id)

        # filter by line active status, applying the default (only active lines)
        strain_query = filter_by_active_status(strain_query, line_active_status,
                                               query_prefix='line__')
        strain_query = strain_query.distinct()  # required by both study permission query and
                                                # line active filters above

        return strain_query


class StudyLineView(viewsets.ModelViewSet):  # LineView(APIView):
    """
        API endpoint that allows lines to be viewed or edited.
    """
    serializer_class = LineSerializer
    STUDY_URL_KWARG = 'study_pk'

    def get_queryset(self):
        print('kwargs: ' + str(self.kwargs))  # TODO: remove debug aid
        print('query_params: ' + str(self.request.query_params))  # TODO: remove debug aid

        # extract study pk URL argument. line pk, if present, will be handled automatically by
        # get_object() inherited from the parent class
        study_pk = self.kwargs[self.STUDY_URL_KWARG]

        user = self.request.user
        requested_permission = (StudyPermission.WRITE if self.request.method in
                               HTTP_MUTATOR_METHODS else StudyPermission.READ)

        # if the user's admin / staff role gives read access to all Studies, don't bother querying
        # the database for specific permissions defined on this study
        if requested_permission == StudyPermission.READ and Study.user_role_can_read(user):
            line_query = Line.objects.filter(study__pk=study_pk)
        else:
            study_user_permission_q = Study.user_permission_q(user, requested_permission,
                                                              keyword_prefix='study__')
            line_query = Line.objects.filter(study_user_permission_q, study__pk=study_pk)

        # filter by line active status, applying the default (only active lines)
        line_active_status = self.request.query_params.get(LINE_ACTIVE_STATUS_PARAM,
                                                           LINES_ACTIVE_DEFAULT)
        line_query = filter_by_active_status(line_query, line_active_status)
        line_query = line_query.distinct()  # distinct() required by *both* study permissions check
                                                # and line activity filter above

        return line_query

    # TODO: if doable with some degree of clarity, use reflection to enforce DRY in mutator methods
    # below. For now, we'll go with fast rather than elegant. MF 2/24/16
    # def enforce_write_access_privileges(self, call_on_success_function):
    #     study_pk = self.kwargs[self.STUDY_URL_KWARG]
    #     user = self.request.user
    #
    #     if self.queryset:
    #         logger.log('has queryset')
    #
    #     # enforce study write privileges
    #     error_response = StudyLineView._test_user_write_access(user, study_pk)
    #     if error_response:
    #         return error_response
    #
    #     super(StudyLineView).call_on_success_function(self, ) # TODO: investigate this

    def create(self, request, *args, **kwargs):
        ##############################################################
        # enforce study write privileges
        ##############################################################
        study_pk = self.kwargs[self.STUDY_URL_KWARG]
        user = self.request.user
        error_response = StudyLineView._test_user_write_access(user, study_pk)
        if error_response:
            return error_response

        # if the input is a dictionary that contains the right data for bulk creation,
        # do a bulk creation
        if 'bulk_creation_source' in request.data.keys():
            self.create_lines_bulk(request)

        ##############################################################
        # if user has write privileges for the study, use parent implementation
        ##############################################################
        return super(StudyLineView, self).create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        ##############################################################
        # enforce study write privileges
        ##############################################################
        study_pk = self.kwargs[self.STUDY_URL_KWARG]
        user = self.request.user
        error_response = StudyLineView._test_user_write_access(user, study_pk)
        if error_response:
            return error_response

        ##############################################################
        # if user has write privileges for the study, use parent implementation
        ##############################################################
        return super(StudyLineView, self).update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        ##############################################################
        # enforce study write privileges
        ##############################################################
        study_pk = self.kwargs[self.STUDY_URL_KWARG]
        user = self.request.user
        error_response = StudyLineView._test_user_write_access(user, study_pk)
        if error_response:
            return error_response

        ##############################################################
        # if user has write privileges for the study, use parent implementation
        ##############################################################
        return super(StudyLineView, self).destroy(request, *args, **kwargs)


    def create_lines_bulk(self, request):
        """
        Creates a set of study lines in bulk based on a set of combinatorial parameters
        :param request:
        :return:
        """
        # TODO: following initial draft / test, refactor as a Celery task. Client should get a quick
        # reply from server to avoid timeouts during long processing times. Celery task's last
        # job should be to reply to the client re: the results of batch processing.
        data = request.data

        # define constants for required input sections
        bulk_creation_src_section_property = 'bulk_creation_source'
        line_properies_section_property = 'line_properties'
        line_name_ordering_section_property = 'line_name_ordering'

        creation_src_manual = 'manual_input_only'
        creation_src_spreadsheet = 'spreadsheet'
        creation_src_ice_collection = 'ice_collection'
        valid_creation_sources = (creation_src_manual, creation_src_spreadsheet,
                                  creation_src_ice_collection)

        missing_section_headers = \
            [section_header for section_header in (bulk_creation_src_section_property,
                                                   line_properies_section_property,
                                                   line_name_ordering_section_property
                                                   ) if section_header not in data]
        if missing_section_headers:
            raise ParseError("Request payload was missing required properties %s"
                             % str(missing_section_headers))

        src_param = 'source'

        # keep track of the current section / search parameter so we can provide helpful error
        # messages if a required item isn't found
        section_name = bulk_creation_src_section_property
        param_name = src_param

        creation_src = data.get(src_param)

        if creation_src not in valid_creation_sources:
            raise ParseError("Value %(value)s isn't a valid value for parameter %(param)s" % {
                'value': creation_src, 'param': src_param
            })

        if creation_src != creation_src_manual:
            raise NotImplementedException(
                """Bulk creation source "%s" isn't supported yet""" % creation_src)
            # TODO: consider checking for / enforcing line name uniqueness within the study once
            # we've given users the option to create their own line names from other sources

        logger.info('Start bulk line creation for user %(username)s: input=%(inputs)s' % {
            'username': self.request.user.username,
            'input': str(self.request.data)
        })

        try:


            # TODO: consider checking uniqueness for line names in input / within the study.
            # 1) requiring that every combinatorial input also be present in the line name
            # format
            # 2) testing all line names against names already in the study *before* creating any
            # lines
            # 3) Maybe allow flexibility in creating non-unique names by having a separate
            # flag that turns of consistency checks. On the other hand, can just require this in the
            # GUI and assume that anyone using the API had better know what they're doing.

            # construct a Line object to save to the database. We can't use Django's bulk_create()
            # to improve efficiency since Line/Strain have a many-to-many relationship.
            line_properties_section = data.get(line_properies_section_property)
            line_name_section = data.get(line_name_ordering_section_property)


            # if the user requested that we set strains for some of the lines, figure out which
            # have already been cached in EDD's database, then get the rest from ICE and cache them
            strain_property_pattern = re.compile(r'$strain_(\w)^')

            strain_section_param = 'strain'
            requested_strain_uuids = line_properties_section.get('strain_section_param')

            if not requested_strain_uuids:
                logger.info('No strains requested for bulk creation. Skipping EDD / ICE strain '
                            'lookup.')
            else:

                # TODO: resume work here(ish). Probably best to revisit the HTML / figure out how
                # to structure elt names / JSON input before implementing too many deets of line
                # name creation

                # build a list of line name elements that will be applied combinatorially
                combinatorial_name_elts = []
                for name_elt in line_name_section:

                    line_property = line_properties_section[name_elt]

                    if 'make_combinations' == line_property['outcome']:  # TODO: resolve w/ elt name

                        if line_property in line_name_section:
                            combinatorial_name_elts.append(line_property)

                # create any strains that weren't already in EDD's database. Do this AFTER checking
                # consistency in line name creation inputs. Strain creation could take some time /
                # create race conditions if the first failed submission due to other errors
                # launches a time-consuming strain creation process.
                cached_strains = self.bulk_create_strains(requested_strain_uuids)


                #with transaction.atomic():
                    # bulk create lines in EDD
                    # follow up by setting the creation / update data for all of the lines since
                    # this can't be done during bulk creation



        except KeyError as key_err:
            logger.log_exception("Exception parsing bulk line creation inputs for user %s" %
                                 self.user)
            raise ParseError("""Required property "%(property)s" wasn't found in data section """
                             '"%(section)s" ' % {
                                'property': param_name,
                                'section': section_name, })



    def bulk_create_strains(self, requested_strain_uuids):
        """
        Performs bulk creation of strains with the provided UUIDs from ICE. If any of the UUIDs are
        already linked to entries in EDD's database, they're ignored. Strains are created in bulk within
        the context of a database transaction, so the creation either completely succeeds or fails.
        :param self:
        :param requested_strain_uuids:
        :return: a dictionary that maps UUID -> EDD Strain instance for each strain (now
        guaranteed to be located / created)
        :raise ValidationError if any value in requested_strain_uuids isn't a valid UUID
        :raise requests.HttpError of any error occurred in contacting ICE
        """
        # TODO: consider doing this externally to a transaction.
        # TODO: also expose as part of /rest/strain (for users with the appropriate access level)
        try:


            # start a transaction so bulk strain creation in EDD's database fails consistently
            # with update history for each strain that must be inserted in a separate query
            with transaction.atomic():
                try:
                    cached_strains = {strain.registry_id: strain for strain in
                                      Strain.objects.filter(registry_id__in=requested_strain_uuids)}
                except TypeError:
                    raise ValidationError('Incorrect UUID format for one or more strains')

                uncached_strains = [uuid for uuid in requested_strain_uuids if
                                   uuid not in cached_strains.keys()]

                if uncached_strains:
                    logger.info("User requested %d strains that weren't found in EDD's "
                                "database. Searching ICE for valid strains that aren't "
                                "cached by EDD.")

                    auth = HmacAuth(key_id=settings.ICE_KEY_ID, username=self.request.user.username)
                    ice = IceApi(auth)

                    entries_to_cache = []
                    for index, uncached_uuid in enumerate(uncached_strains):
                        entry = ice.get_entry(entry_id=uncached_uuid)
                        if not entry:
                            raise ParseError("Requested strain wasn't found in ICE %s")
                        if not isinstance(entry, Strain):
                            raise ValidationError('ICE entry %s is not a Strain. '
                                                           'Only strains are supported as '
                                                           'the basis for EDD line '
                                                           'creation' % uncached_uuid)
                        # TODO: SYNBIO-1350 use uuid to construct URL instead of local pk
                        entries_to_cache.append(Strain(name=entry.name, registry_id=entry.uuid,
                                                       registry_url=ice.get_entry_uri(entry.id),
                                                       description=entry.short_description))

                    logger.info('Found ICE entries for all requested strains. Creating '
                                'EDD strain entries in bulk...')

                    # efficiently cache the entries EDD's database in bulk
                    Strain.objects.create_bulk(entries_to_cache)

                    logger.info('Done with bulk Strain creation. Storing associated '
                                'update history...')

                    # TODO: need to insert update / creation rows following bulk update,
                    # which won't execute the strain save() method or save-related hooks

                    # cache newly-created strain data in this process to use as input for
                    # line creation
                    for cached_entry in entries_to_cache:
                        cached_strains[cached_entry.registry_id] = cached_entry
                else:
                    logger.info("All %d requested strains already cached in EDD's "
                                "database. " % len(requested_strain_uuids))

                return cached_strains

        except HTTPError as err:
            logger.exception('Error getting uncached strain information from ICE '
                                 'during bulk line creation. Failed on strain %(index)d '
                                 'uuid=%(uuid)s' % {
                                     'index': index, 'uuid': uncached_uuid
                                 })
            raise err

    @staticmethod
    def _test_user_write_access(user, study_pk):
        # return a 403 error if user doesn't have write access
        requested_permission = StudyPermission.WRITE
        study_user_permission_q = Study.user_permission_q(user, requested_permission)
        user_has_permission_query = Study.objects.filter(study_user_permission_q,
                                                         pk=study_pk).distinct()

        # TODO: per William's comment, test raising PermissionDenied() similar to Django

        if not user_has_permission_query:
            return Response(status=status.HTTP_403_FORBIDDEN)

        return None

class NotImplementedException(APIException):
    status_code = 500
    default_detail = 'Not yet implemented'