# -*- coding: utf-8 -*-
from __future__ import unicode_literals

import logging

from django.db.models import F
from haystack import indexes

from . import models


logger = logging.getLogger(__name__)


class MetaboliteIndex(indexes.SearchIndex, indexes.Indexable):
    # All SearchIndex objects must define one and only one Field with document=True
    # default template located in {TEMPLATE_DIR}/search/indexes/{APP}/{MODEL}_{FIELD}.txt
    # ./main/templates/search/indexes/main/Metabolite_text.txt
    text = indexes.CharField(document=True, use_template=True)
    # searchable fields
    name = indexes.CharField(model_attr='type_name')
    code = indexes.CharField(model_attr='short_name', null=True)
    charge = indexes.IntegerField(model_attr='charge', null=True,)
    carbons = indexes.IntegerField(model_attr='carbon_count', null=True)
    mass = indexes.DecimalField(model_attr='molar_mass', null=True)
    tags = indexes.MultiValueField(model_attr='tags', null=True, faceted=True)
    source = indexes.CharField(model_attr='_source_name', faceted=True)
    # autocomplete field
    # ./main/templates/search/indexes/main/Metabolite_auto.txt
    auto = indexes.NgramField(use_template=True)

    def get_model(self):
        return models.Metabolite

    def index_queryset(self, using=None):
        # the using parameter is defined but un-used by the API
        return models.Metabolite.objects.annotate(_source_name=F('source__name'))
