import { Utl } from "../modules/Utl"
import VueFormWizard from 'vue-form-wizard'
import { EDDAuto } from "../modules/EDDAutocomplete"
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
      mode: '',
      lineNames:'',
      matchedLines: '',
      matchedAssays: '',
    }
  },
    methods: {
        getEDDData: function() {
            var studydata_url:string;

            studydata_url = "/study/" + EDDData.currentStudyID + "/assaydata/";

            EDDAuto.BaseAuto.initPreexisting();
            // this makes the autocomplete work like a dropdown box
            // fires off a search as soon as the element gains focus
            $(document).on('focus', '.autocomp', function (ev) {
                $(ev.target).addClass('autocomp_search').mcautocomplete('search');
            });

            // Populate ATData and EDDData objects via AJAX calls
            jQuery.ajax(studydata_url, {
                "success": function(data) {
                    $.extend(EDDData, data.ATData);
                    $.extend(EDDData, data.EDDData);
                }
            }).fail(function(x, s, e) {
                alert(s);
            });
        },
        prepareDropzone: function() {
            $(document).on('click', '.disclose .discloseLink', (e) => {
            $(e.target).closest('.disclose').toggleClass('discloseHide');
            $('#skylinelayoutexample').slideToggle('slow', function() {
                $('#skylinelayoutexample').toggleClass('off');
            })
        });
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
                processErrorFn: this.handleError.bind(this),
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
        handleError: function(response) {
            if (response.xhr.status === 504) {
                alert('504 error')
            }
        },
        fileReturnedFromServer: function(fileContainer, result, response){

            this.successHandler();

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
                // this.csvOutput[0].headers = this.csvOutput[0].headers.map(function(a) {
                //     return {'header': a}
                // });
                // this.csvOutput[0].values = this.csvOutput[0].values.map(function(a) {
                //     return a.map(function(b){ return {'cell': b}})
                // });
                this.showDetailModal();
            }
        },
        successHandler: function() {
            $('<p>', {
                text: 'Success!',
                style: 'margin:auto'
            }).appendTo('#fileUploaded');
            // $('#fileUploaded').show();
            $("#fileUploaded").show();
            //remove alert
            setTimeout(function () {
                   $('#fileUploaded').hide();
                }, 3000);

         },
        showDetailModal: function() {
            this.$emit('clicked-show-detail', this.csvOutput);
        }
    },
    mounted() {
      this.prepareDropzone();
      this.getEDDData();
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
            selectedMeasurement:'',
            selectedMeasurementId: '',
            mode: '',
            defaults: [{
                "Line Name": {default: ''},
                "Measurement": {default: ''},
                 "Value":  {default: ''},
                "Units":  {default: ''},
                "Time (h)":  {default: ''},
                "Cellular Compartment":  {default: ''},
             }   
            ],
            updatedHeader: [],
            requiredInputs: ["Line Name", "Measurement", "Value", "Units", "Time (h)", "Cellular" +
            " Compartment"],
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
            emptyDataEntry: {
                assay_id:"named_or_new",
                assay_name:"new",
                compartment_id:"",
                data: [],
                kind: 'std',
                line_id:"",
                line_name:null,
                measurement_id: '',
                measurement_name: '',
                metadata_by_id: "",
                metadata_by_name: "",
                units_id:""
            },
            categories: '',
            yes: true,
            protocols: '',
            formats: '',
            headers: [],
            unmatchedRows: [],
            importedData: [],
            matchedIds: [],
            importData: '',
        },
        methods: {
            clickedShowDetailModal: function (value) {
              if (value.input) {
                  value = value.input;
                  this.headers = value.shift();
                  this.importedData = value;
                  if(this.importedData.length > 50) {
                      this.yes = false;
                  }
              } else {
                  value = value[0];
                  this.headers = (value['headers']);
                  this.headers.unshift('');
                  this.importedData = value['values'];
              }
              this.successfulRedirect();
              this.matchInputs();
              this.findMatchedInputs();
            },
            matchInputs: function() {
              this.importData = this.importedData.map(function(d) {
                  return {
                    assay_id:"named_or_new",
                    assay_name:"new",
                    input: d[0],
                    compartment_id:"",
                    data: [[24, d[3]]],
                    kind: 'std',
                    line_id:"",
                    line_name:null,
                    measurement_id: '',
                    measurement_name: d[2],
                    metadata_by_id: "",
                    metadata_by_name: "",
                    units_id:""
                  }
              });
              this.importData.forEach(function(d) {
                  // var measurement = this.selectedMeasurement;
                  // var measurementId = this.selectedMeasurementId;
                  return EDDData.ExistingLines.forEach(function(m) {
                      if (m.n === d.input) {
                          d.line_name = d.input;
                          d.line_id = m.id;
                      }
                  })
              });
            },
            findMatchedInputs: function() {
                var required = this.requiredInputs;
                var matched = this.headers.filter(function(d, i) {
                    if (required.indexOf(d) >= 0) return i});
                for (var i = 0; i < matched.length; i++ ) {
                    this.matchedIds.push(this.requiredInputs.indexOf(matched[i]) + 1)
                }
            },
            defaultInput: function(input, type) {
                if (type === 'Measurement') {
                    this.importData.forEach(function(d) {
                      d.measurement = input;
                    })
                }
            },
            // identifyHeaders: function() {
            //    for (var key in this.requiredInputs) {
            //        for (var i =0; i < this.headers.length; i++) {
            //            if(this.requiredInputs[key].type.includes(this.headers[i])) {
            //                this.requiredInputs[key].exists = true;
            //            }
            //        }
            //    }
            // },

            successfulRedirect: function() {
            //redirect to lines page
                setTimeout(function () {
                   $('.wizard-btn').eq(1).click();
                }, 1000);
            },
            changeItem: function(ev, a) {
               $("table").find("tr td:nth-child(" + (a + 1) + ")").removeClass('unMatched');
               let name = $(event.target).val().slice(0,3);
                $('.' + name).hide();
            },
            onComplete: function () {
                let studydata_url = "/study/" + EDDData.currentStudyID;
                window.location.pathname = studydata_url;
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
                if (this.selectedCategory) {
                    $('#protocols').find('button').removeClass('greyButton').removeClass('selectedButton');
                    $('#protocols').addClass('off');
                    $('#fileFormat').addClass('off');
                    $('.wizard-btn ').prop('disabled', true);
                }
                $('.btn').removeClass('selectedButton').addClass('greyButton');
                $(event.target).removeClass('greyButton').addClass('selectedButton');
                //get selected text and remove whitespace
                this.selectedCategory = $(event.target).text().replace(/\s/g, '');
                if ($(event.target).text() === 'Other') {
                    this.mode = 'biolector';
                    $('#importDropZone2').addClass('xml');
                } else {
                    this.mode = 'std'
                }
                $(event.target).parent().find('p').remove();
                let id = this.importOptions.categories.filter(function(d) {
                    return d.name === $(event.target).text().replace(/\s/g, '');
                });
                id = id[0].id;
                this.protocols = this.importOptions.protocols.filter(function(d) {
                    return d.category === id
                });
                $('#protocols').removeClass('off');
            },
            selectProtocol: function(event) {
                if (!this.selectedProtocol) {
                    $('.wizard-btn ').prop('disabled', true);
                }
                //turn all buttons grey
                $('#protocols').find('button').addClass('greyButton');
                //turn selected button blue
                $(event.target).addClass('selectedButton');
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
                } else {
                    $('.wizard-btn ').prop('disabled', true);
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



            //resolved sets. how each input should be sent..
// var test = {
//     assay_id:"named_or_new",
//     assay_name:"2X-Mh",
//     compartment_id:"0",
//     data: [[24, 345.5]],
//     kind:"std",
//     line_id:"8",
//     line_name:null,
//     measurement_id:"1",
//     measurement_name:null,
//     metadata_by_id:Object,
//     metadata_by_name:Object,
//     units_id:"1"
// };
//          parsing stuff

//below returns input matched at B-Mm where var t =$('table input')
// t.filter( function(d) {return ($(this).val().replace(/\s/g, '') === 'B-Mm')})