#!/usr/bin/env python
# coding: utf-8

import re
import sys
import pprint

from collections import defaultdict, namedtuple
from decimal import Decimal

Enum = namedtuple('Enum', ['index', 'value', ])
Info = namedtuple('Info', ['media', 'time', 'plate', 'well', 'promoter', ])
Row = namedtuple('Row', ['info', 'values', 'count', 'mean', 'variance', ])

# builds list of bins from 0.15, 0.25, …, 7.85, 7.95
halfstep = Decimal('0.05')
bins = list(map(lambda v: (v / 10) - halfstep, list(map(Decimal, range(2, 81)))))
name_pattern = re.compile(r'(\w+)_(\d+)h_MP(\d)_(\w+)\s+(\w+)')


def parse_name(name):
    # CSM_4h_MP1_A02 ADH1 == "{Media}_{Time}_{Plate}_{Well} {Promoter}"
    match = name_pattern.match(name)
    return Info(**{
        'media': match.group(1),
        'time': match.group(2),
        'plate': match.group(3),
        'well': match.group(4),
        'promoter': match.group(5),
    })


def process_file(filename):
    print('Reading %s …' % filename)
    with open(filename, 'r') as f:
        f.readline()
        f.readline()
        for line in f:
            # simple progress indicator
            sys.stdout.write('.')
            sys.stdout.flush()
            # get all the cells in the row
            row = line.strip().split(',')
            # name is the first cell, parse into Info
            info = parse_name(row[0])
            # values are the remaining cells; last cell is empty
            values = list(map(int, row[1:-1]))
            # build an enumeration of values
            evalues = list(map(lambda e: Enum(*e), enumerate(values)))
            # sum of all cells is population count
            count = sum(values)
            # cell value multiplied by bin value across all bins, averaged
            mean = sum(map(lambda v: bins[v.index] * v.value, evalues)) / count
            # cell value multiplied by square of difference from bin to mean, averaged
            variance = sum(map(lambda v: ((bins[v.index] - mean) ** 2) * v.value, evalues)) / count
            # quantize to limit precision based on bin size
            mean = mean.quantize(halfstep)
            variance = variance.quantize(halfstep)
            # yield processed data
            yield Row(info, values, count, mean, variance)
        print('')


def main(argv):
    lines = defaultdict(list)
    for filename in argv:
        for row in process_file(filename):
            line_id = '%(media)s_%(promoter)s_%(plate)s%(well)s' % row.info._asdict()
            lines[line_id].append(row)
    for line_id in sorted(lines.keys()):
        rows = lines[line_id]
        print(line_id)
        pprint.pprint(rows)


if __name__ == '__main__':
    main(sys.argv[1:])
