# -*- coding: utf-8 -*-
# Generated by Django 1.9.13 on 2017-05-25 19:13

import libsbml
import os

from django.apps import apps as django_apps
from django.core.files import storage
from django.db import migrations


def add_template(apps, schema_editor):
    """
    Adds the default SBML template for EDD tutorial.
    """
    # define models
    SBMLTemplate = apps.get_model('main', 'SBMLTemplate')
    Attachment = apps.get_model('main', 'Attachment')
    Update = apps.get_model('main', 'Update')
    # get the bootstrap update object
    beginning = Update.objects.get(pk=1)
    # load template file
    conf = django_apps.get_app_config('main')
    fixture_dir = os.path.join(conf.path, 'fixtures')
    template_file = os.path.join(fixture_dir, 'StdEciJO1366.xml')
    with open(template_file, 'rb') as fp:
        path = storage.default_storage.save('StdEciJO1366.xml', fp)
    # Create objects
    template = SBMLTemplate(
        name="StdEciJO1366",
        description="JO1366 with standardized names",
        uuid='d9cca866-962f-49cd-9809-292263465bfa',
        created=beginning,
        updated=beginning,
    )
    template.save()
    sbml_file = Attachment(
        object_ref=template,
        file=storage.default_storage.path(path),
        filename='StdEciJO1366.xml',
        mime_type='text/xml',
        file_size=os.path.getsize(template_file),
        created=beginning,
    )
    sbml_file.save()
    template.sbml_file = sbml_file
    # can these be calculated from the model?
    template.biomass_calculation = 8.78066
    template.biomass_exchange_name = 'R_Ec_biomass_iJO1366_core_53p95M'
    template.save()
    template_sync_species(apps, template)


# see: main.tasks.template_sync_species(template_id)
# the migration cannot use the "real" function, as it references the latest form
# of the models used, rather than the models as they exist at this point in the
# chain of migrations.
def template_sync_species(apps, instance):
    """
    Task parses an SBML document, then creates MetaboliteSpecies and MetaboliteExchange records
    for every species and single-reactant reaction in the model.
    """
    doc = libsbml.readSBML(instance.sbml_file.file.file.name)
    model = doc.getModel()
    # filter to only those for the updated template
    MetaboliteSpecies = apps.get_model("main", "MetaboliteSpecies")
    MetaboliteExchange = apps.get_model("main", "MetaboliteExchange")
    species_qs = MetaboliteSpecies.objects.filter(sbml_template=instance)
    exchange_qs = MetaboliteExchange.objects.filter(sbml_template=instance)
    exist_species = set(species_qs.values_list('species', flat=True))
    exist_exchange = set(exchange_qs.values_list('exchange_name', flat=True))
    # creating any records not in the database
    for species in map(lambda s: s.getId(), model.getListOfSpecies()):
        if species not in exist_species:
            MetaboliteSpecies.objects.get_or_create(
                sbml_template=instance,
                species=species
            )
        else:
            exist_species.discard(species)
    reactions = map(lambda r: (r.getId(), r.getListOfReactants()), model.getListOfReactions())
    for reaction, reactants in reactions:
        if len(reactants) == 1 and reaction not in exist_exchange:
            MetaboliteExchange.objects.get_or_create(
                sbml_template=instance,
                exchange_name=reaction,
                reactant_name=reactants[0].getSpecies()
            )
        else:
            exist_exchange.discard(reaction)
    # removing any records in the database not in the template document
    species_qs.filter(species__in=exist_species).delete()
    exchange_qs.filter(exchange_name__in=exist_exchange).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0004_set-assay-names'),
    ]

    operations = [
        migrations.RunPython(code=add_template, reverse_code=migrations.RunPython.noop),
    ]
