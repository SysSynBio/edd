# coding: utf-8

import logging

from rest_framework_csv import renderers as csv_renderers


logger = logging.getLogger(__name__)


class ExportRenderer(csv_renderers.CSVRenderer):
    header = [
        'study.pk',
        'study.name',
        'measurement.assay.line.pk',
        'measurement.assay.line.name',
        'measurement.assay.line.description',
        'measurement.assay.protocol.name',
        'measurement.assay.pk',
        'measurement.assay.name',
        'measurement.type_name',
        'measurement.compartment',
        'measurement.unit_name',
        'y',
        'x',
    ]
    labels = {
        'study.pk': 'Study ID',
        'study.name': 'Study Name',
        'measurement.assay.line.pk': 'Line ID',
        'measurement.assay.line.name': 'Line Name',
        'measurement.assay.line.description': 'Line Description',
        'measurement.assay.protocol.name': 'Protocol',
        'measurement.assay.pk': 'Assay ID',
        'measurement.assay.name': 'Assay Name',
        'measurement.type_name': 'Measurement Type',
        'measurement.compartment': 'Compartment',
        'measurement.unit_name': 'Units',
        'y': 'Value',
        'x': 'Hours',
    }

    def render(self, data, *args, **kwargs):
        if not isinstance(data, list):
            data = data.get('results', [])
        return super(ExportRenderer, self).render(data, *args, **kwargs)
