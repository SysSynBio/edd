/// <reference path="typescript-declarations.d.ts" />
/// <reference path="EDDAutocomplete.ts" />

module CreateLines {
    'use strict';
    const DATA_FORMAT_STRING:string = 'string';
    const ROW_INDEX = 'rowIndex';

    class NameElement {
        jsonId: any;
        displayText: string;

        constructor(json_elt, displayText) {
            this.jsonId = json_elt;
            this.displayText = displayText;
        }

        toString(): string {
            return '(' + this.jsonId.toString() + ', ' + this.displayText + ')';
        }
    }

    //TODO: for immediate development
    // 1. differentiate naming / json output from un-implemented controls (e.g. strain)
    // 2. compute / test JSON generation from supported controls
    // 3. implement / test back end communication / review / line creation
    // 4. error handling!! / wizard
    // 5. implement & test abbreviations & custom name elements...nice-to-have, but not necessary to extract value
    //TODO: revisit meta / attribute subclasses after some integration testing / review of back-end code. May be able to
    // combine some of these.
    export class LineCreationInput {
        uiLabel: JQuery;
        jsonId: string;
        maxRows: number;
        minEntries: number;

        supportsMultiValue: boolean;
        supportsCombinations: boolean;

        rows: JQuery[] = [];
        addButton: JQuery;

        constructor(options:any) {
            this.uiLabel = $('<label>')
                .text(options.labelText + ':')
                .addClass('not-in-use');
            this.jsonId = options.jsonId;
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

        hasValidInput(rowIndex: number ): boolean {
            return this.rows[rowIndex].find('input').first().val().trim() != '';
        }

        hasAnyValidInput(): boolean {
            for(var i=0; i<this.rows.length; i++) {
                if(this.hasValidInput(i)) {
                    return true;
                }
            }
            return false;
        }

        highlightRowLabel(anyValidInput:boolean): void {
            this.rows[0].find('label')
                .first()
                .toggleClass('in-use', anyValidInput)
                .toggleClass('not-in-use', !anyValidInput);
        }

        getInput(rowIndex: number): string {
            return this.rows[rowIndex].find('input').first().val().trim();
        }

        getNameElements(): NameElement[] {
            // only allow naming inputs to be used if there's at least one valid value to insert into line names.
            // note that allowing non-unique values to be used in line names during bulk creation can be helpful since
            // they may differentiate new lines from those already in the study.
            if(!this.hasAnyValidInput()) {
                return [];
            }

            switch(this.jsonId) {
                case 'contact':
                case 'experimenter':
                case 'carbon_source':
                case 'description':
                    return [new NameElement(this.jsonId, 'Description')];
                case 'replicate_num':
                    return [new NameElement(this.jsonId, 'Replicate #')];
                case 'strain':
                    return [new NameElement('strain_name', 'Strain Name'), new NameElement('strain_id', 'Strain Part ID'),
                            new NameElement('strain_alias', 'Strain Alias')];
            }

        }

        getValueJson(): any {
            var values: string[];
            values = [];
            this.rows.forEach((currentValue, index, arr) => {
                if( this.hasValidInput(index)) {
                    values.push(this.getInput(index));
                }
            });
            return values;
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
                .prop('checked', true)
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
                    .addClass('removeButton')
                    .appendTo(container);
                $('<span>').addClass('ui-icon')
                    .addClass('ui-icon-trash').appendTo(btn);
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
            var row: JQuery, hadInput: boolean;

            hadInput = this.hasValidInput(rowIndex);

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

            if(hadInput) {
                creationManager.updateNameElements();
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

            if(firstRow && this.supportsCombinations) {
                yesComboButton = this.buildYesComboButton()
                    .appendTo(makeComboCell);
                noComboButton.prop('checked', true);
            }
        }

        fillInputControls(container: JQuery) {
            //empty implementation for children to override
        }
    }

    export class LineMetadataInput extends LineCreationInput {  // TODO: consider merging with sibling following initial test
        autoInput: EDDAuto.BaseAuto;
        metaTypeIndexes:any = {};

        constructor(options:any) {
            super(options);
        }

        // TODO: override parent behavior to launch a modal dialog...prompt for metadata type first to avoid problems
        // in allowing selection in the main form
        appendRow(): void {

            var newRow: JQuery, parent: JQuery, atMax: boolean, prevRow: JQuery;

            $('#dialog-confirm').dialog({
                resizable: false,
                modal: true,
                buttons: {
                    'Add data': function() {
                        $(this).dialog('close');
                    },
                    Cancel: function() {
                        $(this).dialog('close');
                    }
                }
            });

            prevRow = this.rows[this.rows.length-1];

            newRow = $('<div>')
                .addClass('row')
                .insertAfter(prevRow);
            this.fillRow(newRow);

            this.addButton.prop('disabled', !this.canAddRows());
        }

        hasValidInput(rowIndex: number ): boolean {
            var row: JQuery, hasType: boolean, hasValue: boolean, selectedType:any;
            row = this.rows[rowIndex];
            selectedType = row.find('.meta-type').first().val();
            hasType =  (selectedType != undefined) && selectedType.toString().trim();
            hasValue = row.find('.meta-value').val() != undefined;
            return  hasType && hasValue;
        }

        fillInputControls(rowContainer: JQuery): void {
            var visibleType: JQuery, hiddenType: JQuery, valueInput: JQuery, hiddenVal: JQuery;
            visibleType = $('<input type="text" name="type">')
                .prop('placeholder', 'Metadata Type')
                .addClass('step2-text-input')
                .appendTo(rowContainer);
            hiddenType = $('<input type="hidden" name="type">')
                .addClass('meta-type')
                .appendTo(rowContainer);
            valueInput = $('<input type="text" name="value">')
                .addClass('step2-text-input')
                .addClass('meta-value')
                .appendTo(rowContainer);

            hiddenType.on('change', function() {
                // once the user has selected a metadata type, remove the autocomplete and replace it with a label.
                // this simplifies the visual display and prevents things like having to move rows around to make rows
                // for the same metadata type move together after some values have been entered.
                if (!hiddenType.val()) {
                    return;
                }

                visibleType.remove();
                $('<label>')
                    .text(visibleType.val())
                    .insertBefore(hiddenType);
                creationManager.updateNameElements();
            });
            valueInput.on('change', function() {
                creationManager.updateNameElements();
            });

            this.autoInput = new EDDAuto.LineMetadataType({
                        'container': rowContainer,
                        'visibleInput': visibleType,
                        'hiddenInput': hiddenType,
                    });

            this.buildRemoveControl(rowContainer);
        }

        getNameElements(): NameElement[] {
            var elts: NameElement[];
            elts = [];
            this.rows.forEach((row: JQuery, index:number):void => {
                var metaPk: number, displayName: string;

                if(this.hasValidInput(index)) {
                    metaPk = row.find(':hidden').first().val();
                    displayName = row.find(':input').first().val();
                    elts.push(new NameElement(metaPk, displayName));
                }
            });

            return elts;
        }
    }

    export class LineAttributeInput extends LineCreationInput {

        constructor(options: any) {
            if (options.minRows === undefined) {
                options.minRows = 1;
            }
            super(options);
        }

        hasValidInput(rowIndex: number): boolean {
            var temp:any;
            temp = this.rows[rowIndex].find('.step2-value-input').val();
            return (temp != undefined) && temp.toString().trim();
        }

        fillInputControls(rowContainer: JQuery): void {
            $('<input type="text">')
                .addClass('step2-text-input')
                .addClass('step2-value-input')
                .on('change', function() {
                    creationManager.updateNameElements();
                })
                .appendTo(rowContainer);
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

            visible = $('<input type="text">')
                .addClass('step2-text-input');
            hidden = $('<input type="hidden">')
                .addClass('step2-value-input');

            hidden.on('change', function() {
                creationManager.updateNameElements();
            });

            rowContainer.append(visible).append(hidden);

            switch (this.jsonId) {
                case 'experimenter':
                case 'contact':
                    this.autoInput = new EDDAuto.User({
                        'container': rowContainer,
                        'visibleInput': visible,
                        'hiddenInput': hidden,
                    });
                    break;
                case 'carbon_source':
                    this.autoInput = new EDDAuto.CarbonSource({
                        'container': rowContainer,
                        'visibleInput': visible,
                        'hiddenInput': hidden,
                    });
                    break;
                case 'strain':
                    this.autoInput = new EDDAuto.Registry({
                        'container': rowContainer,
                        'visibleInput': visible,
                        'hiddenInput': hidden,
                    });
                    break;
            }
            this.buildRemoveControl(rowContainer);
        }
    }

    export class ControlInput extends LineCreationInput {
        yesCheckbox: JQuery;
        noCheckbox: JQuery;

        fillInputControls(rowContainer: JQuery): void {
            this.yesCheckbox = $('<input type="checkbox">')
                .on('change', function() {
                    creationManager.updateNameElements();
                })
                .appendTo(rowContainer);
            $('<label>')
                .text('Yes')
                .appendTo(rowContainer);
            this.noCheckbox = $('<input type="checkbox">')
                .on('change', function() {
                    creationManager.updateNameElements();
                })
                .appendTo(rowContainer);
            $('<label>')
                .text('No')
                .appendTo(rowContainer);
        }

        hasValidInput(rowIndex: number) {
            return this.yesCheckbox.prop('checked') || this.noCheckbox.prop('checked');
        }

        getNameElements(): NameElement[] {
            var hasInput: boolean;
            hasInput = this.hasAnyValidInput();
            this.highlightRowLabel(hasInput);
            if(hasInput) {
                return [new NameElement('control', 'Control')];
            }
            return [];
        }
    }

    export class ReplicateInput extends LineCreationInput {
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
                .addClass('step2-text-input')
                .addClass('step2-value-input')
                .appendTo(rowContainer);
        }

        getNameElements(): NameElement[] {
            var hasInput: boolean;
            hasInput = this.hasAnyValidInput();
            this.highlightRowLabel(hasInput);

            return [new NameElement('replicate_num', 'Replicate #')];
        }
    }

    export class CreationManager {

        indicatorColorIndex:number = 0;
        dataElements:LineCreationInput[] = [];
        nameElements:NameElement[] = [];
        unusedNameElements:NameElement[] = [];

        colors = ['red', 'blue', 'yellow', 'orange', 'purple'];
        colorIndex = 0;

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
                    'jsonId': 'combinatorial_strain_id_groups', }),
                new LineMetadataInput(
                    {'labelText': 'Metadata',
                    'jsonId': 'N/A', }),
                new ControlInput({
                    'labelText': 'Control',
                    'jsonId': 'control',
                    'maxRows': 1}),
                new LineAttributeInput(
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

        updateNameElements(): void {
            var availableElts: NameElement[], removedFromNameElts: NameElement[], newElts: NameElement[], unusedList: JQuery,
                newElt:any;
            console.log('updating available naming elements');

            //build an updated list of available naming elements based on user entries in step 1
            availableElts = [];
            this.dataElements.forEach((input: LineCreationInput): void => {
                var elts: NameElement[] = input.getNameElements();
                availableElts = availableElts.concat(elts);
            });

            newElts = availableElts.slice();
            $('#line_name_elts').children().each(function() {
                var text:string, element:any, index:number, data:any;

                // start to build up a list of newly-available selections. we'll clear out more of them from the
                // list of unavailable ones
                index = newElts.indexOf($(this).data());
                if(index >= 0) {
                    newElts.splice(index, 1);
                    return true;  // continue looping
                }
                else {
                    console.log('removing ' + this.text + 'from name elts list');
                    this.remove();
                }
            });

            console.log('Available name elements: ' + availableElts);

            unusedList = $('#unused_line_name_elts');
            unusedList.children().each(function() {
                var availableElt: any, index: number;
                for(index = 0; index < newElts.length; index++) {
                    availableElt = newElts[index];
                    if(availableElt.displayText == this.textContent) {
                        console.log('Found matching element ' + this.textContent);
                        newElts.splice(index, 1);
                        return true;
                    }
                }
                console.log('Removing ' + this.textContent + ' from unused list');
                this.remove();
                return true;
            });

            // add newly-inserted elements into the 'unused' section. that way previous configuration stays unaltered
            newElts.forEach((elt:NameElement) => {
                var li: JQuery;
                li = $('<li>')
                    .text(elt.displayText)
                    .addClass('ui-state-default')
                    .data(elt)
                    .appendTo(unusedList);

                // add an arrow to indicate the item can be dragged between lists
                $('<span>')
                    .addClass('ui-icon')
                    .addClass('ui-icon-arrowthick-2-n-s')
                    .appendTo(li);
            });
            this.updateResults();
        }

        updateResults(): void {
            //TODO: remove the color-based indicator here following testing
            var color: string;
            console.log('updating JSON results');
            color = this.colors[this.colorIndex];
            $('#indicator').css('background',color);
            this.colorIndex = (this.colorIndex+1) % this.colors.length;
            console.log('Color index = ' + this.colorIndex);

            this.buildJson();
        }

        addProperty(): void {
        }

        buildJson(): string {
            var result: any, json: string, nameElements: string[], combinatorialValues: string[], commonValues: string[];
            //build an updated list of available naming elements based on user entries in step 1

            nameElements = [];
            $('#line_name_elts').children().each(function() {
                var elt: JQuery, data: any, text: string;
                elt = $(this);
                data = elt.data();
                text = elt.text();
                console.log('buildJson(' + this.innerText + '): name elt = ' + data.toString());
                nameElements.push(data.jsonId);
            });
            result = {name_elements: {elements: nameElements}};

            //TODO: abbreviations / custom additions...see the mockup

            result.replicate_count = $('#spinner').val();

            commonValues = [];
            this.dataElements.forEach((input: LineCreationInput): void => {
                result[input.jsonId] = input.getValueJson();
            });

            json = JSON.stringify(result)
            $('#jsonTest').text(json);
            return json;
        }

    }

    export const creationManager = new CreationManager();

    // As soon as the window load signal is sent, call back to the server for the set of reference
    // records that will be used to disambiguate labels in imported data.
    export function onDocumentReady(): void {
        creationManager.buildInputs();

        // set up connected lists for naming elements
        $( "#line_name_elts, #unused_line_name_elts" ).sortable({
          connectWith: ".connectedSortable",
            update: function(event, ui) {
                  creationManager.updateResults();
            },
        }).disableSelection();

        // style the replicates spinner
        $( "#spinner" ).spinner({
            min: 1,
            change: function(event, ui) {
                    creationManager.updateNameElements();
                }});

        // add click behavior to the "add property" button
        $('#addPropertyButton').on('click', creationManager.addProperty.bind(this));

        // set up the autocomplete for line metadata type selection
        new EDDAuto.LineMetadataType({
                        'container': $('#dialog-confirm'),
                        'visibleInput': $('#line-metadata-text'),
                        'hiddenInput': $('#line-metadata-value'),
                    });
    }
}

$(CreateLines.onDocumentReady);