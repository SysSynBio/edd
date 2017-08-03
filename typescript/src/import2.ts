import { Utl } from "../modules/Utl"

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
                this.showDetailModal();
                return
            }
            //this works! :)
            if (response.file_type == "xlsx") {
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
            proteomics: [
              { name: 'JBEI Targeted Proteomics'},
              { name: 'PNNL Targeted Proteomics'},
              { name: 'JBEI Shotgun Proteomics'},
            ],
            metabolomics : [
              { name: 'JBEI Targeted Metabolomics'},
              { name: 'PNNL Targeted Metabolomics'},
            ],
            headers: [],
            importedData: [],
        },
        methods: {
            clickedShowDetailModal: function (value) {
              if (typeof value === 'object') {
                  value = value['input'];
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
                this.selectedCategory = $(event.target).text();
                if ($(event.target).text() === 'Biolector') {
                    this.mode = 'biolector';
                    $('#importDropZone2').addClass('xml');
                } else {
                    this.mode = 'std'
                }
                $('#protocols').show();
            },
            selectProtocol: function(event) {
                $('#protocols').find('button').css('color', 'grey');
                event.target.style.color = 'blue';
                this.selectedProtocol = $(event.target).text();
                $('#fileFormat').show();
            },
        },

    })
});