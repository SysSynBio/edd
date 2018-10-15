
from celery import shared_task
from celery.utils.log import get_task_logger
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.urls import reverse

from .codes import FileProcessingCodes
from .importer.table import ImportFileHandler
from .models import Import
from .utilities import EDDImportError, ErrorAggregator
from edd.notify.backend import RedisBroker
from main.tasks import import_table_task

logger = get_task_logger(__name__)


@shared_task
def update_import_status(status, import_uuid, user_pk, notify=None):
    """
        A simple task whose job is to update an import's status and send a related user
        notification
    """
    logger.info(f'Updating import status to {status} for {import_uuid}')
    User = get_user_model()
    user = User.objects.get(pk=user_pk)
    logger.debug(f"Marking import {user.username}'s, {import_uuid} as {status}")
    import_ = Import.objects.get(uuid=import_uuid).select_related('file')
    import_.status = status
    import_.save()

    # send an async notification of the status update
    if not notify:
        notify = RedisBroker(user)
    file_name = import_.file.file.name
    notify.notify(f'Your import for file "{file_name}" is {status.lower()}',
                  tags=['import-status-update'],
                  payload={
                      'status': status,
                      'uuid': import_uuid,
                      'pk': import_.pk
                  })


@shared_task
def process_import_file(import_pk, user_pk, requested_status, encoding, initial_upload):
    """
    The back end Celery task supporting import Step 2, "Upload", and also single-request
    imports made via the REST API.  Parses and verifies the file Format and content.  This
    includes verifying identifiers with external databases (e.g. PubChem, UnipProt).
    """
    import_ = None
    notify = None
    handler = None
    try:
        fetch_fields = ('category', 'file', 'file_format', 'protocol', 'study', 'x_units',
                        'y_units')
        import_ = Import.objects.filter(pk=import_pk).select_related(*fetch_fields).get()
        User = get_user_model()
        user = User.objects.get(pk=user_pk)
        notify = RedisBroker(user)

        # process the file, sending notifications along the way. Raises EDDImportError.
        handler = ImportFileHandler(notify, import_, user)
        handler.process_file(initial_upload, encoding=encoding)

        # if client requested a status transition, likely to SUBMITTED, verify
        # that import state is consistent with attempting it. Raises EDDImportError.
        attempt_status_transition(import_, requested_status, user, notify=notify, asynch=False,
                                  aggregator=handler)

    except (EDDImportError, ObjectDoesNotExist, RuntimeError) as e:
        file_name = import_.file.file.name if import_ else ''
        study_url = reverse('main:overview', kwargs={'slug': import_.slug}) if import_ else ''
        logger.exception(f'Exception processing import upload for file "{file_name}".  '
                         f'Study is {study_url}')
        if import_:
            if import_.status == Import.Status.CREATED:
                import_.delete()  # cascades to file

            if notify:
                payload = build_err_response(handler, import_) if handler else {}
                payload['pk'] = import_pk
                payload['uuid'] = import_.uuid if import_ else None
                payload['status'] = Import.Status.FAILED
                notify.notify(f'Processing for your import file "{file_name}" has failed',
                              tags=['import-status-update'], payload=payload)
        raise e


def attempt_status_transition(import_, requested_status, user, asynch, notify=None,
                              aggregator=None):
    """
    Attempts a status transition to the client-requested status.  Either runs to completion
    or raises an EddImportError.
    :param asynch True to attempt the import asynchronously in a separate Celery task, or False
    to run it synchronously.
    """
    if not aggregator:
        aggregator = ErrorAggregator()

    # if client requested a status transition, verify that state is correct to perform it
    _verify_status_transition(aggregator, import_, requested_status, user, notify, asynch)

    if requested_status == Import.Status.SUBMITTED:
        return submit_import(import_, user.pk, notify, aggregator, asynch)


def _verify_status_transition(aggregator, import_, requested_status, user, notify, asynch):
    if requested_status is None:
        return

    # clients may only directly request a status transition to SUBMITTED...and eventually
    # ABORTED.  Reject all other status change requests.
    if requested_status != Import.Status.SUBMITTED:
        return aggregator.raise_error(FileProcessingCodes.ILLEGAL_STATE_TRANSITION,
                                      occurrence=f'Clients may not request transition to '
                                                 f'{requested_status}.')

    elif import_.status not in (Import.Status.READY, Import.Status.ABORTED,
                                Import.Status.FAILED):
        return aggregator.raise_error(
            FileProcessingCodes.ILLEGAL_STATE_TRANSITION,
             occurrence=f'Transition from {import_.status} to {Import.Status.SUBMITTED} is not '
            f'allowed or not yet supported')


def submit_import(import_, user_pk, notify, aggregator, asynch):
    """
    Schedules a Celery task to do the heavy lifting to finish the import data cached in Redis
    """
    try:
        if asynch:
            # use the celery task code to mark the import SUBMITTED, but run it synchronously
            # here so import status gets updated before any remote tasks are launched
            update_import_status(Import.Status.SUBMITTED, import_.uuid, user_pk, notify)

        # build up signatures for tasks to be executed in a chain
        uuid = import_.uuid
        notify = notify if not asynch else None  # avoid multiple redis connections for synch
        mark_import_processing = update_import_status.si(Import.Status.PROCESSING, uuid,
                                                         user_pk, notify)
        mark_import_complete = update_import_status.si(Import.Status.COMPLETED, uuid,
                                                       user_pk, notify)
        mark_import_failed = update_import_status.si(Import.Status.FAILED, uuid,
                                                     user_pk, notify)
        do_import = import_table_task.si(import_.study_id, user_pk, uuid)

        # layer new tasks on to update the import 2.0 DB status & publish notifications while
        # using the legacy Celery task to do the heavy lifting for the import itself
        chain = celery.chain(mark_import_processing |
                             do_import.on_error(mark_import_failed) |
                             mark_import_complete)

        # run the tasks, either synchronously or asynchronously
        if asynch:
            chain.delay()
        else:
            chain.apply(throw=True)

        return True

    except celery.exceptions.OperationalError as e:
        import_.status = Import.Status.FAILED
        import_.save()
        logger.exception(f'Exception submitting import {import_.uuid}')
        aggregator.raise_error(FileProcessingCodes.COMMUNICATION_ERROR, occurrence=str(e))


def build_err_response(aggregator, import_):
    """
    Builds a JSON error response to return as a WS client notification.
    """
    # flatten errors & warnings into a single list to send to the UI. Each ImportErrorSummary
    # may optionally contain multiple related errors grouped by subcategory
    errs = []
    for err_type_summary in aggregator.errors.values():
        errs.extend(err_type_summary.to_json())

    warns = []
    for warn_type_summary in aggregator.warnings.values():
        warns.extend(warn_type_summary.to_json())

    return {
        'status': import_.status,
        'errors': errs,
        'warnings': warns,
    }
