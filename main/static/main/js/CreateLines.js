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
        MultiValueInput.prototype.getLabel = function () {
            return this.uiLabel;
        };
        MultiValueInput.prototype.buildRemoveBtn = function (container) {
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
                return btn;
            }
            return null;
        };
        MultiValueInput.prototype.registerRemoveEvtHandler = function (removeButton, rowIndex) {
            removeButton.off('click');
            removeButton.on('click', null, { 'rowIndex': rowIndex, 'propertyInput': this }, function (ev) {
                var rowIndex, propertyInput;
                rowIndex = ev.data.rowIndex;
                propertyInput = ev.data.propertyInput;
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
        MultiValueInput.prototype.promoteRowContent = function (firstRow, nextRow) {
            var inputCell;
            // remove only the input cell content from this row, leaving labeling and controls
            // in place
            inputCell = firstRow.children('.inputCell').empty();
            // detach and relocate input cell content from the following row, moving it up
            nextRow.children('.inputCell').children().each(function (index, element) {
                $(element).detach().appendTo(inputCell);
            });
        };
        MultiValueInput.prototype.removeRow = function (rowIndex) {
            var row, hadValidInput, nextRow, inputCell;
            hadValidInput = this.hasValidInput(rowIndex);
            row = this.rows[rowIndex];
            // if removing the title row, relocate inputs from the second row to the first, then
            // remove the second row
            if (rowIndex == 0 && this.rows.length > 1) {
                nextRow = this.rows[rowIndex + 1];
                this.promoteRowContent(row, nextRow);
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
            if (this.getRowCount() == 0) {
                this.removeFromForm();
            }
            // if the removed row had valid user input, recompute results
            if (this.rows.length) {
                this.updateInputState();
            }
            if (hadValidInput) {
                this.postRemoveCallback(rowIndex, hadValidInput);
            }
        };
        MultiValueInput.prototype.removeFromForm = function () {
            CreateLines.creationManager.removeInput(this.lineAttribute);
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
        MultiValueInput.prototype.getValueJson = function () {
            // empty default implementation for children to override
        };
        return MultiValueInput;
    }());
    CreateLines.MultiValueInput = MultiValueInput;
    var AbbreviationInput = (function (_super) {
        __extends(AbbreviationInput, _super);
        function AbbreviationInput() {
            _super.apply(this, arguments);
        }
        AbbreviationInput.prototype.hasValidInput = function (rowIndex) {
            var match, abbrev;
            match = this.rows[rowIndex].find('.abbrev-match-input').val();
            abbrev = this.rows[rowIndex].find('.abbrev-val-input').val();
            return (match != undefined) && match.toString().trim() &&
                (abbrev != undefined) && abbrev.toString().trim();
        };
        AbbreviationInput.prototype.removeFromForm = function () {
            CreateLines.creationManager.removeAbbrev(this.lineAttribute);
        };
        AbbreviationInput.prototype.getValueJson = function () {
            var _this = this;
            var values = {}, self = this;
            if (!this.rows.length) {
                return null;
            }
            this.rows.forEach(function (currentValue, rowIndex, arr) {
                var match, abbrev;
                if (_this.hasValidInput(rowIndex)) {
                    match = _this.rows[rowIndex].find('.abbrev-match-input').val();
                    abbrev = _this.rows[rowIndex].find('.abbrev-val-input').val();
                    values[match] = abbrev;
                }
            });
            return values;
        };
        AbbreviationInput.prototype.fillRow = function (row) {
            var firstRow, row, valCell, addCell, abbrevCell, labelCell, self;
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
            if (firstRow) {
                this.buildAddControl(addCell);
                this.getLabel()
                    .appendTo(labelCell);
            }
            this.addAbbrevInput(row, 'abbrev-match-cell', 'abbrev-match-input');
            valCell = this.addAbbrevInput(row, 'abbrev-val-cell', 'abbrev-val-input');
            this.buildRemoveBtn(valCell);
            this.updateInputState();
        };
        AbbreviationInput.prototype.promoteRowContent = function (firstRow, nextRow) {
            var firstRowCell;
            // remove only the input cell content from this row, leaving labeling and controls
            // in place
            firstRowCell = firstRow.children('.abbrev-match-cell').empty();
            // detach and relocate input cell content from the following row, moving it up
            nextRow.children('.abbrev-match-cell').each(function (index, element) {
                $(element).detach().appendTo(firstRowCell);
            });
            firstRowCell = firstRow.children('.abbrev-val-cell').empty();
            // detach and relocate input cell content from the following row, moving it up
            nextRow.children('.abbrev-val-cell').each(function (index, element) {
                $(element).detach().appendTo(firstRowCell);
            });
        };
        AbbreviationInput.prototype.addAbbrevInput = function (row, cellClassName, inputClassName) {
            var cell, self;
            self = this;
            cell = $('<div>')
                .addClass(cellClassName)
                .addClass('columnar-text-input')
                .addClass('bulk_lines_table_cell')
                .addClass('inputCell')
                .appendTo(row);
            $('<input type="text">')
                .addClass(inputClassName)
                .on('change', function () {
                self.updateInputState();
                CreateLines.creationManager.updateAbbreviations();
            })
                .appendTo(cell);
            return cell;
        };
        AbbreviationInput.prototype.registerRemoveEvtHandler = function (removeButton, rowIndex) {
            removeButton.off('click');
            removeButton.on('click', null, { 'rowIndex': rowIndex, 'abbrevInput': this }, function (ev) {
                var rowIndex, abbrevInput;
                rowIndex = ev.data.rowIndex;
                abbrevInput = ev.data.abbrevInput;
                abbrevInput.removeRow(rowIndex);
                if (abbrevInput.getRowCount() == 0) {
                    CreateLines.creationManager.removeAbbrev(abbrevInput.lineAttribute);
                }
            });
        };
        return AbbreviationInput;
    }(MultiValueInput));
    CreateLines.AbbreviationInput = AbbreviationInput;
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
        LineAttributeInput.prototype.getInput = function (rowIndex) {
            return this.rows[rowIndex].find('input').first().val().trim();
        };
        LineAttributeInput.prototype.buildYesComboButton = function () {
            return $('<input type="radio">')
                .prop('name', this.lineAttribute.jsonId)
                .val('Yes')
                .addClass('property_radio');
        };
        LineAttributeInput.prototype.buildNoComboButton = function () {
            return $('<input type="radio">')
                .prop('name', this.lineAttribute.jsonId)
                .prop('checked', true)
                .val('No')
                .addClass('property_radio');
        };
        LineAttributeInput.prototype.hasComboInputs = function () {
            return this.rows.length > 1;
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
                combosButton.attr('checked', 'checked');
                combosButton.attr('disabled', String(!comboInputs));
            }
            else {
                noCombosButton.attr('checked', 'checked');
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
            var firstRow, row, inputCell, addCell, applyAllCell, makeComboCell, labelCell, noComboButton, yesComboButton, flewGrowWrapper;
            this.rows.push(row);
            addCell = $('<div>')
                .addClass('bulk_lines_table_cell')
                .addClass('addCell')
                .appendTo(row);
            labelCell = $('<div>')
                .addClass('bulk_lines_table_cell')
                .appendTo(row);
            firstRow = this.getRowCount() == 1;
            if (firstRow) {
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
            if (firstRow) {
                noComboButton = this.buildNoComboButton().appendTo(applyAllCell);
            }
            makeComboCell = $('<div>')
                .addClass('bulk_lines_table_cell')
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
            // alternate user inputs
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
            this.buildRemoveBtn(inputCell);
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
            this.buildRemoveBtn(inputCell);
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
            var self = this, removeBtn, buttonsDiv;
            buttonsDiv = $('<div>')
                .addClass('columnar-text-input') //TODO: rename class for this new use
                .appendTo(rowContainer);
            this.yesCheckbox = $('<input type="checkbox">')
                .on('change', function () {
                self.updateInputState();
                CreateLines.creationManager.updateNameElementChoices();
            })
                .appendTo(buttonsDiv);
            $('<label>')
                .text('Yes')
                .appendTo(buttonsDiv);
            this.noCheckbox = $('<input type="checkbox">')
                .on('change', function () {
                self.updateInputState();
                CreateLines.creationManager.updateNameElementChoices();
            })
                .appendTo(buttonsDiv);
            $('<label>')
                .text('No')
                .appendTo(buttonsDiv);
            removeBtn = this.buildRemoveBtn(rowContainer);
            removeBtn.addClass('controlRemoveBtn');
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
            this.previewUpdateTimerID = null;
            this.namingInputsChanged = false;
            this.replicateInput = new NumberInput({
                'lineAttribute': new LineAttributeDescriptor('replicates', 'Replicates') });
            this.lineProperties = [this.replicateInput];
        }
        // Start a timer to wait before calling updating the line name preview, which requires
        // an AJAX call to the back end
        CreationManager.prototype.queuePreviewUpdate = function () {
            $('#step4Label').addClass('wait');
            if (this.previewUpdateTimerID) {
                clearTimeout(this.previewUpdateTimerID);
            }
            this.previewUpdateTimerID = setTimeout(this.updatePreview.bind(this), 500); //TODO:
            // 250 in import
        };
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
                    return false; //stop looping
                }
            });
            // remove the property from our tracking and from the DOM
            this.lineProperties.splice(foundIndex, 1);
            $('#line-properties-table')
                .children('.line_attr_' + lineAttr.jsonId)
                .remove();
            this.updateNameElementChoices();
        };
        CreationManager.prototype.removeAbbrev = function (lineAttr) {
            var foundIndex = -1, abbrevInput;
            this.abbreviations.forEach(function (abbrev, index) {
                if (abbrev.lineAttribute.jsonId === lineAttr.jsonId) {
                    foundIndex = index;
                    abbrevInput = abbrev;
                    return false; //stop looping
                }
            });
            // remove the abbreviation from our tracking and from the DOM
            this.abbreviations.splice(foundIndex, 1);
            $('#abbreviations-table')
                .children('.line_attr_' + lineAttr.jsonId)
                .remove();
            this.updateHasAbbrevInputs();
            this.queuePreviewUpdate();
        };
        CreationManager.prototype.insertLineAttribute = function (input) {
            var parentDiv;
            parentDiv = $('#line-properties-table');
            this.insertRow(input, parentDiv);
        };
        CreationManager.prototype.insertAbbreviation = function (lineAttr) {
            var parentDiv, input;
            parentDiv = $('#abbreviations-table');
            input = new AbbreviationInput({ 'lineAttribute': lineAttr });
            this.abbreviations.push(input);
            this.insertRow(input, parentDiv);
        };
        // TODO: integrate with button and complete work. Note that list elements used to represent
        // the labels in the "name element order" subsection should update dynamically based on
        // user entries here
        CreationManager.prototype.addCustomElt = function () {
            var table, row, cell;
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
        };
        CreationManager.prototype.insertRow = function (input, parentDiv) {
            var row;
            row = $('<div>')
                .addClass('line_attr_' + input.lineAttribute.jsonId)
                .addClass('table-row')
                .appendTo(parentDiv);
            input.fillRow(row);
        };
        CreationManager.prototype.buildStep3Inputs = function () {
            // set up connected lists for naming elements
            $("#line_name_elts, #unused_line_name_elts").sortable({
                connectWith: ".connectedSortable",
                update: function (event, ui) {
                    CreateLines.creationManager.queuePreviewUpdate();
                },
            }).disableSelection();
            // set up selectable list for abbreviations dialog
            $('#line-name-abbrev-list').selectable();
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
            //TODO: similar to line properties, detect whether abbreviation matches / values
            // have changed, then trigger a preview update
            this.queuePreviewUpdate();
        };
        CreationManager.prototype.updateNameElementChoices = function () {
            var availableElts, prevNameElts, newElts, unusedList, unusedChildren, nameEltsChanged, self;
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
            nameEltsChanged = this.lineNameElements.length != $('#line_name_elts').children().length;
            if (nameEltsChanged) {
                this.namingInputsChanged = true;
            }
            this.updateAbbreviations();
        };
        CreationManager.prototype.updatePreview = function () {
            var self, json, csrfToken;
            self = this;
            //build an updated list of naming elements based on user entries in steps 1 & 2. Note
            // that events from the connected lists don't give us enough info to know which element
            // was just changed in line names
            this.lineNameElements = [];
            $('#line_name_elts').children().each(function () {
                var nameElement = $(this).data();
                self.lineNameElements.push(nameElement);
            });
            // clear preview and return early if insufficient inputs available
            if (!this.lineNameElements.length) {
                $('#jsonTest').text('');
                $('#backEndResponse').text('');
                return;
            }
            //TODO: remove the color-based indicator and auto-JSON creation here following testing
            var color;
            console.log('updating JSON results');
            color = this.colors[this.colorIndex];
            $('#indicator').css('background', color);
            this.colorIndex = (this.colorIndex + 1) % this.colors.length;
            console.log('Color index = ' + this.colorIndex);
            json = this.buildJson();
            // submit a query to the back end to compute line / assay names and detect errors
            // before actually making any changes
            jQuery.ajax('../../describe/?DRY_RUN=True', // TODO: path?
            {
                'headers': { 'Content-Type': 'application/json' },
                'method': 'POST',
                'dataType': 'json',
                'data': json,
                'processData': false,
                'success': function (responseJson) {
                    $('#backEndResponse').text(responseJson);
                },
                'error': function (jqXHR, textStatus, errorThrown) {
                    $('#backEndResponse').text(textStatus + '\n\n' + errorThrown);
                }
            });
            $('#step4Label').removeClass('wait');
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
            CreateLines.creationManager.updateHasAbbrevDialogOptions(list);
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
            if (!selectedAttrs.length) {
                return;
            }
            // remove selected items from the list
            selectedItems.remove();
            this.updateHasAbbrevDialogOptions(abbreviationsList);
            selectedAttrs.forEach(function (nameElement) {
                self.insertAbbreviation(nameElement);
            });
            this.updateHasAbbrevInputs();
        };
        CreationManager.prototype.updateHasAbbrevInputs = function () {
            var hasInputs = $('#abbreviations-table').children('.table-row').length !== 0;
            // show table header, since there's at least one abbreviation row
            $('#abbreviations-table').toggleClass('off', !hasInputs);
            $('#no-abbrevs-div').toggleClass('off', hasInputs);
        };
        CreationManager.prototype.updateHasAbbrevDialogOptions = function (list) {
            var hasOptions = list.children('li').length !== 0;
            $('#no-abbrev-options-div').toggleClass('off', hasOptions);
            list.toggleClass('off', !hasOptions);
        };
        CreationManager.prototype.buildJson = function () {
            var result, json, jsonNameElements, combinatorialValues, commonValues, abbrevs;
            // build json for values included as part of generated line names
            jsonNameElements = [];
            this.lineNameElements.forEach(function (nameElement) {
                jsonNameElements.push(nameElement.jsonId);
            });
            result = { name_elements: { elements: jsonNameElements } };
            //TODO: abbreviations / custom additions...see the mockup
            if (this.abbreviations.length) {
                abbrevs = {};
                result['abbreviations'] = abbrevs;
                this.abbreviations.forEach(function (inputs, index) {
                    // vals = inputs.validInputCount() )
                    var values = inputs.getValueJson();
                    if (values) {
                        abbrevs[inputs.lineAttribute.jsonId] = values;
                    }
                });
            }
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
    // using jQuery.  See https://docs.djangoproject.com/en/1.11/ref/csrf/
    function getCookie(name) {
        var cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var cookie = jQuery.trim(cookies[i]);
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    // send CSRF header on each AJAX request from this page
    $.ajaxSetup({
        beforeSend: function (xhr) {
            var csrfToken = getCookie('csrftoken');
            xhr.setRequestHeader('X-CSRFToken', csrfToken);
        }
    });
})(CreateLines || (CreateLines = {}));
$(CreateLines.onDocumentReady);
