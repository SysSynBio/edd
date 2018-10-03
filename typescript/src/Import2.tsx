"use strict";

import * as $ from "jquery";
import * as React from "react";
import * as ReactDOM from "react-dom";
import DropZone from "react-dropzone";
import StepZilla from "react-stepzilla";
import * as Utl from "../modules/Utl";

declare function require(name: string): any;  // avoiding warnings for require calls below
require("react-stepzilla.css");

class HelpButton extends React.Component {
    render() {
        return <span className="helpButton"></span>
    }
}
// ReactDOM.render(<HelpButton/>, document.getElementById("helpButton"));

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

export interface Step2State {
    acceptMimeTypes: string[],
    uploadWait: boolean,
    postUploadStep: number,
    uploadErrors: ErrorSummary[],
    uploadWarnings: ErrorSummary[],
}

export interface Step2Props extends Step2State
{
    onDropCallback: any,
    errorCallback: any,
    clearErrsCallback: any,
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

export interface ParseErrProps {
    errors: ErrorSummary[],
    warnings: ErrorSummary[],
    clearErrsCallback: any,
}

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

class UploadFeedback extends React.Component<ParseErrProps, any> {
    render() {
        if((!this.props.errors || !this.props.warnings) ||
           !(this.props.errors.length || this.props.warnings.length)) {
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
                    onClick={this.props.clearErrsCallback(false)}>Dismiss</button>}
            {errorAlerts}{warningAlerts}</div>
    }
}

export interface ErrSequenceProps {
    errs: ErrorSummary[];
    alertClass: string;
}

class ErrCategoryAlert extends React.Component<ErrSequenceProps, any> {
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

        return ( this.props.errs.length &&
            <div className={this.props.alertClass}>
                <a href="#" className="close" data-dismiss="alert">&times;</a>
                <h4 className="alertSubject">{this.props.errs[0].category}</h4>
                {content}
            </div>
        )
    }

    buildContentDivs() {
        return this.props.errs.map((err: ErrorSummary) => {
            let cls = this.props.errs.length > 1 ? ' emphasizeErrorSubject' : '';
            let summaryTxt = err.subcategory ? (err.summary + ' -- ' + err.subcategory) : err.summary;
            let summarySpan = <span className={cls}>{summaryTxt}</span>;
            if(!err.detail) {
                return <div className="errorMessageContent">{summarySpan}</div>;
            }
            return <div className="errorMessageContent">
                {summarySpan}{": " + err.detail}
                </div>;
        });
    }
}

class Step2 extends React.Component<Step2Props, any> {
    render() {
        let tenMB: number = 1048576;
        return <div>
            <UploadFeedback errors={this.props.uploadErrors} warnings={this.props.uploadWarnings}
                clearErrsCallback={this.props.clearErrsCallback}/>
            <DropZone accept={this.props.acceptMimeTypes} multiple={false} maxSize={tenMB}
                      onDrop={this.props.onDropCallback} disabled={this.props.uploadWait}/>
            </div>
    }

    isValidated() {
        if(!this.props.postUploadStep) {
            console.error('No file uploaded');  // TODO: remove
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

class StepPlaceHolder extends React.Component<any, any> {
    render() {
        return <div>Not implemented yet</div>
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
                <h2>What category of data do you have?</h2><HelpButton/></div>
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

export interface ImportState extends Step1State, Step2State {
}

class Import extends React.Component<any, ImportState> {
    constructor(props) {
        super(props);
        this.state = {

            /* Step 1 state */
            categories: [],
            category: null,
            protocol: null,
            format: null,

            /* Step 2 state */
            acceptMimeTypes: [  /* TODO: should depend on format */
                                "text/csv",
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             ],
            uploadWait: false,
            postUploadStep: 0,
            uploadErrors: [],
            uploadWarnings: [],
        };
    }

    render() {
        let steps =
        [
          {
              name: 'Identify',
              component: <Step1 categories={this.state.categories}
                            category={this.state.category}
                            protocol={this.state.protocol}
                            format={this.state.format}
                            categorySelectedCallback={this.categorySelected.bind(this)}
                            protocolSelectedCallback={this.protocolSelected.bind(this)}
                            formatSelectedCallback={this.formatSelected.bind(this)}/>},
           {
               name: 'Upload',
               component: <Step2 acceptMimeTypes={this.state.acceptMimeTypes}
                                 uploadWait={this.state.uploadWait}
                                 postUploadStep={this.state.postUploadStep}
                                 uploadErrors={this.state.uploadErrors}
                                 uploadWarnings={this.state.uploadWarnings}
                                 errorCallback={this.setState.bind(this)}
                                 onDropCallback={this.onFileDrop.bind(this)}
                                 clearErrsCallback={this.clearUploadErrors.bind(this)}
                                 jumpToStep={null}/>
           },
           {name: 'Interpret', component: <StepPlaceHolder/>},
           {name: 'Review', component: <StepPlaceHolder/>},
           {name: 'Import', component: <StepPlaceHolder/>},
        ];
        return <StepZilla steps={steps} stepsNavigation={false} nextTextOnFinalActionStep="Import"/>
    }

    categoriesLookupSuccess(result_json: any, textStatus: string, jqXHR: JQueryXHR): void {
        this.setState({'categories': result_json.results});
    }

    categoriesLookupErr(jqXHR: JQueryXHR, textStatus: string, errorThrown: string): void {
        this.setState({'categories': []});
    }

    categorySelected(category) {
        if (category === this.state.category) {
            return;
        }
        this.setState({
            'category': category,
            'protocol': null,
        });
    }

    protocolSelected(protocol) {
        if (protocol === this.state.protocol) {
            return;
        }

        this.setState({
            'protocol': protocol,
            'format': null,
        });
    }

    formatSelected(format) {
        if(format === this.state.format) {
            return;
        }
        this.setState({
            'format': format,
        });
    }

    uploadSuccess(result_json: any, textStatus: string, jqXHR: JQueryXHR): void {
        let json = JSON.parse(jqXHR.responseText);

        let nextStep = 4;
        if(json.hasOwnProperty('raw_data')) {
            nextStep = 2;
        }

        this.setState({
            'uploadWait': false,
            'postUploadStep': nextStep,
            'uploadWarnings': json.warnings || [],
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
            vals['postUploadStep'] = 0;
        }
        this.setState(vals);
    }

    onFileDrop(acceptedFiles, rejectedFiles) {
        this.clearUploadErrors(true);

        if(acceptedFiles.length) {
            let data: FormData = new FormData();
            data.append('category', ""+ this.state.category.pk);
            data.append('protocol', ""+ this.state.protocol.pk);
            data.append('file_format', ""+ this.state.format.pk);
            data.append('file', acceptedFiles[0]); // configured to only accept one

            this.setState({
                'uploadWait': true,
            });
            $.ajax('/rest/studies/' + EDDData.currentStudyID + '/imports/',
                {
                    method: 'POST',
                    cache: false,
                    contentType:  false,//'multipart/form-data', //'application/json',
                    data: data,
                    dataType: 'application/json',
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
    }


}

//ReactDOM.render(<StepZilla steps={steps} stepsNavigation={false}
// nextTextOnFinalActionStep="Import"/>, document.getElementById("step1"));

ReactDOM.render(<Import/>, document.getElementById("importWizard"));
