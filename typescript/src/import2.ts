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
            $('.wizard-btn').prop('disabled', true);
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

            var longestRow = rawText.split(/[ \r]*\n/)
                .reduce((prev: number, rawRow: string):number => {
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
            //handle csv files
            if (response.file_type === 'csv') {
                this.rawText(response.file_data);
                this.csvOutput = this.handleCSV();
                this.csvOutput.input = this.csvOutput.input.map(function(d) {
                    return d[0].split(',')
                });
                this.showDetailModal();
                return
            }
            //handle xlsx files
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
            selectedFormat: '',
            mode: '',
            importOptions: {
                categories: [
                    {id: 'abcd', name: 'Proteomics'},
                    {id: 'dcba', name: 'Metabolomics'},
                    {id: 'badc', name: 'Transcriptomics'},
                    {id: 'cdab', name: 'Other'}
                ],
                protocols: [
                    {id: 'a123', category: 'abcd', formats: ['f123'], name: 'JBEI Targeted' +
                    ' Proteomics'},
                    {id: 'a456', category: 'abcd', formats: ['f123'], name: 'PNNL Global ' +
                    'Proteomics'},
                    {id: 'b123', category: 'dcba', formats: ['f123'], name: 'JBEI Targeted ' +
                    'Metabolomics'},
                    {id: 'b456', category: 'dcba', formats: ['f123'], name: 'PNNL Global ' +
                    'Metabolomics'},
                    {id: 'c123', category: 'badc', formats: ['f456', 'f789'], name: 'JBEI ' +
                    'Transcriptomics'},
                    {id: 'd123', category: 'cdab', formats: ['f024'], name: 'Biolector'}
                ],
                formats: [
                    {id: 'f123', name: 'Skyline'},
                    {id: 'f456', name: 'Cufflinks file'},
                    {id: 'f789', name: 'Generic Import File'},
                    {id: 'f024', name: 'Biolector XML File'},
                ]
            },
            categories: '',
            protocols: '',
            formats: '',
            metabolomics : [
              { name: 'JBEI Targeted Metabolomics'},
              { name: 'PNNL Targeted Metabolomics'},
            ],
            headers: [],
            importedData: [],
        },
        methods: {
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
                $('.btn').css('color', 'lightgrey').css('border-color', 'lightgrey');
                event.target.style.color = '#23527c';
                $(event.target).css('border-color', '#23527c');
                //get selected text and remove whitespace
                this.selectedCategory = $(event.target).text().replace(/\s/g, '');
                if ($(event.target).text() === 'Other') {
                    this.mode = 'biolector';
                    $('#importDropZone2').addClass('xml');
                } else {
                    this.mode = 'std'
                }
                $('#protocols').removeClass('off');
                $(event.target).parent().find('p').remove();
                let id = this.importOptions.categories.filter(function(d) {
                    return d.name === $(event.target).text().replace(/\s/g, '');
                });
                id = id[0].id;
                this.protocols = this.importOptions.protocols.filter(function(d) {
                    return d.category === id
                })
            },
            selectProtocol: function(event) {
                //turn all buttons grey
                $('#protocols').find('button').css('color','lightgrey').css('border-color','lightgrey');
                //turn selected button blue
                event.target.style.color = '#23527c';
                $(event.target).css('border-color', '#23527c');
                //remove white space before and after text.
                this.selectedProtocol = $(event.target).text().replace(/^\s\s*/, '').replace(/\s\s*$/, '');
                //get selected protocol obj
                var obj = this.importOptions.protocols.filter(function(d) {
                    return d.name === $(event.target).text().replace(/^\s\s*/, '').replace(/\s\s*$/, '')
                });
                let id = obj[0].formats;
                $(event.target).parent().find('p').remove();
                let options = this.importOptions;
                this.formats = id.map(function(d) {for(var key in options.formats)
                                {if (options.formats[key].id === d) {return options.formats[key]}}});
                if (this.formats.length === 1) {
                   $('.wizard-btn ').prop('disabled', false);
                }
                $('#fileFormat').removeClass('off');
            },
            selectFormats: function(event) {
                this.selectedFormat = $(event.target).text();
                if (event.target.checked) {
                    $('.wizard-btn ').prop('disabled', false);
                } else {
                    $('.wizard-btn ').prop('disabled', true);
                }
            },
        }
    })
});
