/// <reference path="typescript-declarations.d.ts" />
/// <reference path="EDDAutocomplete.ts" />

/**
 * Created by mark.forrer on 7/7/16.
 */

module CreateLines {
    const DATA_FORMAT_STRING:string = 'string';
    const ROW_INDEX = 'rowIndex';

    export class LineCreationInput {
        uiLabel: JQuery;
        jsonId: string;
        dataFormat: string;
        maxRows: number;
        minEntries: number;

        supportsMultiValue: boolean;
        supportsCombinations: boolean;

        parentContainer: JQuery;
        rows: JQuery[] = [];
        addButton: JQuery;

        constructor(options:any) {

            // TODO: make these optional based on other recent examples
            this.uiLabel = $('<label>').text(options.labelText + ':');
            this.jsonId = options['jsonId'];
            this.maxRows = options.maxRows === undefined ? 30 : options.maxRows;
            this.minEntries = options['minEntries'] || 1;
            this.supportsCombinations = options.supportsCombinations === undefined ? true: options.supportsCombinations;
            this.supportsMultiValue = options.supportsMultiValue === undefined ? false: options.supportsMultiValue;

            if (!this.jsonId) {
                throw Error('jsonId is required');
            }

            if (!this.uiLabel) {  // TODO: doesn't work bc of : / elt construction above
                throw Error('uiLabel is required');
            }

        }

        hasValidInput(): boolean {
            return false;  // TODO: implement
        }

        toJSON(): any {
            return {'': ''}
        }

        getLabel(): JQuery {
            return this.uiLabel;
        }

        buildYesComboButton(): JQuery {
            return $('<input type="radio">').prop('name', this.jsonId).val('Yes');
        }

        buildNoComboButton(): JQuery {
            return $('<input type="radio">')
                .prop('name', this.jsonId)
                .val('No')
                .addClass('property_radio');
        }

        getRowCount(): number {
            return this.rows.length;
        }


        buildRemoveControl(container: JQuery): void {
            var btn: JQuery, rowIndex:number, t:any;
            // add a delete button in the same cell as the input controls

            if (this.getRowCount() > this.minEntries) {
                rowIndex = this.getRowCount() -1;
                btn = $('<button>')
                    .text('-')
                    .addClass('removeButton')
                    .appendTo(container);
                this.registerRemoveEvtHandler(btn, rowIndex);

            }
        }

        registerRemoveEvtHandler(removeButton, rowIndex) {
            removeButton.off('click');

            removeButton.on('click', null, {'rowIndex': rowIndex, 'manager': this},
                        (ev: JQueryMouseEventObject) => {
                        var rowIndex: number, manager:any;

                        rowIndex = ev.data.rowIndex;
                        manager = ev.data.manager;

                        console.log('In handler. rowIndex = ' + rowIndex);
                        manager.removeRow(rowIndex);
                    });
        }

        buildAddControl(container: JQuery) {
            // only add the control to the first row
            if (this.getRowCount() == 1) {
                console.log(this.uiLabel.text() + 'Adding a "+" control');  // TODO: remove
                this.addButton = $('<button>')
                    .text('+')
                    .on('click', this.appendRow.bind(this))
                    .appendTo(container);
            }
        }

        canAddRows(): boolean {
            return this.getRowCount() < this.maxRows;
        }

        appendRow(): void {
            var newRow: JQuery, parent: JQuery, atMax: boolean, prevRow: JQuery;
            prevRow = this.rows[this.rows.length-1];

            newRow = $('<div>')
                .addClass('row')
                .insertAfter(prevRow);
            this.fillRow(newRow);

            this.addButton.prop('disabled', !this.canAddRows());
        }

        removeRow(rowIndex: number): void {
            var row: JQuery;
            console.log(this.uiLabel.text() + ': removing row ' + rowIndex);  // TODO: remove

            // remove this row from our tracking and from the DOM
            row = this.rows[rowIndex];
            row.remove();
            this.rows.splice(rowIndex, 1);

            // update event handlers for subsequent rows to get the correct index number following
            // the removal of a preceding row
            console.log('Updating event handlers starting @ index ' + rowIndex);
            for(var i=rowIndex; i < this.rows.length; i++) {
                var removeBtn: JQuery;
                row = this.rows[i];
                removeBtn = row.find('.removeButton').first();
                console.log('Updating ' + removeBtn.length + ' event handlers for index ' + rowIndex);
                this.registerRemoveEvtHandler(removeBtn, i);
            }

            // re-enable the add button if appropriate / if it was disabled
            this.addButton.prop('disabled', !this.canAddRows());
        }

        fillRow(row: JQuery):void {
            var firstRow: boolean, row: JQuery, inputCell: JQuery, addCell: JQuery, applyAllCell: JQuery,
                makeComboCell: JQuery, labelCell: JQuery, noComboButton: JQuery,
                yesComboButton: JQuery;

            this.rows.push(row);

            labelCell = $('<div>')
                .addClass('cell')
                .appendTo(row);

            firstRow = this.getRowCount() == 1;
            if(firstRow) {
                this.getLabel()
                    .appendTo(labelCell);
            }

            inputCell = $('<div>')
                .addClass('cell')
                .addClass('inputCell')
                .appendTo(row);

            this.fillInputControls(inputCell);

            addCell = $('<div>')
                .addClass('cell')
                .appendTo(row);
            this.buildAddControl(addCell);

            applyAllCell = $('<div>')
                .addClass('cell')
                .addClass('centered_radio_btn_parent')
                .appendTo(row);

            if(firstRow) {
                noComboButton = this.buildNoComboButton().appendTo(applyAllCell);
            }

            makeComboCell = $('<div>')
                .addClass('cell')
                .addClass('centered_radio_btn_parent')
                .appendTo(row);

            if(firstRow) {
                yesComboButton = this.buildYesComboButton()
                    .appendTo(makeComboCell);

                yesComboButton.attr('disabled', this.supportsCombinations ? 'enabled' : 'disabled');

                noComboButton.prop('checked', true);
                noComboButton.attr('disabled', this.supportsCombinations ? 'enabled' : 'disabled');
            }
        }

        fillInputControls(container: JQuery) {
            //empty implementation for children to override
        }
    }

    export class LineMetadataInput extends LineCreationInput {

        constructor(options:any) {
            super(options);
        }

        fillInputControls(rowContainer: JQuery): void {
            var visibleType: JQuery, hiddenType: JQuery, visibleVal: JQuery, hiddenVal: JQuery;
            visibleType = $('<input type="text" name="type">')
                .addClass('single_meta_value_input')
                .appendTo(rowContainer);
            hiddenType = $('<input type="hidden" name="type">')
                .appendTo(rowContainer);
            visibleVal = $('<input type="text" name="value">')
                .addClass('single_meta_value_input')
                .appendTo(rowContainer);
            hiddenVal = $('<input type="hidden" name="value">')
                .appendTo(rowContainer);
            this.buildRemoveControl(rowContainer);
        }
    }

    export class LineAttributeInput extends LineCreationInput {
        entryControl: JQuery;

        constructor(options: any) {
            if (options.minRows === undefined) {
                options.minRows = 1;
            }
            super(options);
        }

        fillInputControls(rowContainer: JQuery): void {
            switch (this.jsonId) {
                case 'description':
                    this.entryControl = $('<input type="text">');
            }
            this.buildRemoveControl(rowContainer);
        }
    }

    export class LineAttributeAutoInput extends LineCreationInput {

        autoInput: EDDAuto.BaseAuto;

        constructor(options) {
            super(options);

        }

        // build custom input controls whose type depends on the data type of the Line attribute
        // they configure
        fillInputControls(rowContainer: JQuery): void {
            var visible: JQuery, hidden: JQuery;

            visible = $('<input type="text">').addClass('single_meta_value_input');
            hidden = $('<input type="hidden">');

            rowContainer.append(visible).append(hidden);

            switch (this.jsonId) {
                case 'experimenter':
                case 'contact':
                case 'carbon_source':
                case 'strain':

                    // this.autoInput = new EDDAuto.User({
                    //     container: container,
                    //     'visibleInput': visible,
                    //     'hiddenInput': hidden,
                    // });
                    break;
            }
            this.buildRemoveControl(rowContainer);
        }
    }

    export class ReplicateInput extends LineCreationInput {
        constructor(options:any) {
            options.maxRows = 1;
            options.minRows = 1;
            super(options);
        }

        fillInputControls(rowContainer: JQuery): void {
            $('<input id="spinner">')
                .appendTo(rowContainer);
        }
    }

    export class CreationManager {

        dataElements:LineCreationInput[];

        constructor() {
            console.log('In constructor!');
            this.dataElements = [
                new LineAttributeAutoInput(
                    {'labelText':'Contact',
                    'jsonId': 'contact', }),
                new LineAttributeAutoInput(
                    {'labelText':'Experimenter',
                    'jsonId': 'experimenter', }),
                new LineAttributeAutoInput(
                    {'labelText':'Carbon Source',
                    'jsonId': 'carbon_source', }),
                new LineAttributeAutoInput(
                    {'labelText':'Strain',
                    'jsonId': 'strain', }),
                new LineMetadataInput(
                    {'labelText': 'Metadata',
                    'jsonId': 'N/A', }),
                new LineAttributeAutoInput(
                    {'labelText':'Description',
                    'jsonId': 'description', }),
                new ReplicateInput({
                    'labelText': 'Replicates',
                    'jsonId': 'replicates'}),
            ];
        }

        buildInputs(): void {
            var parentDiv: JQuery;

            console.log('In onDocumentReady.  dataElements = ' + this.dataElements);

            parentDiv = $('#select_line_properties_step_dynamic').find('.sectionContent');

            this.dataElements.forEach((input: LineCreationInput, i: number): void => {
                var row: JQuery;
                row = $('<div>')
                    .addClass('row')
                    .appendTo(parentDiv);
                input.fillRow(row);
            });
        }


    }

    export const creationManager = new CreationManager();

    // As soon as the window load signal is sent, call back to the server for the set of reference
    // records that will be used to disambiguate labels in imported data.
    export function onDocumentReady(): void {
        creationManager.buildInputs()
    }

}

$(CreateLines.onDocumentReady);