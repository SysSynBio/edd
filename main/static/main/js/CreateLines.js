/// <reference path="typescript-declarations.d.ts" />
/// <reference path="EDDAutocomplete.ts" />
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var CreateLines;
(function (CreateLines) {
    'use strict';
    var DATA_FORMAT_STRING = 'string';
    var ROW_INDEX = 'rowIndex';
    var NameElement = (function () {
        function NameElement(json_elt, displayText) {
            this.jsonId = json_elt;
            this.displayText = displayText;
        }
        NameElement.prototype.toString = function () {
            return '(' + this.jsonId.toString() + ', ' + this.displayText + ')';
        };
        return NameElement;
    }());
    //TODO: for immediate development
    // 1. differentiate naming / json output from un-implemented controls (e.g. strain)
    // 2. compute / test JSON generation from supported controls
    // 3. implement / test back end communication / review / line creation
    // 4. error handling!! / wizard
    // 5. implement & test abbreviations & custom name elements...nice-to-have, but not necessary to extract value
    //TODO: revisit meta / attribute subclasses after some integration testing / review of back-end code. May be able to
    // combine some of these.
    var LineCreationInput = (function () {
        function LineCreationInput(options) {
            this.rows = [];
            this.uiLabel = $('<label>')
                .text(options.labelText + ':')
                .addClass('not-in-use');
            this.jsonId = options.jsonId;
            this.maxRows = options.maxRows === undefined ? 30 : options.maxRows;
            this.minEntries = options['minEntries'] || 1;
            this.supportsCombinations = options.supportsCombinations === undefined ? true : options.supportsCombinations;
            this.supportsMultiValue = options.supportsMultiValue === undefined ? false : options.supportsMultiValue;
            if (!this.jsonId) {
                throw Error('jsonId is required');
            }
            if (!this.uiLabel) {
                throw Error('uiLabel is required');
            }
        }
        LineCreationInput.prototype.hasValidInput = function (rowIndex) {
            return this.rows[rowIndex].find('input').first().val().trim() != '';
        };
        LineCreationInput.prototype.hasAnyValidInput = function () {
            for (var i = 0; i < this.rows.length; i++) {
                if (this.hasValidInput(i)) {
                    return true;
                }
            }
            return false;
        };
        LineCreationInput.prototype.highlightRowLabel = function (anyValidInput) {
            this.rows[0].find('label')
                .first()
                .toggleClass('in-use', anyValidInput)
                .toggleClass('not-in-use', !anyValidInput);
        };
        LineCreationInput.prototype.getInput = function (rowIndex) {
            return this.rows[rowIndex].find('input').first().val().trim();
        };
        LineCreationInput.prototype.getNameElements = function () {
            // only allow naming inputs to be used if there's at least one valid value to insert into line names.
            // note that allowing non-unique values to be used in line names during bulk creation can be helpful since
            // they may differentiate new lines from those already in the study.
            if (!this.hasAnyValidInput()) {
                return [];
            }
            switch (this.jsonId) {
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
        };
        LineCreationInput.prototype.getValueJson = function () {
            var _this = this;
            var values;
            values = [];
            this.rows.forEach(function (currentValue, index, arr) {
                if (_this.hasValidInput(index)) {
                    values.push(_this.getInput(index));
                }
            });
            return values;
        };
        LineCreationInput.prototype.getLabel = function () {
            return this.uiLabel;
        };
        LineCreationInput.prototype.buildYesComboButton = function () {
            return $('<input type="radio">').prop('name', this.jsonId).val('Yes');
        };
        LineCreationInput.prototype.buildNoComboButton = function () {
            return $('<input type="radio">')
                .prop('name', this.jsonId)
                .prop('checked', true)
                .val('No')
                .addClass('property_radio');
        };
        LineCreationInput.prototype.getRowCount = function () {
            return this.rows.length;
        };
        LineCreationInput.prototype.buildRemoveControl = function (container) {
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
        LineCreationInput.prototype.registerRemoveEvtHandler = function (removeButton, rowIndex) {
            removeButton.off('click');
            removeButton.on('click', null, { 'rowIndex': rowIndex, 'manager': this }, function (ev) {
                var rowIndex, manager;
                rowIndex = ev.data.rowIndex;
                manager = ev.data.manager;
                console.log('In handler. rowIndex = ' + rowIndex);
                manager.removeRow(rowIndex);
            });
        };
        LineCreationInput.prototype.buildAddControl = function (container) {
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
        LineCreationInput.prototype.canAddRows = function () {
            return this.getRowCount() < this.maxRows;
        };
        LineCreationInput.prototype.appendRow = function () {
            var newRow, parent, atMax, prevRow;
            prevRow = this.rows[this.rows.length - 1];
            newRow = $('<div>')
                .addClass('row')
                .insertAfter(prevRow);
            this.fillRow(newRow);
            this.addButton.prop('disabled', !this.canAddRows());
        };
        LineCreationInput.prototype.removeRow = function (rowIndex) {
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
                console.log('Updating ' + removeBtn.length + ' event handlers for index ' + rowIndex);
                this.registerRemoveEvtHandler(removeBtn, i);
            }
            if (hadInput) {
                CreateLines.creationManager.updateNameElements();
            }
            // re-enable the add button if appropriate / if it was disabled
            this.addButton.prop('disabled', !this.canAddRows());
        };
        LineCreationInput.prototype.fillRow = function (row) {
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
        };
        LineCreationInput.prototype.fillInputControls = function (container) {
            //empty implementation for children to override
        };
        return LineCreationInput;
    }());
    CreateLines.LineCreationInput = LineCreationInput;
    var LineMetadataInput = (function (_super) {
        __extends(LineMetadataInput, _super);
        function LineMetadataInput(options) {
            _super.call(this, options);
            this.metaTypeIndexes = {};
        }
        // TODO: override parent behavior to launch a modal dialog...prompt for metadata type first to avoid problems
        // in allowing selection in the main form
        LineMetadataInput.prototype.appendRow = function () {
            var newRow, parent, atMax, prevRow;
            prevRow = this.rows[this.rows.length - 1];
            newRow = $('<div>')
                .addClass('row')
                .insertAfter(prevRow);
            this.fillRow(newRow);
            this.addButton.prop('disabled', !this.canAddRows());
        };
        LineMetadataInput.prototype.hasValidInput = function (rowIndex) {
            var row, hasType, hasValue, selectedType;
            row = this.rows[rowIndex];
            selectedType = row.find('.meta-type').first().val();
            hasType = (selectedType != undefined) && selectedType.toString().trim();
            hasValue = row.find('.meta-value').val() != undefined;
            return hasType && hasValue;
        };
        LineMetadataInput.prototype.fillInputControls = function (rowContainer) {
            var visibleType, hiddenType, valueInput, hiddenVal;
            valueInput = $('<input type="text" name="value">')
                .addClass('step2-text-input')
                .addClass('meta-value')
                .appendTo(rowContainer);
            valueInput.on('change', function () {
                CreateLines.creationManager.updateNameElements();
            });
            this.buildRemoveControl(rowContainer);
        };
        LineMetadataInput.prototype.getNameElements = function () {
            var _this = this;
            var elts;
            elts = [];
            this.rows.forEach(function (row, index) {
                var metaPk, displayName;
                if (_this.hasValidInput(index)) {
                    metaPk = row.find(':hidden').first().val();
                    displayName = row.find(':input').first().val();
                    elts.push(new NameElement(metaPk, displayName));
                }
            });
            return elts;
        };
        return LineMetadataInput;
    }(LineCreationInput));
    CreateLines.LineMetadataInput = LineMetadataInput;
    var LineAttributeInput = (function (_super) {
        __extends(LineAttributeInput, _super);
        function LineAttributeInput(options) {
            if (options.minRows === undefined) {
                options.minRows = 1;
            }
            _super.call(this, options);
        }
        LineAttributeInput.prototype.hasValidInput = function (rowIndex) {
            var temp;
            temp = this.rows[rowIndex].find('.step2-value-input').val();
            return (temp != undefined) && temp.toString().trim();
        };
        LineAttributeInput.prototype.fillInputControls = function (rowContainer) {
            $('<input type="text">')
                .addClass('step2-text-input')
                .addClass('step2-value-input')
                .on('change', function () {
                CreateLines.creationManager.updateNameElements();
            })
                .appendTo(rowContainer);
            this.buildRemoveControl(rowContainer);
        };
        return LineAttributeInput;
    }(LineCreationInput));
    CreateLines.LineAttributeInput = LineAttributeInput;
    var LineAttributeAutoInput = (function (_super) {
        __extends(LineAttributeAutoInput, _super);
        function LineAttributeAutoInput(options) {
            _super.call(this, options);
        }
        // build custom input controls whose type depends on the data type of the Line attribute
        // they configure
        LineAttributeAutoInput.prototype.fillInputControls = function (rowContainer) {
            var visible, hidden;
            visible = $('<input type="text">')
                .addClass('step2-text-input');
            hidden = $('<input type="hidden">')
                .addClass('step2-value-input');
            hidden.on('change', function () {
                CreateLines.creationManager.updateNameElements();
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
        };
        return LineAttributeAutoInput;
    }(LineCreationInput));
    CreateLines.LineAttributeAutoInput = LineAttributeAutoInput;
    var ControlInput = (function (_super) {
        __extends(ControlInput, _super);
        function ControlInput() {
            _super.apply(this, arguments);
        }
        ControlInput.prototype.fillInputControls = function (rowContainer) {
            this.yesCheckbox = $('<input type="checkbox">')
                .on('change', function () {
                CreateLines.creationManager.updateNameElements();
            })
                .appendTo(rowContainer);
            $('<label>')
                .text('Yes')
                .appendTo(rowContainer);
            this.noCheckbox = $('<input type="checkbox">')
                .on('change', function () {
                CreateLines.creationManager.updateNameElements();
            })
                .appendTo(rowContainer);
            $('<label>')
                .text('No')
                .appendTo(rowContainer);
        };
        ControlInput.prototype.hasValidInput = function (rowIndex) {
            return this.yesCheckbox.prop('checked') || this.noCheckbox.prop('checked');
        };
        ControlInput.prototype.getNameElements = function () {
            var hasInput;
            hasInput = this.hasAnyValidInput();
            this.highlightRowLabel(hasInput);
            if (hasInput) {
                return [new NameElement('control', 'Control')];
            }
            return [];
        };
        return ControlInput;
    }(LineCreationInput));
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
        ReplicateInput.prototype.getNameElements = function () {
            var hasInput;
            hasInput = this.hasAnyValidInput();
            this.highlightRowLabel(hasInput);
            return [new NameElement('replicate_num', 'Replicate #')];
        };
        return ReplicateInput;
    }(LineCreationInput));
    CreateLines.ReplicateInput = ReplicateInput;
    var CreationManager = (function () {
        function CreationManager() {
            this.indicatorColorIndex = 0;
            this.dataElements = [];
            this.nameElements = [];
            this.unusedNameElements = [];
            this.colors = ['red', 'blue', 'yellow', 'orange', 'purple'];
            this.colorIndex = 0;
            console.log('In constructor!');
            this.dataElements = [
                /*              new LineAttributeAutoInput(
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
                                  'jsonId': 'N/A', }),*/
                new ControlInput({
                    'labelText': 'Control',
                    'jsonId': 'control',
                    'maxRows': 1 }),
                new LineAttributeInput({ 'labelText': 'Description',
                    'jsonId': 'description', }),
                new ReplicateInput({
                    'labelText': 'Replicates',
                    'jsonId': 'replicates' }),
            ];
        }
        CreationManager.prototype.addInput = function (labelText, jsonId) {
            var newInput;
            console.log('addInput()');
            newInput = new LineAttributeInput({
                'labelText': labelText,
                'jsonId': jsonId });
            this.dataElements.push(newInput);
            this.insertInputRow(newInput);
        };
        CreationManager.prototype.insertInputRow = function (input) {
            var parentDiv, row;
            console.log('insertInputRow');
            parentDiv = $('#select_line_properties_step_dynamic').find('.sectionContent');
            row = $('<div>')
                .addClass('row')
                .appendTo(parentDiv);
            input.fillRow(row);
        };
        CreationManager.prototype.buildInputs = function () {
            var _this = this;
            console.log('In onDocumentReady.  dataElements = ' + this.dataElements);
            this.dataElements.forEach(function (input, i) {
                _this.insertInputRow(input);
            });
        };
        CreationManager.prototype.updateNameElements = function () {
            var availableElts, removedFromNameElts, newElts, unusedList, newElt;
            console.log('updating available naming elements');
            //build an updated list of available naming elements based on user entries in step 1
            availableElts = [];
            this.dataElements.forEach(function (input) {
                var elts = input.getNameElements();
                availableElts = availableElts.concat(elts);
            });
            newElts = availableElts.slice();
            $('#line_name_elts').children().each(function () {
                var text, element, index, data;
                // start to build up a list of newly-available selections. we'll clear out more of them from the
                // list of unavailable ones
                index = newElts.indexOf($(this).data());
                if (index >= 0) {
                    newElts.splice(index, 1);
                    return true; // continue looping
                }
                else {
                    console.log('removing ' + this.text + 'from name elts list');
                    this.remove();
                }
            });
            console.log('Available name elements: ' + availableElts);
            unusedList = $('#unused_line_name_elts');
            unusedList.children().each(function () {
                var availableElt, index;
                for (index = 0; index < newElts.length; index++) {
                    availableElt = newElts[index];
                    if (availableElt.displayText == this.textContent) {
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
            this.updateResults();
        };
        CreationManager.prototype.updateResults = function () {
            //TODO: remove the color-based indicator here following testing
            var color;
            console.log('updating JSON results');
            color = this.colors[this.colorIndex];
            $('#indicator').css('background', color);
            this.colorIndex = (this.colorIndex + 1) % this.colors.length;
            console.log('Color index = ' + this.colorIndex);
            this.buildJson();
        };
        CreationManager.prototype.addProperty = function () {
            $('#dialog-confirm').dialog({
                resizable: false,
                modal: true,
                buttons: {
                    'Add data': function () {
                        var meta_name, meta_pk;
                        console.log('Add data pressed');
                        meta_name = $('#add-line-metadata-text').val();
                        meta_pk = $('#add-line-metadata-value').val();
                        CreateLines.creationManager.addInput(meta_name, meta_name.toLowerCase());
                        $(this).dialog('close');
                    },
                    'Cancel': function () {
                        $(this).dialog('close');
                    }
                }
            });
        };
        CreationManager.prototype.buildJson = function () {
            var result, json, nameElements, combinatorialValues, commonValues;
            //build an updated list of available naming elements based on user entries in step 1
            nameElements = [];
            $('#line_name_elts').children().each(function () {
                var elt, data, text;
                elt = $(this);
                data = elt.data();
                text = elt.text();
                console.log('buildJson(' + this.innerText + '): name elt = ' + data.toString());
                nameElements.push(data.jsonId);
            });
            result = { name_elements: { elements: nameElements } };
            //TODO: abbreviations / custom additions...see the mockup
            result.replicate_count = $('#spinner').val();
            commonValues = [];
            this.dataElements.forEach(function (input) {
                result[input.jsonId] = input.getValueJson();
            });
            json = JSON.stringify(result);
            $('#jsonTest').text(json);
            return json;
        };
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
        // style the replicates spinner
        $("#spinner").spinner({
            min: 1,
            change: function (event, ui) {
                CreateLines.creationManager.updateNameElements();
            } });
        // add click behavior to the "add property" button
        $('#addPropertyButton').on('click', CreateLines.creationManager.addProperty.bind(this));
        // set up the autocomplete for line metadata type selection
        new EDDAuto.LineMetadataType({
            'container': $('#dialog-confirm'),
            'visibleInput': $('#add-line-metadata-text'),
            'hiddenInput': $('#add-line-metadata-value'),
        });
        // load line metadata types from the REST API. This allows us to
    }
    CreateLines.onDocumentReady = onDocumentReady;
})(CreateLines || (CreateLines = {}));
$(CreateLines.onDocumentReady);
