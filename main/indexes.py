# -*- coding: utf-8 -*-
from __future__ import unicode_literals

import logging

from django.db.models import F
from haystack import indexes

from . import models


logger = logging.getLogger(__name__)


class MetaboliteIndex(indexes.SearchIndex, indexes.Indexable):
    name = indexes.CharField(model_attr='type_name')
    code = indexes.CharField(model_attr='short_name')
    formula = indexes.CharField(model_attr='molecular_formula')
    charge = indexes.IntegerField(model_attr='charge')
    carbons = indexes.IntegerField(model_attr='carbon_count')
    mass = indexes.DecimalField(model_attr='molar_mass')
    tags = indexes.MultiValueField(model_attr='tags')
    source = indexes.CharField(model_attr='_source_name')

    def getModel(self):
        return models.Metabolite

    def index_queryset(self, using=None):
        # the using parameter is defined but un-used by the API
        return models.Metabolite.objects.annotate(_source_name=F('source__name'))
