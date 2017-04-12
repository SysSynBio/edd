/// <reference path="typescript-declarations.d.ts" />
/// <reference path="BiomassCalculationUI.ts" />
/// <reference path="Dragboxes.ts" />
/// <reference path="DataGrid.ts" />
/// <reference path="EDDAutocomplete.ts" />
/// <reference path="EDDEditableElement.ts" />
/// <reference path="Study.ts" />
/// <reference path="Utl.ts" />
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var StudyOverview;
(function (StudyOverview) {
    'use strict';
    var attachmentIDs;
    var attachmentsByID;
    var prevDescriptionEditElement;
    var activeDraggedFile;
    var fileUploadProgressBar;
    // This is called upon receiving a response from a file upload operation, and unlike
    // fileRead(), is passed a processed result from the server as a second argument,
    // rather than the raw contents of the file.
    function fileReturnedFromServer(fileContainer, result) {
        var currentPath = window.location.pathname;
        var linesPathName = currentPath.slice(0, currentPath.lastIndexOf('overview')) + 'experiment-description';
        $('<p>', {
            text: 'Success! ' + result['lines_created'] + ' lines added!',
            style: 'margin:auto'
        }).appendTo('#linesAdded');
        successfulRedirect(linesPathName);
    }
    StudyOverview.fileReturnedFromServer = fileReturnedFromServer;
    function fileWarningReturnedFromServer(fileContainer, result) {
        var currentPath = window.location.pathname;
        var linesPathName = currentPath.slice(0, currentPath.lastIndexOf('overview')) + 'experiment-description';
        $('<p>', {
            text: 'Success! ' + result['lines_created'] + ' lines added!',
            style: 'margin:auto'
        }).appendTo('#linesAdded');
        //display success message
        $('#linesAdded').show();
        generateWarnings(result.warnings);
        generateAcceptWarning();
        //accept warnings for succesful upload of experiment description file.
        $('#acceptWarnings').on('change', function (e) {
            successfulRedirect(linesPathName);
        });
    }
    StudyOverview.fileWarningReturnedFromServer = fileWarningReturnedFromServer;
    function successfulRedirect(linesPathName) {
        //redirect to lines page
        setTimeout(function () {
            window.location.pathname = linesPathName;
        }, 1000);
    }
    // This is called upon receiving an errror in a file upload operation, and
    // is passed an unprocessed result from the server as a second argument.
    function fileErrorReturnedFromServer(fileContainer, xhr, url) {
        // reset the drop zone here
        //parse xhr.response
        var obj, error, id;
        try {
            if (xhr.status === 504) {
                generate504Error();
            }
            obj = JSON.parse(xhr.response);
            if (obj.errors) {
                generateErrors(obj.errors);
            }
            if (obj.warnings) {
                generateWarnings(obj.warnings);
            }
        }
        catch (e) {
            alertError("", "There was an error", "EDD administrators have been notified. Please try again later.");
        }
        //if there is more than one alert and no dismiss all alert button, add a dismiss all alerts button
        if ($('.alert').length > 5 && $('#dismissAll').length === 0) {
            $('#alert_placeholder').prepend('<a href="" class="dismissAll" id="dismissAll">Dismiss all alerts</a>');
        }
        //set up click handler events
        $('#omitStrains').change(function () {
            var f = fileContainer.file;
            f.sendTo(window.location.pathname.split('overview')[0] + 'describe/?IGNORE_ICE_RELATED_ERRORS=true');
            $('#iceError').hide();
        });
        $('#allowDuplicates').change(function () {
            var f = fileContainer.file;
            f.sendTo(window.location.pathname.split('overview')[0] + 'describe/?ALLOW_DUPLICATE_NAMES=true');
            $('#duplicateError').hide();
        });
        $('#noDuplicates, #noOmitStrains').change(function () {
            window.location.reload();
        });
        //dismiss all alerts on click
        $('#dismissAll').on('click', function () {
            $('.close').click();
            $('#dismissAll').remove();
        });
    }
    StudyOverview.fileErrorReturnedFromServer = fileErrorReturnedFromServer;
    function generateWarnings(warnings) {
        var warningMessages = organizeMessages(warnings);
        for (var key in warningMessages) {
            alertWarning(key, warningMessages[key]);
        }
    }
    function generateAcceptWarning() {
        var warningAlerts, warningAcceptMessage, warningInput;
        warningAlerts = $('.alert-warning:visible');
        warningAcceptMessage = $('<span>', {
            text: "Accept Warnings?",
            class: 'acceptWarnings',
        });
        warningInput = $('<input>', {
            type: "radio",
            id: "acceptWarnings"
        });
        if (warningAlerts.length === 1) {
            $(warningAlerts).append(warningAcceptMessage).append(warningInput);
        }
        else {
            $('#alert_placeholder').prepend(warningAcceptMessage).append(warningInput);
        }
    }
    function organizeMessages(warnings) {
        var obj = {};
        warnings.forEach(function (warning) {
            var message = warning.summary + ": " + warning.details;
            if (obj.hasOwnProperty(warning.category)) {
                obj[warning.category].push(message);
            }
            else {
                obj[warning.category] = [message];
            }
        });
        return obj;
    }
    function generateErrors(errors) {
        errors.forEach(function (e) {
            if (e['category'] === "ICE-related Error") {
                // create dismissible error alert
                alertIceWarning(e.category, e.summary, e.details);
            }
            else if (e.summary === "Duplicate assay names in the input" || e.summary === "Duplicate " +
                "line names in the input") {
                if ($('#duplicateError').length === 1) {
                    alertDuplicateError(e.category, e.summary, e.details);
                }
            }
            else {
                alertError(e.category, e.summary, e.details);
            }
        });
    }
    function generate504Error() {
        alertError("", "EDD timed out", "Please reload page and reupload file or try again later");
    }
    function alertIceWarning(header, subject, message) {
        var iceError = $('#iceError');
        $(iceError).children('h4').text('Warning! ' + header);
        $(iceError).children('p').text(subject + " " + message);
        $('#alert_placeholder').append(iceError);
        $(iceError).show();
    }
    function alertDuplicateError(header, subject, message) {
        var duplicateElem = $('#duplicateError');
        $(duplicateElem).children('h4').text(header);
        $(duplicateElem).children('p').text(subject + ": " + message);
        $('#alert_placeholder').append(duplicateElem);
        $(duplicateElem).show();
    }
    function alertError(header, subject, message) {
        if ($('#omitStrains').prop('checked')) {
            $('#iceError').remove();
        }
        else if ($('#allowDuplicates').prop('checked')) {
            $('#allowDuplicates').remove();
        }
        var newErrorAlert = $('.alert-danger').eq(0).clone();
        $(newErrorAlert).children('h4').text('Error uploading! ' + header);
        $(newErrorAlert).children('p').text(subject + ": " + message);
        $('#alert_placeholder').append(newErrorAlert);
        $(newErrorAlert).show();
        clearDropZone();
    }
    function alertWarning(subject, message) {
        var newWarningAlert = $('.alert-warning').eq(0).clone();
        $(newWarningAlert).children('h4').text('Warning - ' + subject);
        message.forEach(function (m) {
            var summary = $('<p>', {
                class: "alertWarning",
                text: m,
            });
            $(newWarningAlert).append(summary);
        });
        $('#alert_placeholder').append(newWarningAlert);
        $(newWarningAlert).show();
    }
    function clearDropZone() {
        $('#templateDropZone').removeClass('off');
        $('#fileDropInfoIcon').addClass('off');
        $('#fileDropInfoName').addClass('off');
        $('#fileDropInfoSending').addClass('off');
    }
    // Here, we take a look at the type of the dropped file and decide whether to
    // send it to the server, or process it locally.
    // We inform the FileDropZone of our decision by setting flags in the fileContainer object,
    // which will be inspected when this function returns.
    function fileDropped(fileContainer, iceError) {
        this.haveInputData = true;
        //processingFileCallback();
        var ft = fileContainer.fileType;
        // We'll signal the dropzone to upload this, and receive processed results.
        if (ft === 'xlsx') {
            fileContainer.skipProcessRaw = true;
            fileContainer.skipUpload = false;
        }
        // HPLC reports need to be sent for server-side processing
        if (!fileContainer.skipProcessRaw || !fileContainer.skipUpload) {
            this.showFileDropped(fileContainer, iceError);
        }
    }
    StudyOverview.fileDropped = fileDropped;
    // Reset and show the info box that appears when a file is dropped,
    // and reveal the text entry area.
    function showFileDropped(fileContainer) {
        var processingMessage = '';
        // Set the icon image properly
        $('#fileDropInfoIcon').removeClass('xml');
        $('#fileDropInfoIcon').removeClass('text');
        $('#fileDropInfoIcon').removeClass('excel');
        if (fileContainer.fileType === 'xml') {
            $('#fileDropInfoIcon').addClass('xml');
        }
        else if (fileContainer.fileType === 'xlsx') {
            $('#fileDropInfoIcon').addClass('excel');
        }
        else if (fileContainer.fileType === 'plaintext') {
            $('#fileDropInfoIcon').addClass('text');
        }
        $('#templateDropZone').addClass('off');
        $('#fileDropInfoArea').removeClass('off');
        $('#fileDropInfoSending').removeClass('off');
        $('#fileDropInfoName').text(fileContainer.file.name);
        if (!fileContainer.skipUpload) {
            processingMessage = 'Sending ' + Utl.JS.sizeToString(fileContainer.file.size) + ' To Server...';
            $('#fileDropInfoLog').empty();
        }
        else if (!fileContainer.skipProcessRaw) {
            processingMessage = 'Processing ' + Utl.JS.sizeToString(fileContainer.file.size) + '...';
            $('#fileDropInfoLog').empty();
        }
        $('#fileUploadMessage').text(processingMessage);
        this.activeDraggedFile = fileContainer;
    }
    StudyOverview.showFileDropped = showFileDropped;
    // This function is passed the usual fileContainer object, but also a reference to the
    // full content of the dropped file.
    function fileRead(fileContainer, result) {
        this.haveInputData = true;
    }
    StudyOverview.fileRead = fileRead;
    function preparePermissions() {
        var user, group;
        user = new EDDAuto.User({
            container: $('#permission_user_box')
        });
        group = new EDDAuto.Group({
            container: $('#permission_group_box')
        });
        //check public permission input on click
        $('#set_everyone_permission').on('click', function () {
            $('#permission_public').prop('checked', true);
        });
        $('#set_group_permission').on('click', function () {
            $('#permission_group').prop('checked', true);
        });
        $('#set_user_permission').on('click', function () {
            $('#permission_user').prop('checked', true);
        });
        $('form#permissions')
            .on('submit', function (ev) {
            var perm = {}, klass, auto;
            auto = $('form#permissions').find('[name=class]:checked');
            klass = auto.val();
            perm.type = $(auto).siblings('select').val();
            perm[klass.toLowerCase()] = { 'id': $(auto).siblings('input:hidden').val() };
            $.ajax({
                'url': '/study/' + EDDData.currentStudyID + '/permissions/',
                'type': 'POST',
                'data': {
                    'data': JSON.stringify([perm]),
                    'csrfmiddlewaretoken': $('form#permissions').find('[name=csrfmiddlewaretoken]').val()
                },
                'success': function () {
                    var permissionTarget;
                    console.log(['Set permission: ', JSON.stringify(perm)].join(''));
                    //reset permission options
                    $('form#permissions').find('.autocomp_search').siblings('select').val('N');
                    //reset input
                    $('form#permissions').find('.autocomp_search').val('');
                    $('<div>').text('Permission Updated').addClass('success')
                        .appendTo($('form#permissions')).delay(2000).fadeOut(2000);
                },
                'error': function (xhr, status, err) {
                    console.log(['Setting permission failed: ', status, ';', err].join(''));
                    //reset permission options
                    $('form#permissions').find('.autocomp_search').siblings('select').val('N');
                    //reset input
                    $('form#permissions').find('.autocomp_search').val('');
                    $('<div>').text('Server Error: ' + err).addClass('bad')
                        .appendTo($('form#permissions')).delay(5000).fadeOut(2000);
                }
            });
            return false;
        })
            .find(':radio').trigger('change').end()
            .removeClass('off');
        //set style on inputs for permissions
        $('#permission_user_box').find('input').insertBefore('#user_permission_options').addClass('permissionUser');
        $('#permission_group_box').find('input').insertBefore('#group_permission_options').addClass('permissionGroup');
        $('#permission_public_box').addClass('permissionGroup');
        // Set up the Add Measurement to Assay modal
        $("#permissionsSection").dialog({
            minWidth: 500,
            autoOpen: false
        });
        $("#addPermission").click(function () {
            $("#permissionsSection").removeClass('off').dialog("open");
            return false;
        });
        //TODO: remove this and fix bug
        $("#attachmentsSection a:contains('Delete')").hide();
    }
    function onChangedMetabolicMap() {
        if (this.metabolicMapName) {
            // Update the UI to show the new filename for the metabolic map.
            $("#metabolicMapName").html(this.metabolicMapName);
        }
        else {
            $("#metabolicMapName").html('(none)');
        }
    }
    StudyOverview.onChangedMetabolicMap = onChangedMetabolicMap;
    // They want to select a different metabolic map.
    function onClickedMetabolicMapName() {
        var _this = this;
        var ui, callback = function (error, metabolicMapID, metabolicMapName, finalBiomass) {
            if (!error) {
                _this.metabolicMapID = metabolicMapID;
                _this.metabolicMapName = metabolicMapName;
                _this.biomassCalculation = finalBiomass;
                _this.onChangedMetabolicMap();
            }
            else {
                console.log("onClickedMetabolicMapName error: " + error);
            }
        };
        ui = new StudyMetabolicMapChooser(false, callback);
    }
    StudyOverview.onClickedMetabolicMapName = onClickedMetabolicMapName;
    var EditableStudyDescription = (function (_super) {
        __extends(EditableStudyDescription, _super);
        function EditableStudyDescription(inputElement, style) {
            _super.call(this, inputElement, style);
            this.minimumRows = 4;
            this.formURL('/study/' + EDDData.currentStudyID + '/setdescription/');
        }
        EditableStudyDescription.prototype.getValue = function () {
            return EDDData.Studies[EDDData.currentStudyID].description;
        };
        EditableStudyDescription.prototype.setValue = function (value) {
            EDDData.Studies[EDDData.currentStudyID].description = value;
        };
        EditableStudyDescription.prototype.blankLabel = function () {
            return '(click to add description)';
        };
        return EditableStudyDescription;
    }(StudyBase.EditableStudyElement));
    StudyOverview.EditableStudyDescription = EditableStudyDescription;
    var EditableStudyContact = (function (_super) {
        __extends(EditableStudyContact, _super);
        function EditableStudyContact(inputElement, style) {
            _super.call(this, inputElement, style);
            this.formURL('/study/' + EDDData.currentStudyID + '/setcontact/');
        }
        // Have to reproduce these here rather than using EditableStudyElement because the inheritance is different
        EditableStudyContact.prototype.editAllowed = function () {
            return EDDData.currentStudyWritable;
        };
        EditableStudyContact.prototype.canCommit = function (value) {
            return EDDData.currentStudyWritable;
        };
        EditableStudyContact.prototype.getValue = function () {
            return EDDData.Studies[EDDData.currentStudyID].contact;
        };
        EditableStudyContact.prototype.setValue = function (value) {
            EDDData.Studies[EDDData.currentStudyID].contact = value;
        };
        return EditableStudyContact;
    }(EDDEditable.EditableAutocomplete));
    StudyOverview.EditableStudyContact = EditableStudyContact;
    // Called when the page loads.
    function prepareIt() {
        this.attachmentIDs = null;
        this.attachmentsByID = null;
        this.prevDescriptionEditElement = null;
        this.metabolicMapID = -1;
        this.metabolicMapName = null;
        this.biomassCalculation = -1;
        new EditableStudyContact($('#editable-study-contact').get()[0]);
        new EditableStudyDescription($('#editable-study-description').get()[0]);
        // put the click handler at the document level, then filter to any link inside a .disclose
        $(document).on('click', '.disclose .discloseLink', function (e) {
            $(e.target).closest('.disclose').toggleClass('discloseHide');
            return false;
        });
        $('#helpExperimentDescription').tooltip({
            content: function () {
                return $(this).prop('title');
            },
            position: { my: "left-10 center", at: "right center" },
            show: null,
            close: function (event, ui) {
                ui.tooltip.hover(function () {
                    $(this).stop(true).fadeTo(400, 1);
                }, function () {
                    $(this).fadeOut("400", function () {
                        $(this).remove();
                    });
                });
            }
        });
        this.fileUploadProgressBar = new Utl.ProgressBar('fileUploadProgressBar');
        Utl.FileDropZone.create({
            elementId: "templateDropZone",
            fileInitFn: this.fileDropped.bind(this),
            processRawFn: this.fileRead.bind(this),
            url: '/study/' + EDDData.currentStudyID + '/describe/',
            processResponseFn: this.fileReturnedFromServer.bind(this),
            processErrorFn: this.fileErrorReturnedFromServer.bind(this),
            processWarningFn: this.fileWarningReturnedFromServer.bind(this),
            progressBar: this.fileUploadProgressBar
        });
        Utl.Tabs.prepareTabs();
        $(window).on('load', preparePermissions);
    }
    StudyOverview.prepareIt = prepareIt;
})(StudyOverview || (StudyOverview = {}));
// use JQuery ready event shortcut to call prepareIt when page is ready
$(function () { return StudyOverview.prepareIt(); });
