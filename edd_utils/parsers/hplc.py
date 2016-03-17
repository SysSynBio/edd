#!/usr/bin/env python
# -*- coding: utf-8 -*-
#
#    This is for parsing the output of HPLC machines.
##
import logging
import re
import chardet

from collections import OrderedDict
from collections import namedtuple
from .util import RawImportRecord


def getRawImpotRecordsAsJSON(request):
    # We pass the request directly along, so it can be read as a stream by the parser
    parser = HPLC_Parser(request)

    records = []
    for record in parser.parse_hplc():
        metadata = {}
        raw_record = RawImportRecord(
            "hplc",
            record.compound,
            record.line,
            record.assay,
            record.timepoints,  # warning: shallow copy(s)
            metadata)
        j = raw_record.to_json()
        records.append(j)
    return records


# Returns an iterator of the given stream.
# There's probably a utility function in the python standard library for this...
def iterate_as_lines(stream):
    for line in stream.split("\n"):
        yield line


class HPLC_Parse_Missing_Argument_Exception(Exception):
    pass


class HPLC_Parse_No_Header_Exception(Exception):
    pass


class HPLC_Parse_Misaligned_Blocks_Exception(Exception):
    pass


class HPLC_Parser:
    # 'main.views' shows up in the apache log. '__name__' does not. Don't know why.
    logger = logging.getLogger('main.views')

    # The maximum number of lines to read before giving up on finding the header
    max_header_line_count = 20

    def __init__(self, input_stream):

        if not input_stream:
            raise HPLC_Parse_Missing_Argument_Exception("No data stream provided")

        self.logger = HPLC_Parser.logger
        self.input_stream = input_stream   # The stream that is being parsed
        self.decoded_stream = None

        # samples format: { 'Sample Name': [Compound_Entry('compound', 'amount'), ...], ... }
        self.samples = OrderedDict()       # The final data resulting from batch parsing
        self.compound_entry = namedtuple('Compound_Entry', ['compound', 'amount'])

        self.compound_record = namedtuple(
            'Compound_Record', ['compound', 'line', 'assay', 'timepoints'])

        self.has_parsed = False
        self.formatted_results = None

        # regex formulated with the nifty https://regex101.com/ tool
        # reads a samples name and captures (line, Time, assay)
        self.sample_name_regex = re.compile(r'(.*)_HPLC@([0-9]+(?:\.[0-9]*)?)(?:_([^@]+))?')

        # Integer indices for standard format parsing
        self.amount_begin_position = None
        self.amount_end_position = None
        self.compound_begin_position = None
        self.compound_end_position = None

        self.expected_row_count = None
        self.current_line = 0
        self.saved_line = 0

    def parse_hplc(self):
        """Parses textual HPLC data from the input stream, returning data formatted for use.

        THIS CLASS IS NOT THREAD SAFE.

        returns records = [('compound', 'line', 'assay', timepoints[[time, amount], ...]), ...]
        ( assay may be None )
        """
        if self.has_parsed:
            return self.formatted_results
        self.has_parsed = True

        # Apparently the HPLC machine generates documents in UTF-16?
        # Iterating over unknown UTF lines in an io stream gives rather unpredictable results.
        # There is no perfect way to determine the encoding while still parsing the stream,
        # unless we use an iterator and buffer everything accumulated while guessing,
        # then decode our buffer all at once using the guess, and pass the rest of the stream to
        # another iterator with the guess explicit:

        #   binary_chunks = iter(partial(input.read, 1), "")
        #   for unicode_chunk in iterdecode(binary_chunks, encoding):
        #       yield unicode_chunk

        # ...And since HPLC files are really never very big, we're going to forget about
        # stream parsing, and just slurp it all in here, detect the encoding, then decode
        # it all at once.

        # Future reference:
        # http://blog.etianen.com/blog/2013/10/05/python-unicode-streams/
        # https://github.com/facelessuser/Rummage/blob/master/rummage/rummage/rumcore/text_decode.py
        # http://chardet.readthedocs.org/en/latest/usage.html

        raw_string = self.input_stream.read()
        chardet_result = chardet.detect(raw_string)
        if chardet_result is None:
            raise HPLC_Parse_No_Header_Exception("unable to determine encoding of document")

        encoding = chardet_result['encoding']
        self.logger.info("detected encoding %s", encoding)
        try:
            decoded_string = raw_string.decode(encoding)
        except Exception:
            raise HPLC_Parse_No_Header_Exception("unable to decode document using guessed unocide type %s", encoding)

        self.logger.info(decoded_string)

        self.decoded_stream = iterate_as_lines(decoded_string)

        # TODO: Verify that long sample names don't clip!
        #        ...This can't be test without interacting with the HPLC machine.
        # TODO: format detection is fragile... needs attention
        # TODO: Add option to return `None`s for unidenfified peaks
        # TODO: capture other data elements, and return or not based on option
        # # ? : Messages -> Logger

        # TODO: Add warning if line is shorter then expected

        firstline = next(self.decoded_stream)

        # This is what we use to detect a 96-well-format HPLC file.
        if firstline.startswith("Batch"):
            self.logger.info("Detected 96 well format in HPLC file")
            self._parse_96_well_format_samples()
        else:
            self.logger.info("Detected standard format in HPLC file")
            header_block = self._parse_file_header()

            self.logger.debug("collecting the table_header")
            (header_block, table_header, table_divider) = self._get_table_header(header_block)

            self.logger.debug("parsing column widths")
            section_widths = self._get_section_widths(table_divider)

            self.logger.debug("collecting the column_headers")
            self._extract_column_headers_from_multiline_text(section_widths, table_header)

            # Read in each line and contruct records
            self.logger.debug("now reading in the data")

            # Collect Sample Name
            sample_name = None

            # Loop - collect each line associated with the sample
            while True:
                line = next(self.decoded_stream)
                self.current_line += 1
                if line == '\n':  # Skip blank line
                    continue
                if not line:  # End Of File
                    break

                # get the name of the sample related to the row
                new_sample_name = line[:section_widths[0]].strip()

                if not new_sample_name and not sample_name:
                    self.logger.error("Continuation entry entry specified before sample name entry. Can't interpret.")
                    break

                if new_sample_name:
                    # ensure no collision with previous sample names by adding a #
                    if new_sample_name in self.samples:
                        new_sample_name += u'-2'  # first sample has no # ... Begin next with 'name-2'
                        i = 3  # if name-2 is taken, begin counting up from 'name-3'
                        while new_sample_name in self.samples:
                            last_dash_index = new_sample_name.rindex('-')
                            new_sample_name = "%s%s" % (
                                new_sample_name[:last_dash_index+1], str(i))
                            i += 1
                    sample_name = new_sample_name
                    self.samples[sample_name] = []
                    self.logger.debug("sample_name: %s", sample_name)

                # collect the other data items - grab amounts & compounds
                amount_string = line[
                    self.amount_begin_position:
                    self.amount_end_position].strip()

                compound_string = line[
                    self.compound_begin_position:
                    self.compound_end_position].strip()

                # Put the value into our data structure
                if amount_string != u'-' and compound_string != u'-':
                    self.samples[sample_name].append(
                        self.compound_entry(compound_string, amount_string))

        self.logger.info("HPLC parsing finished.")

        # TODO: add formatter to RawImport... thingy
        # TODO: ...this might require parsing the name format locally?

        # .+_HPLC@[0-9]+\.?[0-9]*?(_REPLICATE#)?

        # return self.samples
        self.formatted_results = self._format_samples_for_raw_input_record()
        return self.formatted_results

    def _format_samples_for_raw_input_record(self):

        compound_record_dict = {}  # { compound: [ compound_record_for_assay1, ... ], ... }

        for sample_name in self.samples:
            # Collects the DB names from the sample_name.
            line = time = assay = None
            match_result = self.sample_name_regex.match(sample_name)
            if match_result:
                # Note: assay may be None
                line, time, assay = match_result.group(1, 2, 3)
            else:
                # if the sample_name is not in expected format...
                line = sample_name
                self.logger.warn("Sample name '%s' not in the expected format! %s",
                                 sample_name,
                                 "[LINE]_HPLC@[TIME] or [LINE]_HPLC@[TIME]_[REPLICATE]")

            # create formatted record for each compund entry
            for entry in self.samples[sample_name]:
                selected_record = None
                if entry.compound not in compound_record_dict:
                    compound_record_dict[entry.compound] = []
                for record in compound_record_dict[entry.compound]:
                    # check assay and line, may be different if on a different sample
                    if record.assay == assay:
                        if record.line == line:
                            selected_record = record
                if not selected_record:
                    record = self.compound_record(
                        entry.compound,
                        line,
                        assay,
                        [[time, entry.amount]])
                    compound_record_dict[entry.compound].append(record)
                else:
                    selected_record.timepoints.append([time, entry.amount])

        # TODO: in importer: None(timepoint) -> WARNING
        # TODO: in importer: None(assay) -> `None`

        compound_records = []
        for key in compound_record_dict:
            compound_records.extend(compound_record_dict[key])

        # return self.samples
        # return compound_record_dict
        return compound_records

    def _parse_file_header(self):

        header_block = []
        i = 0;
        while True:
            line = next(self.decoded_stream)
            self.current_line += 1
            header_block.append(line)
            i += 1

            if line.startswith("-"):
                break;
            if "*** End of Report ***" in line:
                break;
            if line == '':
                raise HPLC_Parse_No_Header_Exception(
                    "unable to find header: EOF encountered at line %d",
                    self.current_line)
            if i >= HPLC_Parser.max_header_line_count:
                raise HPLC_Parse_No_Header_Exception(
                    "unable to find header: header not closed after %d lines",
                    HPLC_Parser.max_header_line_count)
        return header_block

    def _get_table_header(self, header_block):
        # collect table header, "Sample Name", etc.
        # cliping it off the end of the header block
        table_header = []
        table_divider = header_block[-1]  # indicates column widths
        r_index = -2
        line = header_block[r_index]
        while line != "" and not line.isspace():
            table_header.append(line)
            r_index -= 1
            line = header_block[r_index]
        table_header.reverse()

        # collect header data, currently not parsed
        # (removes table header from header block)
        header_block = header_block[1:r_index]

        return header_block, table_header, table_divider

    def _get_section_widths(self, table_divider):
        section_widths = [0]
        section_index = 0
        for c in table_divider.strip():
            if c == '-':
                section_widths[section_index] += 1
            else:
                section_widths.append(0)
                section_index += 1

        self.logger.debug("section widths: %s", section_widths)

        return section_widths

    def _extract_column_headers_from_multiline_text(self, section_widths, table_header):

        # collect the multiline text
        column_headers = []
        for section_width in section_widths:
            column_headers.append('')
        for line in table_header:
            section_index = 0
            section_width_carryover = 0
            for section_width in section_widths:

                if not line or line.isspace():
                    self.logger.debug('table header multiline scan terminated early')
                    break

                # slice a segment off the line of the correct width
                width = section_width_carryover + section_width
                segment = line[:width]
                line = line[width:]

                # The normally empty divider space sometimes has an
                # important character in it.
                #
                # clip divider character only if empty
                if len(line) > 0 and line[0].isspace():
                    line = line[1:]
                    section_width_carryover = 0
                else:  # account for extra character in next section
                    section_width_carryover = 1
                column_headers[section_index] += segment
                section_index += 1

        # clean up the column headers
        for i in range(len(column_headers)):
            column_headers[i] = column_headers[i].split()

        # each sample is indexed by sample name

        # each value is indexed by column header
        for column_header_index in range(len(column_headers)):
            header = u""
            for header_part in column_headers[column_header_index]:
                header += u" " + header_part
            if len(header) > 0:
                header = header[1:]
            column_headers[column_header_index] = header

            self.logger.debug("header: %s", header)

            if header.startswith('Amount'):
                self.amount_begin_position = (sum(
                    section_widths[:column_header_index]) +
                    len(section_widths[:column_header_index]))
                self.amount_end_position = (section_widths[column_header_index] +
                                            self.amount_begin_position)
                self.logger.debug("Amount Begin: %s    End %s",
                                  self.amount_begin_position, self.amount_end_position)
            elif header.startswith('Compound'):
                self.compound_begin_position = (sum(
                    section_widths[:column_header_index]) +
                    len(section_widths[:column_header_index]))
                self.compound_end_position = (
                    section_widths[column_header_index] +
                    self.compound_begin_position)
                self.logger.debug("Compound Begin: %s    End %s",
                                  self.compound_begin_position,
                                  self.compound_end_position)

        return column_headers

    def _parse_96_well_format_block(self,
                                    sample_names,
                                    compounds,
                                    column_headers,
                                    section_widths):
        """Reads in a single block of data from file"""

        end_of_block = False
        line_number = 0
        while not end_of_block:
            line = next(self.decoded_stream)
            self.current_line += 1

            if self.expected_row_count and line_number > self.expected_row_count:
                raise HPLC_Parse_Misaligned_Blocks_Exception("More rows found then expected!")

            if line.startswith('#'):
                end_of_block = True
                if self.expected_row_count and line_number < self.expected_row_count:
                    raise HPLC_Parse_Misaligned_Blocks_Exception("Less rows found then expected!")

            for index in range(len(column_headers)):
                if "Sample" in column_headers[index]:
                    begin_position = (sum(section_widths[:index]) +
                                      len(section_widths[:index]))
                    end_position = section_widths[index] + begin_position
                    name = line[begin_position:end_position].strip()
                    # sample names is implicitly indexed by line_number
                    sample_names.append(name)
                elif "Amount" in column_headers[index]:
                    begin_position = (sum(section_widths[:index]) +
                                      len(section_widths[:index]))
                    end_position = section_widths[index] + begin_position
                    amount = line[begin_position:end_position].strip()

                    if float(amount) == 0.0:
                        continue

                    compound = column_headers[index].replace("Amount", "").strip()

                    compounds.append((line_number, self.compound_entry(compound, amount)))

            line_number += 1

        return sample_names, compounds

    def _parse_96_well_format_samples(self):
        """Collects the samples from a 96 well plate format file

        Format: [ (compound_string, amount_string), ...] """

        sample_names = []
        compounds = []

        # collect all the sample names
        # ...

        while True:
            self.logger.debug("collecting the header_block")
            header_block = self._parse_file_header()

            if "*** End of Report ***" in header_block[-1]:
                break

            self.logger.debug("collecting the table_header")
            (header_block, table_header, table_divider) = self._get_table_header(header_block)

            self.logger.debug("parsing column widths")
            section_widths = self._get_section_widths(table_divider)

            self.logger.debug("collecting the column_headers")
            column_headers = self._extract_column_headers_from_multiline_text(
                section_widths, table_header)

            self._parse_96_well_format_block(sample_names, compounds, column_headers, section_widths)

        # Line up the sample name with the amounts
        for indexed_compound in compounds:
            line_number, compound = indexed_compound
            sample_name = sample_names[line_number]
            if sample_name in self.samples:
                self.samples[sample_name].append(compound)
            else:
                self.samples[sample_name] = [compound]

# testing hook
if __name__ == "__main__":
    import sys, os, io

    logger = logging.getLogger(__name__)

    if len(sys.argv) is not 2:
        print("usage: python hplc_parser.py input_file_path")
        exit(1)

    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

    logging.basicConfig(
        filename='hplc_parser.log',
        level=logging.DEBUG,
        format=log_format)

    # echo all debug statements to stdout
    formatter = logging.Formatter( log_format )
    sh = logging.StreamHandler(sys.stdout)
    sh.setLevel(logging.DEBUG)
    sh.setFormatter(formatter)
    logger.addHandler(sh)

    # parse the provided filepath
    input_file_path = sys.argv[1]

    from util import RawImportRecord
    # from edd_utils.parsers.util import RawImportRecord

    if not os.path.exists(input_file_path):
        raise IOError("Error: unable to locate file %s" % input_file_path)

    with io.open(input_file_path, "r", encoding = 'utf-16') as input_file:
        p = HPLC_Parser(input_file)
        compound_records = p.parse_hplc()
        hplc_protocol_string = "hplc"

        result = []
        for record in compound_records:
            metadata = {}
            raw_record = RawImportRecord(
                hplc_protocol_string,
                record.compound,
                record.line,
                record.assay,
                record.timepoints,  # warning: shallow copy(s)
                metadata)
            result.append(raw_record)

    # activate interactive debugger with our information inside
    import IPython
    IPython.embed(banner1="\n\nparse function returned, values stored in dict 'samples'")
