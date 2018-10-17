"use strict";

import * as $ from "jquery";
import * as React from "react";
import * as ReactDOM from "react-dom";
import DropZone from "react-dropzone";
import StepZilla from "react-stepzilla";
import * as Utl from "../modules/Utl";
import {Message} from "../modules/Notification";
import {notificationSocket} from "./Common";

declare function require(name: string): any;  // avoiding warnings for require calls below
require("react-stepzilla.css");

class HelpButton extends React.Component {
    render() {
        return <span className="helpButton"></span>
    }
}

export interface Selectable {
    name: string;
    pk: number;
}

export interface Category extends Selectable {
    protocols: Protocol[];
    file_formats: Selectable[];

}

export interface Protocol extends Selectable {

}

export interface SelectProps<T extends Selectable> {
    options: T[];
    selected: T;
    selectionCallback: any;
}

class MultiButtonSelect<T extends Selectable> extends React.Component<SelectProps<T>, any> {
    constructor(props) {
        super(props);
    }

    render() {
        let options: T[] = this.props.options || [];
        const selectionCallback = this.props.selectionCallback;

        return <div>
                {
                    options.map((option:T) => {
                        let selected: T = this.props.selected;
                        let classes = "btn btn-default";
                        if(selected && (selected.pk === option.pk)) {
                            classes += " active";
                        }

                        return <button className={classes}
                                onClick={() => selectionCallback(option)}>{option.name}
                        </button>
                    })
                }
        </div>
    }
}

export interface Step2State extends ImportContextProps {
    acceptMimeTypes: string,
    uploadWait: boolean,
    uploadProcessingWait: boolean,
    uploadedFileName: string,
    postUploadStep: number,
    uploadErrors: ErrorSummary[],
    uploadWarnings: ErrorSummary[],
}

export interface Step2Props extends Step2State
{
    onDropCallback: any,
    errorCallback: any,
    clearFeedbackFn: any,
    submitCallback: any,
    jumpToStep: any, // injected by StepZilla
}

// TODO: merge with similar TS class in Study-Lines-Add-Combos.ts
export interface ErrorSummary {
    category: string,
    summary: string,
    subcategory?: string,
    detail?: string[],
    resolution?: string,
    doc_url?: string,
}

export interface UploadProps {
    uploadWait: boolean,
    uploadProcessingWait: boolean,
    errors: ErrorSummary[],
    warnings: ErrorSummary[],
    uploadedFileName: string,
    postUploadStep: number,
    clearFeedbackFn: any,
}

/*
 * Takes the flat list of errors returned by the back end and breaks it into sublists that fall
  * within the same category.
 */
function categorizeErrs(errors: ErrorSummary[]): ErrorSummary[][] {
    let prevCategory = "";
    let errsByCategory: ErrorSummary[][] = [];
    let currentCat: ErrorSummary[] = [];

    // break down errors into sub-lists of those that fall under the same category
    errors.map((error:ErrorSummary) => {
        let newCategory: boolean = (error.category !== prevCategory);

        if(newCategory && currentCat.length) {
           errsByCategory.push(currentCat);
           currentCat = [];
        }
        currentCat.push(error);
        prevCategory = error.category;
    });

    if(currentCat.length) {
        errsByCategory.push(currentCat);
    }

    return errsByCategory;
}

/*
*  Displays file upload feedback for either success or error.
*/
class UploadFeedback extends React.Component<UploadProps, any> {
    render() {
        if(this.props.uploadWait || this.props.uploadProcessingWait) {
            return <div className="alert alert-info">
                <h4>Processing file</h4>
                Please hang tight while your file is processed...
                <span className="wait step2-wait"/>
            </div>
        }
        if((!this.props.errors || !this.props.warnings) ||
           !(this.props.errors.length || this.props.warnings.length)) {
            if(this.props.postUploadStep) {
                return <UploadSuccessAlert postUploadStep={this.props.postUploadStep}
                                    uploadedFileName={this.props.uploadedFileName}/>
            }
            return <div/>
        }

        let total:number = this.props.errors.length + this.props.warnings.length;

        // show errors, if any
        let errsByCategory: ErrorSummary[][] = categorizeErrs(this.props.errors);
        let errorAlerts = errsByCategory.map((categoryErrors: ErrorSummary[]) => {
                return <ErrCategoryAlert errs={categoryErrors} alertClass="alert alert-danger"/>
        });

        // show warnings, if any
        let warningsByCategory: ErrorSummary[][] = categorizeErrs(this.props.warnings);
        let warningAlerts = warningsByCategory.map(
            (categoryWarnings: ErrorSummary[]) => {
                            return <ErrCategoryAlert errs={categoryWarnings}
                                                     alertClass="alert alert-warning"/>
        });

        return <div>
            {total > 4 &&
            <button className="btn btn-info"
                    onClick={this.props.clearFeedbackFn(false)}>Dismiss</button>}
            {errorAlerts}{warningAlerts}</div>
    }
}

export interface SubmitStatusProps {
    errors: ErrorSummary[],
    warnings: ErrorSummary[],
    clearFeedbackFn?: any,
}

// Displays user feedback re: import submission
class SubmitFeedback extends React.Component<SubmitStatusProps, any> {
    render() {
        if((!this.props.errors || !this.props.warnings) ||
           !(this.props.errors.length || this.props.warnings.length)) {
                return <div>
                    <h4>Import Submitted</h4>
                    Your import has been submitted for processing.  You'll get a notification at
                    top right in the menu bar when it's complete.
                </div>
        }

        let total:number = this.props.errors.length + this.props.warnings.length;

        // show errors, if any
        let errsByCategory: ErrorSummary[][] = categorizeErrs(this.props.errors);
        let errorAlerts = errsByCategory.map((categoryErrors: ErrorSummary[]) => {
                return <ErrCategoryAlert errs={categoryErrors} alertClass="alert alert-danger"/>
        });

        // show warnings, if any
        let warningsByCategory: ErrorSummary[][] = categorizeErrs(this.props.warnings);
        let warningAlerts = warningsByCategory.map(
            (categoryWarnings: ErrorSummary[]) => {
                            return <ErrCategoryAlert errs={categoryWarnings}
                                                     alertClass="alert alert-warning"/>
        });

        return <div>
            {total > 4 &&
            <button className="btn btn-info"
                    onClick={this.props.clearFeedbackFn(false)}>Dismiss</button>}
            {errorAlerts}{warningAlerts}</div>
    }
}

export interface ErrSequenceProps {
    errs: ErrorSummary[];
    alertClass: string;
}

// essentially a workaround for the fact that bootstrap's dismissable alerts don't play well with
// React.
export interface ErrSequenceState {
    hide: boolean;
}

export interface ImportContextProps {
    category: Category,
    protocol: Protocol,
    format: Selectable,
    uploadedFileName: string,
    submitSuccess: boolean,
    submitWait: boolean,
}

// Displays user feedback re: import context selected in step 1 and file uploaded in step 2
class ContextFeedback extends React.Component<ImportContextProps, any> {
    render() {
        let category = this.props.category;
        let protocol = this.props.protocol;
        let fmt = this.props.format;
        let fileName = this.props.uploadedFileName;
        let cat = category && <div className="contextBreadcrumbs">
                <span className="contextSectionHeader">Category:</span> {category.name}
            </div>;
        let prot = protocol && <div className="contextBreadcrumbs">
            <span className="contextSectionHeader">Protocol:</span> {protocol.name}
            </div>;
        let fileFormat = fmt && <div className="contextBreadcrumbs">
                <span className="contextSectionHeader">Format:</span>{fmt.name}</div>;
        let file =  (fileName) && <div className="contextBreadcrumbs">
            <span className="contextSectionHeader">File:</span> {fileName}
            </div>;

        return <div>{cat}{prot}{fileFormat}{file}</div>
    }
}

export interface  UploadSuccessProps {
    postUploadStep: number,
    uploadedFileName: string,
}

class UploadSuccessAlert extends React.Component<UploadSuccessProps, any> {
    render() {
        return this.props.postUploadStep && <div className="alert alert-success">
            <h4>File accepted</h4>
            Your file has been accepted for import. Press "Next" to complete your import.
        </div>
    }

}

/*
* Displays user feedback for errors returned by the back end.  Takes as input a list of errors
* that all fall under the same category.  They are displayed in a single alert with styling
* to help differentiate them from each other.
*/
class ErrCategoryAlert extends React.Component<ErrSequenceProps, any> {
    constructor(props) {
        super(props);
        this.state = {
            hide: false,
        };
    }

    render() {
        let contentDivs = this.buildContentDivs();
        let content;
        if(this.props.errs.length > 1) {
            content = <ul> {
                                contentDivs.map((val) => {
                                    return <li className="errorMessageContent">{val}</li>
                                })
                            }
                     </ul>
        } else {
            content = contentDivs
        }

        return ( (!this.state.hide) && this.props.errs.length &&
            <div className={this.props.alertClass}>
                <a href="#" className="close" onClick={this.hide}>&times;</a>
                <h4 className="alertSubject">{this.props.errs[0].category}</h4>
                {content}
            </div>
        )
    }

    // builds a list of <divs> where each contains the content of a single error.
    // styling depends on the number of errors that need to be displayed in sequence, and also
    // on whether any have a subcategory
    buildContentDivs() {
        return this.props.errs.map((err: ErrorSummary) => {
            let cls = this.props.errs.length > 1 ? ' emphasizeErrorSubject' : '';
            let summaryTxt = err.subcategory ? (err.summary + ' -- ' + err.subcategory) : err.summary;
            let summarySpan = <span className={cls}>{summaryTxt}</span>;
            if(!err.detail) {
                return <div className="errorMessageContent">{summarySpan}</div>;
            }
            let detail = err.detail ? ": " + err.detail : "";
            return <div className="errorMessageContent">
                {summarySpan}{detail}
                </div>;
        });
    }

    hide(event: React.MouseEvent<HTMLAnchorElement>) {
        this.setState({'hide': true});
    }
}

// implements step 2 of the import -- file upload
class Step2 extends React.Component<Step2Props, any> {
    render() {
        let tenMB: number = 1048576;
        let disableDrop: boolean = (this.props.uploadWait || this.props.uploadProcessingWait ||
                                    this.props.submitSuccess || this.props.submitWait);
        let directions = (!disableDrop) && <div>Click or click-and-drag to upload a file</div>
        return <div className="stepDiv">
            <ContextFeedback category={this.props.category} protocol={this.props.protocol}
                             format={this.props.format}
                             uploadedFileName={this.props.uploadedFileName}
                             submitSuccess={this.props.submitSuccess}
                             submitWait={this.props.submitWait} />
            <UploadFeedback
                uploadWait={this.props.uploadWait}
                uploadProcessingWait={this.props.uploadProcessingWait}
                errors={this.props.uploadErrors}
                warnings={this.props.uploadWarnings}
                clearFeedbackFn={this.props.clearFeedbackFn}
                uploadedFileName={this.props.uploadedFileName}
                postUploadStep={this.props.postUploadStep}/>
            {directions}
            <DropZone accept={this.props.acceptMimeTypes} multiple={false} maxSize={tenMB}
                      onDrop={this.props.onDropCallback} disabled={disableDrop}/>
            </div>
    }

    isValidated() {
        if(!this.props.postUploadStep) {
            this.props.errorCallback({
                'uploadErrors': [{
                    'category': 'Data file required',
                    'summary': 'Upload a file to continue',
                }],
                'uploadWarnings': [],
            });
        }
        else {
            // jump to the next required step (usually not step 3!!)
            this.props.jumpToStep(this.props.postUploadStep);
        }

        // always return false to prevent skip-forward navigation above from getting undone
        return false;
    }
}

export interface Step5State extends ImportContextProps {
    submitWait: boolean,
    submitSuccess: boolean,
    submitErrors: any,
}

export interface Step5Props extends Step5State {
    submitCallback: any,
}

class Step5 extends React.Component<Step5Props, any> {
    render() {
        let wait = this.props.submitWait && <div>Submitting your import...please wait.</div>;
        let outcome = ((this.props.submitSuccess || this.props.submitErrors) &&
            <SubmitFeedback errors={this.props.submitErrors} warnings={[]} />);
        return <div className="stepDiv">{wait}{outcome}</div>
    }
}

class StepPlaceHolder extends React.Component<ImportContextProps, any> {
    render() {
        return <div>
                <ContextFeedback category={this.props.category}
                             protocol={this.props.protocol}
                             format={this.props.format}
                             uploadedFileName={this.props.uploadedFileName}
                             submitSuccess={this.props.submitSuccess}
                             submitWait={this.props.submitWait}
                />
                Not implemented yet
            </div>
    }
}

export interface Step1State {
    categories: any[];
    category: Category;
    protocol: Protocol;
    format: Selectable;
}

export interface Step1Props extends Step1State {
    categorySelectedCallback: any,
    protocolSelectedCallback: any,
    formatSelectedCallback: any,
}

// implements step 1 of the import, where user selects data catagory, protocol, & file format
class Step1 extends React.Component<Step1Props, any> {
    constructor(props) {
        super(props);
    }

    isValidated() {
        return this.props.category && this.props.protocol && this.props.format;
    }

    render() {
        const categories = this.props.categories;
        let category = this.props.category;
        let protocol = this.props.protocol;
        let format = this.props.format;

        return <div className="pageSection stepBorder">
            <div className="import2SectionHead">
                <h2>What category of data do you have?</h2>
            </div>
            <div className="import2SectionContent">
                <div>
                    <MultiButtonSelect options={categories}
                                       selectionCallback={this.props.categorySelectedCallback}
                                       selected={this.props.category}/>
                </div>
                {
                    category !== null &&
                    <div className="pageSection stepBorder">
                        <h2>What lab protocol did you use?</h2>
                        <MultiButtonSelect options={category.protocols}
                           selectionCallback={this.props.protocolSelectedCallback}
                           selected={this.props.protocol}/>
                    </div>
                }
                {
                    protocol !== null &&
                    <div className="pageSection stepBorder">
                        <h2>What file format is your data in?</h2>
                            <MultiButtonSelect options={category.file_formats}
                               selectionCallback={this.props.formatSelectedCallback}
                               selected={this.props.format}/>
                    </div>
                }
                {
                    format !== null && format.name === 'Table of Data' &&
                        <div>
                            <h4>Unsupported file format</h4>
                            Custom file formatting is not yet supported.  To import nonstandard
                            files, use EDD's
                            <a href="../import/">
                                <button type="button" className="actionButton primary larger">
                                    <span className="glyphicon glyphicon-cloud-upload"></span>Legacy Import
                                </button>
                            </a>
                        </div>

                }
            </div>
        </div>
    }
}

export interface ImportState extends Step1State, Step2State, Step5State {
    nextButtonText: string,
    importPk: number,
    importUUID: string,
}

// parent component for the import
class Import extends React.Component<any, ImportState> {
    constructor(props) {
        super(props);
        /* TODO: mime types should eventually depend on user-selected file format */
        let mimeTypes = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet," +
                        "text/csv" ;
        this.state = {
            importPk: null,
            importUUID: null,
            nextButtonText: 'Next',

            /* Step 1 state */
            categories: [],
            category: null,
            protocol: null,
            format: null,

            /* Step 2 state */
            acceptMimeTypes: mimeTypes,
            uploadedFileName: null,
            uploadWait: false,
            uploadProcessingWait: false,
            postUploadStep: 0,
            uploadErrors: [],
            uploadWarnings: [],

            /* Step 5 state */
            submitWait: false,
            submitSuccess: false,
            submitErrors: [],
        };
    }

    render() {
        let steps =
        [
          {
              name: '1. Identify',
              component: <Step1 categories={this.state.categories}
                            category={this.state.category}
                            protocol={this.state.protocol}
                            format={this.state.format}
                            categorySelectedCallback={this.categorySelected.bind(this)}
                            protocolSelectedCallback={this.protocolSelected.bind(this)}
                            formatSelectedCallback={this.formatSelected.bind(this)}/>},
           {
               name: '2. Upload',
               component: <Step2 acceptMimeTypes={this.state.acceptMimeTypes}
                                 category={this.state.category}
                                 protocol={this.state.protocol}
                                 format={this.state.format}
                                 uploadWait={this.state.uploadWait}
                                 uploadProcessingWait={this.state.uploadProcessingWait}
                                 uploadedFileName={this.state.uploadedFileName}
                                 postUploadStep={this.state.postUploadStep}
                                 uploadErrors={this.state.uploadErrors}
                                 uploadWarnings={this.state.uploadWarnings}
                                 errorCallback={this.setState.bind(this)}
                                 onDropCallback={this.onFileDrop.bind(this)}
                                 clearFeedbackFn={this.clearUploadErrors.bind(this)}
                                 submitCallback={this.submitImport.bind(this)}
                                 submitSuccess={this.state.submitSuccess}
                                 submitWait={this.state.submitWait}
                                 jumpToStep={null}/>
           },
           {
               name: '3. Interpret',
               component: <StepPlaceHolder category={this.state.category}
                                           protocol={this.state.protocol}
                                           format={this.state.format}
                                           uploadedFileName={this.state.uploadedFileName}
                                           submitSuccess={this.state.submitSuccess}
                                           submitWait={this.state.submitWait}/>
           },
           {
               name: '4. Review',
               component: <StepPlaceHolder category={this.state.category}
                                           protocol={this.state.protocol}
                                           format={this.state.format}
                                           uploadedFileName={this.state.uploadedFileName}
                                           submitSuccess={this.state.submitSuccess}
                                           submitWait={this.state.submitWait}/>
           },
           {
               name: '5. Import',
               component: <Step5 category={this.state.category}
                                 protocol={this.state.protocol}
                                 format={this.state.format}
                                 uploadedFileName={this.state.uploadedFileName}
                                 submitCallback={this.submitImport.bind(this)}
                                 submitWait={this.state.submitWait}
                                 submitSuccess={this.state.submitSuccess}
                                 submitErrors={this.state.submitErrors}/>
           },
        ];
        return <StepZilla steps={steps}
                          stepsNavigation={false}
                          // Note: only applied @ step transition...too late for initial prototype
                          nextButtonText={this.state.nextButtonText}
                          onStepChange={this.onStepChange.bind(this)}/>
    }

    categoriesLookupSuccess(result_json: any, textStatus: string, jqXHR: JQueryXHR): void {
        // filter out any categories that don't have sufficient configuration to make them useful
        let configuredCategories = result_json.results.filter(category => {
            return (category.protocols.length > 0) && (category.file_formats.length > 0);
        });
        this.setState({'categories': configuredCategories});
    }

    categoriesLookupErr(jqXHR: JQueryXHR, textStatus: string, errorThrown: string): void {
        this.setState({'categories': []});
    }

    categorySelected(category) {
        if (category === this.state.category) {
            return;
        }
        let protocol = null;
        if (category && category.protocols.length == 1) {
            protocol = category.protocols[0];
        }

        let format = null;
        if (category.file_formats && category.file_formats.length == 1) {
            format = category.file_formats[0];
        }

        this.setState({
            'category': category,
            'protocol': protocol,
            'format': format,
        });
        this.clearUploadErrors(true);
    }

    protocolSelected(protocol) {
        if (protocol === this.state.protocol) {
            return;
        }

        this.setState({
            'protocol': protocol,
            'format': null,
        });
        this.clearUploadErrors(true);
    }

    formatSelected(format) {
        if(format === this.state.format) {
            return;
        }
        this.setState({
            'format': format,
        });
        this.clearUploadErrors(true);
    }

    uploadSuccess(result_json: any, textStatus: string, jqXHR: JQueryXHR): void {
        this.setState({
            'importPk': JSON.parse(result_json).pk,
            'uploadWait': false,
            'uploadProcessingWait': true,

        });
    }

    uploadErr(jqXHR, textStatus: string, errorThrown: string): void {

        let contentType = jqXHR.getResponseHeader('Content-Type');
        let vals = {
            'uploadWait': false,
            'uploadWarnings': [],
            'postUploadStep': 0,
        };

        if (jqXHR.status === 504) {
            // TODO: need a workaround for large file uploads that take longer to process, e.g.
            // transcriptomics where GeneIdentifiers are resolved during this step.
            vals['uploadErrors'] = [{
                category: "Upload Error",
                summary: "Request timed out",
                detail: ["Please retry your upload or contact system administrators"],
            }];
            this.setState(vals);
        } else if (jqXHR.status === 413) {
            vals['uploadErrors'] = [{
                    category: "Upload Error",
                    summary: "File too large",
                    detail: ["Please break your file into parts or contact system" +
                    " administrators."],
                } as ErrorSummary];
            this.setState(vals);
        } else if (contentType === 'application/json') {
            //TODO: add special-case support for working around ICE access errors (Transcriptomics,
            // Proteomics - custom proteins)
            let json = JSON.parse(jqXHR.responseText);
            vals['uploadErrors']=json.errors;
            vals['uploadWarnings'] = json.warnings;
            this.setState(vals);
        } else {
            // if there is a back end or proxy error (likely html response), show this
            vals['uploadErrors'] = [{
                    category: "Unexpected error",
                    summary: "There was an unexpected error during your upload. Please try" +
                        " again.  If your upload still fails, please contact" +
                        " system administrators to confirm that they're aware of this problem.",
                 }];
            this.setState(vals);
        }
    }

    clearUploadErrors(removeFile:boolean) {
        let vals = {
            'uploadErrors': [],
            'uploadWarnings': [],
        };
        if(removeFile) {
            vals['uploadedFileName'] = null;
            vals['postUploadStep'] = 0;
        }
        this.setState(vals);
    }

    onFileDrop(acceptedFiles, rejectedFiles) {
        this.clearUploadErrors(true);

        if(acceptedFiles.length) {
            let data: FormData = new FormData();
            let file: File = acceptedFiles[0];  // DZ is configured to only accept one
            data.append('category', ""+ this.state.category.pk);
            data.append('protocol', ""+ this.state.protocol.pk);
            data.append('file_format', ""+ this.state.format.pk);
            data.append('file', file);
            data.append('uuid', this.state.importUUID);

            // if we're re-uploading a file after the import is created, but before
            // submission, avoid filling up the database with junk
            let method = 'POST';
            let url = '/rest/studies/' + EDDData.currentStudyID + '/imports/';
            if(this.state.importPk) {
                method = 'PATCH';
                url += this.state.importPk + '/'
            }

            this.setState({
                'uploadWait': true,
                'uploadedFileName': file.name,
                'submitWait': false,
                'submitSuccess': false,
                'submitErrors': [],
            });
            $.ajax(url,
                {
                    method: method,
                    cache: false,
                    contentType:  false,  // Note: 'multipart/form-data' doesn't work w/ file
                    data: data,
                    dataType: 'json',
                    processData: false,
                    success: this.uploadSuccess.bind(this),
                    error: this.uploadErr.bind(this),
                }
            );
        }
        else {
            this.setState({
                'uploadErrors': [{
                    'category': 'Unsupported file format',
                    'summary': ('File "' + rejectedFiles[0].filename + '" is the wrong format.' +
                    ' Only .XLSX and .CSV files are supported'),
                } as ErrorSummary],
            });
        }
    }

    onStepChange(stepIndex: number) {
        if(stepIndex === 4 &&
            (this.state.submitErrors && this.state.submitErrors.length === 0) &&
            (!this.state.submitWait) &&
            (!this.state.submitSuccess)) {
            this.submitImport();
        }
    }

    submitImport() {
        //TODO: disable changes in previous steps, short of clearing all the state...otherwise
        // sebsequent use of the form to upload new files risks overwriting records of previous
        // imports performed without reloading the page

        //TODO: provide required values entered in earlier steps, if any
        this.setState({
            'submitWait': true,
            'submitSuccess': false,
        });
        $.ajax('/rest/studies/' + EDDData.currentStudyID + '/imports/' + this.state.importPk + '/',
                {
                    method: 'PATCH',
                    cache: false,
                    contentType:  'application/json',
                    data: JSON.stringify({
                        'status': 'Submitted',
                    }),
                    dataType: 'json',
                    processData: false,
                    success: this.submitSuccess.bind(this),
                    error: this.submitErr.bind(this),
                }
            );
    }

    submitSuccess(result_json: any, textStatus: string, jqXHR: JQueryXHR) {
        this.setState({
            'submitSuccess': true,
            'submitErrors': [],
            'submitWait': false,
        });
    }

    submitErr(jqXHR, textStatus: string, errorThrown: string): void {
        let contentType = jqXHR.getResponseHeader('Content-Type');

        let vals = {
            submitWait: false,
        };

        if (contentType === 'application/json') {
            let json = JSON.parse(jqXHR.responseText);
            vals['submitErrors']=json.errors;
            this.setState(vals);
        } else {
            // if there is a back end or proxy error (likely html response), show this
            vals['submitErrors'] = [{
                    category: "Unexpected error",
                    summary: "There was an unexpected error submitting your import. Please try" +
                        " again.  If your upload still fails, please contact" +
                        " system administrators to confirm that they're aware of this problem.",
                 }];
            this.setState(vals);
        }
    }

    importMessageReceived(message: Message) {
        if(!message.hasOwnProperty("payload")) {
            console.log("Skipping message that has no payload");
            return;
        }
        let json = message.payload;
        console.log('Processing import ' + json.uuid + ' message ' + message.uuid);

        // skip notifications for other simultaneous imports by this user
        if (json.uuid != this.state.importUUID) {
            console.log('Ignoring status update for import ' + json.uuid +
                ', Looking for ' + this.state.importUUID);
            return;
        }

        switch (message.payload.status) {
            case 'Created':
                // handled by the upload request
                break;
            case 'Resolved':
                let nextStep = 2;
                let nextButtonText = 'Next';
                this.setState({
                    'postUploadStep': 2,
                    'uploadWait': false,
                    'uploadProcessingWait': false,
                    'uploadWarnings': json.warnings || [],
                    'nextButtonText': nextButtonText,  // StepZilla bug?
                });
                break;
            case  'Ready':
                this.setState({
                    'postUploadStep': 4,
                    'uploadWait': false,
                    'uploadProcessingWait': false,
                    'uploadWarnings': json.warnings || [],
                    'nextButtonText': 'Submit Import',  // StepZilla bug?
                });
                break;
            case 'Failed':
                this.setState({
                    'uploadWait': false,
                    'uploadProcessingWait': false,
                    'uploadErrors': json.errors || [],
                    'uploadWarnings': json.warnings || [],
                });
        }
    }

    componentDidMount() {

        // send CSRF header on each AJAX request from this page
        $.ajaxSetup({
            beforeSend: function (xhr) {
                var csrfToken = Utl.EDD.findCSRFToken();
                xhr.setRequestHeader('X-CSRFToken', csrfToken);
            },
        });

        // get categories and associated protocols, file formats
        $.ajax('/rest/import_categories/?ordering=display_order',
            {
                headers: {'Content-Type' : 'application/json'},
                method: 'GET',
                dataType: 'json',
                success: this.categoriesLookupSuccess.bind(this),
                error: this.categoriesLookupErr.bind(this),
            }
        );

        // get UUID assigned by the server...we'll need this to compare against incoming
        // notifications so we only display those for this import (e.g. for this tab)
        let uuid: string = $('#importUUID').val();
        console.log('Received UUID ' + uuid + ' on page load');
        this.setState({'importUUID': uuid});

        notificationSocket.addTagAction('import-status-update',
                                        this.importMessageReceived.bind(this));
    }
}

ReactDOM.render(<Import/>, document.getElementById("importWizard"));
