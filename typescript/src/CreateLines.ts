/// <reference path="EDDRest.ts" />
/// <reference path="EDDAutocomplete.ts" />


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
        jsonId: any; // string for special-cases, integer pk for metadata
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

        getInput(rowIndex: number): any {
            return this.rows[rowIndex].find('input').first().val().trim();
        }

        getLabel(): JQuery {
            return this.uiLabel;
        }

        hasComboInputs(): boolean {
             return this.rows.length > 1;
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

            removeButton.on('click', null, {'rowIndex': rowIndex, 'propertyInput': this},
                        (ev: JQueryMouseEventObject) => {
                        var rowIndex: number, propertyInput:any;

                        rowIndex = ev.data.rowIndex;
                        propertyInput = ev.data.propertyInput;

                        console.log('In handler. rowIndex = ' + rowIndex);
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

        removeRow(rowIndex: number): void {
            var row: JQuery, hadValidInput: boolean, nextRow: JQuery, inputCell:JQuery;

            hadValidInput = this.hasValidInput(rowIndex);
            row = this.rows[rowIndex];

            // if removing the title row, relocate inputs from the second row to the first, then
            // remove the second row
            if(rowIndex == 0 && this.rows.length > 1) {
                // remove only the input cell content from this row, leaving labeling and controls
                // in place
                inputCell = row.children('.inputCell').empty();

                // detach and relocate input cell content from the following row, moving it up
                nextRow = this.rows[rowIndex+1];
                nextRow.children('.inputCell').each(function(index:number,
                                                             element: Element)
                {
                    $(element).detach().appendTo(inputCell);
                });

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

            // if the removed row had valid user input, recompute results
            if(hadValidInput) {
                if(this.rows.length) {
                    this.updateInputState();
                }
                this.postRemoveCallback(rowIndex, hadValidInput);
            }
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
    }

    export class NameElementAbbreviations extends MultiValueInput {

        hasValidInput(rowIndex: number): boolean {
            var temp:any;
            temp = this.rows[rowIndex].find('.columnar-text-input').val();
            return (temp != undefined) && temp.toString().trim();
        }

        fillRow(row: JQuery):void {
            var firstRow: boolean, row: JQuery, inputCell: JQuery, addCell: JQuery,
                abbrevCell: JQuery, labelCell: JQuery;

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

            this.fillInputControls(inputCell); // TODO: abbrev cell

            addCell = $('<div>')
                .addClass('step2_table_cell')
                .appendTo(row);
            this.buildAddControl(addCell);

            this.updateInputState();
        }

        fillInputControls(rowContainer: JQuery): void {
            var self: NameElementAbbreviations = this;
            $('<input type="text">')
                .addClass('columnar-text-input')
                .on('change', function() {
                    this.updateInputState();
                    creationManager.updateAbbreviations();
                })
                .appendTo(rowContainer);
            this.buildRemoveControl(rowContainer);
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

        autoUpdateCombinations () {
            var comboInputs: boolean, combosButton:JQuery, noCombosButton:JQuery;
            comboInputs = this.hasComboInputs();
            noCombosButton = this.rows[0].find('input:radio[value=No]');
            console.log('no combo button matches: ' + noCombosButton.length);

            if(this.supportsCombinations) {
                // note: not all inputs will have a "make combos" button  -- need enclosing check
                combosButton = this.rows[0].find('input:radio[value=Yes]');
            }

            if(comboInputs) {
                //combosButton.click();
                combosButton.attr('disabled', String(!comboInputs));
            }
            else {
                //noCombosButton.click();
            }

            noCombosButton.attr('disabled', String(comboInputs || this.supportsCombinations));
        }

        getValueJson(): any {
            var values: string[] = [];
            this.rows.forEach((currentValue, index, arr) => {
                if( this.hasValidInput(index)) {
                    values.push(this.getInput(index));
                }
            });
            return values;
        }

        fillRow(row: JQuery):void {
            var firstRow: boolean, row: JQuery, inputCell: JQuery, addCell: JQuery,
                applyAllCell: JQuery, makeComboCell: JQuery, labelCell: JQuery,
                noComboButton: JQuery, yesComboButton: JQuery;

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
            this.buildRemoveControl(inputCell);
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

            visible = $('<input type="text">')
                .addClass('columnar-text-input');
            hidden = $('<input type="hidden">')
                .addClass('step2-value-input');

            hidden.on('change', function() {
                self.updateInputState();
                creationManager.updateNameElementChoices();
            });

            inputCell.append(visible)
                .append(hidden);

            switch (this.lineAttribute.displayText) {
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
            this.buildRemoveControl(inputCell);
        }

        getInput(rowIndex: number): any {
            var stringVal: string;
            stringVal = this.rows[rowIndex].find('input[type=hidden]').first().val();
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
            var self: BooleanInput = this;
            this.yesCheckbox = $('<input type="checkbox">')
                .on('change', function() {
                    self.updateInputState();
                    creationManager.updateNameElementChoices();
                })
                .appendTo(rowContainer);
            $('<label>')
                .text('Yes')
                .appendTo(rowContainer);
            this.noCheckbox = $('<input type="checkbox">')
                .on('change', function() {
                    self.updateInputState();
                    creationManager.updateNameElementChoices();
                })
                .appendTo(rowContainer);
            $('<label>')
                .text('No')
                .appendTo(rowContainer);
            this.buildRemoveControl(rowContainer);
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

        abbreviations: NameElementAbbreviations[] = [];

        replicateInput: LineAttributeInput;
        lineMetaAutocomplete:EDDAuto.LineMetadataType = null;  //TODO

        nonAutocompleteLineMetaTypes: any[] = [];
        autocompleteLineMetaTypes: any = {};

        indicatorColorIndex:number = 0;
        colors = ['red', 'blue', 'yellow', 'orange', 'purple'];
        colorIndex = 0;

        static autocompleteMetadataNames = [LINE_EXPERIMENTER_META_NAME, LINE_CONTACT_META_NAME,
                                     CARBON_SOURCE_META_NAME, STRAINS_META_NAME];

        constructor() {
            this.replicateInput = new NumberInput({
                    'lineAttribute': new LineAttributeDescriptor('replicates',
                                                                 'Replicates')});
            this.lineProperties = [this.replicateInput];
        }

        addInput(lineAttr: LineAttributeDescriptor): void {
            var newInput: LineAttributeInput, autocompleteMetaItem:any;

            autocompleteMetaItem = this.autocompleteLineMetaTypes[lineAttr.jsonId];
            if(autocompleteMetaItem) {
                newInput = new LineAttributeAutoInput({'lineAttribute': lineAttr});
            }
            else if(EddRest.CONTROL_META_NAME == lineAttr.displayText) {
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
                    return false;  //stop iterating
                }
            });

            // remove the property from our tracking and from the DOM
            this.lineProperties.slice(foundIndex, 1);
            $('#select_line_properties_step_dynamic')
                .children('.sectionContent')
                .children('line_attr_' + lineAttr.jsonId)
                .remove();

            this.updateNameElementChoices();
        }

        insertLineAttribute(input:LineAttributeInput): void {
            var parentDiv: JQuery;
            parentDiv = $('#select_line_properties_step_dynamic').find('.sectionContent');
            this.insertInputRow(input, parentDiv);
        }

        insertAbbreviation(lineAttr:LineAttributeDescriptor): void {
            var parentDiv: JQuery, input: NameElementAbbreviations;
            parentDiv = $('#abbreviations-table');
            input = new NameElementAbbreviations({'lineAttribute': lineAttr});
            this.abbreviations.push(input);
            this.insertInputRow(input, parentDiv);
        }

        insertInputRow(input:MultiValueInput, parentDiv:JQuery): void {
            var row: JQuery;
            row = $('<div>')
                    .addClass('table-row')
                    .attr('id', 'line_attr_' + input.lineAttribute.jsonId)
                    .appendTo(parentDiv);
            input.fillRow(row);
        }

        buildStep3Inputs(): void {
            // set up connected lists for naming elements
            $( "#line_name_elts, #unused_line_name_elts" ).sortable({
              connectWith: ".connectedSortable",
                update: function(event, ui) {
                      creationManager.updateResults();
                },
            }).disableSelection();

            // set up selectable list for abbreviations dialog
            $('#line-name-abbrev-list').selectable();

            // step 3 column headers until there are rows to labels
            $('#abbreviations-table').find('subsection').toggleClass('hidden',  true);
            $('#name_customization_table').find('subsection').toggleClass('hidden', true);
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
        }

        updateNameElementChoices(): void {
            var availableElts: LineAttributeDescriptor[], prevNameElts: LineAttributeDescriptor[],
                newElts: LineAttributeDescriptor[], unusedList: JQuery, unusedChildren: JQuery,
                namingUnchanged:boolean, self:CreationManager;
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
            namingUnchanged = this.lineNameElements.length === $('#line_name_elts').children().length;

            if(namingUnchanged) {
                return;
            }
            this.updateResults();
        }

        updateResults(): void {
            var self: CreationManager = this;
            //build an updated list of naming elements based on user entries in steps 1 & 2
            this.lineNameElements = [];
            $('#line_name_elts').children().each(function() {
                var nameElement: any = $(this).data();
                self.lineNameElements.push(nameElement);
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
                            hiddenInput: JQuery;
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

            // set up the autocomplete for line metadata type selection
            this.lineMetaAutocomplete = new EDDAuto.LineMetadataType({
                            'container': $('#add-prop-dialog'),
                            'visibleInput': $('#add-line-metadata-text'),
                            'hiddenInput': $('#add-line-metadata-value'),
                            'search_extra': {'sort': 'type_name'}});

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
                self.abbreviations.forEach(function(abbreviation: NameElementAbbreviations){
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
                    .text(namingElement.displayText)
                    .addClass('ui-widget-content')
                    .data(namingElement)
                    .appendTo(list);
            });

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

            // remove selected items from the list
            selectedItems.remove();
            $('#no-abbrev-options-div').toggleClass('hidden',
                abbreviationsList.children('li').length == 0);

            console.log('selected abbreviations: ' + selectedAttrs);

            $('#abbreviations-table subsection').toggleClass('hidden', false);

            selectedAttrs.forEach(function(nameElement) {
                self.insertAbbreviation(nameElement);
            });

        }

        buildJson(): string {
            var result: any, json: string, jsonNameElements: string[],
                combinatorialValues: any, commonValues: any;

            // build json for values included as part of generated line names
            jsonNameElements = [];
            this.lineNameElements.forEach(function(nameElement:LineAttributeDescriptor) {
                jsonNameElements.push(nameElement.jsonId);
            });
            result = {name_elements: {elements: jsonNameElements}};

            //TODO: abbreviations / custom additions...see the mockup

            result.replicate_count = $('#spinner').val();

            // include all inputs in the JSON, separating them by "combinatorial" status as
            // required
            commonValues = {};
            combinatorialValues = {};
            this.lineProperties.forEach((input: LineAttributeInput): boolean => {
                if(!input.validInputCount()) {
                    return true; // keep looping
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
}

$(CreateLines.onDocumentReady);