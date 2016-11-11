/// <reference path="typescript-declarations.d.ts" />
/// <reference path="EDDAutocomplete.ts" />
/// <reference path="Utl.ts" />
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// Creates a div element with the given styling, optionally hidden by default,
// and provides a means to hide or show it.
var EDDEditable;
(function (EDDEditable) {
    var EditableElement = (function () {
        function EditableElement(parentElement, style) {
            var _this = this;
            this.elementJQ = $('<div type="text"/>').addClass(style || '');
            if (parentElement) {
                this.elementJQ.appendTo(parentElement);
                this.parentElement = parentElement;
            }
            else {
                this.parentElement = null;
            }
            var id = EditableElement._uniqueIndex.toString();
            EditableElement._uniqueIndex += 1;
            this.id = id;
            this.element = this.elementJQ[0];
            this.element.id = id;
            this.inputElement = null;
            this.minimumRows = null;
            this.maximumRows = null;
            this.keyESCHandler = function (e) {
                if (e.which == 27) {
                    // ESCAPE key. Cancel out.
                    _this.cancelEditing();
                }
            };
            this.setUpMainElement();
            this.generateControlsContainer();
            this.generateControlButtons();
            this.setDefaultStyling();
            this.elementJQ.click(this.clickToEditHandler.bind(this));
        }
        EditableElement.prototype.editAllowed = function () {
            return true;
        };
        EditableElement.prototype.getValue = function () {
            return '';
        };
        // Override if the value of the field needs to be post-processed or interpreted in some way before being displayed.
        // It is very likely this will need to be altered when subclassing EditableAutocomplete
        EditableElement.prototype.getDisplayValue = function () {
            return this.getValue();
        };
        EditableElement.prototype.setValue = function (value) {
        };
        EditableElement.prototype.canCommit = function (value) {
            return true;
        };
        EditableElement.prototype.onSuccess = function (value) {
        };
        EditableElement.prototype.blankLabel = function () {
            return '(not set)';
        };
        EditableElement.prototype.makeFormData = function (value) {
            var formData = new FormData();
            formData.append('value', value);
            return formData;
        };
        EditableElement.prototype.getFormURL = function () {
            return '';
        };
        EditableElement.prototype.showValue = function () {
            var e = this.element;
            while (e.firstChild) {
                e.removeChild(e.firstChild);
            }
            var v = this.getDisplayValue();
            var bl = this.blankLabel();
            if (bl && ((v === undefined) || (v == null) || (v == ''))) {
                e.innerHTML = '<span style="color:#888">' + bl + '</span>';
            }
            else {
                e.appendChild(document.createTextNode(v));
            }
        };
        // This is called one time to do any necessary manipulation of the main element
        // during setup.
        EditableElement.prototype.setUpMainElement = function () {
            // The "verticalButtons" class changes the styling of the buttons,
            // as well as the styling of the main element itself.
            // For example it gives each button a style of "block" instead of "inline-block",
            // preventing the buttons from appearing side-by-side.
            this.elementJQ.addClass('verticalButtons');
        };
        // Generate a container for the editing buttons(s), and a positioning element to
        // put the controls in the right place relative to the main element.
        EditableElement.prototype.generateControlsContainer = function () {
            // The container is a float-right span that appears at the right edge
            // of the cell in the layout, and the icons consume space within.
            this.editControlsPositioner = $('<span class="icon-positioner"/>')[0];
            this.editControlsContainer = $('<span class="icon-container"/>')[0];
            this.editControlsPositioner.appendChild(this.editControlsContainer);
        };
        // Instantiates and stores all the buttons used in the controls container for later use
        EditableElement.prototype.generateControlButtons = function () {
            this.editButtonElement = $('<span class="icon icon-edit"/>')[0];
            this.acceptButtonElement = $('<span class="icon icon-accept"/>')[0];
            this.cancelButtonElement = $('<span class="icon icon-cancel"/>')[0];
            this.waitButtonElement = $('<span class="icon wait-faster"/>')[0];
            // When rendering contents that have been floated, some browsers will "magically" collapse anything
            // that doesn't contain non-whitespace text to 0 width, regardless of style settings.
            this.editButtonElement.appendChild(document.createTextNode(String.fromCharCode(160))); // &nbsp;
            this.acceptButtonElement.appendChild(document.createTextNode(String.fromCharCode(160)));
            this.cancelButtonElement.appendChild(document.createTextNode(String.fromCharCode(160)));
            this.waitButtonElement.appendChild(document.createTextNode(String.fromCharCode(160)));
            this.cancelButtonElement.setAttribute('title', 'Click to cancel editing.\nYou can also cancel editing by pressing the ESC key.');
            $(this.acceptButtonElement).click(this.clickToAcceptHandler.bind(this));
            $(this.cancelButtonElement).click(this.clickToCancelHandler.bind(this));
        };
        // Changes the styling of the container element to indicate that editing is allowed,
        // and adds a mouse-over control to engage editing.
        EditableElement.prototype.setDefaultStyling = function () {
            this.elementJQ.addClass('editable-field');
            if (this.editAllowed()) {
                this.elementJQ.addClass('enabled');
            }
            else {
                this.elementJQ.removeClass('enabled');
            }
            this.elementJQ.removeClass('active');
            this.elementJQ.removeClass('saving');
            this.elementJQ.addClass('inactive');
            this.element.setAttribute('title', 'click to edit');
            var c = this.editControlsPositioner;
            var p = this.element;
            // We want this to be the first element so the vertical height of the rest of the content
            // doesn't cause it to float farther down side of the cell.
            if (p.firstChild) {
                if (p.firstChild != c) {
                    p.insertBefore(c, p.firstChild);
                }
            }
            else {
                p.appendChild(c);
            }
            while (this.editControlsContainer.firstChild) {
                this.editControlsContainer.removeChild(this.editControlsContainer.firstChild);
            }
            this.editControlsContainer.appendChild(this.editButtonElement);
        };
        // Instantiates the form element(s) used when editing is taking place,
        // with appropriate event handlers and styling, and adds them to the
        // container element.
        EditableElement.prototype.setUpEditingMode = function () {
            var pThis = this;
            this.elementJQ.removeClass('inactive');
            this.elementJQ.removeClass('saving');
            this.elementJQ.addClass('active');
            // Figure out how high to make the text edit box.
            var desiredFontSize = this.elementJQ.css("font-size");
            var lineHeight = parseInt(desiredFontSize, 10);
            var desiredNumLines = this.elementJQ.height() / lineHeight;
            desiredNumLines = Math.floor(desiredNumLines) + 1;
            if (this.minimumRows) {
                if (desiredNumLines < this.minimumRows) {
                    desiredNumLines = this.minimumRows;
                }
            }
            if (this.maximumRows) {
                if (desiredNumLines > this.maximumRows) {
                    desiredNumLines = this.maximumRows;
                }
            }
            // Create an input field that the user can edit with.
            var i = document.createElement("textarea");
            this.inputElement = i;
            i.type = "text";
            i.value = this.getDisplayValue();
            // Copy font attributes from our underlying control.
            $(i).css("font-family", this.elementJQ.css("font-family"));
            $(i).css("font-size", desiredFontSize);
            // Set width and height.
            i.style.width = "100%";
            $(i).attr('rows', desiredNumLines);
            // Compel the enclosing div to be 100% width as well, so our textarea gets
            // the maximum available space
            //this.element.style.width = "100%";
            this.clearElementForEditing();
            this.element.appendChild(i);
            // Remember what we're editing in case they cancel or move to another element
            EditableElement._prevEditableElement = this;
            // Set focus to the new input element ASAP after the click handler.
            // We can't just do this in here because the browser won't actually set the focus,
            // presumably because it thinks the focus should be in what was just clicked on.
            window.setTimeout(function () {
                pThis.inputElement.focus();
            }, 0);
            this.setUpESCHandler();
            // Handle special keys like enter and escape.
            i.onkeydown = function (e) {
                if (e.which == 13) {
                    // ENTER key. Commit the changes.
                    pThis.commitEdit();
                }
            };
            // TODO: Handle losing focus (in which case we commit changes).
        };
        // Support function for setUpEditingMode.
        // Takes the container element that we are using as an editable element,
        // and clears it of all content, then re-adds the basic edit control widgets.
        EditableElement.prototype.clearElementForEditing = function () {
            // Clear the element out
            while (this.element.firstChild) {
                this.element.removeChild(this.element.firstChild);
            }
            // Re-add the controls area
            this.element.appendChild(this.editControlsPositioner);
            while (this.editControlsContainer.firstChild) {
                this.editControlsContainer.removeChild(this.editControlsContainer.firstChild);
            }
            this.editControlsContainer.appendChild(this.acceptButtonElement);
            this.editControlsContainer.appendChild(this.cancelButtonElement);
            //this.editButtonElement.className = "icon icon-edit";
            this.element.removeAttribute('title');
        };
        EditableElement.prototype.clickToEditHandler = function () {
            if (!this.editAllowed()) {
                // Editing not allowed?  Then this has no effect.
                // Let the system handle this event.
                return true;
            }
            if (EditableElement._prevEditableElement != null) {
                if (this === EditableElement._prevEditableElement) {
                    // They're already editing this element. Don't re-setup everything.
                    // Returning true lets the system handle this mouse click.
                    return true;
                }
                else {
                    // They were already editing something, so revert those changes.
                    EditableElement._prevEditableElement.cancelEditing();
                    EditableElement._prevEditableElement = null;
                }
            }
            this.setUpEditingMode();
            // Returning false means to stop handling the mouse click, which respects our inputElement.select() call.
            return false;
        };
        EditableElement.prototype.cancelEditing = function () {
            var pThis = this;
            var element = this.element;
            this.removeESCHandler();
            // Remove the input box.
            if (this.inputElement && this.inputElement.parentNode) {
                this.inputElement.parentNode.removeChild(this.inputElement);
            }
            // We manipulated the size of the
            // container element to give the maximum available space for editing.
            // We should attempt to reset that.
            // We can't just read the old width out and save it, then re-insert it now, because
            // that may permanently fix the element at a width that it may have only had
            // before because of external layout factors.
            //this.element.style.width = '';
            // Restore the content.
            this.showValue();
            // Re-add the default editing widgetry
            this.setDefaultStyling();
            EditableElement._prevEditableElement = null;
        };
        EditableElement.prototype.commitEdit = function () {
            var debug = false;
            var value = this.getEditedValue();
            if (!this.canCommit(value)) {
                return;
            }
            var pThis = this;
            var element = this.element;
            // Extract the new value
            var formData = this.makeFormData(value);
            var formURL = this.getFormURL();
            this.setUpCommittingIndicator();
            $.ajax({
                'url': formURL,
                'type': 'POST',
                'cache': false,
                'data': formData,
                'success': function (response) {
                    if (response.type == "Success") {
                        pThis.setValue(value);
                        pThis.onSuccess(value);
                    }
                    else {
                        alert("Error: " + response.message);
                    }
                    pThis.cancelEditing();
                },
                'error': function (jqXHR, textStatus, errorThrown) {
                    if (debug) {
                        console.log(textStatus + ' ' + errorThrown);
                        console.log(jqXHR.responseText);
                    }
                    pThis.cancelEditing(); // TODO: Better reponse in UI for user
                }
            });
        };
        // This changes the UI to a third state called 'saving' that is different from 'active' or 'inactive'.
        EditableElement.prototype.setUpCommittingIndicator = function () {
            while (this.editControlsContainer.firstChild) {
                this.editControlsContainer.removeChild(this.editControlsContainer.firstChild);
            }
            this.editControlsContainer.appendChild(this.waitButtonElement);
            this.elementJQ.removeClass('active');
            this.elementJQ.removeClass('inactive');
            this.elementJQ.addClass('saving');
        };
        EditableElement.prototype.clickToAcceptHandler = function () {
            this.commitEdit();
            // Stop handling the mouse click
            return false;
        };
        EditableElement.prototype.clickToCancelHandler = function () {
            this.cancelEditing();
            // Stop handling the mouse click
            return false;
        };
        EditableElement.prototype.setUpESCHandler = function () {
            $(document).on('keydown', this.keyESCHandler);
        };
        EditableElement.prototype.removeESCHandler = function () {
            $(document).off('keydown', this.keyESCHandler);
        };
        EditableElement.prototype.getEditedValue = function () {
            return this.inputElement.value;
        };
        EditableElement.prototype.appendTo = function (el) {
            this.parentElement = el;
            el.appendChild(this.element);
        };
        EditableElement.prototype.appendChild = function (el) {
            this.element.appendChild(el);
        };
        EditableElement.prototype.clear = function () {
            while (this.element.lastChild) {
                $(this.element.lastChild).detach();
            }
        };
        EditableElement.prototype.visible = function (enable) {
            if (enable) {
                this.elementJQ.removeClass('off');
            }
            else {
                this.elementJQ.addClass('off');
            }
        };
        EditableElement._uniqueIndex = 1;
        EditableElement._prevEditableElement = null;
        return EditableElement;
    }());
    EDDEditable.EditableElement = EditableElement;
    var EditableAutocomplete = (function (_super) {
        __extends(EditableAutocomplete, _super);
        function EditableAutocomplete(inputElement) {
            _super.call(this, inputElement);
            this.autoCompleteObject = null;
        }
        EditableAutocomplete.prototype.setUpMainElement = function () {
            this.elementJQ.addClass('horizontalButtons');
        };
        // Override this with your specific autocomplete type
        EditableAutocomplete.prototype.createAutoCompleteObject = function () {
            // Create an input field that the user can edit with.
            return new EDDAuto.User({
                container: this.elementJQ
            });
            //, 'editElem' + EditableElement._uniqueIndex, this.getValue());
        };
        // This either returns a reference to the autocomplete object,
        // or if necessary, creates a new one and prepares it, then returns it.
        EditableAutocomplete.prototype.getAutoCompleteObject = function () {
            if (this.autoCompleteObject) {
                return this.autoCompleteObject;
            }
            var auto = this.createAutoCompleteObject();
            // Assume that there is only one AutocompleteEngine involved, and that it can resolve the value from getValue.
            //var id = this.getValue();
            //var selectString = e.resolveRecordIDToSelectString(id);
            //var selectRecord = e.recordCache().cache(id);
            //auto.setSelection(new EDDAuto.AutocompleteFieldSelection(selectString, e.getEngineUID(), selectRecord));
            var el = auto.visibleInput;
            // Copy font attributes from our underlying control.
            $(el).css("font-family", this.elementJQ.css("font-family"));
            $(el).css("font-size", this.elementJQ.css("font-size"));
            $(el).css("width", "100%");
            this.autoCompleteObject = auto;
            return auto;
        };
        EditableAutocomplete.prototype.setUpEditingMode = function () {
            var pThis = this;
            this.elementJQ.removeClass('inactive');
            this.elementJQ.removeClass('saving');
            this.elementJQ.addClass('active');
            var auto = this.getAutoCompleteObject(); // Calling this may set it up for the first time
            this.inputElement = auto.visibleInput;
            this.clearElementForEditing();
            this.element.appendChild(auto.visibleInput[0]);
            // Remember what we're editing in case they cancel or move to another element
            EditableElement._prevEditableElement = this;
            // Set focus to the new input element ASAP after the click handler.
            // We can't just do this in here because the browser won't actually set the focus,
            // presumably because it thinks the focus should be in what was just clicked on.
            window.setTimeout(function () {
                pThis.inputElement.focus();
            }, 0);
            this.setUpESCHandler();
            // Handle special keys like enter and escape.
            this.inputElement.onkeydown = function (e) {
                if (e.which == 13) {
                    // ENTER key. Commit the changes.
                    pThis.commitEdit();
                }
            };
            // TODO: Handle losing focus (in which case we should commit changes?).
        };
        EditableAutocomplete.prototype.getEditedValue = function () {
            var auto = this.getAutoCompleteObject();
            //			return auto.latestSelection.matchedRecord.id;
        };
        return EditableAutocomplete;
    }(EditableElement));
    EDDEditable.EditableAutocomplete = EditableAutocomplete;
    var EditableEmail = (function (_super) {
        __extends(EditableEmail, _super);
        function EditableEmail() {
            _super.apply(this, arguments);
        }
        // Override this with your specific autocomplete type
        EditableEmail.prototype.createAutoCompleteObject = function () {
            // Create an input field that the user can edit with.
            return new EDDAuto.User({
                container: this.elementJQ
            });
            // null, 'editElem' + EditableElement._uniqueIndex, this.getValue()
        };
        return EditableEmail;
    }(EditableAutocomplete));
    EDDEditable.EditableEmail = EditableEmail;
})(EDDEditable || (EDDEditable = {}));
