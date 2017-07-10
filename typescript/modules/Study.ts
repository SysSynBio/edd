import { EDDEditable } from "../modules/EDDEditableElement"
// Code that all Study sub-pages have in common

export module StudyBase {
    'use strict';

    
    // Base class for the non-autocomplete inline editing fields for the Study
    export class EditableStudyElement extends EDDEditable.EditableElement {
        constructor(inputElement: HTMLElement, style?: string) {
            super(inputElement, style);
        }

        editAllowed(): boolean { return EDDData.currentStudyWritable; }
        canCommit(value): boolean { return EDDData.currentStudyWritable; }
    }


    export class EditableStudyName extends EditableStudyElement {
        constructor(inputElement: HTMLElement) {
            super(inputElement);
            this.formURL('/study/' + EDDData.currentStudyID + '/rename/');
        }

        canCommit(value): boolean {
            return EDDData.currentStudyWritable && (this.getEditedValue() != '');
        }

        getValue():string {
            return EDDData.Studies[EDDData.currentStudyID].name;
        }

        setValue(value) {
            EDDData.Studies[EDDData.currentStudyID].name = value;
        }

        blankLabel(): string {
            return '(Enter a name for your Study)';
        }
    }

    // Called when the page loads.
    export function prepareIt() {
        new EditableStudyName($('#editable-study-name').get()[0]);
        // put the click handler at the document level, then filter to any link inside a .disclose
        $(document).on('click', '.disclose .discloseLink', (e) => {
            $(e.target).closest('.disclose').toggleClass('discloseHide');
            return false;
        });
    }
};


// use JQuery ready event shortcut to call prepareIt when page is ready
$(() => StudyBase.prepareIt());
