import { Utl } from "../modules/Utl"
import VueFormWizard from 'vue-form-wizard'
import 'vue-form-wizard/dist/vue-form-wizard.min.css'
import { EDDAuto } from "../modules/EDDAutocomplete"
import {EDDTableImport} from "./Import"
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
            $('.wizard-footer-right3').on('click', function() {
                $('#submitForImport').removeClass('off')
            })
        },
        prepareDropzone: function() {
            $(document).on('click', '.disclose .discloseLink', (e) => {
                $(e.target).closest('.disclose').toggleClass('discloseHide');
            });
            // $('#skylinelayoutexample').slideToggle('slow', function() {
            //     $('#skylinelayoutexample').toggleClass('off');
            // });

            //doing this b/c i can't figure out why 2 text areas exist
            if ($('.fd-zone').length > 1) {
                let elem = $('.fd-zone')[1];
                $(elem).remove()
            }
        },
        fileDropped(file, formData): void {
            EDDTableImport.processingFileCallback();
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
            categories: '',
            yes: true,
            protocols: '',
            formats: [
                {id: 'f123', name: 'Skyline', value: 'std'},
                {id: 'f789', name: 'General Import File', value: 'std'},
                ],
            headers: [],
            unmatchedRows: [],
            importedData: [],
            matchedIds: [],
            importData: '',
            // "std", "mdv", "tr", "hplc", "pr", and "biolector".
            importOptions: {
                categories: [
                    {id: 'abcd', name: 'Proteomics'},
                    {id: 'dcba', name: 'Metabolomics'},
                    {id: 'badc', name: 'Transcriptomics'},
                    {id: 'cdab', name: 'Other'}
                ],
                protocols: [
                    {id: 'a123', category: 'abcd', formats: ['f123', 'f789'], name: 'JBEI Targeted' +
                    ' Proteomics'},
                    {id: 'a456', category: 'abcd', formats: ['f123', 'f789'], name: 'PNNL Global ' +
                    'Proteomics'},
                    {id: 'b123', category: 'dcba', formats: ['f123', 'f789'], name: 'JBEI Targeted ' +
                    'Metabolomics'},
                    {id: 'b456', category: 'dcba', formats: ['f123', 'f789'], name: 'PNNL Global ' +
                    'Metabolomics'},
                    {id: 'c123', category: 'badc', formats: ['f456', 'f789'], name: 'JBEI ' +
                    'Transcriptomics'},
                    {id: 'd123', category: 'cdab', formats: ['f024', 'f789'], name: 'Biolector'}
                ],
                formats: [
                    {id: 'f123', name: 'Skyline', value: 'std'},
                    {id: 'f456', name: 'Cufflinks file', value: 'std'},
                    {id: 'f789', name: 'General Import File', value: 'std'},
                    {id: 'f024', name: 'Biolector XML File', value: 'biolector'},
                ]
            },
        },
        methods: {
             onComplete: function () {
                let studydata_url = "/study/" + EDDData.currentStudyID;
                window.location.pathname = studydata_url;
            },
            setLoading: function (value) {
                this.loadingWizard = value
            },
            handleValidation: function (isValid, tabIndex) {
                console.log('Tab: ' + tabIndex + ' valid: ' + isValid);
            },
            validateAsync: function () {
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        resolve(true)
                    })
                })
            },
            highlightOnClick: function (event, category) {
                alert(event + " " + category);
            },
            selectCategory: function(event) {
                if (this.selectedCategory) {
                    $('#protocols').find('button').removeClass('greyButton').removeClass('selectedButton');
                    $('#protocols').addClass('off');
                    $('#fileFormat').addClass('off');
                }
                $('.btn').removeClass('selectedButton').addClass('greyButton');
                $(event.target).removeClass('greyButton').addClass('selectedButton');
                //get selected text and remove whitespace
                this.selectedCategory = $(event.target).text().replace(/\s/g, '');
                $(event.target).parent().find('p').remove();
                // let id = this.importOptions.categories.filter(function(d) {
                //     return d.name === $(event.target).text().replace(/\s/g, '');
                // });
                // id = id[0].id;
                // this.protocols = this.importOptions.protocols.filter(function(d) {
                //     return d.category === id
                // });
                $('#protocols').removeClass('off');
            },
            selectProtocol: function(event) {
                if ($(event.target).find('option:selected').text()) {
                    $('.wizard-footer-right0').prop('disabled', true);
                }
                //turn all buttons grey
                // $('#protocols').find('button').addClass('greyButton');
                //turn selected button blue
                // $(event.target).addClass('selectedButton');
                // if (this.formats.length === 1) {
                //    $('.wizard-btn ').prop('disabled', false);
                // } else {
                //     $('.wizard-btn ').prop('disabled', true);
                // }
                $('#fileFormat').removeClass('off');
            },
            selectFormats: function(event) {
                this.selectedFormat = $(event.target).text();
                if ($('#fileFormat').find('input').eq(1).prop('checked') &&
                !$('#fileFormat').find('input').eq(0).prop('checked')) {
                    $('.wizard-footer-right0').prop('disabled', false);
                } else if ($('#fileFormat').find('input').eq(0).prop('checked') &&
                !$('#fileFormat').find('input').eq(1).prop('checked')) {
                    $('.wizard-footer-right0 ').prop('disabled', false);
                } else {
                  $('.wizard-footer-right0').prop('disabled', true);
                }
            },
        }
    })
});


// var test = {
//     cache: {},
//     cacheId: "GenericOrMetaboliteTypes",
//     columns: '',
//     container: '',
//     delete_last: false,
//     display_key: "name",
//     hiddenInput: '',
//     modelName: "GenericOrMetabolite",
//     search_uri: "/search/",
//     uid: 10,
//     value_key: "id",
//     visibleInput: ''
// };
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