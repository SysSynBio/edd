/// <reference path="typescript-declarations.d.ts" />
/// <reference path="EDDAutocomplete.ts" />
/// <reference path="EDDRest.ts" />

module CreateLines {
    'use strict';
    const DATA_FORMAT_STRING:string = 'string';
    const ROW_INDEX = 'rowIndex';

    const LINE_EXPERIMENTER_META_NAME = 'Line Experimenter';
    const LINE_CONTACT_META_NAME = 'Line Contact';
    const CARBON_SOURCE_META_NAME = 'Carbon Source(s)';
    const STRAINS_META_NAME = 'Strain(s)';
    const autocompleteMetadataNames = [LINE_EXPERIMENTER_META_NAME, LINE_CONTACT_META_NAME,
                                       CARBON_SOURCE_META_NAME, STRAINS_META_NAME];

    function loadAllLineMetadataTypes():void {
        $('#addPropertyButton').prop('disabled', true);
        EddRest.loadMetadataTypes(
            {
                'success': creationManager.setLineMetaTypes.bind(creationManager),
                'error': showMetaLoadFailed,
                'request_all': true, // get all result pages
                'wait': showWaitMessage,
                'context': EddRest.LINE_METADATA_CONTEXT,
                'sort_order': EddRest.ASCENDING_SORT,
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

    export class MultiValueInput {
        uiLabel: JQuery;
        lineAttribute: LineAttributeDescriptor;
        maxRows: number;
        minEntries: number;

        supportsMultiValue: boolean;
        supportsCombinations: boolean;

        rows: JQuery[] = [];
        addButton: JQuery;

        constructor(options:any) {
            this.lineAttribute = options.lineAttribute;
            if (!this.lineAttribute) {
                throw Error('lineAttribute is required');
            }

            this.uiLabel = $('<label>')
                .text(this.lineAttribute.displayText + ':')
                .addClass('not-in-use');

            this.maxRows = options.maxRows === undefined ? 30 : options.maxRows;
            this.minEntries = options['minEntries'] || 1;
            this.supportsCombinations = options.supportsCombinations === undefined ? true: options.supportsCombinations;
            this.supportsMultiValue = options.supportsMultiValue === undefined ? false: options.supportsMultiValue;


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

        autoUpdateCombinations () {
            var radioButton: JQuery, multipleRows: boolean, combosButton:JQuery,
                noCombosButton:JQuery;
            multipleRows = this.rows.length > 1;
            noCombosButton = this.rows[0].find('input:radio[value=No]');
            console.log('no combo button matches: ' + noCombosButton.length);


            if(this.rows.length > 1) {
                // note: not all inputs will have a "make combos" button  -- need enclosing check
                combosButton = this.rows[0].find('input:radio[value=Yes]');
                console.log('yes combo button matches: ' + combosButton.length);
                combosButton.click();
            }
            else {
                noCombosButton.click();
            }
        }

        getInput(rowIndex: number): string {
            return this.rows[rowIndex].find('input').first().val().trim();
        }
    }

    export class NameElementAbbreviations extends MultiValueInput {
    }

    //TODO: for immediate development
    // 1. differentiate naming / json output from un-implemented controls (e.g. strain)
    // 2. compute / test JSON generation from supported controls
    // 3. implement / test back end communication / review / line creation
    // 4. error handling!! / wizard
    // 5. implement & test abbreviations & custom name elements...nice-to-have, but not necessary to extract value
    //TODO: revisit meta / attribute subclasses after some integration testing / review of back-end code. May be able to
    // combine some of these.
    export class LinePropertyInput extends MultiValueInput {
         constructor(options: any) {
             super(options);
         }

        getNameElements(): LineAttributeDescriptor[] {
             var validInputCount:number = this.validInputCount(), hasInput:boolean;
             hasInput = validInputCount > 0;

             this.highlightRowLabel(hasInput);
             this.autoUpdateCombinations();


            // only allow naming inputs to be used if there's at least one valid value to insert into line names.
            // note that allowing non-unique values to be used in line names during bulk creation can be helpful since
            // they may differentiate new lines from those already in the study.
            if(!hasInput) {
                return [];
            }

            return [this.lineAttribute];
        }

        getValueJson(): string[] {
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
            return $('<input type="radio">')
                .prop('name', this.lineAttribute.jsonId)
                .val('Yes');
        }

        buildNoComboButton(): JQuery {
            return $('<input type="radio">')
                .prop('name', this.lineAttribute.jsonId)
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
                .addClass('table-row')
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
                creationManager.updateNameElementChoices();
            }

            this.autoUpdateCombinations();

            // re-enable the add button if appropriate / if it was disabled
            this.addButton.prop('disabled', !this.canAddRows());
        }

        fillRow(row: JQuery):void {
            var firstRow: boolean, row: JQuery, inputCell: JQuery, addCell: JQuery, applyAllCell: JQuery,
                makeComboCell: JQuery, labelCell: JQuery, noComboButton: JQuery,
                yesComboButton: JQuery;

            this.rows.push(row);

            labelCell = $('<div>')
                .addClass('step2_table_cell')
                .appendTo(row);

            firstRow = this.getRowCount() == 1;
            if(firstRow) {
                this.getLabel()
                    .appendTo(labelCell);
            }

            inputCell = $('<div>')
                .addClass('step2_table_cell')
                .addClass('inputCell')
                .appendTo(row);

            this.fillInputControls(inputCell);

            addCell = $('<div>')
                .addClass('step2_table_cell')
                .appendTo(row);
            this.buildAddControl(addCell);

            applyAllCell = $('<div>')
                .addClass('step2_table_cell')
                .addClass('centered_radio_btn_parent')
                .appendTo(row);

            if(firstRow) {
                noComboButton = this.buildNoComboButton().appendTo(applyAllCell);
            }

            makeComboCell = $('<div>')
                .addClass('step2_table_cell')
                .addClass('centered_radio_btn_parent')
                .appendTo(row);

            if(firstRow && this.supportsCombinations) {
                yesComboButton = this.buildYesComboButton()
                    .appendTo(makeComboCell);
                noComboButton.prop('checked', true);
            }
            else {
                this.autoUpdateCombinations();
            }
        }

        fillInputControls(container: JQuery) {
            //empty implementation for children to override
        }
    }

    export class LineAttributeInput extends LinePropertyInput {

        constructor(options: any) {
            super(options);
            if (options.minRows === undefined) {
                options.minRows = 1;
            }

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
                    creationManager.updateNameElementChoices();
                })
                .appendTo(rowContainer);
            this.buildRemoveControl(rowContainer);
        }
    }

    export class LineAttributeAutoInput extends LinePropertyInput {

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
                creationManager.updateNameElementChoices();
            });

            rowContainer.append(visible).append(hidden);

            switch (this.lineAttribute.displayText) {
                case LINE_EXPERIMENTER_META_NAME:
                case LINE_CONTACT_META_NAME:
                    visible.attr('eddautocompletetype', "User");
                    this.autoInput = new EDDAuto.User({
                        'container': rowContainer,
                        'visibleInput': visible,
                        'hiddenInput': hidden,
                    });
                    break;
                case CARBON_SOURCE_META_NAME:
                    visible.attr('eddautocompletetype', "CarbonSource");
                    this.autoInput = new EDDAuto.CarbonSource({
                        'container': rowContainer,
                        'visibleInput': visible,
                        'hiddenInput': hidden,
                    });
                    break;
                case STRAINS_META_NAME:
                    visible.attr('eddautocompletetype', "Registry");
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

    export class ControlInput extends LinePropertyInput {
        yesCheckbox: JQuery;
        noCheckbox: JQuery;

        constructor(options:any) {
            super(options);
        }

        fillInputControls(rowContainer: JQuery): void {
            this.yesCheckbox = $('<input type="checkbox">')
                .on('change', function() {
                    creationManager.updateNameElementChoices();
                })
                .appendTo(rowContainer);
            $('<label>')
                .text('Yes')
                .appendTo(rowContainer);
            this.noCheckbox = $('<input type="checkbox">')
                .on('change', function() {
                    creationManager.updateNameElementChoices();
                })
                .appendTo(rowContainer);
            $('<label>')
                .text('No')
                .appendTo(rowContainer);
        }

        hasValidInput(rowIndex: number) {
            return this.yesCheckbox.prop('checked') || this.noCheckbox.prop('checked');
        }
    }

    export class ReplicateInput extends LinePropertyInput {
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
    }

    export class CreationManager {
        // line properties configured in step 2
        lineProperties:LinePropertyInput[] = [];

        // name elements in use in step 3
        nameElements:LineAttributeDescriptor[] = [];

        // name elements not in use in step 3
        unusedNameElements:LineAttributeDescriptor[] = [];

        usedMetadataNames = [];

        lineMetaAutocomplete:EDDAuto.LineMetadataType = null;

        nonAutocompleteLineMetaTypes: any[] = [];
        autocompleteLineMetaTypes: any = {};

        indicatorColorIndex:number = 0;
        colors = ['red', 'blue', 'yellow', 'orange', 'purple'];
        colorIndex = 0;

        constructor() {
            this.lineProperties = [
                new ControlInput({
                    'lineAttribute': new LineAttributeDescriptor('control', 'Control'),
                    'maxRows': 1}),
                new LineAttributeInput(
                    {
                        'lineAttribute': new LineAttributeDescriptor('description', 'Description')}),
                new ReplicateInput({
                    'lineAttribute': new LineAttributeDescriptor('replicates', 'Replicates')})
            ];
        }

        addInput(lineAttr: LineAttributeDescriptor): void {
            var newInput: LinePropertyInput, autocompleteMetaItem:any, cache:any;

            autocompleteMetaItem = this.autocompleteLineMetaTypes[lineAttr.jsonId];
            if(autocompleteMetaItem) {
                newInput = new LineAttributeAutoInput({'lineAttribute': lineAttr});
            }
            else {
                newInput = new LineAttributeInput({'lineAttribute': lineAttr});
            }

            this.lineProperties.push(newInput);
            this.insertInputRow(newInput);
        }

        insertInputRow(input:LinePropertyInput): void {
            var parentDiv: JQuery, row:JQuery;
            parentDiv = $('#select_line_properties_step_dynamic').find('.sectionContent');
            row = $('<div>')
                    .addClass('table-row')
                    .appendTo(parentDiv);
            input.fillRow(row);
        }

        buildInputs(): void {

            // style the replicates spinner
            $("#spinner").spinner({
                min: 1,
                change: function(event, ui) {
                        creationManager.updateNameElementChoices();
                    }});

            creationManager.buildAddPropDialog();
            creationManager.buildAbbrevDialog();

            // add click behavior to the "add property" button
            $('#addPropertyButton').on('click', creationManager.showAddProperty.bind(this));
            $('#addAbbreviationButton').on('click', creationManager.showAddAbbreviation.bind(this));

            // set up the autocomplete for line metadata type selection
            this.lineMetaAutocomplete = new EDDAuto.LineMetadataType({
                            'container': $('#add-prop-dialog'),
                            'visibleInput': $('#add-line-metadata-text'),
                            'hiddenInput': $('#add-line-metadata-value'),
                            'search_extra': {'sort': 'ascending'}});  // TODO: sort not working!

            this.lineProperties.forEach((input: LinePropertyInput, i: number): void => {
                this.insertInputRow(input);
            });

            // add options for any naming elements that should be available by default
            this.updateNameElementChoices();
        }

        updateNameElementChoices(): void {
            var availableElts: LineAttributeDescriptor[], prevNameElts: LineAttributeDescriptor[],
                newElts: LineAttributeDescriptor[], unusedList: JQuery, unusedChildren: JQuery,
                namingUnchanged:boolean, self:CreationManager;
            console.log('updating available naming elements');

            //build an updated list of available naming elements based on user entries in step 1
            availableElts = [];
            this.lineProperties.forEach((input: LinePropertyInput): void => {
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
                        self.nameElements.push(nameElement);
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

                        if(availableElt.displayText == listElement.textContent) {
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

            // skip JSON reconstruction / resulting server request if naming elements are the same
            // as before. Note that since the form will never add a naming element
            // automatically, comparing array dimensions is enough
            namingUnchanged = this.nameElements.length === $('#line_name_elts').children().length;

            if(namingUnchanged) {
                return;
            }
            this.updateResults();
        }

        updateResults(): void {
            var self: CreationManager = this;
            //build an updated list of naming elements based on user entries in steps 1 & 2
            this.nameElements = [];
            $('#line_name_elts').children().each(function() {
                var nameElement: any = $(this).data();
                self.nameElements.push(nameElement);
            });

            //TODO: remove the color-based indicator and auto-JSON creation here following testing
            var color: string;
            console.log('updating JSON results');
            color = this.colors[this.colorIndex];
            $('#indicator').css('background',color);
            this.colorIndex = (this.colorIndex+1) % this.colors.length;
            console.log('Color index = ' + this.colorIndex);

            this.buildJson();
        }

        setLineMetaTypes(metadataTypes:any[]) {
            var self:CreationManager = this;
            $('#step2_status_div').empty();
            $('#addPropertyButton').prop('disabled', false);

            this.nonAutocompleteLineMetaTypes = [];
            this.autocompleteLineMetaTypes = {};
            metadataTypes.forEach(function(metaType) {
                if(autocompleteMetadataNames.indexOf(metaType.type_name) < 0) {
                    self.nonAutocompleteLineMetaTypes.push(metaType);
                }
                else {
                    self.autocompleteLineMetaTypes[metaType.pk] = metaType;
                }
            });
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
                        var meta_name:string, meta_pk:number, textInput: JQuery, hiddenInput: JQuery;
                        textInput = $('#add-line-metadata-text');
                        hiddenInput = $('#add-line-metadata-value');
                        meta_name = textInput.val();
                        meta_pk = hiddenInput.val();
                        self.lineMetaAutocomplete.omitKey(String(meta_pk));
                        creationManager.addInput(new LineAttributeDescriptor(
                            meta_pk, meta_name));
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
        }

        showAddAbbreviation(): void {
            var list:JQuery = $('#line-name-abbrev-list').empty();
            this.nameElements.forEach(function(namingElement: LineAttributeDescriptor) {
                $('<li>')
                    .text(namingElement.displayText)
                    .addClass('ui-widget-content')
                    .data(namingElement)
                    .appendTo(list);
            });

            $('#add-abbrev-dialog').dialog('open');
        }

        buildAbbrevDialog(): void {
            var self: CreationManager = this;

            $('#add-abbrev-dialog').dialog({
                resizable: false,
                modal: true,
                autoOpen: false,
                buttons: {
                    'Add Abbreviation(s)': function() {
                        // var meta_name:string, meta_pk:number, textInput: JQuery, hiddenInput: JQuery;
                        // self.lineMetaAutocomplete.omitKey(String(meta_pk));
                        //creationManager.addAbbreviation();
                    },
                    'Close': function() {
                        var textInput: JQuery, hiddenInput: JQuery;
                        $(this).dialog('close');
                    }
                }
            });
        }

        addAbbreviation(nameElement:LineAttributeDescriptor): void {
        }

        buildJson(): string {
            var result: any, json: string, jsonNameElements: string[],
                combinatorialValues: string[], commonValues: string[];
            jsonNameElements = [];
            this.nameElements.forEach(function(nameElement:LineAttributeDescriptor) {
                jsonNameElements.push(nameElement.jsonId);
            });
            result = {name_elements: {elements: jsonNameElements}};

            //TODO: abbreviations / custom additions...see the mockup

            result.replicate_count = $('#spinner').val();

            commonValues = [];
            this.lineProperties.forEach((input: LinePropertyInput): void => {
                result[input.lineAttribute.jsonId] = input.getValueJson();
            });

            json = JSON.stringify(result);
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

        // set up selectable list for abbreviations
        $('#line-name-abbrev-list').selectable();

        // load line metadata types from the REST API. This allows us to display them more
        // responsively if there are many, and also to show them in the
        loadAllLineMetadataTypes();
    }

    //TODO: remove if unused
    // function loadAllLineMetadataTypes():void {
    //     EddRest.loadMetadataTypes(
    //         {
    //             'success': lineMetaSuccessHandler,
    //             'error': lineErrorHandler,
    //             'request_all': true, // get all result pages
    //             'wait': function() { showWaitMessage(LINE_DIV_SELECTOR); },
    //             'context': EddRest.LINE_METADATA_CONTEXT,
    //             'sort_order': EddRest.ASCENDING_SORT,
    //         });
    // }
}

$(CreateLines.onDocumentReady);