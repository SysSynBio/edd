/// <reference path="EDDRest.ts" />
/// <reference path="EDDAutocomplete.ts" />
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var CreateLines;
(function (CreateLines) {
    var DATA_FORMAT_STRING = 'string';
    var ROW_INDEX = 'rowIndex';
    //TODO: relocate, e.g. to EDDRest.ts.  Initial attempts compiled but failed to run in
    // strange ways.
    /* Default metadata names that may have to be explicitly-referenced in the UI */
    CreateLines.LINE_NAME_META_NAME = 'Line Name';
    CreateLines.LINE_EXPERIMENTER_META_NAME = 'Line Experimenter';
    CreateLines.LINE_DESCRIPTION_META_NAME = 'Line Description';
    CreateLines.LINE_CONTACT_META_NAME = 'Line Contact';
    CreateLines.CARBON_SOURCE_META_NAME = 'Carbon Source(s)';
    CreateLines.STRAINS_META_NAME = 'Strain(s)';
    CreateLines.CONTROL_META_NAME = 'Control';
    // Metadata types present in the database that should be omitted from user-displayed lists in
    // contexts where separate display is available for line attributes.
    CreateLines.LINE_ATTRIBUTE_META_TYPES = [CreateLines.LINE_NAME_META_NAME, CreateLines.LINE_DESCRIPTION_META_NAME,
        CreateLines.LINE_CONTACT_META_NAME, CreateLines.LINE_EXPERIMENTER_META_NAME, CreateLines.STRAINS_META_NAME];
    function loadAllLineMetadataTypes() {
        $('#addPropertyButton').prop('disabled', true);
        EddRest.loadMetadataTypes({
            'success': CreateLines.creationManager.setLineMetaTypes.bind(CreateLines.creationManager),
            'error': showMetaLoadFailed,
            'request_all': true,
            'wait': showWaitMessage,
            'context': EddRest.LINE_METADATA_CONTEXT,
            'sort_order': EddRest.ASCENDING_SORT,
        });
    }
    function showWaitMessage() {
        console.log('Showing wait message');
        var div, span;
        div = $('#step2_status_div');
        div.empty();
        span = $("<span>")
            .text('Loading line metadata types...')
            .addClass('errorMessage')
            .appendTo(div);
    }
    function showMetaLoadFailed(jqXHR, textStatus, errorThrown) {
        var div, span;
        div = $('#step2_status_div');
        div.empty();
        span = $("<span>")
            .text('Unable to load line metadata from EDD. Property selection is disabled.')
            .addClass('errorMessage')
            .appendTo(div);
        $('<a>').text(' Retry').on('click', function () {
            loadAllLineMetadataTypes();
        }).appendTo(span);
    }
    var LineAttributeDescriptor = (function () {
        function LineAttributeDescriptor(json_elt, displayText) {
            this.jsonId = json_elt;
            this.displayText = displayText;
        }
        LineAttributeDescriptor.prototype.toString = function () {
            return '(' + this.jsonId.toString() + ', ' + this.displayText + ')';
        };
        return LineAttributeDescriptor;
    }());
    var MultiValueInput = (function () {
        function MultiValueInput(options) {
            this.rows = [];
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
        MultiValueInput.prototype.hasValidInput = function (rowIndex) {
            return this.rows[rowIndex].find('input').first().val().trim() != '';
        };
        MultiValueInput.prototype.validInputCount = function () {
            var count = 0;
            for (var i = 0; i < this.rows.length; i++) {
                if (this.hasValidInput(i)) {
                    count++;
                }
            }
            return count;
        };
        MultiValueInput.prototype.highlightRowLabel = function (anyValidInput) {
            this.rows[0].find('label')
                .first()
                .toggleClass('in-use', anyValidInput)
                .toggleClass('not-in-use', !anyValidInput);
        };
        MultiValueInput.prototype.getInput = function (rowIndex) {
            return this.rows[rowIndex].find('input').first().val().trim();
        };
        MultiValueInput.prototype.getLabel = function () {
            return this.uiLabel;
        };
        MultiValueInput.prototype.hasComboInputs = function () {
            return this.rows.length > 1;
        };
        MultiValueInput.prototype.buildYesComboButton = function () {
            return $('<input type="radio">')
                .prop('name', this.lineAttribute.jsonId)
                .val('Yes');
        };
        MultiValueInput.prototype.buildNoComboButton = function () {
            return $('<input type="radio">')
                .prop('name', this.lineAttribute.jsonId)
                .prop('checked', true)
                .val('No')
                .addClass('property_radio');
        };
        MultiValueInput.prototype.buildRemoveControl = function (container) {
            var btn, rowIndex, t;
            // add a delete button in the same cell as the input controls
            if (this.getRowCount() > this.minEntries) {
                rowIndex = this.getRowCount() - 1;
                btn = $('<button>')
                    .addClass('removeButton')
                    .appendTo(container);
                $('<span>').addClass('ui-icon')
                    .addClass('ui-icon-trash').appendTo(btn);
                this.registerRemoveEvtHandler(btn, rowIndex);
            }
        };
        MultiValueInput.prototype.registerRemoveEvtHandler = function (removeButton, rowIndex) {
            removeButton.off('click');
            removeButton.on('click', null, { 'rowIndex': rowIndex, 'propertyInput': this }, function (ev) {
                var rowIndex, propertyInput;
                rowIndex = ev.data.rowIndex;
                propertyInput = ev.data.propertyInput;
                console.log('In handler. rowIndex = ' + rowIndex);
                propertyInput.removeRow(rowIndex);
                if (propertyInput.getRowCount() == 0) {
                    CreateLines.creationManager.removeInput(propertyInput.lineAttribute);
                }
            });
        };
        MultiValueInput.prototype.buildAddControl = function (container) {
            // only add the control to the first row
            if ((this.getRowCount() == 1) && (this.getRowCount() < this.maxRows)) {
                this.addButton = $('<button>')
                    .addClass('addButton')
                    .on('click', this.appendRow.bind(this))
                    .appendTo(container);
                $('<span>').addClass('ui-icon')
                    .addClass('ui-icon-plusthick').appendTo(this.addButton);
            }
        };
        MultiValueInput.prototype.canAddRows = function () {
            return this.getRowCount() < this.maxRows;
        };
        MultiValueInput.prototype.getRowCount = function () {
            return this.rows.length;
        };
        MultiValueInput.prototype.appendRow = function () {
            var newRow, parent, atMax, prevRow;
            prevRow = this.rows[this.rows.length - 1];
            newRow = $('<div>')
                .addClass('table-row')
                .insertAfter(prevRow);
            this.fillRow(newRow);
            this.updateInputState();
        };
        MultiValueInput.prototype.removeRow = function (rowIndex) {
            var row, hadValidInput, nextRow, inputCell;
            hadValidInput = this.hasValidInput(rowIndex);
            row = this.rows[rowIndex];
            // if removing the title row, relocate inputs from the second row to the first, then
            // remove the second row
            if (rowIndex == 0 && this.rows.length > 1) {
                // remove only the input cell content from this row, leaving labeling and controls
                // in place
                inputCell = row.children('.inputCell').empty();
                // detach and relocate input cell content from the following row, moving it up
                nextRow = this.rows[rowIndex + 1];
                nextRow.children('.inputCell').each(function (index, element) {
                    $(element).detach().appendTo(inputCell);
                });
                // remove the now-empty second row whose inputs were moved up to first
                nextRow.remove();
                this.rows.splice(rowIndex + 1, 1);
            }
            else {
                row.remove();
                this.rows.splice(rowIndex, 1);
            }
            // update event handlers for subsequent rows to get the correct index number following
            // the removal of a preceding row
            for (var i = rowIndex; i < this.rows.length; i++) {
                var removeBtn;
                row = this.rows[i];
                removeBtn = row.find('.removeButton').first();
                this.registerRemoveEvtHandler(removeBtn, i);
            }
            // if the removed row had valid user input, recompute results
            if (hadValidInput) {
                if (this.rows.length) {
                    this.updateInputState();
                }
                this.postRemoveCallback(rowIndex, hadValidInput);
            }
        };
        MultiValueInput.prototype.postRemoveCallback = function (rowIndex, hadValidInput) {
            // empty default implementation for children to override
        };
        MultiValueInput.prototype.updateInputState = function () {
            // empty default implementation for children to override
        };
        MultiValueInput.prototype.fillRow = function (row) {
            // empty default implementation for children to override
        };
        return MultiValueInput;
    }());
    CreateLines.MultiValueInput = MultiValueInput;
    var NameElementAbbreviations = (function (_super) {
        __extends(NameElementAbbreviations, _super);
        function NameElementAbbreviations() {
            _super.apply(this, arguments);
        }
        NameElementAbbreviations.prototype.hasValidInput = function (rowIndex) {
            var temp;
            temp = this.rows[rowIndex].find('.columnar-text-input').val();
            return (temp != undefined) && temp.toString().trim();
        };
        NameElementAbbreviations.prototype.fillRow = function (row) {
            var firstRow, row, inputCell, addCell, abbrevCell, labelCell;
            this.rows.push(row);
            labelCell = $('<div>')
                .addClass('step2_table_cell')
                .appendTo(row);
            firstRow = this.getRowCount() == 1;
            if (firstRow) {
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
        };
        NameElementAbbreviations.prototype.fillInputControls = function (rowContainer) {
            var self = this;
            $('<input type="text">')
                .addClass('columnar-text-input')
                .on('change', function () {
                this.updateInputState();
                CreateLines.creationManager.updateAbbreviations();
            })
                .appendTo(rowContainer);
            this.buildRemoveControl(rowContainer);
        };
        return NameElementAbbreviations;
    }(MultiValueInput));
    CreateLines.NameElementAbbreviations = NameElementAbbreviations;
    //TODO: for immediate development
    // 1. differentiate naming / json output from un-implemented controls (e.g. strain)
    // 2. compute / test JSON generation from supported controls
    // 3. implement / test back end communication / review / line creation
    // 4. error handling!! / wizard
    // 5. implement & test abbreviations & custom name elements...nice-to-have, but not necessary
    //    to extract value
    // TODO: revisit meta / attribute subclasses after some integration testing / review of
    // back-end code. May be able to combine some of these.
    var LineAttributeInput = (function (_super) {
        __extends(LineAttributeInput, _super);
        function LineAttributeInput(options) {
            _super.call(this, options);
            this.supportsCombinations = options.supportsCombinations === undefined ?
                true : options.supportsCombinations;
        }
        LineAttributeInput.prototype.updateInputState = function () {
            if (this.addButton) {
                this.addButton.prop('disabled', !this.canAddRows());
            }
            this.highlightRowLabel(this.validInputCount() > 0);
            this.autoUpdateCombinations();
        };
        LineAttributeInput.prototype.getNameElements = function () {
            var validInputCount = this.validInputCount(), hasInput;
            hasInput = validInputCount > 0;
            // only allow naming inputs to be used if there's at least one valid value to insert
            // into line names. note that allowing non-unique values to be used in line names
            // during bulk creation can be helpful since they may differentiate new lines from
            // those already in the study.
            if (!hasInput) {
                return [];
            }
            return [this.lineAttribute];
        };
        LineAttributeInput.prototype.autoUpdateCombinations = function () {
            var comboInputs, combosButton, noCombosButton;
            comboInputs = this.hasComboInputs();
            noCombosButton = this.rows[0].find('input:radio[value=No]');
            console.log('no combo button matches: ' + noCombosButton.length);
            if (this.supportsCombinations) {
                // note: not all inputs will have a "make combos" button  -- need enclosing check
                combosButton = this.rows[0].find('input:radio[value=Yes]');
            }
            if (comboInputs) {
                //combosButton.click();
                combosButton.attr('disabled', String(!comboInputs));
            }
            else {
            }
            noCombosButton.attr('disabled', String(comboInputs || this.supportsCombinations));
        };
        LineAttributeInput.prototype.getValueJson = function () {
            var _this = this;
            var values = [];
            this.rows.forEach(function (currentValue, index, arr) {
                if (_this.hasValidInput(index)) {
                    values.push(_this.getInput(index));
                }
            });
            return values;
        };
        LineAttributeInput.prototype.fillRow = function (row) {
            var firstRow, row, inputCell, addCell, applyAllCell, makeComboCell, labelCell, noComboButton, yesComboButton;
            this.rows.push(row);
            labelCell = $('<div>')
                .addClass('step2_table_cell')
                .appendTo(row);
            firstRow = this.getRowCount() == 1;
            if (firstRow) {
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
            if (firstRow) {
                noComboButton = this.buildNoComboButton().appendTo(applyAllCell);
            }
            makeComboCell = $('<div>')
                .addClass('step2_table_cell')
                .addClass('centered_radio_btn_parent')
                .appendTo(row);
            if (firstRow && this.supportsCombinations) {
                yesComboButton = this.buildYesComboButton()
                    .appendTo(makeComboCell);
                noComboButton.prop('checked', true);
            }
            this.updateInputState();
        };
        LineAttributeInput.prototype.fillInputControls = function (inputCell) {
            // by default, just fill in a single text box.  child classes may override with
            // alternate controls
            var text, hidden, self;
            self = this;
            text = $('<input type="text">')
                .addClass('columnar-text-input');
            text.on('change', function () {
                self.updateInputState();
                CreateLines.creationManager.updateNameElementChoices();
            });
            inputCell.append(text)
                .append(hidden);
            this.buildRemoveControl(inputCell);
        };
        LineAttributeInput.prototype.postRemoveCallback = function (rowIndex, hadValidInput) {
            if (hadValidInput) {
                CreateLines.creationManager.updateNameElementChoices();
            }
        };
        return LineAttributeInput;
    }(MultiValueInput));
    CreateLines.LineAttributeInput = LineAttributeInput;
    var LineAttributeAutoInput = (function (_super) {
        __extends(LineAttributeAutoInput, _super);
        function LineAttributeAutoInput(options) {
            _super.call(this, options);
        }
        // build custom input controls whose type depends on the data type of the Line attribute
        // they configure
        LineAttributeAutoInput.prototype.fillInputControls = function (inputCell) {
            var visible, hidden, self;
            self = this;
            visible = $('<input type="text">')
                .addClass('columnar-text-input');
            hidden = $('<input type="hidden">')
                .addClass('step2-value-input');
            hidden.on('change', function () {
                self.updateInputState();
                CreateLines.creationManager.updateNameElementChoices();
            });
            inputCell.append(visible)
                .append(hidden);
            switch (this.lineAttribute.displayText) {
                case CreateLines.LINE_EXPERIMENTER_META_NAME:
                case CreateLines.LINE_CONTACT_META_NAME:
                    visible.attr('eddautocompletetype', "User");
                    this.autoInput = new EDDAuto.User({
                        'container': inputCell,
                        'visibleInput': visible,
                        'hiddenInput': hidden,
                    });
                    break;
                case CreateLines.CARBON_SOURCE_META_NAME:
                    visible.attr('eddautocompletetype', "CarbonSource");
                    this.autoInput = new EDDAuto.CarbonSource({
                        'container': inputCell,
                        'visibleInput': visible,
                        'hiddenInput': hidden,
                    });
                    break;
                case CreateLines.STRAINS_META_NAME:
                    visible.attr('eddautocompletetype', "Registry");
                    this.autoInput = new EDDAuto.Registry({
                        'container': inputCell,
                        'visibleInput': visible,
                        'hiddenInput': hidden,
                    });
                    break;
            }
            this.buildRemoveControl(inputCell);
        };
        LineAttributeAutoInput.prototype.getInput = function (rowIndex) {
            var stringVal;
            stringVal = this.rows[rowIndex].find('input[type=hidden]').first().val();
            return parseInt(stringVal);
        };
        return LineAttributeAutoInput;
    }(LineAttributeInput));
    CreateLines.LineAttributeAutoInput = LineAttributeAutoInput;
    var BooleanInput = (function (_super) {
        __extends(BooleanInput, _super);
        function BooleanInput(options) {
            _super.call(this, options);
        }
        BooleanInput.prototype.fillInputControls = function (rowContainer) {
            var self = this;
            this.yesCheckbox = $('<input type="checkbox">')
                .on('change', function () {
                self.updateInputState();
                CreateLines.creationManager.updateNameElementChoices();
            })
                .appendTo(rowContainer);
            $('<label>')
                .text('Yes')
                .appendTo(rowContainer);
            this.noCheckbox = $('<input type="checkbox">')
                .on('change', function () {
                self.updateInputState();
                CreateLines.creationManager.updateNameElementChoices();
            })
                .appendTo(rowContainer);
            $('<label>')
                .text('No')
                .appendTo(rowContainer);
            this.buildRemoveControl(rowContainer);
        };
        BooleanInput.prototype.hasComboInputs = function () {
            return this.yesCheckbox.prop('checked') &&
                this.noCheckbox.prop('checked');
        };
        BooleanInput.prototype.hasValidInput = function (rowIndex) {
            return this.yesCheckbox.prop('checked')
                || this.noCheckbox.prop('checked');
        };
        BooleanInput.prototype.getValueJson = function () {
            return this.getInput(0);
        };
        BooleanInput.prototype.getInput = function (rowIndex) {
            var values = [];
            if (this.yesCheckbox.prop('checked')) {
                values.push(true);
            }
            if (this.noCheckbox.prop('checked')) {
                values.push(false);
            }
            return values;
        };
        return BooleanInput;
    }(LineAttributeInput));
    CreateLines.BooleanInput = BooleanInput;
    var NumberInput = (function (_super) {
        __extends(NumberInput, _super);
        function NumberInput(options) {
            options.maxRows = 1;
            options.minRows = 1;
            options.supportsCombinations = false;
            _super.call(this, options);
        }
        NumberInput.prototype.hasValidInput = function (rowIndex) {
            return $('#spinner').val() > 1;
        };
        NumberInput.prototype.fillInputControls = function (rowContainer) {
            $('<input id="spinner">')
                .val(1)
                .addClass('columnar-text-input')
                .addClass('step2-value-input')
                .appendTo(rowContainer);
        };
        NumberInput.prototype.getInput = function (rowIndex) {
            var textInput = _super.prototype.getInput.call(this, rowIndex);
            return +textInput;
        };
        return NumberInput;
    }(LineAttributeInput));
    CreateLines.NumberInput = NumberInput;
    var CreationManager = (function () {
        function CreationManager() {
            // line properties configured in step 2
            this.lineProperties = [];
            // name elements in use in step 3
            this.lineNameElements = [];
            this.abbreviations = [];
            this.lineMetaAutocomplete = null; //TODO
            this.nonAutocompleteLineMetaTypes = [];
            this.autocompleteLineMetaTypes = {};
            this.indicatorColorIndex = 0;
            this.colors = ['red', 'blue', 'yellow', 'orange', 'purple'];
            this.colorIndex = 0;
            this.replicateInput = new NumberInput({
                'lineAttribute': new LineAttributeDescriptor('replicates', 'Replicates') });
            this.lineProperties = [this.replicateInput];
        }
        CreationManager.prototype.addInput = function (lineAttr) {
            var newInput, autocompleteMetaItem;
            autocompleteMetaItem = this.autocompleteLineMetaTypes[lineAttr.jsonId];
            if (autocompleteMetaItem) {
                newInput = new LineAttributeAutoInput({ 'lineAttribute': lineAttr });
            }
            else if (EddRest.CONTROL_META_NAME == lineAttr.displayText) {
                newInput = new BooleanInput({ 'lineAttribute': lineAttr, 'maxRows': 1 });
            }
            else {
                newInput = new LineAttributeInput({ 'lineAttribute': lineAttr });
            }
            this.lineProperties.push(newInput);
            this.insertLineAttribute(newInput);
        };
        CreationManager.prototype.removeInput = function (lineAttr) {
            var foundIndex = -1, lineProperty;
            this.lineProperties.forEach(function (property, index) {
                if (property.lineAttribute.jsonId === lineAttr.jsonId) {
                    foundIndex = index;
                    lineProperty = property;
                    return false; //stop iterating
                }
            });
            // remove the property from our tracking and from the DOM
            this.lineProperties.slice(foundIndex, 1);
            $('#select_line_properties_step_dynamic')
                .children('.sectionContent')
                .children('line_attr_' + lineAttr.jsonId)
                .remove();
            this.updateNameElementChoices();
        };
        CreationManager.prototype.insertLineAttribute = function (input) {
            var parentDiv;
            parentDiv = $('#select_line_properties_step_dynamic').find('.sectionContent');
            this.insertInputRow(input, parentDiv);
        };
        CreationManager.prototype.insertAbbreviation = function (lineAttr) {
            var parentDiv, input;
            parentDiv = $('#abbreviations-table');
            input = new NameElementAbbreviations({ 'lineAttribute': lineAttr });
            this.abbreviations.push(input);
            this.insertInputRow(input, parentDiv);
        };
        CreationManager.prototype.insertInputRow = function (input, parentDiv) {
            var row;
            row = $('<div>')
                .addClass('table-row')
                .attr('id', 'line_attr_' + input.lineAttribute.jsonId)
                .appendTo(parentDiv);
            input.fillRow(row);
        };
        CreationManager.prototype.buildStep3Inputs = function () {
            // set up connected lists for naming elements
            $("#line_name_elts, #unused_line_name_elts").sortable({
                connectWith: ".connectedSortable",
                update: function (event, ui) {
                    CreateLines.creationManager.updateResults();
                },
            }).disableSelection();
            // set up selectable list for abbreviations dialog
            $('#line-name-abbrev-list').selectable();
            // step 3 column headers until there are rows to labels
            $('#abbreviations-table').find('subsection').toggleClass('hidden', true);
            $('#name_customization_table').find('subsection').toggleClass('hidden', true);
        };
        CreationManager.prototype.buildStep2Inputs = function () {
            var _this = this;
            CreateLines.creationManager.buildAddPropDialog();
            CreateLines.creationManager.buildAbbrevDialog();
            // add options for any naming elements that should be available by default
            this.lineProperties.forEach(function (input, i) {
                _this.insertLineAttribute(input);
            });
            // style the replicates spinner
            $("#spinner").spinner({
                min: 1,
                change: function (event, ui) {
                    CreateLines.creationManager.replicateInput.updateInputState();
                    CreateLines.creationManager.updateNameElementChoices();
                } });
            // update step 3 choices based on step 2 defaults
            this.updateNameElementChoices();
        };
        CreationManager.prototype.updateAbbreviations = function () {
        };
        CreationManager.prototype.updateNameElementChoices = function () {
            var availableElts, prevNameElts, newElts, unusedList, unusedChildren, namingUnchanged, self;
            console.log('updating available naming elements');
            //build an updated list of available naming elements based on user entries in step 1
            availableElts = [];
            this.lineProperties.forEach(function (input) {
                var elts = input.getNameElements();
                availableElts = availableElts.concat(elts);
            });
            // loop over available elements, constructing a list of those newly added in step 2 so
            // they can be appended at the end of the step 3 list without altering previous user
            // changes
            newElts = availableElts.slice();
            self = this;
            $('#line_name_elts').children().each(function () {
                var text, element, foundIndex, nameElement, index;
                // start to build up a list of newly-available selections. we'll clear out more of
                // them from the list of unavailable ones
                nameElement = $(this).data();
                for (index = 0; index < newElts.length; index++) {
                    element = newElts[index];
                    if (element.jsonId == nameElement.jsonId) {
                        self.lineNameElements.push(nameElement);
                        newElts.splice(index, 1);
                        return true; // continue outer loop
                    }
                }
                $(this).remove();
                return true; // continue looping
            });
            console.log('Available name elements: ' + availableElts);
            unusedList = $('#unused_line_name_elts');
            unusedChildren = unusedList.children();
            if (unusedChildren) {
                unusedChildren.each(function (unusedIndex, listElement) {
                    var availableElt, newIndex, listElement;
                    listElement = this;
                    for (newIndex = 0; newIndex < newElts.length; newIndex++) {
                        availableElt = newElts[newIndex];
                        if (availableElt.displayText == listElement.textContent) {
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
            newElts.forEach(function (elt) {
                var li;
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
            if (namingUnchanged) {
                return;
            }
            this.updateResults();
        };
        CreationManager.prototype.updateResults = function () {
            var self = this;
            //build an updated list of naming elements based on user entries in steps 1 & 2
            this.lineNameElements = [];
            $('#line_name_elts').children().each(function () {
                var nameElement = $(this).data();
                self.lineNameElements.push(nameElement);
            });
            //TODO: remove the color-based indicator and auto-JSON creation here following testing
            var color;
            console.log('updating JSON results');
            color = this.colors[this.colorIndex];
            $('#indicator').css('background', color);
            this.colorIndex = (this.colorIndex + 1) % this.colors.length;
            console.log('Color index = ' + this.colorIndex);
            this.buildJson();
        };
        CreationManager.prototype.setLineMetaTypes = function (metadataTypes) {
            var self = this;
            $('#step2_status_div').empty();
            $('#addPropertyButton').prop('disabled', false);
            this.nonAutocompleteLineMetaTypes = [];
            this.autocompleteLineMetaTypes = {};
            metadataTypes.forEach(function (metaType) {
                if (CreationManager.autocompleteMetadataNames.indexOf(metaType.type_name) < 0) {
                    self.nonAutocompleteLineMetaTypes.push(metaType);
                }
                else {
                    self.autocompleteLineMetaTypes[metaType.pk] = metaType;
                }
            });
            // TODO:
        };
        CreationManager.prototype.showAddProperty = function () {
            $('#add-prop-dialog').dialog('open');
        };
        CreationManager.prototype.buildAddPropDialog = function () {
            var self = this;
            $('#add-prop-dialog').dialog({
                resizable: false,
                modal: true,
                autoOpen: false,
                buttons: {
                    'Add Property': function () {
                        var meta_name, meta_pk, textInput, hiddenInput;
                        textInput = $('#add-line-metadata-text');
                        hiddenInput = $('#add-line-metadata-value');
                        meta_name = textInput.val();
                        meta_pk = hiddenInput.val();
                        self.lineMetaAutocomplete.omitKey(String(meta_pk));
                        CreateLines.creationManager.addInput(new LineAttributeDescriptor(meta_pk, meta_name));
                        textInput.val(null);
                        hiddenInput.val(null);
                    },
                    'Close': function () {
                        var textInput, hiddenInput;
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
                'search_extra': { 'sort': 'type_name' } });
            // add click behavior to the "add property" button
            $('#addPropertyButton')
                .on('click', CreateLines.creationManager.showAddProperty.bind(this));
        };
        CreationManager.prototype.showAddAbbreviation = function () {
            var list, self;
            self = this;
            list = $('#line-name-abbrev-list').empty();
            this.lineNameElements.forEach(function (namingElement) {
                var existingAbbreviation = false;
                self.abbreviations.forEach(function (abbreviation) {
                    if (abbreviation.lineAttribute.jsonId == namingElement.jsonId) {
                        existingAbbreviation = true;
                        return false; // stop inner loop
                    }
                });
                // skip list item creation for any line property that we already have an
                // abbreviation for
                if (existingAbbreviation) {
                    return true; // continue looping
                }
                $('<li>')
                    .text(namingElement.displayText)
                    .addClass('ui-widget-content')
                    .data(namingElement)
                    .appendTo(list);
            });
            $('#add-abbrev-dialog').dialog('open');
        };
        CreationManager.prototype.buildAbbrevDialog = function () {
            $('#add-abbrev-dialog').dialog({
                resizable: false,
                modal: true,
                autoOpen: false,
                buttons: {
                    'Add Abbreviation(s)': function () {
                        CreateLines.creationManager.addSelectedAbbreviations();
                    },
                    'Close': function () {
                        var textInput, hiddenInput;
                        $(this).dialog('close');
                    }
                }
            });
            $('#addAbbreviationButton')
                .on('click', CreateLines.creationManager.showAddAbbreviation.bind(this));
        };
        CreationManager.prototype.addSelectedAbbreviations = function () {
            var abbreviationsList, selectedAttrs, selectedItems, self;
            self = this;
            // build the list of line attributes selected in the dialog
            abbreviationsList = $('#line-name-abbrev-list');
            selectedItems = abbreviationsList.children('.ui-selected');
            selectedAttrs = [];
            selectedItems.each(function (index, elt) {
                selectedAttrs.push($(elt).data());
            });
            // remove selected items from the list
            selectedItems.remove();
            $('#no-abbrev-options-div').toggleClass('hidden', abbreviationsList.children('li').length == 0);
            console.log('selected abbreviations: ' + selectedAttrs);
            $('#abbreviations-table subsection').toggleClass('hidden', false);
            selectedAttrs.forEach(function (nameElement) {
                self.insertAbbreviation(nameElement);
            });
        };
        CreationManager.prototype.buildJson = function () {
            var result, json, jsonNameElements, combinatorialValues, commonValues;
            // build json for values included as part of generated line names
            jsonNameElements = [];
            this.lineNameElements.forEach(function (nameElement) {
                jsonNameElements.push(nameElement.jsonId);
            });
            result = { name_elements: { elements: jsonNameElements } };
            //TODO: abbreviations / custom additions...see the mockup
            result.replicate_count = $('#spinner').val();
            // include all inputs in the JSON, separating them by "combinatorial" status as
            // required
            commonValues = {};
            combinatorialValues = {};
            this.lineProperties.forEach(function (input) {
                if (!input.validInputCount()) {
                    return true; // keep looping
                }
                if (input.hasComboInputs()) {
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
        };
        CreationManager.autocompleteMetadataNames = [CreateLines.LINE_EXPERIMENTER_META_NAME, CreateLines.LINE_CONTACT_META_NAME,
            CreateLines.CARBON_SOURCE_META_NAME, CreateLines.STRAINS_META_NAME];
        return CreationManager;
    }());
    CreateLines.CreationManager = CreationManager;
    CreateLines.creationManager = new CreationManager();
    // As soon as the window load signal is sent, call back to the server for the set of reference
    // records that will be used to disambiguate labels in imported data.
    function onDocumentReady() {
        CreateLines.creationManager.buildStep2Inputs();
        CreateLines.creationManager.buildStep3Inputs();
        // load line metadata types from the REST API. This allows us to display them more
        // responsively if there are many, and also to show them in the
        loadAllLineMetadataTypes();
    }
    CreateLines.onDocumentReady = onDocumentReady;
})(CreateLines || (CreateLines = {}));
$(CreateLines.onDocumentReady);
