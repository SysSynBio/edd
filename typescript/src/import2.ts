import { Utl } from "../modules/Utl"
import VueFormWizard from 'vue-form-wizard'
// import 'vue-form-wizard/dist/vue-form-wizard.min.css'

var Vue = require('vue/dist/vue');


Vue.use(VueFormWizard);

//dropzone component
var dropzone = {
    template:'#importDropZone2',
    props: ['currentMode'],
    data: function () {
    return {
      csvOutput: '',
      mode: ''
    }
  },
    methods: {
        prepareDropzone: function() {
            //doing this b/c i can't figure out why 2 text areas exist
            if ($('.fd-zone').length > 1) {
                let elem = $('.fd-zone')[1];
                $(elem).remove()
            }
            Utl.FileDropZone.create({
                elementId: "importDropZone2",
                fileInitFn: this.fileDropped.bind(this),
                url: "/utilities/parsefile/",
                processResponseFn: this.fileReturnedFromServer.bind(this),
            });
        },
        fileDropped: function (file, formData) {
            formData['X_EDD_IMPORT_MODE'] = this.currentMode;
            var ft = file.name.split('.');
            ft = ft[1];
            formData['X_EDD_FILE_TYPE'] = ft;
        },
        handleCSV: function() {
            var rows = [];
            var rawText = $('#step2textarea2').val();

            var longestRow = rawText.split(/[ \r]*\n/).reduce((prev: number, rawRow: string): number => {
                var row: string[];
                if (rawRow !== '') {
                    row = rawRow.split('\t');
                    rows.push(row);
                    return Math.max(prev, row.length);
                }
                return prev;
            }, 0);

            // pad out rows so it is rectangular
            rows.forEach((row: string[]): void => {
                while (row.length < longestRow) {
                    row.push('');
                }
            });
            return {
                'input': rows,
                'columns': longestRow
            };
        },
        rawText: function(value) {
            var rawArea: JQuery = $('#step2textarea2');
            if (value === undefined) {
                value = rawArea.val();
            } else {
                rawArea.val(value);
            }
            return value;
        },

        fileReturnedFromServer: function(fileContainer, result, response){
            
            if (response.file_type === 'csv') {
                this.rawText(response.file_data);
                this.csvOutput = this.handleCSV();
                this.csvOutput.input = this.csvOutput.input.map(function(d) {return d[0].split(',')});
                this.showDetailModal();
                return
            }
            //this works! :)
            if (response.file_type === "xlsx") {
                var ws = response.file_data["worksheets"][0];
                this.csvOutput = ws;
                this.showDetailModal();
            }
        },
        showDetailModal: function() {
            this.$emit('clicked-show-detail', this.csvOutput);
        }
    },
    mounted() {
      this.prepareDropzone()
    }
};

//parent class
window.addEventListener('load', function () {
    var parent = new Vue({
        delimiters: ['${', '}'],
        el: '#app',
        components: {
             'my-dropzone': dropzone
        },
        data: {
            loadingWizard: false,
            highlight: false,
            selectedProtocol: '',
            selectedCategory: '',
            mode: '',
            step1: [
                    {'Proteomics': [
                        {'JBEI Targeted Promeomics': ['Skyline'],},
                        {'PNNL Global Proteomics': ['Skyline'],}]},
                    {'Metabolomics': [
                        {'JBEI Targeted Metabolomics': ['Skyline']},
                        {'PNNL Global Metabolomics': ['Skyline']}]},
                    {'Transcriptomics': [
                        {'JBEI Transcriptomics': ['Cufflinks file', 'Generic Import File']}
                        ]},
                    {'Other': [
                        {'BioLector': ['BioLector XML file']}]}
            ],
            categories: '',
            protocols: '',
            metabolomics : [
              { name: 'JBEI Targeted Metabolomics'},
              { name: 'PNNL Targeted Metabolomics'},
            ],
            headers: [],
            importedData: [],
        },
        methods: {
            prepareIt: function() {
                this.categories = this.step1.map(function(d) {return Object.keys(d)[0]});
                console.log(this.categories)
            },
            clickedShowDetailModal: function (value) {
              if (value.input) {
                  value = value.input;
                  this.headers = value.shift();
                  this.importedData = value;
              } else {
                  value = value[0];
                  this.headers = (value['headers']);
                  this.importedData = value['values'];
              }

            },
            onComplete: function () {
                alert('Your data is being imported');
            },
            setLoading: function (value) {
                this.loadingWizard = value
            },
            handleValidation: function (isValid, tabIndex) {
                console.log('Tab: ' + tabIndex + ' valid: ' + isValid)
            },
            validateAsync:function() {
              return new Promise((resolve, reject) => {
                setTimeout(() => {
                  resolve(true)
                })
              })
             },
            highlightOnClick:function(event, category) {
                alert(event + " " + category);
            },
            selectCategory: function(event) {
                $('.categories').find('button').css('color', 'grey');
                event.target.style.color = 'blue';
                //get selected text and remove whitespace
                this.selectedCategory = $(event.target).text().replace(/\s/g, '');
                if ($(event.target).text() === 'Other') {
                    this.mode = 'biolector';
                    $('#importDropZone2').addClass('xml');
                } else {
                    this.mode = 'std'
                }
                $('#protocols').show();
                var t = this.step1.filter(function(d) {return (Object).keys(d)[0] === $(event.target).text().replace(/\s/g, '');});
                this.protocols = ((<any>Object).values(t[0])[0]).map(function(d){return Object.keys(d)[0]});
            },
            selectProtocol: function(event) {
                $('#protocols').find('button').css('color', 'grey');
                event.target.style.color = 'blue';
                this.selectedProtocol = $(event.target).text();
                $('#fileFormat').show();
            },
        },
        mounted() {
            this.prepareIt()
        }
    })
});
