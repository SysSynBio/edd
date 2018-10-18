# Generated by Django 2.0.8 on 2018-10-18 18:18

import environ

from django.core.management import call_command
from django.core.serializers import base, python
from django.db import migrations


def load_bootstrap_fixture(apps, schema_editor):
    """
    Loads the bootstrap fixture, using models generated from the migration state, rather than from
    current model code.
    """
    # re-define the _get_model function, using argument apps in closure
    # code copied verbatim from django.core.serializers.python
    def _get_model(model_identifier):
        try:
            return apps.get_model(model_identifier)
        except (LookupError, TypeError):
            raise base.DeserializationError("Invalid model identifier: '%s'" % model_identifier)
    # save function we are going to monkey-patch
    backup = python._get_model
    # monkey-patch
    python._get_model = _get_model

    # load bootstrap fixture
    call_command('loaddata', 'bootstrap.json', app_label='edd_file_importer')

    # create reference to OD600 protocol, which is in EDD's bootstrap.json, but for historical
    # reasons isn't yet consistently defined in either PK or UUID across EDD deployments
    Protocol = apps.get_model('main', 'Protocol')
    od600_protocol = Protocol.objects.get(name='OD600')

    ImportCategory = apps.get_model('edd_file_importer', 'ImportCategory')
    od_category = ImportCategory.objects.get(name='OD')

    od_category.protocols.add(od600_protocol)

    # revert monkey-patch
    python._get_model = backup


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0001_edd-schema-init'),
        ('main', '0002_edd-data-bootstrap'),
        ('edd_file_importer', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(code=load_bootstrap_fixture, reverse_code=migrations.RunPython.noop),
    ]
