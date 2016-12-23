/// <reference path="typescript-declarations.d.ts" />
/// <reference path="Utl.ts" />
/// <reference path="Dragboxes.ts" />
/// <reference path="DataGrid.ts" />

declare var EDDData:EDDData;

module StudyOverview {
    'use strict';

    var attachmentIDs:any;
    var attachmentsByID:any;
    var prevDescriptionEditElement:any;

    var activeDraggedFile: any;

    var fileUploadProgressBar: Utl.ProgressBar;

    // We can have a valid metabolic map but no valid biomass calculation.
    // If they try to show carbon balance in that case, we'll bring up the UI to 
    // calculate biomass for the specified metabolic map.
    export var metabolicMapID:any;
    export var metabolicMapName:any;
    export var biomassCalculation:number;


    // Called when the page loads.
    export function prepareIt() {

        this.attachmentIDs = null;
        this.attachmentsByID = null;
        this.prevDescriptionEditElement = null;

        this.metabolicMapID = -1;
        this.metabolicMapName = null;
        this.biomassCalculation = -1;

        new EditableStudyName($('#editable-study-name').get()[0]);
        new EDDEditable.EditableAutocomplete($('#editable-study-contact').get()[0]);
        new EditableStudyDescription($('#editable-study-description').get()[0]);


        // put the click handler at the document level, then filter to any link inside a .disclose
        $(document).on('click', '.disclose .discloseLink', (e) => {
            $(e.target).closest('.disclose').toggleClass('discloseHide');
            return false;
        });

        this.fileUploadProgressBar = new Utl.ProgressBar('fileUploadProgressBar');

        Utl.FileDropZone.create({
            elementId: "templateDropZone",
            fileInitFn: this.fileDropped.bind(this),
            processRawFn: this.fileRead.bind(this),
            url: '/study/' + EDDData.currentStudyID + '/parsetemplate/',
            processResponseFn: this.fileReturnedFromServer.bind(this),
            progressBar: this.fileUploadProgressBar
        });

        Utl.Tabs.prepareTabs();

        $(window).on('load', preparePermissions);
    }


    // This is called upon receiving a response from a file upload operation, and unlike
    // fileRead(), is passed a processed result from the server as a second argument,
    // rather than the raw contents of the file.
    export function fileReturnedFromServer(fileContainer, result): void {
        //is this needed?
        $('#fileDropInfoSending').addClass('off');

        if (fileContainer.fileType == "xlsx") {
            this.clearDropZone();
        }
        var currentPath = window.location.pathname;
        var linesPathName = currentPath.slice(0, -8) + 'lines';
        //display success message
        $('#general').append('<div id="successLines" class="success" style="margin-bottom: 17px;">Successfully added ' + result['lines_created'] + ' lines! ' +
            'Redirecting you to <a style="vertical-align:top" href="/study/{{ study.slug }}/lines">Lines page</a></div>');
        //redirect to lines page
        setTimeout(function () {
            window.location.pathname = linesPathName;
        }, 3000);
    }


    // Here, we take a look at the type of the dropped file and decide whether to
    // send it to the server, or process it locally.
    // We inform the FileDropZone of our decision by setting flags in the fileContiner object,
    // which will be inspected when this function returns.
    export function fileDropped(fileContainer): void {
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
            this.showFileDropped(fileContainer);
        }
    }


    // Reset and show the info box that appears when a file is dropped,
    // and reveal the text entry area.
    export function showFileDropped(fileContainer): void {
        var processingMessage:string = '';
        // Set the icon image properly
        $('#fileDropInfoIcon').removeClass('xml');
        $('#fileDropInfoIcon').removeClass('text');
        $('#fileDropInfoIcon').removeClass('excel');
        if (fileContainer.fileType === 'xml') {
            $('#fileDropInfoIcon').addClass('xml');
        } else if (fileContainer.fileType === 'xlsx') {
            $('#fileDropInfoIcon').addClass('excel');
        } else if (fileContainer.fileType === 'plaintext') {
            $('#fileDropInfoIcon').addClass('text');
        }
        $('#templateDropZone').addClass('off');
        $('#fileDropInfoArea').removeClass('off');
        $('#fileDropInfoSending').removeClass('off');
        $('#fileDropInfoName').text(fileContainer.file.name)

        if (!fileContainer.skipUpload) {
            processingMessage = 'Sending ' + Utl.JS.sizeToString(fileContainer.file.size) + ' To Server...';
            $('#fileDropInfoLog').empty();
        } else if (!fileContainer.skipProcessRaw) {
            processingMessage = 'Processing ' + Utl.JS.sizeToString(fileContainer.file.size) + '...';
            $('#fileDropInfoLog').empty();
        }
        $('#fileUploadMessage').text(processingMessage);
        this.activeDraggedFile = fileContainer;
    }


    // This function is passed the usual fileContainer object, but also a reference to the
    // full content of the dropped file.
    export function fileRead(fileContainer, result): void {
        this.haveInputData = true;
    }


    function preparePermissions() {
        var user: EDDAuto.User, group: EDDAuto.Group;
        user = new EDDAuto.User({
            container:$('#permission_user_box')
        });
        group = new EDDAuto.Group({
            container:$('#permission_group_box')
        });

        $('form#permissions')
            .on('change', ':radio', (ev:JQueryInputEventObject):void => {
                var radio: JQuery = $(ev.target);
                $('#permissions').find(':radio').each((i: number, r: Element): void => {
                    $(r).closest('span').find('.autocomp').prop('disabled', !$(r).prop('checked'));
                });
                if (radio.prop('checked')) {
                    radio.closest('span').find('.autocomp:visible').focus();
                }
            })
            .on('submit', (ev:JQueryEventObject): boolean => {
                var perm: any = {}, klass: string, auto: JQuery;
                auto = $('form#permissions').find('[name=class]:checked');
                klass = auto.val();
                perm.type = $('form#permissions').find('[name=type]').val();
                perm[klass.toLowerCase()] = { 'id': auto.closest('span').find('input:hidden').val() };
                $.ajax({
                    'url': '/study/' + EDDData.currentStudyID + '/permissions/',
                    'type': 'POST',
                    'data': {
                        'data': JSON.stringify([perm]),
                        'csrfmiddlewaretoken': $('form#permissions').find('[name=csrfmiddlewaretoken]').val()
                    },
                    'success': (): void => {
                        console.log(['Set permission: ', JSON.stringify(perm)].join(''));
                        $('<div>').text('Set Permission').addClass('success')
                            .appendTo($('form#permissions')).delay(5000).fadeOut(2000);
                    },
                    'error': (xhr, status, err): void => {
                        console.log(['Setting permission failed: ', status, ';', err].join(''));
                        $('<div>').text('Server Error: ' + err).addClass('bad')
                            .appendTo($('form#permissions')).delay(5000).fadeOut(2000);
                    }
                });
                return false;
            })
            .find(':radio').trigger('change').end()
            .removeClass('off');
    }


    export function onChangedMetabolicMap() {
        if (this.metabolicMapName) {
            // Update the UI to show the new filename for the metabolic map.
            $("#metabolicMapName").html(this.metabolicMapName);
        } else {
            $("#metabolicMapName").html('(none)');
        }
    }


    // They want to select a different metabolic map.
    export function onClickedMetabolicMapName():void {
        var ui:StudyMetabolicMapChooser,
            callback:MetabolicMapChooserResult = (error:string,
                metabolicMapID?:number,
                metabolicMapName?:string,
                finalBiomass?:number):void => {
            if (!error) {
                this.metabolicMapID = metabolicMapID;
                this.metabolicMapName = metabolicMapName;
                this.biomassCalculation = finalBiomass;
                this.onChangedMetabolicMap();
            } else {
                console.log("onClickedMetabolicMapName error: " + error);
            }
        };
        ui = new StudyMetabolicMapChooser(false, callback);
    }


    // Base class for the non-autocomplete inline editing fields for the Study
    export class EditableStudyElment extends EDDEditable.EditableElement {

        editAllowed(): boolean { return EDDData.currentStudyWritable; }
        canCommit(value): boolean { return EDDData.currentStudyWritable; }
    }


    export class EditableStudyName extends EditableStudyElment {
        getValue():string {
            return EDDData.Studies[EDDData.currentStudyID].name;
        }

        setValue(value) {
            EDDData.Studies[EDDData.currentStudyID].name = value;
        }
    }


    export class EditableStudyDescription extends EditableStudyElment {

        constructor(inputElement: HTMLElement) {        
            super(inputElement);
            this.minimumRows = 4;
        }

        getValue():string {
            return EDDData.Studies[EDDData.currentStudyID].description;
        }

        setValue(value) {
            EDDData.Studies[EDDData.currentStudyID].description = value;
        }

        blankLabel(): string {
            return '(click to add description)';
        }
    }


    export class EditableStudyContact extends EDDEditable.EditableAutocomplete {

        // Have to reproduce these here rather than using EditableStudyElment because the inheritance is different
        editAllowed(): boolean { return EDDData.currentStudyWritable; }
        canCommit(value): boolean { return EDDData.currentStudyWritable; }

        getValue():string {
            return EDDData.Studies[EDDData.currentStudyID].contact;
        }

        setValue(value) {
            EDDData.Studies[EDDData.currentStudyID].contact = value;
        }
    }
};


// use JQuery ready event shortcut to call prepareIt when page is ready
$(() => StudyOverview.prepareIt());