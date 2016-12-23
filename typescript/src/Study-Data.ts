/// <reference path="typescript-declarations.d.ts" />
/// <reference path="Utl.ts" />
/// <reference path="Dragboxes.ts" />
/// <reference path="DataGrid.ts" />
/// <reference path="EDDGraphingTools.ts" />
/// <reference path="../typings/d3/d3.d.ts"/>


declare var EDDData:EDDData;

namespace StudyDataPage {
    'use strict';

    var viewingMode;    // An enum: 'linegraph', 'bargraph', or 'table'
    var viewingModeIsStale:{[id:string]: boolean};
    var barGraphMode;    // an enum: 'time', 'line', 'measurement'

    export var progressiveFilteringWidget: ProgressiveFilteringWidget;
    var postFilteringAssays:any[];
    var postFilteringMeasurements:any[];

    var actionPanelRefreshTimer:any;
    var refresDataDisplayIfStaleTimer:any;

    var remakeMainGraphAreaCalls = 0;

    var colorObj:any;

    // Table spec and table objects, one each per Protocol, for Assays.
    var assaysDataGridSpec;
    export var assaysDataGrid;

    // Utility interface used by GenericFilterSection#updateUniqueIndexesHash
    export interface ValueToUniqueID {
        [index: string]: number;
    }
    export interface ValueToUniqueList {
        [index: string]: number[];
    }
    export interface UniqueIDToValue {
        [index: number]: string;
    }
    // Used in ProgressiveFilteringWidget#prepareFilteringSection
    export interface RecordIDToBoolean {
        [index: string]: boolean;
    }

    // For the filtering section on the main graph
    export class ProgressiveFilteringWidget {

        allFilters: GenericFilterSection[];
        assayFilters: GenericFilterSection[];
        // MeasurementGroupCode: Need to keep a separate filter list for each type.
        metaboliteFilters: GenericFilterSection[];
        proteinFilters: GenericFilterSection[];
        geneFilters: GenericFilterSection[];
        measurementFilters: GenericFilterSection[];
        metaboliteDataProcessed: boolean;
        proteinDataProcessed: boolean;
        geneDataProcessed: boolean;
        genericDataProcessed: boolean;
        filterTableJQ: JQuery;
        filteredAssayIDs: any;

        // MeasurementGroupCode: Need to initialize each filter list.
        constructor() {

            this.allFilters = [];
            this.assayFilters = [];
            this.metaboliteFilters = [];
            this.proteinFilters = [];
            this.geneFilters = [];
            this.measurementFilters = [];
            this.metaboliteDataProcessed = false;
            this.proteinDataProcessed = false;
            this.geneDataProcessed = false;
            this.genericDataProcessed = false;
            this.filterTableJQ = null;
        }

        // Read through the Lines, Assays, and AssayMeasurements structures to learn what types are present,
        // then instantiate the relevant subclasses of GenericFilterSection, to create a series of
        // columns for the filtering section under the main graph on the page.
        // This must be outside the constructor because EDDData.Lines and EDDData.Assays are not immediately available
        // on page load.
        // MeasurementGroupCode: Need to create and add relevant filters for each group.
        prepareFilteringSection(): void {

            var seenInLinesHash: RecordIDToBoolean = {};
            var seenInAssaysHash: RecordIDToBoolean = {};
            var aIDsToUse: string[] = [];

            this.filterTableJQ = $('<div>').addClass('filterTable');
            $('#mainFilterSection').append(this.filterTableJQ);

            // First do some basic sanity filtering on the list
            $.each(EDDData.Assays, (assayId: string, assay: any): void => {
                var line = EDDData.Lines[assay.lid];
                if (!assay.active || !line || !line.active) return;
                $.each(assay.meta || [], (metadataId) => { seenInAssaysHash[metadataId] = true; });
                $.each(line.meta || [], (metadataId) => { seenInLinesHash[metadataId] = true; });
                aIDsToUse.push(assayId);
            });

            // Create filters on assay tables
            // TODO media is now a metadata type, strain and carbon source should be too
            var assayFilters = [];
            assayFilters.push(new ProtocolFilterSection()); // Protocol
            assayFilters.push(new StrainFilterSection()); // first column in filtering section
            assayFilters.push(new LineNameFilterSection()); // LINE
            assayFilters.push(new CarbonSourceFilterSection());
            assayFilters.push(new CarbonLabelingFilterSection());
            assayFilters.push(new AssaySuffixFilterSection()); //Assasy suffix
            // convert seen metadata IDs to FilterSection objects, and push to end of assayFilters
            assayFilters.push.apply(assayFilters,
                $.map(seenInAssaysHash, (_, id: string) => new AssayMetaDataFilterSection(id)));
            assayFilters.push.apply(assayFilters,
                $.map(seenInLinesHash, (_, id: string) => new LineMetaDataFilterSection(id)));

            this.metaboliteFilters = [];
            this.metaboliteFilters.push(new MetaboliteCompartmentFilterSection());
            this.metaboliteFilters.push(new MetaboliteFilterSection());

            this.proteinFilters = [];
            this.proteinFilters.push(new ProteinFilterSection());

            this.geneFilters = [];
            this.geneFilters.push(new GeneFilterSection());

            this.measurementFilters = [];
            this.measurementFilters.push(new MeasurementFilterSection());

            // All filter sections are constructed; now need to call configure() on all
            this.allFilters = [].concat(
                assayFilters,
                this.metaboliteFilters,
                this.proteinFilters,
                this.geneFilters,
                this.measurementFilters);
            this.allFilters.forEach((section) => section.configure());

            // We can initialize all the Assay- and Line-level filters immediately
            this.assayFilters = assayFilters;
            assayFilters.forEach((filter) => {
                filter.populateFilterFromRecordIDs(aIDsToUse);
                filter.populateTable();
            });
            this.repopulateFilteringSection();
        }

        // Clear out any old filters in the filtering section, and add in the ones that
        // claim to be "useful".
        repopulateFilteringSection(): void {
            var dark:boolean = false;
            $.each(this.allFilters, (i, widget) => {
                if (widget.isFilterUseful()) {
                    widget.addToParent(this.filterTableJQ[0]);
                    widget.applyBackgroundStyle(dark);
                    dark = !dark;
                } else {
                    widget.detach();
                }
            });
        }

        // Given a set of measurement records and a dictionary of corresponding types
        // (passed down from the server as a result of a data request), sort them into
        // their various categories, then pass each category to their relevant filter objects
        // (possibly adding to the values in the filter) and refresh the UI for each filter.
        // MeasurementGroupCode: Need to process each group separately here.
        processIncomingMeasurementRecords(measures, types): void {

            var process: (ids: string[], i: number, widget: GenericFilterSection) => void;

            var filterIds = { 'm': [], 'p': [], 'g': [], '_': [] };
            // loop over all downloaded measurements. measures corresponds to AssayMeasurements
            $.each(measures || {}, (index, measurement) => {
                var assay = EDDData.Assays[measurement.assay], line, mtype;
                if (!assay || !assay.active) return;
                line = EDDData.Lines[assay.lid];
                if (!line || !line.active) return;
                mtype = types[measurement.type] || {};
                if (mtype.family === 'm') { // measurement is of metabolite
                    filterIds.m.push(measurement.id);
                } else if (mtype.family === 'p') { // measurement is of protein
                    filterIds.p.push(measurement.id);
                } else if (mtype.family === 'g') { // measurement is of gene / transcript
                    filterIds.g.push(measurement.id);
                } else {
                    // throw everything else in a general area
                    filterIds._.push(measurement.id);
                }
            });

            process = (ids: string[], i: number, widget: GenericFilterSection): void => {
                widget.populateFilterFromRecordIDs(ids);
                widget.populateTable();
            };
            if (filterIds.m.length) {
                $.each(this.metaboliteFilters, process.bind({}, filterIds.m));
                this.metaboliteDataProcessed = true;
            }
            if (filterIds.p.length) {
                $.each(this.proteinFilters, process.bind({}, filterIds.p));
                this.proteinDataProcessed = true;
            }
            if (filterIds.g.length) {
                $.each(this.geneFilters, process.bind({}, filterIds.g));
                this.geneDataProcessed = true;
            }
            if (filterIds._.length) {
                $.each(this.measurementFilters, process.bind({}, filterIds._));
                this.genericDataProcessed = true;
            }
            this.repopulateFilteringSection();
        }

        // Build a list of all the non-disabled Assay IDs in the Study.
        buildAssayIDSet(): any[] {
            var assayIds: any[] = [];
            $.each(EDDData.Assays, (assayId, assay) => {
                var line = EDDData.Lines[assay.lid];
                if (!assay.active || !line || !line.active) return;
                assayIds.push(assayId);

            });
            return assayIds;
        }

        // Starting with a list of all the non-disabled Assay IDs in the Study, we loop it through the
        // Line and Assay-level filters, causing the filters to refresh their UI, narrowing the set down.
        // We resolve the resulting set of Assay IDs into measurement IDs, then pass them on to the
        // measurement-level filters.  In the end we return a set of measurement IDs representing the
        // end result of all the filters, suitable for passing to the graphing functions.
        // MeasurementGroupCode: Need to process each group separately here.
        buildFilteredMeasurements(): any[] {
            var filteredAssayIds = this.buildAssayIDSet();

            $.each(this.assayFilters, (i, filter) => {
                filteredAssayIds = filter.applyProgressiveFiltering(filteredAssayIds);
            });

            var measurementIds: any[] = [];
            $.each(filteredAssayIds, (i, assayId) => {
                var assay = EDDData.Assays[assayId];
                $.merge(measurementIds, assay.measures || []);
            });

            // We start out with four references to the array of available measurement IDs, one for each major category.
            // Each of these will become its own array in turn as we narrow it down.
            // This is to prevent a sub-selection in one category from overriding a sub-selection in the others.

            var metaboliteMeasurements = measurementIds;
            var proteinMeasurements = measurementIds;
            var geneMeasurements = measurementIds;
            var genericMeasurements = measurementIds;

            // Note that we only try to filter if we got measurements that apply to the widget types

            if (this.metaboliteDataProcessed) {
                $.each(this.metaboliteFilters, (i, filter) => {
                    metaboliteMeasurements = filter.applyProgressiveFiltering(metaboliteMeasurements);
                });
            }
            if (this.proteinDataProcessed) {
                $.each(this.proteinFilters, (i, filter) => {
                    proteinMeasurements = filter.applyProgressiveFiltering(proteinMeasurements);
                });
            }
            if (this.geneDataProcessed) {
                $.each(this.geneFilters, (i, filter) => {
                    geneMeasurements = filter.applyProgressiveFiltering(geneMeasurements);
                });
            }
            if (this.genericDataProcessed) {
                $.each(this.measurementFilters, (i, filter) => {
                    genericMeasurements = filter.applyProgressiveFiltering(genericMeasurements);
                });
            }

            // Once we've finished with the filtering, we want to see if any sub-selections have been made across
            // any of the categories, and if so, merge those sub-selections into one.

            // The idea is, we display everything until the user makes a selection in one or more of the main categories,
            // then drop everything from the categories that contain no selections.

            // An example scenario will explain why this is important:

            // Say a user is presented with two categories, Metabolite and Measurement.
            // Metabolite has criteria 'Acetate' and 'Ethanol' available.
            // Measurement has only one criteria available, 'Optical Density'.
            // By default, Acetate, Ethanol, and Optical Density are all unchecked, and all visible on the graph.
            // This is equivalent to 'return measurements' below.

            // If the user checks 'Acetate', they expect only Acetate to be displayed, even though no change has been made to
            // the Measurement section where Optical Density is listed.
            // In the code below, by testing for any checked boxes in the metaboliteFilters filters,
            // we realize that the selection has been narrowed down, so we append the Acetate measurements onto dSM.
            // Then when we check the measurementFilters filters, we see that the Measurement section has
            // not narrowed down its set of measurements, so we skip appending those to dSM.
            // The end result is only the Acetate measurements.

            // Then suppose the user checks 'Optical Density', intending to compare Acetate directly against Optical Density.
            // Since measurementFilters now has checked boxes, we push its measurements onto dSM,
            // where it combines with the Acetate.

            var anyChecked = (filter: GenericFilterSection): boolean => { return filter.anyCheckboxesChecked; };

            var dSM: any[] = [];    // "Deliberately selected measurements"
            if ( this.metaboliteFilters.some(anyChecked)) { dSM = dSM.concat(metaboliteMeasurements); }
            if (    this.proteinFilters.some(anyChecked)) { dSM = dSM.concat(proteinMeasurements); }
            if (       this.geneFilters.some(anyChecked)) { dSM = dSM.concat(geneMeasurements); }
            if (this.measurementFilters.some(anyChecked)) { dSM = dSM.concat(genericMeasurements); }
            if (dSM.length) {
                return dSM;
            }
            return measurementIds;
        }

        // redraw graph with new measurement types.
        checkRedrawRequired(force?: boolean): boolean {
            var redraw:boolean = !!force;
            // Walk down the filter widget list.  If we encounter one whose collective checkbox
            // state has changed since we last made this walk, then a redraw is required. Note that
            // we should not skip this loop, even if we already know a redraw is required, since the
            // call to anyCheckboxesChangedSinceLastInquiry sets internal state in the filter
            // widgets that we will use next time around.
            $.each(this.allFilters, (i, filter) => {
                if (filter.anyCheckboxesChangedSinceLastInquiry()) {
                    redraw = true;
                }
            });
            return redraw;
        }
    }

    // A generic version of a filtering column in the filtering section beneath the graph area on the page,
    // meant to be subclassed for specific criteria.
    // When initialized with a set of record IDs, the column is filled with labeled checkboxes, one for each
    // unique value of the given criteria encountered in the records.
    // During use, another set of record IDs is passed in, and if any checkboxes are checked, the ID set is
    // narrowed down to only those records that contain the checked values.
    // Checkboxes whose values are not represented anywhere in the given IDs are temporarily disabled,
    // visually indicating to a user that those values are not available for further filtering.
    // The filters are meant to be called in sequence, feeding each returned ID set into the next,
    // progressively narrowing down the enabled checkboxes.
    // MeasurementGroupCode: Need to subclass this for each group type.
    export class GenericFilterSection {

        // A dictionary of the unique values found for filtering against, and the dictionary's complement.
        // Each unique ID is an integer, ascending from 1, in the order the value was first encountered
        // when examining the record data in updateUniqueIndexesHash.
        uniqueValues: UniqueIDToValue;
        uniqueIndexes: ValueToUniqueID;
        uniqueIndexCounter: number;

        // The sorted order of the list of unique values found in the filter
        uniqueValuesOrder: number[];

        // A dictionary resolving a record ID (assay ID, measurement ID) to an array. Each array
        // contains the integer identifiers of the unique values that apply to that record.
        // (It's rare, but there can actually be more than one criteria that matches a given ID,
        //  for example a Line with two feeds assigned to it.)
        filterHash: ValueToUniqueList;
        // Dictionary resolving the filter value integer identifiers to HTML Input checkboxes.
        checkboxes: {[index: number]: JQuery};
        // Dictionary used to compare checkboxes with a previous state to determine whether an
        // update is required. Values are 'C' for checked, 'U' for unchecked, and 'N' for not
        // existing at the time. ('N' can be useful when checkboxes are removed from a filter due to
        // the back-end data changing.)
        previousCheckboxState: UniqueIDToValue;
        // Dictionary resolving the filter value integer identifiers to HTML table row elements.
        tableRows: {[index: number]: HTMLTableRowElement};

        // References to HTML elements created by the filter
        filterColumnDiv: HTMLElement;
        clearIcons: JQuery;
        plaintextTitleDiv: HTMLElement;
        searchBox: HTMLInputElement;
        searchBoxTitleDiv: HTMLElement;
        scrollZoneDiv: HTMLElement;
        filteringTable: JQuery;
        tableBodyElement: HTMLTableElement;

        // Search box related
        typingTimeout: number;
        typingDelay: number;
        currentSearchSelection: string;
        previousSearchSelection: string;
        minCharsToTriggerSearch: number;

        anyCheckboxesChecked: boolean;

        sectionTitle: string;
        sectionShortLabel: string;

        // TODO: Convert to a protected constructor! Then use a factory method to create objects
        //    with configure() already called. Typescript 1.8 does not support visibility
        //    modifiers on constructors, support is added in Typescript 2.0
        constructor() {
            this.uniqueValues = {};
            this.uniqueIndexes = {};
            this.uniqueIndexCounter = 0;
            this.uniqueValuesOrder = [];
            this.filterHash = {};
            this.previousCheckboxState = {};

            this.typingTimeout = null;
            this.typingDelay = 330;    // TODO: Not implemented
            this.currentSearchSelection = '';
            this.previousSearchSelection = '';
            this.minCharsToTriggerSearch = 1;
            this.anyCheckboxesChecked = false;
        }

        configure(title: string='Generic Filter', shortLabel: string='gf'): void {
            this.sectionTitle = title;
            this.sectionShortLabel = shortLabel;
            this.createContainerObjects();
        }

        // Create all the container HTML objects
        createContainerObjects(): void {
            var sBoxID: string = 'filter' + this.sectionShortLabel + 'SearchBox',
                sBox: HTMLInputElement;
            this.filterColumnDiv = $("<div>").addClass('filterColumn')[0];
            var textTitle = $("<span>").addClass('filterTitle').text(this.sectionTitle);
            var clearIcon = $("<span>").addClass('filterClearIcon');
            this.plaintextTitleDiv = $("<div>").addClass('filterHead').append(clearIcon).append(textTitle)[0];

            $(sBox = document.createElement("input"))
                .attr({
                    'id': sBoxID,
                    'name': sBoxID,
                    'placeholder': this.sectionTitle,
                    'size': 14
                });
            sBox.setAttribute('type', 'text'); // JQuery .attr() cannot set this
            this.searchBox = sBox;
            // We need two clear iccons for the two versions of the header
            var searchClearIcon = $("<span>").addClass('filterClearIcon');
            this.searchBoxTitleDiv = $("<div>").addClass('filterHeadSearch').append(searchClearIcon).append(sBox)[0];

            this.clearIcons = clearIcon.add(searchClearIcon);    // Consolidate the two JQuery elements into one

            this.clearIcons.on('click', (ev) => {
                // Changing the checked status will automatically trigger a refresh event
                $.each(this.checkboxes || {}, (id: number, checkbox: JQuery) => {
                    checkbox.prop('checked', false);
                });
                return false;
            });
            this.scrollZoneDiv = $("<div>").addClass('filterCriteriaScrollZone')[0];
            this.filteringTable = $("<table>")
                .addClass('filterCriteriaTable dragboxes')
                .attr({ 'cellpadding': 0, 'cellspacing': 0 })
                .append(this.tableBodyElement = <HTMLTableElement>$("<tbody>")[0]);
        }

        populateFilterFromRecordIDs(ids: string[]): void {
            var usedValues: ValueToUniqueID, crSet: number[], cHash: UniqueIDToValue,
                previousIds: string[];
            // can get IDs from multiple assays, first merge with this.filterHash
            previousIds = $.map(this.filterHash || {}, (_, previousId: string) => previousId);
            ids.forEach((addedId: string): void => { this.filterHash[addedId] = []; });
            ids = $.map(this.filterHash || {}, (_, previousId: string) => previousId);
            // skip over building unique values and sorting when no new IDs added
            if (ids.length > previousIds.length) {
                this.updateUniqueIndexesHash(ids);
                crSet = [];
                cHash = {};
                // Create a reversed hash so keys map values and values map keys
                $.each(this.uniqueIndexes, (value: string, uniqueID: number): void => {
                    cHash[uniqueID] = value;
                    crSet.push(uniqueID);
                });
                // Alphabetically sort an array of the keys according to values
                crSet.sort((a: number, b: number): number => {
                    var _a:string = cHash[a].toLowerCase();
                    var _b:string = cHash[b].toLowerCase();
                    return _a < _b ? -1 : _a > _b ? 1 : 0;
                });
                this.uniqueValues = cHash;
                this.uniqueValuesOrder = crSet;
            }
        }

        // In this function are running through the given list of measurement IDs and examining
        // their records and related records, locating the particular field we are interested in,
        // and creating a list of all the unique values for that field.  As we go, we mark each
        // unique value with an integer UID, and construct a hash resolving each record to one (or
        // possibly more) of those integer UIDs.  This prepares us for quick filtering later on.
        // (This generic filter does nothing, so we leave these structures blank.)
        updateUniqueIndexesHash(ids: string[]): void {
            this.filterHash = this.filterHash || {};
            this.uniqueIndexes = this.uniqueIndexes || {};
        }

        // If we didn't come up with 2 or more criteria, there is no point in displaying the filter.
        isFilterUseful():boolean {
            if (this.uniqueValuesOrder.length < 2) {
                return false;
            }
            return true;
        }

        addToParent(parentDiv):void {
            parentDiv.appendChild(this.filterColumnDiv);
        }

        detach():void {
            $(this.filterColumnDiv).detach();
        }

        applyBackgroundStyle(darker:boolean):void {
            $(this.filterColumnDiv).removeClass(darker ? 'stripeRowB' : 'stripeRowA');
            $(this.filterColumnDiv).addClass(darker ? 'stripeRowA' : 'stripeRowB');
        }

        // Runs through the values in uniqueValuesOrder, adding a checkbox and label for each
        // filtering value represented.  If there are more than 15 values, the filter gets
        // a search box and scrollbar.
        populateTable():void {
            var fCol = $(this.filterColumnDiv);
            fCol.children().detach();
            // Only use the scrolling container div if the size of the list warrants it, because
            // the scrolling container div declares a large padding margin for the scroll bar,
            // and that padding margin would be an empty waste of space otherwise.
            if (this.uniqueValuesOrder.length > 15) {
                fCol.append(this.searchBoxTitleDiv).append(this.scrollZoneDiv);
                // Change the reference so we're affecting the innerHTML of the correct div later on
                fCol = $(this.scrollZoneDiv);
            } else {
                fCol.append(this.plaintextTitleDiv);
            }
            fCol.append(this.filteringTable);

            var tBody = this.tableBodyElement;
            // Clear out any old table contents
            $(this.tableBodyElement).empty();

            this.tableRows = {};
            this.checkboxes = {};

            // line label color based on graph color of line
            if (this.sectionTitle === "Line") {    // TODO: Find a better way to identify this section
                var colors:any = {};

                //create new colors object with line names a keys and color hex as values
                for (var key in EDDData.Lines) {
                    colors[EDDData.Lines[key].name] = colorObj[key];
                }

                this.uniqueValuesOrder.forEach((uniqueId: number): void => {
                var cboxName, cell, p, q, r;
                cboxName = ['filter', this.sectionShortLabel, 'n', uniqueId, 'cbox'].join('');
                this.tableRows[uniqueId] = <HTMLTableRowElement>this.tableBodyElement.insertRow();
                cell = this.tableRows[uniqueId].insertCell();
                this.checkboxes[uniqueId] = $("<input type='checkbox'>")
                    .attr({ 'name': cboxName, 'id': cboxName })
                    .appendTo(cell);

                for (var key in EDDData.Lines) {
                    if (EDDData.Lines[key].name == this.uniqueValues[uniqueId]) {
                       (EDDData.Lines[key]['identifier'] = cboxName)
                    }
                }

                $('<label>').attr('for', cboxName).text(this.uniqueValues[uniqueId])
                    .css('font-weight', 'Bold').appendTo(cell);
                });

            } else {
                this.uniqueValuesOrder.forEach((uniqueId: number): void => {
                    var cboxName, cell, p, q, r;
                    cboxName = ['filter', this.sectionShortLabel, 'n', uniqueId, 'cbox'].join('');
                    this.tableRows[uniqueId] = <HTMLTableRowElement>this.tableBodyElement.insertRow();
                    cell = this.tableRows[uniqueId].insertCell();
                    this.checkboxes[uniqueId] = $("<input type='checkbox'>")
                        .attr({ 'name': cboxName, 'id': cboxName })
                        .appendTo(cell);

                    $('<label>').attr('for', cboxName).text(this.uniqueValues[uniqueId])
                        .appendTo(cell);
                });
            }
            // TODO: Drag select is twitchy - clicking a table cell background should check the box,
            // even if the user isn't hitting the label or the checkbox itself.
            Dragboxes.initTable(this.filteringTable);
        }

        // Returns true if any of the checkboxes show a different state than when this function was
        // last called
        anyCheckboxesChangedSinceLastInquiry():boolean {
            var changed:boolean = false,
                currentCheckboxState: UniqueIDToValue = {},
                v: string = $(this.searchBox).val();
            this.anyCheckboxesChecked = false;
            $.each(this.checkboxes || {}, (uniqueId: number, checkbox: JQuery) => {
                var current, previous;
                // "C" - checked, "U" - unchecked, "N" - doesn't exist
                current = (checkbox.prop('checked') && !checkbox.prop('disabled')) ? 'C' : 'U';
                previous = this.previousCheckboxState[uniqueId] || 'N';
                if (current !== previous) changed = true;
                if (current === 'C') this.anyCheckboxesChecked = true;
                currentCheckboxState[uniqueId] = current;
            });
            this.clearIcons.toggleClass('enabled', this.anyCheckboxesChecked);

            v = v.trim();                // Remove leading and trailing whitespace
            v = v.toLowerCase();
            v = v.replace(/\s\s*/, ' '); // Replace internal whitespace with single spaces
            this.currentSearchSelection = v;
            if (v !== this.previousSearchSelection) {
                this.previousSearchSelection = v;
                changed = true;
            }

            if (!changed) {
                // If we haven't detected any change so far, there is one more angle to cover:
                // Checkboxes that used to exist, but have since been removed from the set.
                $.each(this.previousCheckboxState, (rowId) => {
                    if (currentCheckboxState[rowId] === undefined) {
                        changed = true;
                        return false;
                    }
                });
            }
            this.previousCheckboxState = currentCheckboxState;
            return changed;
        }

        // Takes a set of record IDs, and if any checkboxes in the filter's UI are checked,
        // the ID set is narrowed down to only those records that contain the checked values.
        // Checkboxes whose values are not represented anywhere in the given IDs are temporarily disabled
        // and sorted to the bottom of the list, visually indicating to a user that those values are not
        // available for further filtering.
        // The narrowed set of IDs is then returned, for use by the next filter.
        applyProgressiveFiltering(ids:any[]):any {

            // If the filter only contains one item, it's pointless to apply it.
            if (!this.isFilterUseful()) {
                return ids;
            }

            var idsPostFiltering: any[];

            var useSearchBox:boolean = false;
            var queryStrs = [];

            var v = this.currentSearchSelection;
            if (v != null) {
                if (v.length >= this.minCharsToTriggerSearch) {
                    // If there are multiple words, we match each separately.
                    // We will not attempt to match against empty strings, so we filter those out if
                    // any slipped through.
                    queryStrs = v.split(/\s+/).filter((one) => { return one.length > 0; });
                    // The user might have pasted/typed only whitespace, so:
                    if (queryStrs.length > 0) {
                        useSearchBox = true;
                    }
                }
            }

            var valuesVisiblePreFiltering = {};

            var indexIsVisible = (index):boolean => {
                var match:boolean = true, text:string;
                if (useSearchBox) {
                    text = this.uniqueValues[index].toLowerCase();
                    match = queryStrs.some((v) => {
                        return text.length >= v.length && text.indexOf(v) >= 0;
                    });
                }
                if (match) {
                    valuesVisiblePreFiltering[index] = 1;
                    if ((this.previousCheckboxState[index] === 'C') || !this.anyCheckboxesChecked) {
                        return true;
                    }
                }
                return false;
            };

            idsPostFiltering = ids.filter((id) => {
                // If we have filtering data for this id, use it.
                // If we don't, the id probably belongs to some other measurement category,
                // so we ignore it.
                if (this.filterHash[id]) {
                    return this.filterHash[id].some(indexIsVisible);
                }
                return false;
            });

            // Create a document fragment, and accumulate inside it all the rows we want to display, in sorted order.
            var frag = document.createDocumentFragment();

            var rowsToAppend = [];
            this.uniqueValuesOrder.forEach((crID) => {
                var checkbox: JQuery = this.checkboxes[crID],
                    row: HTMLTableRowElement = this.tableRows[crID],
                    show: boolean = !!valuesVisiblePreFiltering[crID];
                checkbox.prop('disabled', !show)
                $(row).toggleClass('nodata', !show);
                if (show) {
                    frag.appendChild(row);
                } else {
                    rowsToAppend.push(row);
                }
            });
            // Now, append all the rows we disabled, so they go to the bottom of the table
            rowsToAppend.forEach((row) => frag.appendChild(row));

            // Remember that we last sorted by this column
            this.tableBodyElement.appendChild(frag);

            return idsPostFiltering;
        }

        _assayIdToAssay(assayId:string) {
            return EDDData.Assays[assayId];
        }
        _assayIdToLine(assayId:string) {
            var assay = this._assayIdToAssay(assayId);
            if (assay) return EDDData.Lines[assay.lid];
            return undefined;
        }
        _assayIdToProtocol(assayId:string): ProtocolRecord {
            var assay = this._assayIdToAssay(assayId);
            if (assay) return EDDData.Protocols[assay.pid];
            return undefined;
        }

        getIdMapToValues():(id:string) => any[] {
            return () => [];
        }
    }

    export class StrainFilterSection extends GenericFilterSection {
        configure():void {
            super.configure('Strain', 'st');
        }

        updateUniqueIndexesHash(ids: string[]): void {
            this.uniqueIndexes = this.uniqueIndexes || {};
            this.filterHash = this.filterHash || {};
            ids.forEach((assayId: string) => {
                var line:any = this._assayIdToLine(assayId) || {};
                this.filterHash[assayId] = this.filterHash[assayId] || [];
                // assign unique ID to every encountered strain name
                (line.strain || []).forEach((strainId: string): void => {
                    var strain = EDDData.Strains[strainId];
                    if (strain && strain.name) {
                        this.uniqueIndexes[strain.name] = this.uniqueIndexes[strain.name] || ++this.uniqueIndexCounter;
                        this.filterHash[assayId].push(this.uniqueIndexes[strain.name]);
                    }
                });
            });
        }
    }

    export class CarbonSourceFilterSection extends GenericFilterSection {
        configure():void {
            super.configure('Carbon Source', 'cs');
        }

        updateUniqueIndexesHash(ids: string[]): void {
            this.uniqueIndexes = this.uniqueIndexes || {};
            this.filterHash = this.filterHash || {};
            ids.forEach((assayId:string) => {
                var line:any = this._assayIdToLine(assayId) || {};
                this.filterHash[assayId] = this.filterHash[assayId] || [];
                // assign unique ID to every encountered carbon source name
                (line.carbon || []).forEach((carbonId:string) => {
                    var src = EDDData.CSources[carbonId];
                    if (src && src.name) {
                        this.uniqueIndexes[src.name] = this.uniqueIndexes[src.name] || ++this.uniqueIndexCounter;
                        this.filterHash[assayId].push(this.uniqueIndexes[src.name]);
                    }
                });
            });
        }
    }

    export class CarbonLabelingFilterSection extends GenericFilterSection {
        configure():void {
            super.configure('Labeling', 'l');
        }

        updateUniqueIndexesHash(ids: string[]): void {
            this.uniqueIndexes = this.uniqueIndexes || {};
            this.filterHash = this.filterHash || {};
            ids.forEach((assayId:string) => {
                var line:any = this._assayIdToLine(assayId) || {};
                this.filterHash[assayId] = this.filterHash[assayId] || [];
                // assign unique ID to every encountered carbon source labeling description
                (line.carbon || []).forEach((carbonId:string) => {
                    var src = EDDData.CSources[carbonId];
                    if (src && src.labeling) {
                        this.uniqueIndexes[src.labeling] = this.uniqueIndexes[src.labeling] || ++this.uniqueIndexCounter;
                        this.filterHash[assayId].push(this.uniqueIndexes[src.labeling]);
                    }
                });
            });
        }
    }

    export class LineNameFilterSection extends GenericFilterSection {
        configure():void {
            super.configure('Line', 'ln');
        }

        updateUniqueIndexesHash(ids: string[]): void {
            this.uniqueIndexes = this.uniqueIndexes || {};
            this.filterHash = this.filterHash || {};
            ids.forEach((assayId:string) => {
                var line:any = this._assayIdToLine(assayId) || {};
                this.filterHash[assayId] = this.filterHash[assayId] || [];
                if (line.name) {
                    this.uniqueIndexes[line.name] = this.uniqueIndexes[line.name] || ++this.uniqueIndexCounter;
                    this.filterHash[assayId].push(this.uniqueIndexes[line.name]);
                }
            });
        }
    }

    export class ProtocolFilterSection extends GenericFilterSection {
        configure():void {
            super.configure('Protocol', 'p');
        }

        updateUniqueIndexesHash(ids: string[]): void {
            this.uniqueIndexes = this.uniqueIndexes || {};
            this.filterHash = this.filterHash || {};
            ids.forEach((assayId:string) => {
                var protocol: ProtocolRecord = this._assayIdToProtocol(assayId);
                this.filterHash[assayId] = this.filterHash[assayId] || [];
                if (protocol && protocol.name) {
                    this.uniqueIndexes[protocol.name] = this.uniqueIndexes[protocol.name] || ++this.uniqueIndexCounter;
                    this.filterHash[assayId].push(this.uniqueIndexes[protocol.name]);
                }
            });
        }
    }

    export class AssaySuffixFilterSection extends GenericFilterSection {
        configure():void {
            super.configure('Assay Suffix', 'a');
        }

        updateUniqueIndexesHash(ids: string[]): void {
            this.uniqueIndexes = this.uniqueIndexes || {};
            this.filterHash = this.filterHash || {};
            ids.forEach((assayId:string) => {
                var assay = this._assayIdToAssay(assayId) || {};
                this.filterHash[assayId] = this.filterHash[assayId] || [];
                if (assay.name) {
                    this.uniqueIndexes[assay.name] = this.uniqueIndexes[assay.name] || ++this.uniqueIndexCounter;
                    this.filterHash[assayId].push(this.uniqueIndexes[assay.name]);
                }
            });
        }
    }

    export class MetaDataFilterSection extends GenericFilterSection {

        metaDataID:string;
        pre:string;
        post:string;

        constructor(metaDataID:string) {
            super();
            var MDT = EDDData.MetaDataTypes[metaDataID];
            this.metaDataID = metaDataID;
            this.pre = MDT.pre || '';
            this.post = MDT.post || '';
        }

        configure():void {
            super.configure(EDDData.MetaDataTypes[this.metaDataID].name, 'md'+this.metaDataID);
        }
    }

    export class LineMetaDataFilterSection extends MetaDataFilterSection {

        updateUniqueIndexesHash(ids: string[]): void {
            this.uniqueIndexes = this.uniqueIndexes || {};
            this.filterHash = this.filterHash || {};
            ids.forEach((assayId:string) => {
                var line: any = this._assayIdToLine(assayId) || {}, value = '(Empty)';
                this.filterHash[assayId] = this.filterHash[assayId] || [];
                if (line.meta && line.meta[this.metaDataID]) {
                    value = [ this.pre, line.meta[this.metaDataID], this.post ].join(' ').trim();
                }
                this.uniqueIndexes[value] = this.uniqueIndexes[value] || ++this.uniqueIndexCounter;
                this.filterHash[assayId].push(this.uniqueIndexes[value]);
            });
        }
    }

    export class AssayMetaDataFilterSection extends MetaDataFilterSection {

        updateUniqueIndexesHash(ids: string[]): void {
            this.uniqueIndexes = this.uniqueIndexes || {};
            this.filterHash = this.filterHash || {};
            ids.forEach((assayId:string) => {
                var assay: any = this._assayIdToAssay(assayId) || {}, value = '(Empty)';
                this.filterHash[assayId] = this.filterHash[assayId] || [];
                if (assay.meta && assay.meta[this.metaDataID]) {
                    value = [ this.pre, assay.meta[this.metaDataID], this.post ].join(' ').trim();
                }
                this.uniqueIndexes[value] = this.uniqueIndexes[value] || ++this.uniqueIndexCounter;
                this.filterHash[assayId].push(this.uniqueIndexes[value]);
            });
        }
    }

    export class MetaboliteCompartmentFilterSection extends GenericFilterSection {
        // NOTE: this filter class works with Measurement IDs rather than Assay IDs
        configure():void {
            super.configure('Compartment', 'com');
        }

        updateUniqueIndexesHash(amIDs: string[]): void {
            this.uniqueIndexes = this.uniqueIndexes || {};
            this.filterHash = this.filterHash || {};
            amIDs.forEach((measureId:string) => {
                var measure: any = EDDData.AssayMeasurements[measureId] || {}, value: any;
                this.filterHash[measureId] = this.filterHash[measureId] || [];
                value = EDDData.MeasurementTypeCompartments[measure.compartment] || {};
                if (value && value.name) {
                    this.uniqueIndexes[value.name] = this.uniqueIndexes[value.name] || ++this.uniqueIndexCounter;
                    this.filterHash[measureId].push(this.uniqueIndexes[value.name]);
                }
            });
        }
    }

    export class MeasurementFilterSection extends GenericFilterSection {
        // NOTE: this filter class works with Measurement IDs rather than Assay IDs
        loadPending: boolean;

        configure(): void {
            this.loadPending = true;
            super.configure('Measurement', 'mm');
        }

        isFilterUseful(): boolean {
            return this.loadPending || this.uniqueValuesOrder.length > 0;
        }

        updateUniqueIndexesHash(mIds: string[]): void {
            this.uniqueIndexes = this.uniqueIndexes || {};
            this.filterHash = this.filterHash || {};
            mIds.forEach((measureId: string): void => {
                var measure: any = EDDData.AssayMeasurements[measureId] || {};
                var mType: any;
                this.filterHash[measureId] = this.filterHash[measureId] || [];
                if (measure && measure.type) {
                    mType = EDDData.MeasurementTypes[measure.type] || {};
                    if (mType && mType.name) {
                        this.uniqueIndexes[mType.name] = this.uniqueIndexes[mType.name] || ++this.uniqueIndexCounter;
                        this.filterHash[measureId].push(this.uniqueIndexes[mType.name]);
                    }
                }
            });
            this.loadPending = false;
        }
    }

    export class MetaboliteFilterSection extends GenericFilterSection {
        // NOTE: this filter class works with Measurement IDs rather than Assay IDs
        loadPending:boolean;

        configure():void {
            this.loadPending = true;
            super.configure('Metabolite', 'me');
        }

        // Override: If the filter has a load pending, it's "useful", i.e. display it.
        isFilterUseful(): boolean {
            return this.loadPending || this.uniqueValuesOrder.length > 0;
        }

        updateUniqueIndexesHash(amIDs: string[]): void {
            this.uniqueIndexes = this.uniqueIndexes || {};
            this.filterHash = this.filterHash || {};
            amIDs.forEach((measureId:string) => {
                var measure: any = EDDData.AssayMeasurements[measureId] || {}, metabolite: any;
                this.filterHash[measureId] = this.filterHash[measureId] || [];
                if (measure && measure.type) {
                    metabolite = EDDData.MetaboliteTypes[measure.type] || {};
                    if (metabolite && metabolite.name) {
                        this.uniqueIndexes[metabolite.name] = this.uniqueIndexes[metabolite.name] || ++this.uniqueIndexCounter;
                        this.filterHash[measureId].push(this.uniqueIndexes[metabolite.name]);
                    }
                }
            });
            // If we've been called to build our hashes, assume there's no load pending
            this.loadPending = false;
        }
    }

    export class ProteinFilterSection extends GenericFilterSection {
        // NOTE: this filter class works with Measurement IDs rather than Assay IDs
        loadPending:boolean;

        configure():void {
            this.loadPending = true;
            super.configure('Protein', 'pr');
        }

        // Override: If the filter has a load pending, it's "useful", i.e. display it.
        isFilterUseful():boolean {
            return this.loadPending || this.uniqueValuesOrder.length > 0;
        }

        updateUniqueIndexesHash(amIDs: string[]): void {
            this.uniqueIndexes = this.uniqueIndexes || {};
            this.filterHash = this.filterHash || {};
            amIDs.forEach((measureId:string) => {
                var measure: any = EDDData.AssayMeasurements[measureId] || {}, protein: any;
                this.filterHash[measureId] = this.filterHash[measureId] || [];
                if (measure && measure.type) {
                    protein = EDDData.ProteinTypes[measure.type] || {};
                    if (protein && protein.name) {
                        this.uniqueIndexes[protein.name] = this.uniqueIndexes[protein.name] || ++this.uniqueIndexCounter;
                        this.filterHash[measureId].push(this.uniqueIndexes[protein.name]);
                    }
                }
            });
            // If we've been called to build our hashes, assume there's no load pending
            this.loadPending = false;
        }
    }

    export class GeneFilterSection extends GenericFilterSection {
        // NOTE: this filter class works with Measurement IDs rather than Assay IDs
        loadPending:boolean;

        configure():void {
            this.loadPending = true;
            super.configure('Gene', 'gn');
        }

        // Override: If the filter has a load pending, it's "useful", i.e. display it.
        isFilterUseful():boolean {
            return this.loadPending || this.uniqueValuesOrder.length > 0;
        }

        updateUniqueIndexesHash(amIDs: string[]): void {
            this.uniqueIndexes = this.uniqueIndexes || {};
            this.filterHash = this.filterHash || {};
            amIDs.forEach((measureId:string) => {
                var measure: any = EDDData.AssayMeasurements[measureId] || {}, gene: any;
                this.filterHash[measureId] = this.filterHash[measureId] || [];
                if (measure && measure.type) {
                    gene = EDDData.GeneTypes[measure.type] || {};
                    if (gene && gene.name) {
                        this.uniqueIndexes[gene.name] = this.uniqueIndexes[gene.name] || ++this.uniqueIndexCounter;
                        this.filterHash[measureId].push(this.uniqueIndexes[gene.name]);
                    }
                }
            });
            // If we've been called to build our hashes, assume there's no load pending
            this.loadPending = false;
        }
    }


    // Called when the page loads.
    export function prepareIt() {

        this.progressiveFilteringWidget = new ProgressiveFilteringWidget();
        postFilteringAssays = [];
        postFilteringMeasurements = [];

        // By default, we always show the graph
        viewingMode = 'linegraph';
        barGraphMode = 'time';
        // Start out with every display mode needing a refresh
        viewingModeIsStale = {
            'linegraph': true,
            'bargraph': true,
            'table': true
        };
        refresDataDisplayIfStaleTimer = null;

        colorObj = null;

        assaysDataGridSpec = null;
        assaysDataGrid = null;

        actionPanelRefreshTimer = null;

        // This only adds code that turns the other buttons off when a button is made active,
        // and does the same to elements named in the 'for' attributes of each button.
        // We still need to add our own responders to actually do stuff.
        Utl.ButtonBar.prepareButtonBars();

        $("#dataTableButton").click(function() {
            viewingMode = 'table';
            $("#tableActionButtons").removeClass('off');
            $("#barGraphTypeButtons").addClass('off');
            queueRefreshDataDisplayIfStale();
        });
        // This one is active by default
        $("#lineGraphButton").click(function() {
            viewingMode = 'linegraph';
            $("#tableActionButtons").addClass('off');
            $("#barGraphTypeButtons").addClass('off');
            $('#lineGraph').removeClass('off');
            $('#barGraphByTime').addClass('off');
            $('#barGraphByLine').addClass('off');
            $('#barGraphByMeasurement').addClass('off');
            queueRefreshDataDisplayIfStale();
        });
        $('#barGraphButton').one("click", function () {
            $('#graphLoading').removeClass('off');
        });
        $('#timeBarGraphButton').one("click", function () {
            $('#graphLoading').removeClass('off');
        });
        $('#lineBarGraphButton').one("click", function () {
            $('#graphLoading').removeClass('off');
        });
        $('#measurementBarGraphButton').one("click", function () {
            $('#graphLoading').removeClass('off');
        });
        $("#barGraphButton").click(function() {
            viewingMode = 'bargraph';
            $("#tableActionButtons").addClass('off');
            $("#barGraphTypeButtons").removeClass('off');
            $('#lineGraph').addClass('off');
            $('#barGraphByTime').addClass('off');
            $('#barGraphByLine').addClass('off');
            $('#barGraphByMeasurement').addClass('off');
            if (barGraphMode == 'time') {
                $('#barGraphByTime').removeClass('off');
            } else if (barGraphMode == 'line') {
                $('#barGraphByLine').removeClass('off');
            } else {
                $('#barGraphByMeasurement').removeClass('off');
            }
            queueRefreshDataDisplayIfStale();
        });
        $("#timeBarGraphButton").click(function() {
            barGraphMode = 'time';
            queueRefreshDataDisplayIfStale();
             $('#graphLoading').addClass('off');
        });
        $("#lineBarGraphButton").click(function() {
            barGraphMode = 'line';
            queueRefreshDataDisplayIfStale();
        });
        $("#measurementBarGraphButton").click(function() {
            $('#graphLoading').removeClass('off');
            barGraphMode = 'measurement';
            queueRefreshDataDisplayIfStale();
        });

        // Set up the Add Measurement to Assay modal
        var dlg = $("#addMeasurement").dialog({
           autoOpen: false
        });
        $("#addMeasurementButton").click(function() {
           $("#addMeasurement").dialog( "open" );
            return false;
        });

        // Callbacks to respond to the filtering section
        $('#mainFilterSection').on('mouseover mousedown mouseup', this.queueRefreshDataDisplayIfStale.bind(this, false))
            .on('keydown', filterTableKeyDown.bind(this));

        $.ajax({
            'url': 'edddata/',
            'type': 'GET',
            'error': (xhr, status, e) => {
                $('#content').prepend("<div class='noData'>Error. Please reload</div>");
                console.log(['Loading EDDData failed: ', status, ';', e].join(''));
            },
            'success': (data) => {
                EDDData = $.extend(EDDData || {}, data);

                colorObj = EDDGraphingTools.renderColor(EDDData.Lines);

                this.progressiveFilteringWidget.prepareFilteringSection();

                //pulling in protocol measurements AssayMeasurements
                $.each(EDDData.Protocols, (id, protocol) => {
                    $.ajax({
                        url: 'measurements/' + id + '/',
                        type: 'GET',
                        dataType: 'json',
                        error: (xhr, status) => {
                            console.log('Failed to fetch measurement data on ' + protocol.name + '!');
                            console.log(status);
                        },
                        success: processMeasurementData.bind(this, protocol)
                    });
                });
            }
        });
    }


    function filterTableKeyDown(e) {
        switch (e.keyCode) {
            case 38: // up
            case 40: // down
            case 9:  // tab
            case 13: // return
                return;
            default:
                // ignore if the following keys are pressed: [shift] [capslock]
                if (e.keyCode > 8 && e.keyCode < 32) {
                    return;
                }
                this.queueRefreshDataDisplayIfStale(false);
        }
    }


    export function requestAssayData(assay) {
        var protocol = EDDData.Protocols[assay.pid];
        $.ajax({
            url: ['measurements', assay.pid, assay.id, ''].join('/'),
            type: 'GET',
            dataType: 'json',
            error: (xhr, status) => {
                console.log('Failed to fetch measurement data on ' + assay.name + '!');
                console.log(status);
            },
            success: processMeasurementData.bind(this, protocol)
        });
    }


    function processMeasurementData(protocol, data) {
        var assaySeen = {},
            protocolToAssay = {},
            count_total:number = 0,
            count_rec:number = 0;
        EDDData.AssayMeasurements = EDDData.AssayMeasurements || {};
        EDDData.MeasurementTypes = $.extend(EDDData.MeasurementTypes || {}, data.types);

        // attach measurement counts to each assay
        $.each(data.total_measures, (assayId:string, count:number):void => {
            var assay = EDDData.Assays[assayId];
            if (assay) {
                assay.count = count;
                count_total += count;
            }
        });
        // loop over all downloaded measurements
        $.each(data.measures || {}, (index, measurement) => {
            var assay = EDDData.Assays[measurement.assay], line, mtype;
            ++count_rec;
            if (!assay || !assay.active || assay.count === undefined) return;
            line = EDDData.Lines[assay.lid];
            if (!line || !line.active) return;
            // attach values
            $.extend(measurement, { 'values': data.data[measurement.id] || [] });
            // store the measurements
            EDDData.AssayMeasurements[measurement.id] = measurement;
            // track which assays received updated measurements
            assaySeen[assay.id] = true;
            protocolToAssay[assay.pid] = protocolToAssay[assay.pid] || {};
            protocolToAssay[assay.pid][assay.id] = true;
            // handle measurement data based on type
            mtype = data.types[measurement.type] || {};
            (assay.measures = assay.measures || []).push(measurement.id);
            if (mtype.family === 'm') { // measurement is of metabolite
                (assay.metabolites = assay.metabolites || []).push(measurement.id);
            } else if (mtype.family === 'p') { // measurement is of protein
                (assay.proteins = assay.proteins || []).push(measurement.id);
            } else if (mtype.family === 'g') { // measurement is of gene / transcript
                (assay.transcriptions = assay.transcriptions || []).push(measurement.id);
            } else {
                // throw everything else in a general area
                (assay.general = assay.general || []).push(measurement.id);
            }
        });

        this.progressiveFilteringWidget.processIncomingMeasurementRecords(data.measures || {}, data.types);

        if (count_rec < count_total) {
            // TODO not all measurements downloaded; display a message indicating this
            // explain downloading individual assay measurements too
        }

        console.log('processed ' + count_rec);
        this.queueRefreshDataDisplayIfStale(false);
    }


    export function queueRefreshDataDisplayIfStale() {
        if (refresDataDisplayIfStaleTimer) {
            clearTimeout(refresDataDisplayIfStaleTimer);
        }
        refresDataDisplayIfStaleTimer = setTimeout(refreshDataDisplayIfStale.bind(this), 100);
    }


    export function queueActionPanelRefresh() {
        if (actionPanelRefreshTimer) {
            clearTimeout(actionPanelRefreshTimer);
        }
        actionPanelRefreshTimer = setTimeout(actionPanelRefresh.bind(this), 150);
    }


    function actionPanelRefresh() {
        var checkedBoxes:HTMLInputElement[], checkedAssays, checkedMeasure, nothingSelected:boolean;
        // Figure out how many assays/checkboxes are selected.

        // Don't show the selected item count if we're not looking at the table.
        // (Only the visible item count makes sense in that case.)
        if (viewingMode == 'table') {
            $('#selectedDiv').toggleClass('off', nothingSelected);

            checkedBoxes = assaysDataGrid.getSelectedCheckboxElements();

            checkedAssays = $(checkedBoxes).filter('[id^=assay]').length;
            checkedMeasure = $(checkedBoxes).filter(':not([id^=assay])').length;

            nothingSelected = !checkedAssays && !checkedMeasure;

            $('#selectedDiv').toggleClass('off', nothingSelected);
            var selectedStrs = [];
            if (!nothingSelected) {
                if (checkedAssays) {
                    selectedStrs.push((checkedAssays > 1) ? (checkedAssays + " Assays") : "1 Assay");
                }
                if (checkedMeasure) {
                    selectedStrs.push((checkedMeasure > 1) ? (checkedMeasure + " Measurements") : "1 Measurement");
                }
                var selectedStr = selectedStrs.join(', ');
                $('#selectedDiv').text(selectedStr + ' selected');
            }
        } else {
            $('#selectedDiv').addClass('off');
        }
    }


    //this function shows and hides rows based on filtered data.
    export function showHideAssayRows(progressiveFilteringMeasurements):void {

        var assays = _.keys(EDDData.Assays);

        var hideArray = _.filter(assays, function( el ) {
          return !progressiveFilteringMeasurements.includes( parseInt(el) );
        });
        var showArray =_.filter(assays, function( el ) {
          return progressiveFilteringMeasurements.includes( parseInt(el) );
        });
        //hide elements not in progressive filtering measurements
        _.each(hideArray, function(assayId) {
            $( "input[value='" + assayId + "']").parents('tr').hide();
        });
        //show elements in progressive filtering measurements
        _.each(showArray, function(assayId) {
            //if the row does not exist, reset table 
            if ($( "input[value='" + assayId + "']").parents('tr').length === 0) {
                assaysDataGrid.triggerAssayRecordsRefresh();
            }
            $( "input[value='" + assayId + "']").parents('tr').show();
        });
    }


    function refreshDataDisplayIfStale(force?:boolean) {

        // Any switch between viewing modes, or change in filtering, is cause to check the UI
        // in the action panel and make sure it's current.
        queueActionPanelRefresh();

        // If the filtering widget claims a change since the last inquiry,
        // then all the viewing modes are stale, no matter what.
        if (progressiveFilteringWidget.checkRedrawRequired(force)) {

            viewingModeIsStale['linegraph'] = true;
            viewingModeIsStale['bargraph-time'] = true;
            viewingModeIsStale['bargraph-line'] = true;
            viewingModeIsStale['bargraph-measurement'] = true;
            viewingModeIsStale['table'] = true;
            // Gives ids of lines to show.
            postFilteringMeasurements = this.progressiveFilteringWidget.buildFilteredMeasurements();
            postFilteringAssays = [];

            var seenAssays:{[id:number]: boolean} = {};
            // Resolve measurement IDs into a list of assay IDs in the original order encountered, de-duping them.
            postFilteringMeasurements.forEach((mId) => {
                var a = EDDData.AssayMeasurements[mId].assay;
                if (!seenAssays[a]) { postFilteringAssays.push(a); }
                seenAssays[a] = true;
            });

        // If the filtering widget hasn't changed and the current mode doesn't claim to be stale, we're done.
        } else if (viewingMode == 'bargraph') {
            if (!viewingModeIsStale[viewingMode+'-'+barGraphMode]) {
                return;
            }
        } else if (!viewingModeIsStale[viewingMode]) {
            return;
        }

        if (viewingMode == 'table') {
            if (assaysDataGridSpec === null) {
                assaysDataGridSpec = new DataGridSpecAssays(EDDData.Assays);
                assaysDataGridSpec.init();
                assaysDataGrid = new DataGridAssays(assaysDataGridSpec);
            }
            // If any checkboxes have been checked in filtering section, assume we're hiding empty assays?
            if ($(".filterTable input:checkbox:checked").length > 0) {
                showHideAssayRows(postFilteringAssays);
            }
            viewingModeIsStale['table'] = false;
        } else {
            remakeMainGraphArea();
            if (viewingMode == 'bargraph') {
                viewingModeIsStale[viewingMode+'-'+barGraphMode] = false;
            } else {
                viewingModeIsStale['linegraph'] = false;
            }
        }
    }


    function remakeMainGraphArea() {

        var dataPointsDisplayed = 0,
            dataPointsTotal = 0,
            dataSets = [];

        $('#tooManyPoints').hide();
        $('#lineGraph').addClass('off');
        $('#barGraphByTime').addClass('off');
        $('#barGraphByLine').addClass('off');
        $('#barGraphByMeasurement').addClass('off');

        // show message that there's no data to display
        if (postFilteringMeasurements.length === 0) {
            $('#graphLoading').addClass('off');    // Remove load spinner if still present
            $('#noData').removeClass('off');
            return;
        }

        $.each(postFilteringMeasurements, (i, measurementId) => {

            var measure:AssayMeasurementRecord = EDDData.AssayMeasurements[measurementId],
                points = (measure.values ? measure.values.length : 0),
                assay, line, name, singleAssayObj, color, protocol, lineName, dataObj;
            dataPointsTotal += points;

            if (dataPointsDisplayed > 15000) {
                return; // Skip the rest if we've hit our limit
            }

            dataPointsDisplayed += points;
            assay = EDDData.Assays[measure.assay] || {};
            line = EDDData.Lines[assay.lid] || {};
            protocol = EDDData.Protocols[assay.pid] || {};
            name = [line.name, protocol.name, assay.name].join('-');
            lineName = line.name;

            var label = $('#' + line['identifier']).next();

            if (_.keys(EDDData.Lines).length > 22) {
                color = changeLineColor(line, assay.lid)
            } else {
                color = colorObj[assay.lid];
            }

            if (remakeMainGraphAreaCalls < 1) {
                EDDGraphingTools.labels.push(label);
                color = colorObj[assay.lid];
                // update label color to line color
                $(label).css('color', color);
            } else if ($('#' + line['identifier']).prop('checked')) {
                // unchecked labels black
                makeLabelsBlack(EDDGraphingTools.labels);
                // update label color to line color
                if (color === null || color === undefined) {
                    color = colorObj[assay.lid]
                }
                $(label).css('color', color);
            } else {
                var count = noCheckedBoxes(EDDGraphingTools.labels);
                if (count === 0) {
                    EDDGraphingTools.nextColor = null;
                    addColor(EDDGraphingTools.labels, assay.lid)
                } else {
                    //update label color to black
                    $(label).css('color', 'black');
                }
            }

            if (color === null || color === undefined) {
                color = colorObj[assay.lid]
            }
            dataObj = {
                'measure': measure,
                'data': EDDData,
                'name': name,
                'color': color,
                'lineName': lineName
            };
            singleAssayObj = EDDGraphingTools.transformSingleLineItem(dataObj);
            dataSets.push(singleAssayObj);
        });

        $('#noData').addClass('off');

        remakeMainGraphAreaCalls++;
        uncheckEventHandler(EDDGraphingTools.labels);

        var barAssayObj  = EDDGraphingTools.concatAssays(dataSets);

        //data for graphs
        var graphSet = {
            barAssayObj: EDDGraphingTools.concatAssays(dataSets),
            create_x_axis: EDDGraphingTools.createXAxis,
            create_right_y_axis: EDDGraphingTools.createRightYAxis,
            create_y_axis: EDDGraphingTools.createLeftYAxis,
            x_axis: EDDGraphingTools.make_x_axis,
            y_axis: EDDGraphingTools.make_right_y_axis,
            individualData: dataSets,
            assayMeasurements: barAssayObj,
            width: 750,
            height: 220
        };

        //$('#graphLoading').addClass('off');    // Remove load spinner if still present
        if (viewingMode == 'linegraph') {
            $('#lineGraph').empty().removeClass('off');
            var s = EDDGraphingTools.createSvg($('#lineGraph').get(0));
            EDDGraphingTools.createMultiLineGraph(graphSet, s);
        } else if (barGraphMode == 'time') {
            $('#barGraphByTime').empty().removeClass('off');
            var s = EDDGraphingTools.createSvg($('#barGraphByTime').get(0));
            createGroupedBarGraph(graphSet, s);
        } else if (barGraphMode == 'line') {
            $('#barGraphByLine').empty().removeClass('off');
            var s = EDDGraphingTools.createSvg($('#barGraphByLine').get(0));
            createGroupedBarGraph(graphSet, s);
        } else if (barGraphMode == 'measurement') {
            $('#barGraphByMeasurement').empty().removeClass('off');
            var s = EDDGraphingTools.createSvg($('#barGraphByMeasurement').get(0));
            createGroupedBarGraph(graphSet, s);
        }
    }


    /**
     * this function makes unchecked labels black
     * @param selectors
     */
    function makeLabelsBlack(selectors:JQuery[]) {
        _.each(selectors, function(selector:JQuery) {
            if (selector.prev().prop('checked') === false) {
            $(selector).css('color', 'black');
            }
        })
    }


    /**
     * this function creates an event handler for unchecking a checked checkbox
     * @param labels
     */
    function uncheckEventHandler(labels) {
        _.each(labels, function(label){
            var id = $(label).prev().attr('id');
            $('#' + id).change(function() {
                var ischecked= $(this).is(':checked');
                if (!ischecked) {
                    $(label).css('color', 'black');
                }
            });
        });
    }


    /**
     * this function returns how many checkboxes are checked.
     * @param labels
     * @returns count of checked boxes.
     */
    function noCheckedBoxes(labels) {
        var count = 0;
        _.each(labels, function(label) {
            var checkbox = $(label).prev();
            if ($(checkbox).prop('checked')) {
                count++;
            }
        });
        return count;
    }


    /**
     * This function adds colors after user has clicked a line and then unclicked all the lines.
     * @param labels
     * @param assay
     * @returns labels
     */
    function addColor(labels:JQuery[], assay) {
        _.each(labels, function(label:JQuery) {
            var color = colorObj[assay];
            if (EDDData.Lines[assay].name === label.text()) {
                $(label).css('color', color);
            }
        });
        return labels;
    }


    /** this function takes in element and returns an array of selectors
     * [<div id=​"linechart">​</div>​, <div id=​"timeBar">​</div>​, <div id=​"single">​</div>​,
     * <div id=​"barAssay">​</div>​]
     */
    function getButtonElement(element) {
        return $(element.siblings(':first')).find("label")
    }


    /**
     * this function takes in the graphDiv element and returns an array of 4 buttons
     */
    function getSelectorElement(element) {
        if ($(element).attr('id') != 'maingraph') {
            var selector = element.siblings().eq(1);
            return $(selector).children();
        } else {
          return element.siblings().addBack()
        }
    }


    /** this function takes in an element selector and an array of svg rects and returns
     * returns message or nothing.
     */
    function svgWidth(selector, rectArray) {
        $('.tooMuchData').hide();
        $('.noData').hide();
        var sum = 0;
        _.each(rectArray, function(rectElem:any) {
            if (rectElem.getAttribute("width") != 0) {
                sum++
            }
        });
        if (sum === 0) {
             $('#graphLoading').addClass('off');
            $(selector).prepend("<p class=' tooMuchData'>Too many data points to display" +
                "</p><p  class=' tooMuchData'>Recommend filtering by protocol</p>");
        }
    }


    /** this function takes in the EDDData.MeasurementTypes object and returns the measurement type
     *  that has the most data points - options are based on family p, m, -, etc.
     */
    function measurementType(types) {    // TODO: RENAME
        var proteomics = {};
        for (var type in types) {
            if (proteomics.hasOwnProperty(types[type].family)) {
                proteomics[types[type].family]++;
            } else {
                proteomics[types[type].family] = 0
            }
        }
        for (var key in proteomics) {
            var max:any = 0;
            var maxType:any;
            if (proteomics[key] > max) {
                max = proteomics[key];
                maxType = key;
            }
        }
        return maxType;
    }


    /**
     * this function takes in the event, selector type, rect obj, selector object and
     * handles the button event.
     */
    function buttonEventHandler(newSet, event, rect, selector, selectors) {
        event.preventDefault();
        if (newSet.length === 0) {
            $(selectors[selector]).prepend("<p class='noData'>No data selected - please " +
            "filter</p>")
            $('.tooMuchData').remove();
        } else {
            $('.noData').remove();
            svgWidth(selectors[selector], rect);
        }
        return false;
    }


    /**
     * this function takes in input min y value, max y value, and the sorted json object.
     *  outputs a grouped bar graph with values grouped by assay name
     **/
    export function createGroupedBarGraph(graphSet, svg) {

        var assayMeasurements = graphSet.assayMeasurements,
            typeID = {
                'measurement': "#barGraphByMeasurement",
                'x': "#barGraphByTime",
                'name': '#barGraphByLine'
            },
            modeToField = {
                'line': 'name',
                'time': 'x',
                'measurement': 'measurement'
            },
            numUnits = EDDGraphingTools.howManyUnits(assayMeasurements),
            yRange = [],
            unitMeasurementData = [],
            yMin = [],
            data, nested, typeNames, xValues, yvalueIds, x_name, xValueLabels,
            sortedXvalues, div, x_xValue, lineID, meas, y, wordLength;

        var type = modeToField[barGraphMode];

        if (type === 'x') {
             var entries = (<any>d3).nest(type)
                .key(function (d:any) {
                    return d[type];
                })
                .entries(assayMeasurements);

            var timeMeasurements = _.clone(assayMeasurements);
            var nestedByTime = EDDGraphingTools.findAllTime(entries);
            var howManyToInsertObj = EDDGraphingTools.findMaxTimeDifference(nestedByTime);
            var max = Math.max.apply(null, _.values(howManyToInsertObj));
            if (max > 400) {
                $(typeID[type]).prepend("<p class='noData'>Too many missing data fields. Please filter</p>");
                $('.tooMuchData').remove();
            } else {
                $('.noData').remove();
            }
            EDDGraphingTools.insertFakeValues(entries, howManyToInsertObj, timeMeasurements);
        }
        //x axis scale for type
        x_name = d3.scale.ordinal()
            .rangeRoundBands([0, graphSet.width], 0.1);

        //x axis scale for x values
        x_xValue = d3.scale.ordinal();

        //x axis scale for line id to differentiate multiple lines associated with the same name/type
        lineID = d3.scale.ordinal();

        // y axis range scale
        y = d3.scale.linear()
            .range([graphSet.height, 0]);

        div = d3.select("body").append("div")
            .attr("class", "tooltip2")
            .style("opacity", 0);

        var d3_entries = type === 'x' ? timeMeasurements : assayMeasurements;
            meas = d3.nest()
            .key(function (d:any) {
                return d.y_unit;
            })
            .entries(d3_entries);

        // if there is no data - show no data error message
        if (assayMeasurements.length === 0) {
            $(typeID[type]).prepend("<p class='noData'>No data selected - please " +
            "filter</p>");

            $('.tooMuchData').remove();
        } else {
            $('.noData').remove();
        }

        for (var i = 0; i < numUnits; i++) {
            yRange.push(d3.scale.linear().rangeRound([graphSet.height, 0]));
            unitMeasurementData.push(d3.nest()
                .key(function (d:any) {
                    return d.y;
                })
                .entries(meas[i].values));
            yMin.push(d3.min(unitMeasurementData[i], function (d:any) {
                return d3.min(d.values, function (d:any) {
                    return d.y;
                });
            }))
        }

        if (type === 'x') {
            // nest data by type (ie measurement) and by x value
            nested = (<any>d3).nest(type)
                .key(function (d:any) {
                    return d[type];
                })
                .key(function (d:any) {
                    return parseFloat(d.x);
                })
                .entries(timeMeasurements);
        } else {
            // nest data by type (ie measurement) and by x value
        nested = (<any>d3).nest(type)
                .key(function (d:any) {
                    return d[type];
                })
                .key(function (d:any) {
                    return parseFloat(d.x);
                })
                .entries(assayMeasurements);
        }


        //insert y value to distinguish between lines
        data = EDDGraphingTools.getXYValues(nested);

        if (data.length === 0) {
            return svg
        }

        //get type names for x labels
        typeNames = data.map(function (d:any) {
                return d.key;
            });

        //sort x values
        typeNames.sort(function (a, b) {
                return a - b
            });

        xValues = data.map(function (d:any) {
            return (d.values);
        });

        yvalueIds = data[0].values[0].values.map(function (d:any) {
            return d.key;
        });

        // returns time values
        xValueLabels = xValues[0].map(function (d:any) {
            return (d.key);
        });

        //sort time values
        sortedXvalues = xValueLabels.sort(function(a, b) { return parseFloat(a) - parseFloat(b)});

        x_name.domain(typeNames);

        x_xValue.domain(sortedXvalues).rangeRoundBands([0, x_name.rangeBand()]);

        lineID.domain(yvalueIds).rangeRoundBands([0, x_xValue.rangeBand()]);
        
        //create x axis
        graphSet.create_x_axis(graphSet, x_name, svg, type);

        //loop through different units
        for (var index = 0; index < numUnits; index++) {

            if (yMin[index] > 0 ) {
                yMin[index] = 0;
            }
            //y axis min and max domain 
            y.domain([yMin[index], d3.max(unitMeasurementData[index], function (d:any) {
                return d3.max(d.values, function (d:any) {
                    return d.y;
                });
            })]);

            //nest data associated with one unit by type and time value
            data = (<any>d3).nest(type)
                .key(function (d:any) {
                    return d[type];
                })
                .key(function (d:any) {
                    return parseFloat(d.x);
                })
                .entries(meas[index].values);


            // //hide values if there are different time points
            if (type != 'x') {
                var nestedByTime = EDDGraphingTools.findAllTime(data);
                var howManyToInsertObj = EDDGraphingTools.findMaxTimeDifference(nestedByTime);
                var max = Math.max.apply(null, _.values(howManyToInsertObj));
                var graphSvg = $(typeID[type])[0];

                if (max > 1) {
                    $('.tooMuchData').remove();
                    var arects = d3.selectAll(typeID[type] +  ' rect')[0];
                    svgWidth(graphSvg, arects);
                     //get word length
                    wordLength = EDDGraphingTools.getSum(typeNames);
                    d3.selectAll(typeID[type] + ' .x.axis text').remove();
                    return svg;
                } else {
                    $('.noData').remove();
                }
            }

            //right axis
            if (index == 0) {
                graphSet.create_y_axis(graphSet, meas[index].key, y, svg);
            } else {
                var spacing = {
                    1: graphSet.width,
                    2: graphSet.width + 50,
                    3: graphSet.width + 100,
                    4: graphSet.width + 150
                };
                //create right axis
                graphSet.create_right_y_axis(meas[index].key, y, svg, spacing[index])
            }

            var names_g = svg.selectAll(".group" + index)
                .data(data)
                .enter().append("g")
                .attr("transform", function (d:any) {
                    return "translate(" + x_name(d.key) + ",0)";
                });

            var categories_g = names_g.selectAll(".category" + index)
                .data(function (d:any) {
                    return d.values;
                })
                .enter().append("g")
                .attr("transform", function (d:any) {
                    return "translate(" + x_xValue(d.key) + ",0)";
                });

            var categories_labels = categories_g.selectAll('.category-label' + index)
                .data(function (d:any) {
                    return [d.key];
                })
                .enter()
                .append("text")
                .attr("x", function () {
                    return x_xValue.rangeBand() / 2;
                })
                .attr('y', function () {
                    return graphSet.height + 27;
                })
                .attr('text-anchor', 'middle');

             var values_g = categories_g.selectAll(".value" + index)
                .data(function (d:any) {
                    return d.values;
                })
                .enter().append("g")
                .attr("class", function (d:any) {
                    d.lineName = d.lineName.split(' ').join('');
                    return 'value value-' + d.lineName;
                 })
                .attr("transform", function (d:any) {
                    return "translate(" + lineID(d.key) + ",0)";
                })
                .on('mouseover', function(d) {
                    d3.selectAll('.value').style('opacity', 0.3);
                    d3.selectAll('.value-' + d.lineName).style('opacity', 1)
                })
                .on('mouseout', function(d) {
                    d3.selectAll('.value').style('opacity', 1);
                });

            var rects = values_g.selectAll('.rect' + index)
                .data(function (d:any) {
                    return [d];
                })
                .enter().append("rect")
                .attr("class", "rect")
                .attr("width", lineID.rangeBand())
                .attr("y", function (d:any) {
                    return y(d.y);
                })
                .attr("height", function (d:any) {
                    return graphSet.height - y(d.y);
                })
                .style("fill", function (d:any) {
                    return d.color
                })
                .style("opacity", 1);

            categories_g.selectAll('.rect')
                .data(function (d:any) {
                    return d.values;
                })
                .on("mouseover", function (d:any) {
                    div.transition()
                        .style("opacity", 0.9);

                    div.html('<strong>' + d.name + '</strong>' + ": "
                            + "</br>" + d.measurement + '</br>' + d.y + " " + d.y_unit + "</br>" + " @" +
                        " " + d.x + " hours")
                        .style("left", ((<any>d3.event).pageX) + "px")
                        .style("top", ((<any>d3.event).pageY - 30) + "px");
                })
                .on("mouseout", function () {
                    div.transition()
                        .style("opacity", 0);
                });
            //get word length
            wordLength = EDDGraphingTools.getSum(typeNames);

            if (wordLength > 90 && type != 'x') {
               d3.selectAll(typeID[type] + ' .x.axis text').remove()
            }
            if (wordLength > 150 && type === 'x') {
               d3.selectAll(typeID[type] + ' .x.axis text').remove()
            }
        }
        $('#graphLoading').addClass('off');
    }


    /**
     * this function takes in the type of measurement, selectors obj, selector type and
     * button obj and shows the measurement graph is the main type is proteomic
     */
    function showProteomicGraph(type, selectors, selector, buttons) {
        if (type ==='p') {
            d3.select(selectors['line']).style('display', 'none');
            d3.select(selectors['bar-measurement']).style('display', 'block');
            $('label.btn').removeClass('active');
            var rects = d3.selectAll('.groupedMeasurement rect')[0];
            svgWidth(selectors[selector], rects);
            var button =  $('.groupByMeasurementBar')[0];
            $(buttons['bar-time']).removeClass('hidden');
            $(buttons['bar-line']).removeClass('hidden');
            $(buttons['bar-measurement']).removeClass('hidden');
            $(button).addClass('active');
            $(buttons['bar-empty']).addClass('active');
        }
    }


    /**
     * @param line
     * @param assay
     * @returns color for line.
     * this function returns the color in the color queue for studies >22 lines. Instantiated
     * when user clicks on a line.
     */
    function changeLineColor(line, assay) {

        var color;

        if($('#' + line['identifier']).prop('checked') && remakeMainGraphAreaCalls === 1) {
            color = line['color'];
            line['doNotChange'] = true;
            EDDGraphingTools.colorQueue(color);
        }
        if ($('#' + line['identifier']).prop('checked') && remakeMainGraphAreaCalls >= 1) {
            if (line['doNotChange']) {
               color = line['color'];
            } else {
                color = EDDGraphingTools.nextColor;
                line['doNotChange'] = true;
                line['color'] = color;
                //text label next to checkbox
                var label = $('#' + line['identifier']).next();
                //update label color to line color
                $(label).css('color', color);
                EDDGraphingTools.colorQueue(color);
            }
        } else if ($('#' + line['identifier']).prop('checked') === false && remakeMainGraphAreaCalls > 1 ){
            color = colorObj[assay];
             var label = $('#' + line['identifier']).next();
                //update label color to line color
            $(label).css('color', color);
        }

        if (remakeMainGraphAreaCalls == 0) {
            color = colorObj[assay];
        }
        return color;
    }


    function clearAssayForm():JQuery {
        var form:JQuery = $('#assayMain');
        form.find('[name^=assay-]').not(':checkbox, :radio').val('');
        form.find('[name^=assay-]').filter(':checkbox, :radio').prop('selected', false);
        form.find('.cancel-link').remove();
        form.find('.errorlist').remove();
        return form;
    }


    function fillAssayForm(form, record) {
        var user = EDDData.Users[record.experimenter];
        form.find('[name=assay-assay_id]').val(record.id);
        form.find('[name=assay-name]').val(record.name);
        form.find('[name=assay-description]').val(record.description);
        form.find('[name=assay-protocol]').val(record.pid);
        form.find('[name=assay-experimenter_0]').val(user && user.uid ? user.uid : '--');
        form.find('[name=assay-experimenter_1]').val(record.experimenter);
    }


    export function editAssay(index:number):void {
        var record = EDDData.Assays[index], form;
        if (!record) {
            console.log('Invalid Assay record for editing: ' + index);
            return;
        }
        form = $('#assayMain');
        clearAssayForm();
        fillAssayForm(form, record);
        form.removeClass('off').dialog( "open" );
    }
};



class DataGridAssays extends AssayResults {

    // Right now we're not actually using the contents of this array, just
    // checking to see if it's non-empty.
    recordsCurrentlyInvalidated:number[];

    constructor(dataGridSpec:DataGridSpecBase) {
        super(dataGridSpec);
        this.recordsCurrentlyInvalidated = [];
    }

    invalidateAssayRecords(records:number[]):void {
        this.recordsCurrentlyInvalidated = this.recordsCurrentlyInvalidated.concat(records);
        if (!this.recordsCurrentlyInvalidated.length) {
            return;
        }
    }

    triggerAssayRecordsRefresh():void {
        try {
            this.triggerDataReset();
            this.recordsCurrentlyInvalidated = [];
        } catch (e) {
            console.log('Failed to execute records refresh: ' + e);
        }
    }
}



// The spec object that will be passed to DataGrid to create the Assays table(s)
class DataGridSpecAssays extends DataGridSpecBase {

    assayID:any;
    filteredIdsInTable:number[];
    metaDataIDsUsedInAssays:any;
    maximumXValueInData:number;

    measuringTimesHeaderSpec:DataGridHeaderSpec;
    graphAreaHeaderSpec:DataGridHeaderSpec;

    graphObject:any;

    constructor(assayID) {
        super();
        this.assayID = assayID;
        this.graphObject = null;
        this.measuringTimesHeaderSpec = null;
        this.graphAreaHeaderSpec = null;
    }

    init() {
        this.refreshIDList();
        this.findMaximumXValueInData();
        this.findMetaDataIDsUsedInAssays();
        super.init();
    }

    //pass in filtered ids. this.assayIDsInProtocol change to this.filteredIDsInTable
    refreshIDList():void {
        // Find out which protocols have assays with measurements - disabled or no
        this.filteredIdsInTable = [];
        this.filterIdsInTable(this.filteredIdsInTable, EDDData.Assays)

    }

    filterIdsInTable(filteredTables, assays):void {
        $.each(assays, (assayId:string, assay:AssayRecord):void => {
            var line:LineRecord;
            line = EDDData.Lines[assay.lid];
             // skip assays without a valid line or with a disabled line
            if (line && line.active) {
                filteredTables.push(assay.id);
            }
        });
    }

    // An array of unique identifiers, used to identify the records in the data set being displayed
    getRecordIDs():any[] {
        return this.filteredIdsInTable;
    }

    // This is an override.  Called when a data reset is triggered, but before the table rows are
    // rebuilt.
    onDataReset(dataGrid:DataGrid):void {

        this.findMaximumXValueInData();
        if (this.measuringTimesHeaderSpec && this.measuringTimesHeaderSpec.element) {
            $(this.measuringTimesHeaderSpec.element).children(':first').text(
                    'Measuring Times (Range 0 to ' + this.maximumXValueInData + ')');
        }
    }

    // The table element on the page that will be turned into the DataGrid.  Any preexisting table
    // content will be removed.
    getTableElement() {
        return document.getElementById('studyAssaysTable');
    }

    // Specification for the table as a whole
    defineTableSpec():DataGridTableSpec {
        return new DataGridTableSpec('assays', {
            'defaultSort': 1
        });
    }

    findMetaDataIDsUsedInAssays() {
        var seenHash:any = {};
        this.metaDataIDsUsedInAssays = [];
        this.getRecordIDs().forEach((assayId) => {
            var assay = EDDData.Assays[assayId];
            $.each(assay.meta || {}, (metaId) => { seenHash[metaId] = true; });
        });
        [].push.apply(this.metaDataIDsUsedInAssays, Object.keys(seenHash));
    }

    findMaximumXValueInData():void {
        var maxForAll:number = 0;
        // reduce to find highest value across all records
        maxForAll = this.getRecordIDs().reduce((prev:number, assayId) => {
            var assay = EDDData.Assays[assayId], measures, maxForRecord;
            measures = assay.measures || [];
            // reduce to find highest value across all measures
            maxForRecord = measures.reduce((prev:number, measureId) => {
                var lookup:any = EDDData.AssayMeasurements || {},
                    measure:any = lookup[measureId] || {},
                    maxForMeasure;
                // reduce to find highest value across all data in measurement
                maxForMeasure = (measure.values || []).reduce((prev:number, point) => {
                    return Math.max(prev, point[0][0]);
                }, 0);
                return Math.max(prev, maxForMeasure);
            }, 0);
            return Math.max(prev, maxForRecord);
        }, 0);
        // Anything above 0 is acceptable, but 0 will default instead to 1.
        this.maximumXValueInData = maxForAll || 1;
    }

    private loadAssayName(index:any):string {
        // In an old typical EDDData.Assays record this string is currently pre-assembled and stored
        // in 'fn'. But we're phasing that out.
        var protocolNaming = EDDData.Protocols[this.assayID[index].pid].name;
        var assay, line;
        if ((assay = EDDData.Assays[index])) {
            if ((line = EDDData.Lines[assay.lid])) {
                return [line.n, protocolNaming, assay.name].join('-').toUpperCase();
            }
        }
        return '';
    }

    private loadExperimenterInitials(index:any):string {
        // ensure index ID exists, ensure experimenter user ID exists, uppercase initials or ?
        var assay, experimenter;
        if ((assay = EDDData.Assays[index])) {
            if ((experimenter = EDDData.Users[assay.exp])) {
                return experimenter.initials.toUpperCase();
            }
        }
        return '?';
    }

    private loadAssayModification(index:any):number {
        return EDDData.Assays[index].mod;
    }

    // Specification for the headers along the top of the table
    defineHeaderSpec():DataGridHeaderSpec[] {
        // map all metadata IDs to HeaderSpec objects
        var metaDataHeaders:DataGridHeaderSpec[] = this.metaDataIDsUsedInAssays.map((id, index) => {
            var mdType = EDDData.MetaDataTypes[id];
            return new DataGridHeaderSpec(2 + index, 'hAssaysMetaid' + id, {
                'name': mdType.name,
                'headerRow': 2,
                'size': 's',
                'sortBy': this.makeMetaDataSortFunction(id),
                'sortAfter': 1
            });
        });

         this.graphAreaHeaderSpec = new DataGridHeaderSpec(8 + metaDataHeaders.length,
                'hAssaysGraph', { 'colspan': 7 + metaDataHeaders.length });

        var leftSide:DataGridHeaderSpec[] = [
            new DataGridHeaderSpec(1, 'hAssaysName', {
                'name': 'Name',
                'headerRow': 2,
                'sortBy': this.loadAssayName
            })
        ];

        this.measuringTimesHeaderSpec = new DataGridHeaderSpec(5 + metaDataHeaders.length,
                'hAssaysMTimes', { 'name': 'Measuring Times', 'headerRow': 2 });

        var rightSide = [
            new DataGridHeaderSpec(2 + metaDataHeaders.length,
                    'hAssaysMName',
                    { 'name': 'Measurement', 'headerRow': 2 }),
            new DataGridHeaderSpec(3 + metaDataHeaders.length,
                    'hAssaysUnits',
                    { 'name': 'Units', 'headerRow': 2 }),
            new DataGridHeaderSpec(4 + metaDataHeaders.length,
                    'hAssaysCount',
                    { 'name': 'Count', 'headerRow': 2 }),
            this.measuringTimesHeaderSpec,
            new DataGridHeaderSpec(6 + metaDataHeaders.length,
                    'hAssaysExperimenter',
                    {
                        'name': 'Experimenter',
                        'headerRow': 2,
                        'sortBy': this.loadExperimenterInitials,
                        'sortAfter': 1
                    }),
            new DataGridHeaderSpec(7 + metaDataHeaders.length,
                    'hAssaysModified',
                    {
                        'name': 'Last Modified',
                        'headerRow': 2,
                        'sortBy': this.loadAssayModification,
                        'sortAfter': 1
                    })
        ];

        return leftSide.concat(metaDataHeaders, rightSide);
    }

    private makeMetaDataSortFunction(id) {
        return (i) => {
            var record = EDDData.Assays[i];
            if (record && record.meta) {
                return record.meta[id] || '';
            }
            return '';
        }
    }

    // The colspan value for all the cells that are assay-level (not measurement-level) is based on
    // the number of measurements for the respective record. Specifically, it's the number of
    // metabolite and general measurements, plus 1 if there are transcriptomics measurements, plus 1 if there
    // are proteomics measurements, all added together.  (Or 1, whichever is higher.)
    private rowSpanForRecord(index):number {
        var rec = EDDData.Assays[index];
        var v:number = ((rec.general         || []).length +
                        (rec.metabolites     || []).length +
                        ((rec.transcriptions || []).length ? 1 : 0) +
                        ((rec.proteins       || []).length ? 1 : 0)   ) || 1;
        return v;
    }

    generateAssayNameCells(gridSpec:DataGridSpecAssays, index:string):DataGridDataCell[] {
        var record = EDDData.Assays[index], line = EDDData.Lines[record.lid], sideMenuItems = [
            '<a class="assay-edit-link">Edit Assay</a>',
            '<a class="assay-reload-link">Reload Data</a>',
            '<a href="/export?assayId=' + index + '">Export Data as CSV/etc</a>'
        ];

        // Set up jQuery modals
        $("#assayMain").dialog({ autoOpen: false });

        // TODO we probably don't want to special-case like this by name
        if (EDDData.Protocols[record.pid].name == "Transcriptomics") {
            sideMenuItems.push('<a href="import/rnaseq/edgepro?assay='+index+'">Import RNA-seq data from EDGE-pro</a>');
        }
        return [
            new DataGridDataCell(gridSpec, index, {
                'checkboxName': 'assayId',
                'checkboxWithID': (id) => { return 'assay' + id + 'include'; },
                'sideMenuItems': sideMenuItems,
                'hoverEffect': true,
                'nowrap': true,
                'rowspan': gridSpec.rowSpanForRecord(index),
                'contentString': [line.name, EDDData.Protocols[record.pid].name, record.name].join('-')
            })
        ];
    }

    makeMetaDataCellsGeneratorFunction(id) {
        return (gridSpec:DataGridSpecAssays, index:string):DataGridDataCell[] => {
            var contentStr = '', assay = EDDData.Assays[index], type = EDDData.MetaDataTypes[id];
            if (assay && type && assay.meta && (contentStr = assay.meta[id] || '')) {
                contentStr = [ type.pre || '', contentStr, type.postfix || '' ].join(' ').trim();
            }
            return [
                new DataGridDataCell(gridSpec, index, {
                    'rowspan': gridSpec.rowSpanForRecord(index),
                    'contentString': contentStr
                })
            ];
        }
    }

    private generateMeasurementCells(gridSpec:DataGridSpecAssays, index:string,
            opt:any):DataGridDataCell[] {
        var record = EDDData.Assays[index], cells = [],
            factory = ():DataGridDataCell => new DataGridDataCell(gridSpec, index);

        if ((record.metabolites || []).length > 0) {
            if (EDDData.AssayMeasurements === undefined) {
                cells.push(new DataGridLoadingCell(gridSpec, index,
                        { 'rowspan': record.metabolites.length }));
            } else {
                // convert IDs to measurements, sort by name, then convert to cell objects
                cells = record.metabolites.map(opt.metaboliteToValue)
                        .sort(opt.metaboliteValueSort)
                        .map(opt.metaboliteValueToCell);
            }
        }
        if ((record.general || []).length > 0) {
            if (EDDData.AssayMeasurements === undefined) {
                cells.push(new DataGridLoadingCell(gridSpec, index,
                    { 'rowspan': record.general.length }));
            } else {
                // convert IDs to measurements, sort by name, then convert to cell objects
                cells = record.general.map(opt.metaboliteToValue)
                    .sort(opt.metaboliteValueSort)
                    .map(opt.metaboliteValueToCell);
            }
        }
        // generate only one cell if there is any transcriptomics data
        if ((record.transcriptions || []).length > 0) {
            if (EDDData.AssayMeasurements === undefined) {
                cells.push(new DataGridLoadingCell(gridSpec, index));
            } else {
                cells.push(opt.transcriptToCell(record.transcriptions));
            }
        }
        // generate only one cell if there is any proteomics data
        if ((record.proteins || []).length > 0) {
            if (EDDData.AssayMeasurements === undefined) {
                cells.push(new DataGridLoadingCell(gridSpec, index));
            } else {
                cells.push(opt.proteinToCell(record.proteins));
            }
        }
        // generate a loading cell if none created by measurements
        if (!cells.length) {
            if (record.count) {
                // we have a count, but no data yet; still loading
                cells.push(new DataGridLoadingCell(gridSpec, index));
            } else if (opt.empty) {
                cells.push(opt.empty.call({}));
            } else {
                cells.push(factory());
            }
        }
        return cells;
    }

    generateMeasurementNameCells(gridSpec:DataGridSpecAssays, index:string):DataGridDataCell[] {
        return gridSpec.generateMeasurementCells(gridSpec, index, {
            'metaboliteToValue': (measureId) => {
                var measure:any = EDDData.AssayMeasurements[measureId] || {},
                    mtype:any = EDDData.MeasurementTypes[measure.type] || {};
                return { 'name': mtype.name || '', 'id': measureId };
            },
            'metaboliteValueSort': (a:any, b:any) => {
                var y = a.name.toLowerCase(), z = b.name.toLowerCase();
                return (<any>(y > z) - <any>(z > y));
            },
            'metaboliteValueToCell': (value) => {
                return new DataGridDataCell(gridSpec, value.id, {
                    'hoverEffect': true,
                    'checkboxName': 'measurementId',
                    'checkboxWithID': () => { return 'measurement' + value.id + 'include'; },
                    'contentString': value.name
                });
            },
            'transcriptToCell': (ids:any[]) => {
                return new DataGridDataCell(gridSpec, index, {
                  'contentString': 'Transcriptomics Data'
                });
            },
            'proteinToCell': (ids:any[]) => {
                return new DataGridDataCell(gridSpec, index, {
                  'contentString': 'Proteomics Data'
                });
            },
            "empty": () => new DataGridDataCell(gridSpec, index, {
                'contentString': '<i>No Measurements</i>'
            })
        });
    }

    generateUnitsCells(gridSpec:DataGridSpecAssays, index:string):DataGridDataCell[] {
        return gridSpec.generateMeasurementCells(gridSpec, index, {
            'metaboliteToValue': (measureId) => {
                var measure:any = EDDData.AssayMeasurements[measureId] || {},
                    mtype:any = EDDData.MeasurementTypes[measure.type] || {},
                    unit:any = EDDData.UnitTypes[measure.y_units] || {};
                return { 'name': mtype.name || '', 'id': measureId, 'unit': unit.name || '' };
            },
            'metaboliteValueSort': (a:any, b:any) => {
                var y = a.name.toLowerCase(), z = b.name.toLowerCase();
                return (<any>(y > z) - <any>(z > y));
            },
            'metaboliteValueToCell': (value) => {
                return new DataGridDataCell(gridSpec, index, {
                    'contentString': value.unit
                });
            },
            'transcriptToCell': (ids:any[]) => {
                return new DataGridDataCell(gridSpec, index, {
                  'contentString': 'RPKM'
                });
            },
            'proteinToCell': (ids:any[]) => {
                return new DataGridDataCell(gridSpec, index, {
                  'contentString': '' // TODO: what are proteomics measurement units?
                });
            }
        });
    }

    generateCountCells(gridSpec:DataGridSpecAssays, index:string):DataGridDataCell[] {
        // function to use in Array#reduce to count all the values in a set of measurements
        var reduceCount = (prev:number, measureId) => {
            var measure:any = EDDData.AssayMeasurements[measureId] || {};
            return prev + (measure.values || []).length;
        };
        return gridSpec.generateMeasurementCells(gridSpec, index, {
            'metaboliteToValue': (measureId) => {
                var measure:any = EDDData.AssayMeasurements[measureId] || {},
                    mtype:any = EDDData.MeasurementTypes[measure.type] || {};
                return { 'name': mtype.name || '', 'id': measureId, 'measure': measure };
            },
            'metaboliteValueSort': (a:any, b:any) => {
                var y = a.name.toLowerCase(), z = b.name.toLowerCase();
                return (<any>(y > z) - <any>(z > y));
            },
            'metaboliteValueToCell': (value) => {
                return new DataGridDataCell(gridSpec, index, {
                    'contentString': [ '(', (value.measure.values || []).length, ')'].join('')
                });
            },
            'transcriptToCell': (ids:any[]) => {
                return new DataGridDataCell(gridSpec, index, {
                    'contentString': [ '(', ids.reduce(reduceCount, 0), ')'].join('')
                });
            },
            'proteinToCell': (ids:any[]) => {
                return new DataGridDataCell(gridSpec, index, {
                    'contentString': [ '(', ids.reduce(reduceCount, 0), ')'].join('')
                });
            }
        });
    }

    generateMeasuringTimesCells(gridSpec:DataGridSpecAssays, index:string):DataGridDataCell[] {
        var svgCellForTimeCounts = (ids:any[]) => {
                var consolidated, svg = '', timeCount = {};
                // count values at each x for all measurements
                ids.forEach((measureId) => {
                    var measure:any = EDDData.AssayMeasurements[measureId] || {},
                        points:number[][][] = measure.values || [];
                    points.forEach((point:number[][]) => {
                        timeCount[point[0][0]] = timeCount[point[0][0]] || 0;
                        // Typescript compiler does not like using increment operator on expression
                        ++timeCount[point[0][0]];
                    });
                });
                // map the counts to [x, y] tuples
                consolidated = $.map(timeCount, (value, key) => [[ [parseFloat(key)], [value] ]]);
                // generate SVG string
                if (consolidated.length) {
                    svg = gridSpec.assembleSVGStringForDataPoints(consolidated, '');
                }
                return new DataGridDataCell(gridSpec, index, {
                  'contentString': svg
                });
            };
        return gridSpec.generateMeasurementCells(gridSpec, index, {
            'metaboliteToValue': (measureId) => {
                var measure:any = EDDData.AssayMeasurements[measureId] || {},
                    mtype:any = EDDData.MeasurementTypes[measure.type] || {};
                return { 'name': mtype.name || '', 'id': measureId, 'measure': measure };
            },
            'metaboliteValueSort': (a:any, b:any) => {
                var y = a.name.toLowerCase(), z = b.name.toLowerCase();
                return (<any>(y > z) - <any>(z > y));
            },
            'metaboliteValueToCell': (value) => {
                var measure = value.measure || {},
                    format = measure.format === 1 ? 'carbon' : '',
                    points = value.measure.values || [],
                    svg = gridSpec.assembleSVGStringForDataPoints(points, format);
                return new DataGridDataCell(gridSpec, index, {
                    'contentString': svg
                });
            },
            'transcriptToCell': svgCellForTimeCounts,
            'proteinToCell': svgCellForTimeCounts
        });
    }

    generateExperimenterCells(gridSpec:DataGridSpecAssays, index:string):DataGridDataCell[] {
        var exp = EDDData.Assays[index].exp;
        var uRecord = EDDData.Users[exp];
        return [
            new DataGridDataCell(gridSpec, index, {
                'rowspan': gridSpec.rowSpanForRecord(index),
                'contentString': uRecord ? uRecord.initials : '?'
            })
        ];
    }

    generateModificationDateCells(gridSpec:DataGridSpecAssays, index:string):DataGridDataCell[] {
        return [
            new DataGridDataCell(gridSpec, index, {
                'rowspan': gridSpec.rowSpanForRecord(index),
                'contentString': Utl.JS.timestampToTodayString(EDDData.Assays[index].mod)
            })
        ];
    }

    assembleSVGStringForDataPoints(points, format:string):string {
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" version="1.2" width="100%" height="10px"\
                    viewBox="0 0 470 10" preserveAspectRatio="none">\
                <style type="text/css"><![CDATA[\
                        .cP { stroke:rgba(0,0,0,1); stroke-width:4px; stroke-linecap:round; }\
                        .cV { stroke:rgba(0,0,230,1); stroke-width:4px; stroke-linecap:round; }\
                        .cE { stroke:rgba(255,128,0,1); stroke-width:4px; stroke-linecap:round; }\
                    ]]></style>\
                <path fill="rgba(0,0,0,0.0.05)"\
                        stroke="rgba(0,0,0,0.05)"\
                        d="M10,5h450"\
                        style="stroke-width:2px;"\
                        stroke-width="2"></path>';
        var paths = [ svg ];
        points.sort((a,b) => { return a[0] - b[0]; }).forEach((point) => {
            var x = point[0][0],
                y = point[1][0],
                rx = ((x / this.maximumXValueInData) * 450) + 10,
                tt = [y, ' at ', x, 'h'].join('');
            paths.push(['<path class="cE" d="M', rx, ',5v4"></path>'].join(''));
            if (y === null) {
                paths.push(['<path class="cE" d="M', rx, ',2v6"></path>'].join(''));
                return;
            }
            paths.push(['<path class="cP" d="M', rx, ',1v4"></path>'].join(''));
            if (format === 'carbon') {
                paths.push(['<path class="cV" d="M', rx, ',1v8"><title>', tt, '</title></path>'].join(''));
            } else {
                paths.push(['<path class="cP" d="M', rx, ',1v8"><title>', tt, '</title></path>'].join(''));
            }
        });
        paths.push('</svg>');
        return paths.join('\n');
    }

    // Specification for each of the data columns that will make up the body of the table
    defineColumnSpec():DataGridColumnSpec[] {
        var leftSide:DataGridColumnSpec[],
            metaDataCols:DataGridColumnSpec[],
            rightSide:DataGridColumnSpec[];

        leftSide = [
            new DataGridColumnSpec(1, this.generateAssayNameCells)
           ];

        metaDataCols = this.metaDataIDsUsedInAssays.map((id, index) => {
            var mdType = EDDData.MetaDataTypes[id];
            return new DataGridColumnSpec(2 + index, this.makeMetaDataCellsGeneratorFunction(id));
        });

        rightSide = [
            new DataGridColumnSpec(2 + metaDataCols.length, this.generateMeasurementNameCells),
            new DataGridColumnSpec(3 + metaDataCols.length, this.generateUnitsCells),
            new DataGridColumnSpec(4 + metaDataCols.length, this.generateCountCells),
            new DataGridColumnSpec(5 + metaDataCols.length, this.generateMeasuringTimesCells),
            new DataGridColumnSpec(6 + metaDataCols.length, this.generateExperimenterCells),
            new DataGridColumnSpec(7 + metaDataCols.length, this.generateModificationDateCells)
        ];

        return leftSide.concat(metaDataCols, rightSide);
    }

    // Specification for each of the groups that the headers and data columns are organized into
    defineColumnGroupSpec():DataGridColumnGroupSpec[] {
        var topSection:DataGridColumnGroupSpec[] = [
            new DataGridColumnGroupSpec('Name', { 'showInVisibilityList': false })
        ];

        var metaDataColGroups:DataGridColumnGroupSpec[];
        metaDataColGroups = this.metaDataIDsUsedInAssays.map((id, index) => {
            var mdType = EDDData.MetaDataTypes[id];
            return new DataGridColumnGroupSpec(mdType.name);
        });

        var bottomSection:DataGridColumnGroupSpec[] = [
            new DataGridColumnGroupSpec('Measurement', { 'showInVisibilityList': false }),
            new DataGridColumnGroupSpec('Units', { 'showInVisibilityList': false }),
            new DataGridColumnGroupSpec('Count', { 'showInVisibilityList': false }),
            new DataGridColumnGroupSpec('Measuring Times', { 'showInVisibilityList': false }),
            new DataGridColumnGroupSpec('Experimenter', { 'hiddenByDefault': true }),
            new DataGridColumnGroupSpec('Last Modified', { 'hiddenByDefault': true })
        ];

        return topSection.concat(metaDataColGroups, bottomSection);
    }

    // This is called to generate the array of custom header widgets.
    // The order of the array will be the order they are added to the header bar.
    // It's perfectly fine to return an empty array.
    createCustomHeaderWidgets(dataGrid:DataGrid):DataGridHeaderWidget[] {
        var widgetSet:DataGridHeaderWidget[] = [];

        // Create a single widget for substring searching
        var searchAssaysWidget = new DGAssaysSearchWidget(dataGrid, this, 'Search Assays', 30,
                false);
        widgetSet.push(searchAssaysWidget);

        var deselectAllWidget = new DGDeselectAllWidget(dataGrid, this);
        deselectAllWidget.displayBeforeViewMenu(true);
        widgetSet.push(deselectAllWidget);

        // A "select all" button
        var selectAllWidget = new DGSelectAllWidget(dataGrid, this);
        selectAllWidget.displayBeforeViewMenu(true);
        widgetSet.push(selectAllWidget);

        return widgetSet;
    }

    // This is called to generate the array of custom options menu widgets.
    // The order of the array will be the order they are displayed in the menu.
    // It's perfectly fine to return an empty array.
    createCustomOptionsWidgets(dataGrid:DataGrid):DataGridOptionWidget[] {
        var widgetSet:DataGridOptionWidget[] = [];
        // Create a single widget for showing disabled Assays
        var disabledAssaysWidget = new DGDisabledAssaysWidget(dataGrid, this);
        widgetSet.push(disabledAssaysWidget);
        return widgetSet;
    }


    // This is called after everything is initialized, including the creation of the table content.
    onInitialized(dataGrid:DataGridAssays):void {

        // Wire up the 'action panels' for the Assays sections
        var table = this.getTableElement();
        $(table).on('change', ':checkbox', () => StudyDataPage.queueActionPanelRefresh());
        //$(table).on('change', ':checkbox', () => this.refreshIDList());

        // add click handler for menu on assay name cells
        $(table).on('click', 'a.assay-edit-link', (ev) => {
            StudyDataPage.editAssay($(ev.target).closest('.popupcell').find('input').val());
            return false;
        }).on('click', 'a.assay-reload-link', (ev:JQueryMouseEventObject):boolean => {
            var id = $(ev.target).closest('.popupcell').find('input').val(),
                assay:AssayRecord = EDDData.Assays[id];
            if (assay) {
                StudyDataPage.requestAssayData(assay);
            }
            return false;
        });

        // on page load of data hide assays section
//        $( "input[name*='assaysSearch']" ).parents('thead').hide();
        // Run it once in case the page was generated with checked Assays
        StudyDataPage.queueActionPanelRefresh();
    }
}



// When unchecked, this hides the set of Assays that are marked as disabled.
class DGDisabledAssaysWidget extends DataGridOptionWidget {

    createElements(uniqueID:any):void {
        var cbID:string = this.dataGridSpec.tableSpec.id+'ShowDAssaysCB'+uniqueID;
        var cb:HTMLInputElement = this._createCheckbox(cbID, cbID, '1');
        $(cb).click( (e) => this.dataGridOwnerObject.clickedOptionWidget(e) );
        if (this.isEnabledByDefault()) {
            cb.setAttribute('checked', 'checked');
        }
        this.checkBoxElement = cb;
        this.labelElement = this._createLabel('Show Disabled', cbID);
        this._createdElements = true;
    }

    applyFilterToIDs(rowIDs:string[]):string[] {

        // If the box is checked, return the set of IDs unfiltered
        if (this.checkBoxElement.checked) {
            return rowIDs;
        }

        var filteredIDs = [];
        for (var r = 0; r < rowIDs.length; r++) {
            var id = rowIDs[r];
            // Here is the condition that determines whether the rows associated with this ID are
            // shown or hidden.
            if (EDDData.Assays[id].active) {
                filteredIDs.push(id);
            }

        }
        return filteredIDs;
    }

    initialFormatRowElementsForID(dataRowObjects:any, rowID:any):any {
        if (!EDDData.Assays[rowID].active) {
            $.each(dataRowObjects, (x, row) => $(row.getElement()).addClass('disabledRecord'));
        }
    }
}



// This is a DataGridHeaderWidget derived from DGSearchWidget. It's a search field that offers
// options for additional data types, querying the server for results.
class DGAssaysSearchWidget extends DGSearchWidget {

    searchDisclosureElement:any;

    constructor(dataGridOwnerObject:any, dataGridSpec:any, placeHolder:string, size:number,
            getsFocus:boolean) {
        super(dataGridOwnerObject, dataGridSpec, placeHolder, size, getsFocus);
    }

    // The uniqueID is provided to assist the widget in avoiding collisions when creating input
    // element labels or other things requiring an ID.
    createElements(uniqueID:any):void {
        super.createElements(uniqueID);
        this.createdElements(true);
    }

    // This is called to append the widget elements beneath the given element. If the elements have
    // not been created yet, they are created, and the uniqueID is passed along.
    appendElements(container:any, uniqueID:any):void {
        if (!this.createdElements()) {
            this.createElements(uniqueID);
        }
        container.appendChild(this.element);
    }
}


// use JQuery ready event shortcut to call prepareIt when page is ready
$(() => StudyDataPage.prepareIt());