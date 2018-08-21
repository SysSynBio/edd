"use strict";

import * as $ from "jquery";
import * as React from "react";
import * as ReactDOM from "react-dom";
import StepZilla from "react-stepzilla";


// const Index = () => {
//     return <div>Hello React!</div>
// };
//
// ReactDOM.render(<Index/>, document.getElementById("helloWorld"));


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
        let classes: string;
        let selected: T = this.props.selected;

        return <div>
                {
                    options.map((option) => {
                        classes = "btn btn-default";
                        if(selected && selected.pk === option.pk) {
                            classes += " active";
                        }

                        return <button className={classes}
                                // onClick={() => this.props.selectionCallback(option)}>{option.name}
                                onClick={() => selectionCallback(option)}>{option.name}
                        </button>
                    })
                }
        </div>
    }
}

class Import extends React.Component<any, any> {
    constructor(props) {
        super(props);
        this.state = {
            stepNum: 1,
        };
    }
}

export interface Step1State {
    categories: any[];
    category: Category;
    protocol: Protocol;
    format: Selectable;
}

class Step1 extends React.Component<any, Step1State> {
    constructor(props) {
        super(props);
        this.state = {
            categories: [],
            category: null,
            protocol: null,
            format: null,
        };
    }

    componentDidMount() {
        // get categories and associated protocols, file formats
        $.ajax('/rest/import_categories/?ordering=display_order',
            {
                headers: {'Content-Type' : 'application/json'},
                method: 'GET',
                dataType: 'json',
                success: this.categoriesLookupSuccess.bind(this),
                error: this.categoriesLookupSuccessErr.bind(this),
            }
        );
    }

    categoriesLookupSuccess(result_json: any, textStatus: string, jqXHR: JQueryXHR): void {
        this.setState({'categories': result_json.results})
    }

    categoriesLookupSuccessErr(jqXHR, textStatus: string, errorThrown: string): void {
        console.error('Error looking up categories');
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
        console.log("set protocol to " + protocol);
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

    nextSelected() {
        $.ajax('/rest/imports/',
            {
                headers: {'Content-Type' : 'application/json'},
                method: 'POST',
                dataType: 'json',
                data: {
                    'category': this.state.category.pk,
                    'protocol': this.state.protocol.pk,
                    'file_format': this.state.format.pk,
                },
                processData: false,
                success: this.step1PostSuccess.bind(this),
                error: this.step1PostErr.bind(this),
            }
        );
    }

    step1PostSuccess(result_json: any, textStatus: string, jqXHR: JQueryXHR): void {
        // TODO:
    }

    step1PostErr(jqXHR, textStatus: string, errorThrown: string): void {
        // TODO:
    }

    render() {
        const categories = this.state.categories;
        let category = this.state.category;
        let protocol = this.state.protocol;

        return this.props.stepNum === 1 && <div className="pageSection stepBorder">
            <div className="import2SectionHead">
                <h2>What category of data do you have?</h2><HelpButton/></div>
            <div className="import2SectionContent">
                <div>
                {
                    <MultiButtonSelect options={categories}
                                       selectionCallback={this.categorySelected.bind(this)}
                                       selected={this.state.category}/>
                }
                </div>
                {
                    category !== null &&
                    <div className="pageSection stepBorder">
                        <h2>What lab protocol did you use?</h2>
                        <MultiButtonSelect options={category.protocols}
                           selectionCallback={this.protocolSelected.bind(this)}
                           selected={this.state.protocol}/>
                    </div>
                }
                {
                    protocol !== null &&
                    <div className="pageSection stepBorder">
                        <h2>What file format is your data in?</h2>
                            <MultiButtonSelect options={category.file_formats}
                               selectionCallback={this.formatSelected.bind(this)}
                               selected={this.state.format}/>
                    </div>
                }

            </div>

        </div>
    }
}

ReactDOM.render(<Step1 stepNum={1}/>, document.getElementById("step1"));

const steps = []
