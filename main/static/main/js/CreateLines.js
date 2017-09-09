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
            this.minEntries = options['minEntries'] || 1;
            this.supportsCombinations = options.supportsCombinations === undefined ? true : options.supportsCombinations;
            this.supportsMultiValue = options.supportsMultiValue === undefined ? false : options.supportsMultiValue;
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
        return MultiValueInput;
    }());
    CreateLines.MultiValueInput = MultiValueInput;
    var NameElementAbbreviations = (function (_super) {
        __extends(NameElementAbbreviations, _super);
        function NameElementAbbreviations() {
            _super.apply(this, arguments);
        }
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
    var LinePropertyInput = (function (_super) {
        __extends(LinePropertyInput, _super);
        function LinePropertyInput(options) {
            _super.call(this, options);
        }
        LinePropertyInput.prototype.updateInputState = function () {
            this.highlightRowLabel(this.validInputCount() > 0);
            this.autoUpdateCombinations();
        };
        LinePropertyInput.prototype.getNameElements = function () {
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
        LinePropertyInput.prototype.autoUpdateCombinations = function () {
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
        LinePropertyInput.prototype.getValueJson = function () {
            var _this = this;
            var values = [];
            this.rows.forEach(function (currentValue, index, arr) {
                if (_this.hasValidInput(index)) {
                    values.push(_this.getInput(index));
                }
            });
            return values;
        };
        LinePropertyInput.prototype.getLabel = function () {
            return this.uiLabel;
        };
        LinePropertyInput.prototype.hasComboInputs = function () {
            return this.rows.length > 1;
        };
        LinePropertyInput.prototype.buildYesComboButton = function () {
            return $('<input type="radio">')
                .prop('name', this.lineAttribute.jsonId)
                .val('Yes');
        };
        LinePropertyInput.prototype.buildNoComboButton = function () {
            return $('<input type="radio">')
                .prop('name', this.lineAttribute.jsonId)
                .prop('checked', true)
                .val('No')
                .addClass('property_radio');
        };
        LinePropertyInput.prototype.buildRemoveControl = function (container) {
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
        LinePropertyInput.prototype.registerRemoveEvtHandler = function (removeButton, rowIndex) {
            removeButton.off('click');
            removeButton.on('click', null, { 'rowIndex': rowIndex, 'manager': this }, function (ev) {
                var rowIndex, manager;
                rowIndex = ev.data.rowIndex;
                manager = ev.data.manager;
                console.log('In handler. rowIndex = ' + rowIndex);
                manager.removeRow(rowIndex);
            });
        };
        LinePropertyInput.prototype.buildAddControl = function (container) {
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
        LinePropertyInput.prototype.canAddRows = function () {
            return this.getRowCount() < this.maxRows;
        };
        LinePropertyInput.prototype.getRowCount = function () {
            return this.rows.length;
        };
        LinePropertyInput.prototype.appendRow = function () {
            var newRow, parent, atMax, prevRow;
            prevRow = this.rows[this.rows.length - 1];
            newRow = $('<div>')
                .addClass('table-row')
                .insertAfter(prevRow);
            this.fillRow(newRow);
            this.updateInputState();
            this.addButton.prop('disabled', !this.canAddRows());
        };
        LinePropertyInput.prototype.removeRow = function (rowIndex) {
            var row, hadInput;
            hadInput = this.hasValidInput(rowIndex);
            // remove this row from our tracking and from the DOM
            row = this.rows[rowIndex];
            row.remove();
            this.rows.splice(rowIndex, 1);
            // update event handlers for subsequent rows to get the correct index number following
            // the removal of a preceding row
            console.log('Updating event handlers starting @ index ' + rowIndex);
            for (var i = rowIndex; i < this.rows.length; i++) {
                var removeBtn;
                row = this.rows[i];
                removeBtn = row.find('.removeButton').first();
                console.log('Updating ' + removeBtn.length + ' event handlers for index ' +
                    rowIndex);
                this.registerRemoveEvtHandler(removeBtn, i);
            }
            // re-enable the add button if appropriate / if it was disabled
            this.addButton.prop('disabled', !this.canAddRows());
            if (hadInput) {
                this.updateInputState();
                CreateLines.creationManager.updateNameElementChoices();
            }
        };
        LinePropertyInput.prototype.fillRow = function (row) {
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
        LinePropertyInput.prototype.fillInputControls = function (container) {
            //empty implementation for children to override
        };
        return LinePropertyInput;
    }(MultiValueInput));
    CreateLines.LinePropertyInput = LinePropertyInput;
    var LineAttributeInput = (function (_super) {
        __extends(LineAttributeInput, _super);
        function LineAttributeInput(options) {
            _super.call(this, options);
            if (options.minRows === undefined) {
                options.minRows = 1;
            }
        }
        LineAttributeInput.prototype.hasValidInput = function (rowIndex) {
            var temp;
            temp = this.rows[rowIndex].find('.step2-value-input').val();
            return (temp != undefined) && temp.toString().trim();
        };
        LineAttributeInput.prototype.fillInputControls = function (rowContainer) {
            var self = this;
            $('<input type="text">')
                .addClass('step2-text-input')
                .addClass('step2-value-input')
                .on('change', function () {
                this.updateInputState();
                CreateLines.creationManager.updateNameElementChoices();
            })
                .appendTo(rowContainer);
            this.buildRemoveControl(rowContainer);
        };
        return LineAttributeInput;
    }(LinePropertyInput));
    CreateLines.LineAttributeInput = LineAttributeInput;
    var LineAttributeAutoInput = (function (_super) {
        __extends(LineAttributeAutoInput, _super);
        function LineAttributeAutoInput(options) {
            _super.call(this, options);
        }
        // build custom input controls whose type depends on the data type of the Line attribute
        // they configure
        LineAttributeAutoInput.prototype.fillInputControls = function (rowContainer) {
            var visible, hidden, self;
            self = this;
            visible = $('<input type="text">')
                .addClass('step2-text-input');
            hidden = $('<input type="hidden">')
                .addClass('step2-value-input');
            hidden.on('change', function () {
                self.updateInputState();
                CreateLines.creationManager.updateNameElementChoices();
            });
            rowContainer.append(visible).append(hidden);
            switch (this.lineAttribute.displayText) {
                case CreateLines.LINE_EXPERIMENTER_META_NAME:
                case CreateLines.LINE_CONTACT_META_NAME:
                    visible.attr('eddautocompletetype', "User");
                    this.autoInput = new EDDAuto.User({
                        'container': rowContainer,
                        'visibleInput': visible,
                        'hiddenInput': hidden,
                    });
                    break;
                case CreateLines.CARBON_SOURCE_META_NAME:
                    visible.attr('eddautocompletetype', "CarbonSource");
                    this.autoInput = new EDDAuto.CarbonSource({
                        'container': rowContainer,
                        'visibleInput': visible,
                        'hiddenInput': hidden,
                    });
                    break;
                case CreateLines.STRAINS_META_NAME:
                    visible.attr('eddautocompletetype', "Registry");
                    this.autoInput = new EDDAuto.Registry({
                        'container': rowContainer,
                        'visibleInput': visible,
                        'hiddenInput': hidden,
                    });
                    break;
            }
            this.buildRemoveControl(rowContainer);
        };
        LineAttributeAutoInput.prototype.getInput = function (rowIndex) {
            var stringVal;
            stringVal = this.rows[rowIndex].find('input[type=hidden]').first().val();
            return parseInt(stringVal);
        };
        return LineAttributeAutoInput;
    }(LinePropertyInput));
    CreateLines.LineAttributeAutoInput = LineAttributeAutoInput;
    var ControlInput = (function (_super) {
        __extends(ControlInput, _super);
        function ControlInput(options) {
            _super.call(this, options);
        }
        ControlInput.prototype.fillInputControls = function (rowContainer) {
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
        };
        ControlInput.prototype.hasComboInputs = function () {
            return this.yesCheckbox.prop('checked') &&
                this.noCheckbox.prop('checked');
        };
        ControlInput.prototype.hasValidInput = function (rowIndex) {
            return this.yesCheckbox.prop('checked')
                || this.noCheckbox.prop('checked');
        };
        ControlInput.prototype.getValueJson = function () {
            return this.getInput(0);
        };
        ControlInput.prototype.getInput = function (rowIndex) {
            var values = [];
            if (this.yesCheckbox.prop('checked')) {
                values.push(true);
            }
            if (this.noCheckbox.prop('checked')) {
                values.push(false);
            }
            return values;
        };
        return ControlInput;
    }(LinePropertyInput));
    CreateLines.ControlInput = ControlInput;
    var ReplicateInput = (function (_super) {
        __extends(ReplicateInput, _super);
        function ReplicateInput(options) {
            options.maxRows = 1;
            options.minRows = 1;
            options.supportsCombinations = false;
            _super.call(this, options);
        }
        ReplicateInput.prototype.hasValidInput = function (rowIndex) {
            return $('#spinner').val() > 1;
        };
        ReplicateInput.prototype.fillInputControls = function (rowContainer) {
            $('<input id="spinner">')
                .val(1)
                .addClass('step2-text-input')
                .addClass('step2-value-input')
                .appendTo(rowContainer);
        };
        return ReplicateInput;
    }(LinePropertyInput));
    CreateLines.ReplicateInput = ReplicateInput;
    var CreationManager = (function () {
        function CreationManager() {
            // line properties configured in step 2
            this.lineProperties = [];
            // name elements in use in step 3
            this.nameElements = [];
            // name elements not in use in step 3
            this.unusedNameElements = [];
            this.usedMetadataNames = [];
            this.lineMetaAutocomplete = null;
            this.nonAutocompleteLineMetaTypes = [];
            this.autocompleteLineMetaTypes = {};
            this.indicatorColorIndex = 0;
            this.colors = ['red', 'blue', 'yellow', 'orange', 'purple'];
            this.colorIndex = 0;
            this.lineProperties = [
                new ReplicateInput({
                    'lineAttribute': new LineAttributeDescriptor('replicates', 'Replicates') })
            ];
        }
        CreationManager.prototype.addInput = function (lineAttr) {
            var newInput, autocompleteMetaItem;
            autocompleteMetaItem = this.autocompleteLineMetaTypes[lineAttr.jsonId];
            if (autocompleteMetaItem) {
                newInput = new LineAttributeAutoInput({ 'lineAttribute': lineAttr });
            }
            else if (EddRest.CONTROL_META_NAME == lineAttr.displayText) {
                newInput = new ControlInput({ 'lineAttribute': lineAttr, 'maxRows': 1 });
            }
            else {
                newInput = new LineAttributeInput({ 'lineAttribute': lineAttr });
            }
            this.lineProperties.push(newInput);
            this.insertInputRow(newInput);
        };
        CreationManager.prototype.insertInputRow = function (input) {
            var parentDiv, row;
            parentDiv = $('#select_line_properties_step_dynamic').find('.sectionContent');
            row = $('<div>')
                .addClass('table-row')
                .appendTo(parentDiv);
            input.fillRow(row);
        };
        CreationManager.prototype.buildInputs = function () {
            var _this = this;
            // style the replicates spinner
            $("#spinner").spinner({
                min: 1,
                change: function (event, ui) {
                    CreateLines.creationManager.updateNameElementChoices();
                } });
            CreateLines.creationManager.buildAddPropDialog();
            CreateLines.creationManager.buildAbbrevDialog();
            // add click behavior to the "add property" button
            $('#addPropertyButton')
                .on('click', CreateLines.creationManager.showAddProperty.bind(this));
            $('#addAbbreviationButton')
                .on('click', CreateLines.creationManager.showAddAbbreviation.bind(this));
            // set up the autocomplete for line metadata type selection
            this.lineMetaAutocomplete = new EDDAuto.LineMetadataType({
                'container': $('#add-prop-dialog'),
                'visibleInput': $('#add-line-metadata-text'),
                'hiddenInput': $('#add-line-metadata-value'),
                'search_extra': { 'sort': 'ascending' } }); // TODO: sort not working!
            this.lineProperties.forEach(function (input, i) {
                _this.insertInputRow(input);
            });
            // add options for any naming elements that should be available by default
            this.updateNameElementChoices();
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
                        self.nameElements.push(nameElement);
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
            namingUnchanged = this.nameElements.length === $('#line_name_elts').children().length;
            if (namingUnchanged) {
                return;
            }
            this.updateResults();
        };
        CreationManager.prototype.updateResults = function () {
            var self = this;
            //build an updated list of naming elements based on user entries in steps 1 & 2
            this.nameElements = [];
            $('#line_name_elts').children().each(function () {
                var nameElement = $(this).data();
                self.nameElements.push(nameElement);
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
        };
        CreationManager.prototype.showAddAbbreviation = function () {
            var list = $('#line-name-abbrev-list').empty();
            this.nameElements.forEach(function (namingElement) {
                $('<li>')
                    .text(namingElement.displayText)
                    .addClass('ui-widget-content')
                    .data(namingElement)
                    .appendTo(list);
            });
            $('#add-abbrev-dialog').dialog('open');
        };
        CreationManager.prototype.buildAbbrevDialog = function () {
            var self = this;
            $('#add-abbrev-dialog').dialog({
                resizable: false,
                modal: true,
                autoOpen: false,
                buttons: {
                    'Add Abbreviation(s)': function () {
                        // var meta_name:string, meta_pk:number, textInput: JQuery, hiddenInput: JQuery;
                        // self.lineMetaAutocomplete.omitKey(String(meta_pk));
                        //creationManager.addAbbreviation();
                    },
                    'Close': function () {
                        var textInput, hiddenInput;
                        $(this).dialog('close');
                    }
                }
            });
        };
        CreationManager.prototype.addAbbreviation = function (nameElement) {
        };
        CreationManager.prototype.buildJson = function () {
            var result, json, jsonNameElements, combinatorialValues, commonValues;
            jsonNameElements = [];
            this.nameElements.forEach(function (nameElement) {
                jsonNameElements.push(nameElement.jsonId);
            });
            result = { name_elements: { elements: jsonNameElements } };
            //TODO: abbreviations / custom additions...see the mockup
            result.replicate_count = $('#spinner').val();
            commonValues = [];
            this.lineProperties.forEach(function (input) {
                result[input.lineAttribute.jsonId] = input.getValueJson();
            });
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
        CreateLines.creationManager.buildInputs();
        // set up connected lists for naming elements
        $("#line_name_elts, #unused_line_name_elts").sortable({
            connectWith: ".connectedSortable",
            update: function (event, ui) {
                CreateLines.creationManager.updateResults();
            },
        }).disableSelection();
        // set up selectable list for abbreviations
        $('#line-name-abbrev-list').selectable();
        // load line metadata types from the REST API. This allows us to display them more
        // responsively if there are many, and also to show them in the
        loadAllLineMetadataTypes();
    }
    CreateLines.onDocumentReady = onDocumentReady;
})(CreateLines || (CreateLines = {}));
$(CreateLines.onDocumentReady);
