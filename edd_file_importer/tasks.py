
from celery.utils.log import get_task_logger

from .models import Import
from celery import shared_task

logger = get_task_logger(__name__)


@shared_task(bind=True)
def mark_import_processing(self, import_uuid):
    """
    A simple task whose job is to mark an import as PROCESSING once it's begun
    """
    logger.debug(f'Marking import {import_uuid} as processing')
    Import.objects.filter(uuid=import_uuid).update(status=Import.Status.PROCESSING)


@shared_task(bind=True)
def mark_import_complete(self, import_uuid):
    """
    A simple task whose job is to mark an import as COMPLETED once it's done
    """
    logger.debug(f'Marking import {import_uuid} as complete')
    Import.objects.filter(uuid=import_uuid).update(status=Import.Status.COMPLETED)


@shared_task
def mark_import_failed(request, exc, traceback, import_uuid):
    """
        A simple task whose job is to mark an import as FAILED on error.
     """
    logger.debug(f'Marking import {import_uuid} as failed')
    Import.objects.filter(uuid=import_uuid).update(status=Import.Status.FAILED)
