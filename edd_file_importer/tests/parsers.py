# coding: utf-8

import json

from unittest.mock import call, patch

from .import factory
from edd_file_importer.codes import FileParseCodes
from edd_file_importer.parsers.table import (GenericImportParser, MeasurementParseRecord,
                                             SkylineParser)
from main.tests import TestCase


class GenericTests(TestCase):

    def test_excel_err_detection(self):
        """
        Tests error detection for anticipated common errors
        """
        file_path = factory.test_file_path('generic_import/generic_import_parse_errs.xlsx')
        self.check_errs(file_path, True)

    def test_csv_err_detection(self):
        file_path = factory.test_file_path('generic_import/generic_import_parse_errs.csv')
        self.check_errs(file_path, False)

    def check_errs(self, file_path, is_excel):
        # mocking importer and test that the parsing does its job of aggregating errors
        # note that we init internal dicts in mock instance so they don't cause errors
        with patch('edd_file_importer.utilities.ErrorAggregator') as MockAggregator:
            aggregator = MockAggregator.return_value
            aggregator.errors = {}

            # parse the input from either file type. note that the mock masks exceptions normally
            # raised by the parser...we'll check below
            parser = GenericImportParser(aggregator=aggregator)
            if is_excel:
                with open(file_path, 'rb') as fh:
                    parser.parse_excel(fh)
            else:
                with open(file_path) as fh:
                    parser.parse_csv(fh)

            aggregator.add_error.assert_has_calls([
                call(FileParseCodes.DUPLICATE_COL_HEADER,
                     occurrence='"Time" (D1)'),
                call(FileParseCodes.DUPLICATE_COL_HEADER,
                     occurrence='"Time" (E1)'),
                call(FileParseCodes.MISSING_REQ_VALUE,
                     subcategory='Measurement Type',
                     occurrence='B2'),
                call(FileParseCodes.MISSING_REQ_VALUE,
                     subcategory='Value',
                     occurrence='C2'),
                call(FileParseCodes.INVALID_VALUE,
                     subcategory="Time",
                     occurrence='"A" (D3)'),
            ])

    def test_excel_success_and_warnings(self):
        self.check_success_and_warnings('generic_import/generic_import.xlsx', True)

    def test_csv_success_and_warnings(self):
        self.check_success_and_warnings('generic_import/generic_import.csv', False)

    def check_success_and_warnings(self, filename, is_excel):
        """
        Tests for successful parsing of generic import file
        """
        file_path = factory.test_file_path(filename)

        # mocking error aggregator to test that the parsing does its job
        with patch('edd_file_importer.utilities.ErrorAggregator') as MockAggregator:
            importer = MockAggregator.return_value
            importer.errors = {}  # prevent mock from masking correct parse return value
            parser = GenericImportParser(aggregator=importer)

            if is_excel:
                with open(file_path, 'rb') as fh:
                    mcount = parser.parse_excel(fh)
            else:
                with open(file_path) as fh:
                    mcount = parser.parse_csv(fh)

            self.assertEqual(parser.unique_line_or_assay_names, {'A', 'B'})
            self.assertEqual(parser.unique_mtypes, {'CID:440917', 'CID:5288798'})

            importer.add_error.assert_not_called()

            # build a list of warnings expected to be detected during parsing
            warning_calls = []
            if is_excel:
                warning_calls = [
                    call(FileParseCodes.IGNORED_WORKSHEET,
                         occurrence='Only the first sheet in your workbook, "Sheet 1", '
                                    'was processed.  All other sheets will be ignored.')]
            warning_calls.append(
                call(FileParseCodes.COLUMN_IGNORED, occurrence='"Unrecognized Header" (C2)'))

            # verify expected errors and warnings detected
            importer.add_warning.assert_has_calls(warning_calls)
            importer.add_warnings.assert_called_once_with(
                FileParseCodes.IGNORED_VALUE_BEFORE_HEADERS,
                ['"Hand-scrawled research notes" (B1)'])

            self.assertEqual(mcount, 2)

        with factory.load_test_file('generic_import/parse_result.json') as json_file:
            expected = json.loads(json_file.read())
            parsed = [m.to_json() for m in parser.series_data]

            self.assertEqual(expected, parsed)


class SkylineTests(TestCase):

    def test_excel_err_detection(self):
        """
        Tests error detection for anticipated common errors
        """
        file_path = factory.test_file_path('skyline/skyline_parse_errs.xlsx')
        self.check_errs(file_path, True)

    def test_csv_err_detection(self):
        file_path = factory.test_file_path('skyline/skyline_parse_errs.csv')
        self.check_errs(file_path, False)

    def check_errs(self, file_path, is_excel):
        # mocking importer and test that the parsing does its job of aggregating errors
        # note that we init internal dicts in mock instance so they don't cause errors
        with patch('edd_file_importer.utilities.ErrorAggregator') as MockAggregator:
            aggregator = MockAggregator.return_value
            aggregator.errors = {}

            # parse the input from either file type. note that the mock masks exceptions normally
            # raised by the parser...we'll check below
            parser = SkylineParser(aggregator=aggregator)
            if is_excel:
                with open(file_path, 'rb') as fh:
                    parser.parse_excel(fh)
            else:
                with open(file_path) as fh:
                    parser.parse_csv(fh)

            aggregator.add_error.assert_has_calls([
                call(FileParseCodes.DUPLICATE_COL_HEADER,
                     occurrence='"Total Area" (D1)'),
                call(FileParseCodes.DUPLICATE_COL_HEADER,
                     occurrence='"Total Area" (E1)'),
                call(FileParseCodes.MISSING_REQ_VALUE,
                     subcategory='Total Area',
                     occurrence='D2'),
                call(FileParseCodes.MISSING_REQ_VALUE,
                     subcategory='Replicate Name',
                     occurrence='A4'),
                call(FileParseCodes.INVALID_VALUE,
                     subcategory="Total Area",
                     occurrence='"Kitty" (D6)'),
            ])

    def test_excel_success_and_warnings(self):
        self.check_success_and_warnings('skyline/skyline.xlsx', True)

    def test_csv_success_and_warnings(self):
        self.check_success_and_warnings('skyline/skyline.csv', False)

    def check_success_and_warnings(self, filename, is_excel):
        """
        Tests for successful parsing of skyline import file
        """
        file_path = factory.test_file_path(filename)

        # mocking error aggregator to test that the parsing does its job
        with patch('edd_file_importer.utilities.ErrorAggregator') as MockAggregator:
            importer = MockAggregator.return_value
            importer.errors = {}  # prevent mock from masking correct parse return value
            parser = SkylineParser(aggregator=importer)

            if is_excel:
                with open(file_path, 'rb') as fh:
                    mcount = parser.parse_excel(fh)
            else:
                with open(file_path) as fh:
                    mcount = parser.parse_csv(fh)

            self.assertEqual(parser.unique_line_or_assay_names, {'arcA', 'BW1'})
            self.assertEqual(parser.unique_mtypes, {'A', 'B', 'C'})
            self.assertEqual(mcount, 6)

            importer.add_error.assert_not_called()

            # build a list of warnings expected to be detected during parsing
            warning_calls = []
            if is_excel:
                warning_calls = [
                    call(FileParseCodes.IGNORED_WORKSHEET,
                         occurrence='Only the first sheet in your workbook, "Sheet 1", '
                                    'was processed.  All other sheets will be ignored.')]
            warning_calls.append(
                call(FileParseCodes.COLUMN_IGNORED, occurrence='"Unrecognized Header" (D2)'))

            # verify expected errors and warnings detected
            importer.add_warning.assert_has_calls(warning_calls)
            importer.add_warnings.assert_called_once_with(
                FileParseCodes.IGNORED_VALUE_BEFORE_HEADERS,
                ['"Hand-scrawled research notes" (B1)'])

            # compare searchable parsed data
            exp_areas = {
                ('arcA', 'A'): 1,
                ('arcA', 'B'): 2,
                ('arcA', 'C'): 3,
                ('BW1', 'A'): 3,
                ('BW1', 'B'): 2,
                ('BW1', 'C'): 1,
            }
            self.assertDictEqual(exp_areas, parser.summed_areas)

        # compare MeasurementParseRecords generated by the parser
        with factory.load_test_file('skyline/parse_result.json') as json_file:
            expected = json.loads(json_file.read())
            parsed = [m.to_json() for m in parser.series_data]
            self.assertEqual(expected, parsed)
