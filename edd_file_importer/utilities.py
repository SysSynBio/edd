# coding: utf-8
import logging
from collections import defaultdict

from .codes import get_ui_summary
from main.models import Measurement

logger = logging.getLogger(__name__)


class EDDImportError(Exception):
    def __init__(self, aggregator):
        super(EDDImportError, self).__init__()
        self.aggregator = aggregator

    @property
    def errors(self):
        return self.aggregator.errors

    @property
    def warnings(self):
        return self.aggregator.warnings


class ParseError(EDDImportError):
    pass


class VerificationError(EDDImportError):
    pass


class CommunicationError(EDDImportError):
    pass


class ImportTooLargeError(EDDImportError):
    pass


class ImportErrorSummary(object):
    """
    Defines error/warning information captured during an actual or attempted import attempt.
    Experiment Description file upload (and eventual combinatorial GUI) will be much easier
    to use
    if the back end can aggregate some errors and return some or all of them at the same time.
    """

    # TODO: either account for subcategory in JSON output, or remove
    def __init__(self, err):
        self.err = err
        self.resolution = None
        self.doc_url = None
        self._occurrence_details = defaultdict(list)  # maps subcategory => occurrences

    def add_occurrence(self, occurrence, subcategory=None):
        detail_str = str(occurrence)
        subcategory = subcategory if subcategory else 'default'
        self._occurrence_details[subcategory].append(detail_str)

    def to_json(self):
        # explode error code into UI-centric category + summary
        ui_summary = get_ui_summary(self.err)

        results = []
        for subcategory, occurrences in self._occurrence_details.items():
            summary = {
                **ui_summary,
                'resolution': self.resolution,
                'doc_url': self.doc_url,
                'detail': ', '.join(occurrences)
            }
            if subcategory != 'default':
                summary['subcategory'] = subcategory
            results.append(summary)

        return results


class ErrorAggregator(object):
    def __init__(self):
        self.warnings = {}  # maps err type -> ImportErrorSummary
        self.errors = {}    # maps warn type -> ImportErrorSummary

    def add_warning(self, warn_type, subcategory=None, occurrence=None):
        logger.debug(f'add_warning called! {warn_type}: {occurrence}')
        self._issue(self.warnings, warn_type, subcategory=subcategory,
                    occurrence=occurrence)

    def add_error(self, err_type, subcategory=None, occurrence=None):
        logger.debug(f'add_error called! {err_type}: {occurrence}')
        self._issue(self.errors, err_type, subcategory=subcategory,
                    occurrence=occurrence)

    def raise_error(self, err_type, subcategory=None, occurrence=None):
        logger.debug(f'raise_error called! {err_type}: {occurrence}')
        self._issue(self.errors, err_type, subcategory=subcategory,
                    occurrence=occurrence)
        self.raise_errors()

    @staticmethod
    def _issue(dest, type_id, subcategory=None, occurrence=None):
        errs = dest.get(type_id)
        if not errs:
            errs = ImportErrorSummary(type_id)
            dest[type_id] = errs
        if occurrence:
            errs.add_occurrence(occurrence=occurrence, subcategory=subcategory)

    @staticmethod
    def error_factory(err_type, subcategory, occurrence=None):
        aggregator = ErrorAggregator()
        aggregator.raise_error(err_type, subcategory, occurrence)

    def add_errors(self, err_type, subcategory=None, occurrences=None):
        logger.debug(f'add_errors called! {err_type}: {occurrences}')
        for detail in occurrences:
            self.add_error(err_type, subcategory=subcategory, occurrence=detail)

    def add_warnings(self, warn_type, occurrences):
        for detail in occurrences:
            self.add_warning(warn_type, occurrence=detail)

    # TODO: add / enforce a limit so we aren't adding an unbounded list
    def raise_errors(self, err_type=None, subcategory=None, occurrences=None):
        if err_type:
            self.add_errors(err_type, subcategory=subcategory, occurrences=occurrences)

        if self.errors:
            raise EDDImportError(self)


def build_step4_ui_json(import_, required_inputs, import_records, unique_mtypes, x_units_pk):
    """
    Build JSON to send to the new import front end, including some legacy data for easy
    display in the existing TS graphing code (which may get replaced later). Relative to the
    import JSON, x and y elements are further broken down into separate lists. Note that JSON
    generated here should match that produced by the /s/{study_slug}/measurements/ view
    TODO: address PR comment re: code organization
    https://repo.jbei.org/projects/EDD/repos/edd-django/pull-requests/425/overview?commentId=3073
    """
    logger.debug('Building UI JSON for user inspection')

    assay_id_to_meas_count = {}

    measures = []
    data = {}
    for index, import_record in enumerate(import_records):
        import_data = import_record['data']

        # if this import is creating new assays, assign temporary IDs to them for pre-import
        # display and possible deactivation in step 4.  If the import is updating existing
        # assays, use their real pk's.
        assay_id = import_record['assay_id']
        assay_id = assay_id if assay_id not in ('new', 'named_or_new') else index

        mcount = assay_id_to_meas_count.get(assay_id, 0)
        mcount += 1
        assay_id_to_meas_count[assay_id] = mcount

        # TODO: file format, content, and protocol should all likely be considerations here.
        # Once supported by the Celery task, consider moving this determination up to the
        # parsing step  where the information is all available on a per-measurement basis.
        format = Measurement.Format.SCALAR
        if len(import_data) > 2:
            format = Measurement.Format.VECTOR

        measures.append({
            # assign temporary measurement ID's.
            # TODO: revisit when implementing collision detection/merge similar to assays
            # above. Likely need detection/tracking earlier in the process to do this with
            # measurements.
            'id': index,

            'assay': assay_id,
            'type': import_record['measurement_id'],
            'comp': import_record['compartment_id'],
            'format': format,
            'x_units': x_units_pk,
            'y_units': import_record['units_id'],
            'meta': {},
        })

        # repackage data from the import into the format used by the legacy study data UI
        # Note: assuming based on initial example that it's broken up into separate arrays
        # along x and y measurements...correct if that's not born out by other examples (maybe
        # it's just an array per element)
        measurement_vals = []
        data[str(index)] = measurement_vals
        for imported_timepoint in import_data:
            display_timepoint = [[imported_timepoint[0]]]  # x-value
            display_timepoint.append(imported_timepoint[1:])  # y-value(s)
            measurement_vals.append(display_timepoint)

    return {
        'pk': f'{import_.pk}',
        'uuid': f'{import_.uuid}',
        'status': import_.status,
        'total_measures': assay_id_to_meas_count,
        'required_values': required_inputs,
        'types': {str(mtype.id): mtype.to_json() for mtype in unique_mtypes},
        'measures': measures,
        'data': data,
    }
