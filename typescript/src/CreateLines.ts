/// <reference types="jqueryui" />
import { EDDAuto } from "../modules/EDDAutocomplete"
import { EddRest } from "../modules/EDDRest"
import { Utl } from "../modules/Utl"
import * as $ from "jquery"
import "bootstrap-loader"

declare function require(name: string): any;  // avoiding warnings for require calls below

// as of JQuery UI 1.12, need to require each dependency individually
require('jquery-ui/themes/base/core.css');
require('jquery-ui/themes/base/selectable.css');
require('jquery-ui/themes/base/sortable.css');
require('jquery-ui/themes/base/dialog.css');
require('jquery-ui/themes/base/spinner.css');
require('jquery-ui/themes/base/theme.css');
require('jquery-ui/ui/widgets/selectable');
require('jquery-ui/ui/widgets/sortable');
require('jquery-ui/ui/widgets/dialog');
require('jquery-ui/ui/widgets/spinner');

module CreateLines {
    const DATA_FORMAT_STRING:string = 'string';
    const ROW_INDEX = 'rowIndex';

    //TODO: relocate, e.g. to EDDRest.ts.  Initial attempts compiled but failed to run in
    // strange ways.
    /* Default metadata names that may have to be explicitly-referenced in the UI */
    export const LINE_NAME_META_NAME = 'Line Name';
    export const LINE_EXPERIMENTER_META_NAME = 'Line Experimenter';
    export const LINE_DESCRIPTION_META_NAME = 'Line Description';
    export const LINE_CONTACT_META_NAME = 'Line Contact';
    export const CARBON_SOURCE_META_NAME = 'Carbon Source(s)';
    export const STRAINS_META_NAME = 'Strain(s)';
    export const CONTROL_META_NAME = 'Control';


    // Metadata types present in the database that should be omitted from user-displayed lists in
    // contexts where separate display is available for line attributes.
    export const LINE_ATTRIBUTE_META_TYPES = [LINE_NAME_META_NAME, LINE_DESCRIPTION_META_NAME,
        LINE_CONTACT_META_NAME, LINE_EXPERIMENTER_META_NAME, STRAINS_META_NAME];

    const RELATED_MODEL_FIELDS = {};
    RELATED_MODEL_FIELDS[STRAINS_META_NAME] = {
                nameEltLabel: 'Strain Name',
                nameEltJsonId: 'strain__name'};
    RELATED_MODEL_FIELDS[LINE_CONTACT_META_NAME] = {
                nameEltLabel: 'Contact Last Name',
                nameEltJsonId: 'contact__last_name'};
    RELATED_MODEL_FIELDS[LINE_EXPERIMENTER_META_NAME]= {
                nameEltLabel: 'Experimenter Last Name',
                nameEltJsonId: 'experimenter__last_name',};
    //CARBON_SOURCE_META_NAME: [], // TODO: add Carbon Source Support

    const REPLICATE_COUNT_JSON_ID = 'replicate_count';
    const REPLICATE_NUM_NAME_ID = 'replicate_num';

    function loadAllLineMetadataTypes():void {
        $('#addPropertyButton').prop('disabled', true);
        EddRest.loadMetadataTypes(
            {
                'success': creationManager.setLineMetaTypes.bind(creationManager),
                'error': showMetaLoadFailed,
                'request_all': true, // get all result pages
                'wait': showWaitMessage,
                'context': EddRest.LINE_METADATA_CONTEXT,
                'ordering': 'type_name',
            });
    }

    function showWaitMessage(): void {
        console.log('Showing wait message');
        var div: JQuery, span;
        div = $('#step2_status_div');
        div.empty();

        span = $("<span>")
            .text('Loading line metadata types...')
            .addClass('errorMessage')
            .appendTo(div);
    }

    function showMetaLoadFailed(jqXHR, textStatus:string, errorThrown:string): void {
        var div: JQuery, span;
        div = $('#step2_status_div');
        div.empty();

        span = $("<span>")
            .text('Unable to load line metadata from EDD. Property selection is disabled.')
            .addClass('errorMessage')
            .appendTo(div);

        $('<a>').text(' Retry').on('click', () => {
            loadAllLineMetadataTypes();
        }).appendTo(span);
    }

    class LineAttributeDescriptor {
        jsonId: any; // string for special-cases, integer pk for metadata
        nameEltJsonId: any;
        inputLabel: string;
        nameEltLabel: string;

        constructor(jsonId, inputLabel, nameEltLabel=null, nameEltJsonId=null) {
            this.jsonId = jsonId;
            this.inputLabel = inputLabel;
            this.nameEltJsonId = nameEltJsonId || jsonId;
            this.nameEltLabel = nameEltLabel || inputLabel;
        }

        toString(): string {
            return '(' + this.jsonId.toString() + ', ' + this.inputLabel + ')';
        }
    }

    export class MultiValueInput {
        uiLabel: JQuery;
        lineAttribute: LineAttributeDescriptor;
        maxRows: number;
        minEntries: number;

        rows: JQuery[] = [];
        addButton: JQuery;

        constructor(options:any) {
            this.lineAttribute = options.lineAttribute;
            if (!this.lineAttribute) {
                throw Error('lineAttribute is required');
            }

            this.uiLabel = $('<label>')
                .text(this.lineAttribute.inputLabel + ':')
                .addClass('not-in-use');

            this.maxRows = options.maxRows === undefined ? 30 : options.maxRows;
            this.minEntries = options['minEntries'] || 0;
        }

        hasValidInput(rowIndex: number ): boolean {
            return this.rows[rowIndex].find('input').first().val().trim() != '';
        }

        validInputCount(): number {
            var count: number = 0;
            for(var i=0; i<this.rows.length; i++) {
                if(this.hasValidInput(i)) {
                    count++;
                }
            }
            return count;
        }

        highlightRowLabel(anyValidInput:boolean): void {
            this.rows[0].find('label')
                .first()
                .toggleClass('in-use', anyValidInput)
                .toggleClass('not-in-use', !anyValidInput);
        }

        getLabel(): JQuery {
            return this.uiLabel;
        }


        buildRemoveBtn(container: JQuery): JQuery {
            var btn: JQuery, rowIndex:number, t:any;
            // add a delete button in the same cell as the input controls

            if (this.getRowCount() > this.minEntries) {
                rowIndex = this.getRowCount() -1;
                btn = $('<button>')
                    .addClass('removeButton')
                    .appendTo(container);
                $('<span>').addClass('ui-icon')
                    .addClass('ui-icon-trash').appendTo(btn);
                this.registerRemoveEvtHandler(btn, rowIndex);
                return btn;
            }
            return null;
        }

        registerRemoveEvtHandler(removeButton, rowIndex) {
            removeButton.off('click');

            removeButton.on('click', null, {'rowIndex': rowIndex, 'propertyInput': this},
                        (ev: JQueryMouseEventObject) => {
                        var rowIndex: number, propertyInput:any;

                        rowIndex = ev.data.rowIndex;
                        propertyInput = ev.data.propertyInput;

                        propertyInput.removeRow(rowIndex);
                        if(propertyInput.getRowCount() == 0) {
                            creationManager.removeInput(propertyInput.lineAttribute);
                        }
                    });
        }

        buildAddControl(container: JQuery) {
            // only add the control to the first row
            if ((this.getRowCount() == 1) && (this.getRowCount() < this.maxRows)) {
                this.addButton = $('<button>')
                    .addClass('addButton')
                    .on('click', this.appendRow.bind(this))
                    .appendTo(container);

                $('<span>').addClass('ui-icon')
                    .addClass('ui-icon-plusthick').appendTo(this.addButton);
            }
        }

        canAddRows(): boolean {
            return this.getRowCount() < this.maxRows;
        }

        getRowCount(): number {
             return this.rows.length;
        }

        appendRow(): void {
            var newRow: JQuery, parent: JQuery, atMax: boolean, prevRow: JQuery;
            prevRow = this.rows[this.rows.length-1];

            newRow = $('<div>')
                .addClass('table-row')
                .insertAfter(prevRow);
            this.fillRow(newRow);

            this.updateInputState();
        }

        promoteRowContent(firstRow: JQuery, nextRow: JQuery) {
            var inputCell: JQuery;
            // remove only the input cell content from this row, leaving labeling and controls
            // in place
            inputCell = firstRow.children('.inputCell').empty();

            // detach and relocate input cell content from the following row, moving it up
            nextRow.children('.inputCell').children().each(function(index:number, element: Element)
            {
                $(element).detach().appendTo(inputCell);
            });
        }

        removeRow(rowIndex: number): void {
            var row: JQuery, hadValidInput: boolean, nextRow: JQuery, inputCell:JQuery;

            hadValidInput = this.hasValidInput(rowIndex);
            row = this.rows[rowIndex];

            // if removing the title row, relocate inputs from the second row to the first, then
            // remove the second row
            if(rowIndex == 0 && this.rows.length > 1) {
                nextRow = this.rows[rowIndex+1];
                this.promoteRowContent(row, nextRow);

                // remove the now-empty second row whose inputs were moved up to first
                nextRow.remove();
                this.rows.splice(rowIndex+1, 1);
            }
            // if removing a row other than the first / title row, just remove everything
            else {
                row.remove();
                this.rows.splice(rowIndex, 1);
            }

            // update event handlers for subsequent rows to get the correct index number following
            // the removal of a preceding row
            for(var i=rowIndex; i < this.rows.length; i++) {
                var removeBtn: JQuery;
                row = this.rows[i];
                removeBtn = row.find('.removeButton').first();
                this.registerRemoveEvtHandler(removeBtn, i);
            }

            if(this.getRowCount() == 0) {
                this.removeFromForm();
            }

            // if the removed row had valid user input, recompute results
            if(this.rows.length) {
                this.updateInputState();
            }
            if(hadValidInput) {
                this.postRemoveCallback(rowIndex, hadValidInput);
            }
        }

        removeFromForm() {
            creationManager.removeInput(this.lineAttribute);
        }

        postRemoveCallback(rowIndex: number, hadValidInput:boolean):void {
            // empty default implementation for children to override
        }

        updateInputState(): void {
            // empty default implementation for children to override
        }

        fillRow(row: JQuery): void {
            // empty default implementation for children to override
        }

        getValueJson(): any {
            // empty default implementation for children to override
        }
    }

    export class AbbreviationInput extends MultiValueInput {

        constructor(options:any) {
            super(options);
            this.uiLabel = $('<label>')
                .text(this.lineAttribute.nameEltLabel + ':')
                .addClass('not-in-use');
        }

        hasValidInput(rowIndex: number): boolean {
            var match:any, abbrev:any;

            match = this.rows[rowIndex].find('.abbrev-match-input').val();
            abbrev = this.rows[rowIndex].find('.abbrev-val-input').val();

            return (match != undefined) && match.toString().trim() &&
                   (abbrev != undefined) && abbrev.toString().trim();
        }

        removeFromForm() {
            creationManager.removeAbbrev(this.lineAttribute);
        }

        getValueJson(): any {
            var values: any = {}, self:AbbreviationInput = this;

            if(!this.rows.length) {
                return null;
            }

            this.rows.forEach((currentValue, rowIndex, arr) => {
                var match: any, abbrev: any;
                if(this.hasValidInput(rowIndex)) {
                    match = this.rows[rowIndex].find('.abbrev-match-input').val();
                    abbrev = this.rows[rowIndex].find('.abbrev-val-input').val();
                    values[match] = abbrev;
                }
            });
            return values;
        }

        fillRow(row: JQuery):void {
            var firstRow: boolean, row: JQuery, valCell: JQuery, addCell: JQuery,
                abbrevCell: JQuery, labelCell: JQuery, self: AbbreviationInput;
            self = this;

            this.rows.push(row);

            addCell = $('<div>')
                .addClass('bulk_lines_table_cell')
                .addClass('addCell')
                .appendTo(row);

            labelCell = $('<div>')
                .addClass('bulk_lines_table_cell')
                .appendTo(row);

            firstRow = this.getRowCount() == 1;
            if(firstRow) {
                this.buildAddControl(addCell);
                this.getLabel()
                    .appendTo(labelCell);
            }

            this.addAbbrevInput(row, 'abbrev-match-cell', 'abbrev-match-input');
            valCell = this.addAbbrevInput(row, 'abbrev-val-cell', 'abbrev-val-input');

            this.buildRemoveBtn(valCell);
            this.updateInputState();
        }

        promoteRowContent(firstRow: JQuery, nextRow: JQuery) {
            var firstRowCell: JQuery;
            // remove only the input cell content from this row, leaving labeling and controls
            // in place
            firstRowCell = firstRow.children('.abbrev-match-cell').empty();

            // detach and relocate input cell content from the following row, moving it up
            nextRow.children('.abbrev-match-cell').each(function(index:number, element: Element)
            {
                $(element).detach().appendTo(firstRowCell);
            });

            firstRowCell = firstRow.children('.abbrev-val-cell').empty();
            // detach and relocate input cell content from the following row, moving it up
            nextRow.children('.abbrev-val-cell').each(function(index:number, element: Element)
            {
                $(element).detach().appendTo(firstRowCell);
            });
        }

        addAbbrevInput(row: JQuery, cellClassName: string, inputClassName: string): JQuery {
            var cell: JQuery, self: AbbreviationInput;
            self = this;
            cell = $('<div>')
                .addClass(cellClassName)
                .addClass('columnar-text-input')
                .addClass('bulk_lines_table_cell')
                .addClass('inputCell')
                .appendTo(row);

            $('<input type="text">')
                .addClass(inputClassName)
                .on('change', function() {
                    self.updateInputState();
                    creationManager.updateAbbreviations();
                })
                .appendTo(cell);

            return cell;
        }

        registerRemoveEvtHandler(removeButton, rowIndex) {
            removeButton.off('click');

            removeButton.on('click', null, {'rowIndex': rowIndex, 'abbrevInput': this},
                        (ev: JQueryMouseEventObject) => {
                var rowIndex: number, abbrevInput:any;

                rowIndex = ev.data.rowIndex;
                abbrevInput = ev.data.abbrevInput;

                abbrevInput.removeRow(rowIndex);
                if(abbrevInput.getRowCount() == 0) {
                    creationManager.removeAbbrev(abbrevInput.lineAttribute);
                }
            });
        }
    }

    //TODO: for immediate development
    // 1. differentiate naming / json output from un-implemented controls (e.g. strain)
    // 2. compute / test JSON generation from supported controls
    // 3. implement / test back end communication / review / line creation
    // 4. error handling!! / wizard
    // 5. implement & test abbreviations & custom name elements...nice-to-have, but not necessary
    //    to extract value
    // TODO: revisit meta / attribute subclasses after some integration testing / review of
    // back-end code. May be able to combine some of these.
    export class LineAttributeInput extends MultiValueInput {
         supportsCombinations: boolean;

         constructor(options: any) {
             super(options);
             this.supportsCombinations = options.supportsCombinations === undefined ?
                true: options.supportsCombinations;
         }

         updateInputState() {
             if(this.addButton) {
                 this.addButton.prop('disabled', !this.canAddRows());
             }
             this.highlightRowLabel(this.validInputCount() > 0);
             this.autoUpdateCombinations();
         }

        getNameElements(): LineAttributeDescriptor[] {
             var validInputCount:number = this.validInputCount(), hasInput:boolean;
             hasInput = validInputCount > 0;

            // only allow naming inputs to be used if there's at least one valid value to insert
            // into line names. note that allowing non-unique values to be used in line names
            // during bulk creation can be helpful since they may differentiate new lines from
            // those already in the study.
            if(!hasInput) {
                return [];
            }

            return [this.lineAttribute];
        }

        getInput(rowIndex: number): any {
            return this.rows[rowIndex].find('input').first().val().trim();
        }

        buildYesComboButton(): JQuery {
            return $('<input type="radio">')
                .prop('name', this.lineAttribute.jsonId)
                .val('Yes')
                .addClass('property_radio');
        }

        buildNoComboButton(): JQuery {
            return $('<input type="radio">')
                .prop('name', this.lineAttribute.jsonId)
                .prop('checked', true)
                .val('No')
                .addClass('property_radio');
        }

        hasComboInputs(): boolean {
             return this.rows.length > 1;
        }

        autoUpdateCombinations() {
            var comboInputs: boolean, combosButton:JQuery, noCombosButton:JQuery;
            comboInputs = this.hasComboInputs();
            noCombosButton = this.rows[0].find('input:radio[value=No]');
            console.log('no combo button matches: ' + noCombosButton.length);

            if(this.supportsCombinations) {
                // note: not all inputs will have a "make combos" button  -- need enclosing check
                combosButton = this.rows[0].find('input:radio[value=Yes]');
            }

            if(comboInputs) {
                combosButton.attr('checked', 'checked');
                combosButton.attr('disabled', String(!comboInputs));
            }
            else {
                noCombosButton.attr('checked', 'checked');
            }

            noCombosButton.attr('disabled', String(comboInputs || this.supportsCombinations));
        }

        getValueJson(): any {
            var values: string[] = [];
            this.rows.forEach((currentValue, index, arr) => {
                if(this.hasValidInput(index)) {
                    values.push(this.getInput(index));
                }
            });

            // if there's only one valid value, don't package it in an array
            if(values.length == 1) {
                return values[0];
            }
            return values;
        }

        fillRow(row: JQuery):void {
            var firstRow: boolean, row: JQuery, inputCell: JQuery, addCell: JQuery,
                applyAllCell: JQuery, makeComboCell: JQuery, labelCell: JQuery,
                noComboButton: JQuery, yesComboButton: JQuery, flewGrowWrapper: JQuery;

            this.rows.push(row);

            addCell = $('<div>')
                .addClass('bulk_lines_table_cell')
                .addClass('addCell')
                .appendTo(row);

            labelCell = $('<div>')
                .addClass('bulk_lines_table_cell')
                .appendTo(row);

            firstRow = this.getRowCount() == 1;
            if(firstRow) {
                this.buildAddControl(addCell);
                this.getLabel()
                    .appendTo(labelCell);
            }

            inputCell = $('<div>')
                .addClass('bulk_lines_table_cell')
                .addClass('inputCell')
                .appendTo(row);

            flewGrowWrapper = $('<div>').addClass('inputContent').appendTo(inputCell);

            this.fillInputControls(flewGrowWrapper);

            applyAllCell = $('<div>')
                .addClass('bulk_lines_table_cell')
                .addClass('centered_radio_btn_parent')
                .appendTo(row);

            if(firstRow) {
                noComboButton = this.buildNoComboButton().appendTo(applyAllCell);
            }

            makeComboCell = $('<div>')
                .addClass('bulk_lines_table_cell')
                .addClass('centered_radio_btn_parent')
                .appendTo(row);

            if(firstRow && this.supportsCombinations) {
                yesComboButton = this.buildYesComboButton()
                    .appendTo(makeComboCell);
                noComboButton.prop('checked', true);
            }
            this.updateInputState();
        }

        fillInputControls(inputCell: JQuery): void {
             // by default, just fill in a single text box.  child classes may override with
            // alternate user inputs
            var text: JQuery, hidden: JQuery, self: LineAttributeInput;
            self = this;

            text = $('<input type="text">')
                .addClass('columnar-text-input');
            text.on('change', function () {
                self.updateInputState();
                creationManager.updateNameElementChoices();
            });

            inputCell.append(text)
                .append(hidden);
            this.buildRemoveBtn(inputCell);
        }

        postRemoveCallback(rowIndex: number, hadValidInput:boolean):void {
            if(hadValidInput) {
                creationManager.updateNameElementChoices();
            }
        }
    }

    export class LineAttributeAutoInput extends LineAttributeInput {

        autoInput: EDDAuto.BaseAuto;

        constructor(options) {
            super(options);
        }

        // build custom input controls whose type depends on the data type of the Line attribute
        // they configure
        fillInputControls(inputCell: JQuery): void {
            var visible: JQuery, hidden: JQuery, self: LineAttributeAutoInput;
            self = this;

            visible = $('<input type="text" autocomplete="off">')
                .addClass('columnar-text-input')
                .addClass('autocomp')
                .addClass('autocomp_search')
                //.addClass('form-control')
                .addClass('ui-autocomplete-input');
            hidden = $('<input type="hidden">')
                .addClass('step2-value-input');

            hidden.on('change', function() {
                self.updateInputState();
                creationManager.updateNameElementChoices();
            });

            inputCell.append(visible)
                .append(hidden);

            switch (this.lineAttribute.inputLabel) {
                case LINE_EXPERIMENTER_META_NAME:
                case LINE_CONTACT_META_NAME:
                    visible.attr('eddautocompletetype', "User");
                    this.autoInput = new EDDAuto.User({
                        'container': inputCell,
                        'visibleInput': visible,
                        'hiddenInput': hidden,
                    });
                    break;
                case CARBON_SOURCE_META_NAME:
                    visible.attr('eddautocompletetype', "CarbonSource");
                    this.autoInput = new EDDAuto.CarbonSource({
                        'container': inputCell,
                        'visibleInput': visible,
                        'hiddenInput': hidden,
                    });
                    break;
                case STRAINS_META_NAME:
                    visible.attr('eddautocompletetype', "Registry");
                    this.autoInput = new EDDAuto.Registry({
                        'container': inputCell,
                        'visibleInput': visible,
                        'hiddenInput': hidden,
                    });
                    break;
            }
            this.buildRemoveBtn(inputCell);
        }

        getInput(rowIndex: number): any {
            var stringVal: string;
            stringVal = this.rows[rowIndex].find('input[type=hidden]').first().val();

            if(this.lineAttribute.inputLabel == STRAINS_META_NAME) {
                // strain autocomplete uses UUID
                return stringVal;
            }
            // non-strain autocompletes use integer pk's
            return parseInt(stringVal);
        }
    }

    export class BooleanInput extends LineAttributeInput {
        yesCheckbox: JQuery;
        noCheckbox: JQuery;

        constructor(options:any) {
            super(options);
        }

        fillInputControls(rowContainer: JQuery): void {
            var self: BooleanInput = this, removeBtn: JQuery, buttonsDiv: JQuery;
            buttonsDiv = $('<div>')
                .addClass('columnar-text-input')  //TODO: rename class for this new use
                .appendTo(rowContainer);

            this.yesCheckbox = $('<input type="checkbox">')
                .on('change', function() {
                    self.updateInputState();
                    creationManager.updateNameElementChoices();
                })
                .appendTo(buttonsDiv);
            $('<label>')
                .text('Yes')
                .appendTo(buttonsDiv);
            this.noCheckbox = $('<input type="checkbox">')
                .on('change', function() {
                    self.updateInputState();
                    creationManager.updateNameElementChoices();
                })
                .appendTo(buttonsDiv);
            $('<label>')
                .text('No')
                .appendTo(buttonsDiv);
            removeBtn = this.buildRemoveBtn(rowContainer);
            removeBtn.addClass('controlRemoveBtn');
        }

        hasComboInputs(): boolean {
            return this.yesCheckbox.prop('checked') &&
                   this.noCheckbox.prop('checked');
        }

        hasValidInput(rowIndex: number) {
            return this.yesCheckbox.prop('checked')
                || this.noCheckbox.prop('checked');
        }

        getValueJson(): any {
            return this.getInput(0);
        }

        getInput(rowIndex: number): any {
            var values = [];
            if(this.yesCheckbox.prop('checked')) {
                values.push(true);
            }
            if(this.noCheckbox.prop('checked')) {
                values.push(false);
            }
            return values;
        }
    }

    export class NumberInput extends LineAttributeInput {
        constructor(options:any) {
            options.maxRows = 1;
            options.minRows = 1;
            options.supportsCombinations = false;
            super(options);
        }

        hasValidInput(rowIndex: number):boolean {
            return $('#spinner').val() > 1;
        }

        fillInputControls(rowContainer: JQuery): void {
            $('<input id="spinner">')
                .val(1)
                .addClass('columnar-text-input')
                .addClass('step2-value-input')
                .appendTo(rowContainer);
        }

        getInput(rowIndex: number): any {
            var textInput = super.getInput(rowIndex);
            return +textInput;
        }
    }

    export class CreationManager {
        // line properties configured in step 2
        lineProperties:LineAttributeInput[] = [];

        // name elements in use in step 3
        lineNameElements:LineAttributeDescriptor[] = [];

        abbreviations: AbbreviationInput[] = [];

        replicateInput: LineAttributeInput;
        lineMetaAutocomplete: EDDAuto.LineMetadataType = null;  //TODO

        nonAutocompleteLineMetaTypes: any[] = [];
        autocompleteLineMetaTypes: any = {};

        indicatorColorIndex:number = 0;
        colors = ['red', 'blue', 'yellow', 'orange', 'purple'];
        colorIndex = 0;

        previewUpdateTimerID:number = null;

        namingInputsChanged = false;

        static autocompleteMetadataNames = [LINE_EXPERIMENTER_META_NAME, LINE_CONTACT_META_NAME,
                                     CARBON_SOURCE_META_NAME, STRAINS_META_NAME];

        constructor() {
            this.replicateInput = new NumberInput({
                    'lineAttribute': new LineAttributeDescriptor(REPLICATE_COUNT_JSON_ID,
                                                                 'Replicates', 'Replicate #',
                                                                  REPLICATE_NUM_NAME_ID)});
            this.lineProperties = [this.replicateInput];
        }

        // Start a timer to wait before calling updating the line name preview, which requires
        // an AJAX call to the back end
        queuePreviewUpdate(): void {
            $('#step4Label').addClass('wait');
            if (this.previewUpdateTimerID) {
                clearTimeout(this.previewUpdateTimerID);
            }
            this.previewUpdateTimerID = setTimeout(this.updatePreview.bind(this), 500);  //TODO:
            // 250 in import
        }

        addInput(lineAttr: LineAttributeDescriptor): void {
            var newInput: LineAttributeInput, autocompleteMetaItem:any;

            autocompleteMetaItem = this.autocompleteLineMetaTypes[lineAttr.jsonId];
            if(autocompleteMetaItem) {
                newInput = new LineAttributeAutoInput({'lineAttribute': lineAttr});
            }
            else if(EddRest.CONTROL_META_NAME == lineAttr.inputLabel) {
                newInput = new BooleanInput({'lineAttribute': lineAttr, 'maxRows': 1})
            }
            else {
                newInput = new LineAttributeInput({'lineAttribute': lineAttr});
            }

            this.lineProperties.push(newInput);
            this.insertLineAttribute(newInput);
        }

        removeInput(lineAttr: LineAttributeDescriptor): void {
            var foundIndex = -1, lineProperty: LineAttributeInput;
            this.lineProperties.forEach(function(property, index:number) {
                if(property.lineAttribute.jsonId === lineAttr.jsonId) {
                    foundIndex = index;
                    lineProperty = property;
                    return false;  //stop looping
                }
            });

            // remove the property from our tracking and from the DOM
            this.lineProperties.splice(foundIndex, 1);
            $('#line-properties-table')
                .children('.line_attr_' + lineAttr.jsonId)
                .remove();

            // restore user's ability to choose this option via the "add property" dropdown
            this.lineMetaAutocomplete.reinstateKey(String(lineAttr.jsonId));

            this.updateNameElementChoices();
        }

        removeAbbrev(lineAttr: LineAttributeDescriptor): void {
            var foundIndex = -1, abbrevInput: AbbreviationInput;
            this.abbreviations.forEach(function(abbrev, index:number) {
                if(abbrev.lineAttribute.jsonId === lineAttr.jsonId) {
                    foundIndex = index;
                    abbrevInput = abbrev;
                    return false;  //stop looping
                }
            });

            // remove the abbreviation from our tracking and from the DOM
            this.abbreviations.splice(foundIndex, 1);
            $('#abbreviations-table')
                .children('.line_attr_' + lineAttr.jsonId)
                .remove();

            this.updateHasAbbrevInputs();
            this.queuePreviewUpdate();
        }

        insertLineAttribute(input:LineAttributeInput): void {
            var parentDiv: JQuery;
            parentDiv = $('#line-properties-table');
            this.insertRow(input, parentDiv);
        }

        insertAbbreviation(lineAttr:LineAttributeDescriptor): void {
            var parentDiv: JQuery, input: AbbreviationInput;
            parentDiv = $('#abbreviations-table');
            input = new AbbreviationInput({'lineAttribute': lineAttr});
            this.abbreviations.push(input);
            this.insertRow(input, parentDiv);
        }

        // TODO: integrate with button and complete work. Note that list elements used to represent
        // the labels in the "name element order" subsection should update dynamically based on
        // user entries here
        addCustomElt(): void {
            var table: JQuery, row: JQuery, cell: JQuery;
            table = $('custom-elements-table');
            row = $('<div>')
                .addClass('table-row')
                .appendTo(table);

            // label cell
            cell = $('<div>')
                .addClass('cell')
                .appendTo(row);
            $('<input type="text">').appendTo(cell);

            // value cell
            cell = $('<div>')
                .addClass('cell')
                .appendTo(row);
            $('<input type="text">').appendTo(cell);
        }

        insertRow(input:MultiValueInput, parentDiv:JQuery): void {
            var row: JQuery;
            row = $('<div>')
                    .addClass('line_attr_' + input.lineAttribute.nameEltJsonId)
                    .addClass('table-row')
                    .appendTo(parentDiv);
            input.fillRow(row);
        }

        buildStep3Inputs(): void {
            // set up connected lists for naming elements
            $( "#line_name_elts, #unused_line_name_elts" ).sortable({
              connectWith: ".connectedSortable",
                update: function(event, ui) {
                      creationManager.queuePreviewUpdate();
                },
            }).disableSelection();

            // set up selectable list for abbreviations dialog
            $('#line-name-abbrev-list').selectable();
        }

        buildStep2Inputs(): void {

            creationManager.buildAddPropDialog();
            creationManager.buildAbbrevDialog();

            // add options for any naming elements that should be available by default
            this.lineProperties.forEach((input: LineAttributeInput, i: number): void => {
                this.insertLineAttribute(input);
            });

            // style the replicates spinner
            $("#spinner").spinner({
                min: 1,
                change: function(event, ui) {
                        creationManager.replicateInput.updateInputState();
                        creationManager.updateNameElementChoices();
                    }});

            // update step 3 choices based on step 2 defaults
            this.updateNameElementChoices();
        }

        updateAbbreviations(): void {

            //TODO: similar to line properties, detect whether abbreviation matches / values
            // have changed, then trigger a preview update

            this.queuePreviewUpdate();
        }

        updateNameElementChoices(): void {
            var availableElts: LineAttributeDescriptor[], prevNameElts: LineAttributeDescriptor[],
                newElts: LineAttributeDescriptor[], unusedList: JQuery, unusedChildren: JQuery,
                nameEltsChanged:boolean, self:CreationManager;
            console.log('updating available naming elements');

            //build an updated list of available naming elements based on user entries in step 1
            availableElts = [];
            this.lineProperties.forEach((input: LineAttributeInput): void => {
                var elts: LineAttributeDescriptor[] = input.getNameElements();
                availableElts = availableElts.concat(elts);
            });

            // loop over available elements, constructing a list of those newly added in step 2 so
            // they can be appended at the end of the step 3 list without altering previous user
            // changes
            newElts = availableElts.slice();
            self = this;
            $('#line_name_elts').children().each(function() {
                var text:string, element:any, foundIndex:number, nameElement:any, index:number;

                // start to build up a list of newly-available selections. we'll clear out more of
                // them from the list of unavailable ones
                nameElement = $(this).data();

                for(index = 0; index < newElts.length; index++) {
                    element = newElts[index];

                    if(element.jsonId == nameElement.jsonId) {
                        self.lineNameElements.push(nameElement);
                        newElts.splice(index, 1);
                        return true;  // continue outer loop
                    }
                }
                $(this).remove();
                return true;  // continue looping
             });


            console.log('Available name elements: ' + availableElts);

            unusedList = $('#unused_line_name_elts');
            unusedChildren = unusedList.children();

            if(unusedChildren){
                unusedChildren.each(function(unusedIndex: number, listElement: Element) {
                    var availableElt: any, newIndex: number, listElement: Element;
                    listElement = this;

                    for(newIndex = 0; newIndex < newElts.length; newIndex++) {
                        availableElt = newElts[newIndex];

                        if(availableElt.inputLabel == listElement.textContent) {
                            console.log('Found matching element ' + listElement.textContent);
                            newElts.splice(newIndex, 1);
                            return true;
                        }
                    }
                    console.log('Removing ' + this.textContent + ' from unused list');
                    this.remove();
                    return true;
                });
            }


            // add newly-inserted elements into the 'unused' section. that way previous
            // configuration stays unaltered
            newElts.forEach((elt:LineAttributeDescriptor) => {
                var li: JQuery;
                li = $('<li>')
                    .text(elt.nameEltLabel)
                    .addClass('ui-state-default')
                    .data(elt)
                    .appendTo(unusedList);

                // add an arrow to indicate the item can be dragged between lists
                $('<span>')
                    .addClass('ui-icon')
                    .addClass('ui-icon-arrowthick-2-n-s')
                    .appendTo(li);
            });

            // skip JSON reconstruction / resulting server request if naming elements are the same
            // as before. Note that since the form will never add a naming element
            // automatically, comparing array dimensions is enough
            nameEltsChanged = this.lineNameElements.length != $('#line_name_elts').children().length;

            if(nameEltsChanged) {
                this.namingInputsChanged = true;
            }
            this.updateAbbreviations();
        }

        updatePreview(): void {
            var self: CreationManager, json: string, csrfToken: string, statusDiv: JQuery;
            self = this;
            //build an updated list of naming elements based on user entries in steps 1 & 2. Note
            // that events from the connected lists don't give us enough info to know which element
            // was just changed in line names
            this.lineNameElements = [];
            $('#line_name_elts').children().each(function() {
                var nameElement: any = $(this).data();
                self.lineNameElements.push(nameElement);
            });

            // clear preview and return early if insufficient inputs available
            if(!this.lineNameElements.length) {
                $('#step4-status-div').empty().text('Select at least one line name element' +
                    ' above');
                $('#bulk-line-table').addClass('hide');

                $('#jsonTest').text('');
                $('#backEndResponse').text('');
                return;
            } else {
                $('#step4-status-div').empty();
            }

            //TODO: remove the color-based indicator and auto-JSON creation here following testing
            var color: string;
            console.log('updating JSON results');
            color = this.colors[this.colorIndex];
            $('#indicator').css('background',color);
            this.colorIndex = (this.colorIndex+1) % this.colors.length;
            console.log('Color index = ' + this.colorIndex);

            json = this.buildJson();

            // submit a query to the back end to compute line / assay names and detect errors
            // before actually making any changes
            $.ajax(
                '../../describe/?DRY_RUN=True', // TODO: path?
                {
                    headers: {'Content-Type' : 'application/json'},
                    method: 'POST',
                    dataType: 'json',
                    data: json,
                    processData: false,
                    success: (responseJson) => {
                        $('#backEndResponse').text(responseJson);
                    },
                    'error': (jqXHR, textStatus: string, errorThrown: string) => {
                        $('#backEndResponse').text(textStatus + '\n\n' + errorThrown);
                    }
                }
        );

            $('#step4Label').removeClass('wait');
        }

        setLineMetaTypes(metadataTypes:any[]) {
            var self:CreationManager = this;
            $('#step2_status_div').empty();
            $('#addPropertyButton').prop('disabled', false);

            this.nonAutocompleteLineMetaTypes = [];
            this.autocompleteLineMetaTypes = {};
            metadataTypes.forEach(function(metaType) {
                if(CreationManager.autocompleteMetadataNames.indexOf(metaType.type_name) < 0) {
                    self.nonAutocompleteLineMetaTypes.push(metaType);
                }
                else {
                    self.autocompleteLineMetaTypes[metaType.pk] = metaType;
                }
            });
            // TODO:
        }

        showAddProperty(): void {
            $('#add-prop-dialog').dialog('open');
        }

        buildAddPropDialog(): void {
            var self: CreationManager = this;
            $('#add-prop-dialog').dialog({
                resizable: false,
                modal: true,
                autoOpen: false,
                buttons: {
                    'Add Property': function() {
                        var meta_name:string, meta_pk:number, textInput: JQuery,
                            hiddenInput: JQuery, supportedProperties: any,
                            descriptor: LineAttributeDescriptor;
                        textInput = $('#add-line-metadata-text');
                        hiddenInput = $('#add-line-metadata-value');
                        meta_name = textInput.val();
                        meta_pk = hiddenInput.val();

                        self.lineMetaAutocomplete.omitKey(String(meta_pk));

                        if(RELATED_MODEL_FIELDS.hasOwnProperty(meta_name)) {
                            supportedProperties = RELATED_MODEL_FIELDS[meta_name];
                            descriptor = new LineAttributeDescriptor(
                                meta_pk, meta_name,
                                supportedProperties.nameEltLabel,
                                supportedProperties.nameEltJsonId);
                        } else {
                            descriptor = new LineAttributeDescriptor(meta_pk, meta_name)
                        }

                        creationManager.addInput(descriptor);
                        textInput.val(null);
                        hiddenInput.val(null);
                    },
                    'Close': function() {
                        var textInput: JQuery, hiddenInput: JQuery;
                        $(this).dialog('close');
                        textInput = $('#add-line-metadata-text');
                        hiddenInput = $('#add-line-metadata-value');
                        textInput.val(null);
                        hiddenInput.val(null);
                    }
                }
            });

            // set up the autocomplete for line metadata type selection
            this.lineMetaAutocomplete = new EDDAuto.LineMetadataType({
                            'container': $('#add-prop-dialog'),
                            'visibleInput': $('#add-line-metadata-text'),
                            'hiddenInput': $('#add-line-metadata-value'),
                            'search_extra': {'sort': 'type_name'}});

            // TODO: remove if unused
            //this.lineMetaAutocomplete.autocomplete( "option", "minLength", 0 );

            // add click behavior to the "add property" button
            $('#addPropertyButton')
                .on('click', creationManager.showAddProperty.bind(this));
        }

        showAddAbbreviation(): void {
            var list: JQuery, self: CreationManager;
            self = this;
            list = $('#line-name-abbrev-list').empty();
            this.lineNameElements.forEach(function(namingElement: LineAttributeDescriptor) {
                var existingAbbreviation = false;
                self.abbreviations.forEach(function(abbreviation: AbbreviationInput){
                    if(abbreviation.lineAttribute.jsonId == namingElement.jsonId) {
                        existingAbbreviation = true;
                        return false;  // stop inner loop
                    }
                });

                // skip list item creation for any line property that we already have an
                // abbreviation for
                if(existingAbbreviation) {
                    return true;  // continue looping
                }

                $('<li>')
                    .text(namingElement.nameEltLabel)
                    .addClass('ui-widget-content')
                    .data(namingElement)
                    .appendTo(list);
            });

            creationManager.updateHasAbbrevDialogOptions(list);
            $('#add-abbrev-dialog').dialog('open');
        }

        buildAbbrevDialog(): void {

            $('#add-abbrev-dialog').dialog({
                resizable: false,
                modal: true,
                autoOpen: false,
                buttons: {
                    'Add Abbreviation(s)': function() {
                        creationManager.addSelectedAbbreviations();
                    },
                    'Close': function() {
                        var textInput: JQuery, hiddenInput: JQuery;
                        $(this).dialog('close');
                    }
                }
            });

            $('#addAbbreviationButton')
                .on('click', creationManager.showAddAbbreviation.bind(this));
        }

        addSelectedAbbreviations() {
            var abbreviationsList: JQuery, selectedAttrs: LineAttributeDescriptor[],
                selectedItems: JQuery, self:CreationManager;
            self = this;

            // build the list of line attributes selected in the dialog
            abbreviationsList = $('#line-name-abbrev-list');
            selectedItems = abbreviationsList.children('.ui-selected');
            selectedAttrs = [];
            selectedItems.each(
                function (index: number, elt: Element) {
                selectedAttrs.push($(elt).data());
            });

            if(!selectedAttrs.length) {
                return;
            }

            // remove selected items from the list
            selectedItems.remove();
            this.updateHasAbbrevDialogOptions(abbreviationsList);

            selectedAttrs.forEach(function(attribute) {
                self.insertAbbreviation(attribute);
            });

            this.updateHasAbbrevInputs();
        }

        updateHasAbbrevInputs(): void {
            var hasInputs:boolean = $('#abbreviations-table').children('.table-row').length !==0;

            // show table header, since there's at least one abbreviation row
            $('#abbreviations-table').toggleClass('off', !hasInputs);
            $('#no-abbrevs-div').toggleClass('off', hasInputs);
        }

        updateHasAbbrevDialogOptions(list: JQuery): void {
            var hasOptions = list.children('li').length !== 0;
            $('#no-abbrev-options-div').toggleClass('off', hasOptions);
            list.toggleClass('off', !hasOptions);
        }

        buildJson(): string {
            var result: any, json: string, jsonNameElements: string[],
                combinatorialValues: any, commonValues: any, abbrevs: any;

            // name element ordering
            jsonNameElements = [];
            this.lineNameElements.forEach(function(nameElement:LineAttributeDescriptor) {
                jsonNameElements.push(nameElement.nameEltJsonId);
            });

            // abbreviations
            if(this.abbreviations.length) {
                abbrevs = {};
                this.abbreviations.forEach(function(inputs: AbbreviationInput, index: number) {
                    // vals = inputs.validInputCount() )
                    var values: any = inputs.getValueJson();
                    if(values) {
                        abbrevs[inputs.lineAttribute.jsonId] = values;
                    }
                });
                jsonNameElements['abbreviations'] = abbrevs;
            }
            result = {name_elements: {elements: jsonNameElements}};

            // include all inputs in the JSON, separating them by "combinatorial" status as
            // required
            commonValues = {};
            combinatorialValues = {};
            this.lineProperties.forEach((input: LineAttributeInput): boolean => {
                var value: any, v: number;
                if(!input.validInputCount()) {
                    return true; // keep looping
                }

                if(REPLICATE_NUM_NAME_ID == input.lineAttribute.nameEltJsonId) {
                    result[REPLICATE_COUNT_JSON_ID] = input.getValueJson();
                    return true; // keep looping
                }
                if(STRAINS_META_NAME == input.lineAttribute.inputLabel) {
                    // for starters, assume each strain specified should result in creation
                    // of a combinatorial group of lines.  later on we can add complexity
                    // to support co-culture.  here we package the list of provided strains in
                    // the format supported by the back end, which should already support
                    // co-cultures.
                    value = input.getValueJson();
                    if(value.constructor === Array) {
                       for(v=0; v<value.length; v++) {
                           value[v] = [value[v]];
                       }
                    } else {
                         value = [value]
                    }
                    result.combinatorial_strain_id_groups = value;

                    return true
                }

                if(input.hasComboInputs()) {
                    combinatorialValues[input.lineAttribute.jsonId] = input.getValueJson();
                }
                else {
                    commonValues[input.lineAttribute.jsonId] = input.getValueJson();
                }
            });

            result['combinatorial_line_metadata'] = combinatorialValues;
            result['common_line_metadata'] = commonValues;

            json = JSON.stringify(result);
            $('#jsonTest').text(json);
            return json;
        }
    }

    export const creationManager = new CreationManager();

    // As soon as the window load signal is sent, call back to the server for the set of reference
    // records that will be used to disambiguate labels in imported data.
    export function onDocumentReady(): void {
        creationManager.buildStep2Inputs();
        creationManager.buildStep3Inputs();



        // load line metadata types from the REST API. This allows us to display them more
        // responsively if there are many, and also to show them in the
        loadAllLineMetadataTypes();
    }

    // send CSRF header on each AJAX request from this page
    $.ajaxSetup({
        beforeSend: function(xhr) {
            var csrfToken = Utl.EDD.findCSRFToken();
            xhr.setRequestHeader('X-CSRFToken', csrfToken);
        }
    });

}

$(window).on('load', function() {
    CreateLines.onDocumentReady();
});