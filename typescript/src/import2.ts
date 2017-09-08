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
                $(e.target).parent().next().toggleClass('off')
            });

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
            formats: '',
            proteomicFormats: [
                {id: 'f123', name: 'Skyline', value: 'std'},
                {id: 'f789', name: 'General Import File', value: 'std'},
                ],
            metabolomicFormats: [
                {id: 'f123', name: 'Skyline', value: 'std'},
                {id: 'f542', name: 'HPLC Instrument File', value:'hplc'},
                {id: 'f542', name: 'Flux Analysis file', value:'mdv'},
                {id: 'f789', name: 'General Import File', value: 'std'},
                ],
            otherFormats: [
                {id: 'f024', name: 'Biolector XML File', value: 'biolector'},
                {id: 'f789', name: 'General Import File', value: 'std'},
                ],
            transcriptomicFormats: [
                {id: 'f123', name: 'Gene Transcription', value: 'tr'},
                {id: 'f789', name: 'General Import File', value: 'std'},
                ],
            headers: [],
            unmatchedRows: [],
            importedData: [],
            matchedIds: [],
            importData: '',
            importOptions: {
                categories: [
                    {id: 'abcd', name: 'Proteomics'},
                    {id: 'dcba', name: 'Metabolomics'},
                    {id: 'badc', name: 'Transcriptomics'},
                    {id: 'cdab', name: 'Other'}
                ],
            }
        },
        methods: {
            setLoading: function (value) {
                this.loadingWizard = value
            },
            handleValidation: function (isValid, tabIndex) {
                console.log('Tab: ' + tabIndex + ' valid: ' + isValid);
            },
            validateAsync: function () {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(true)
                    })
                })
            },
            selectCategory: function(event) {
                if (this.selectedCategory) {
                    $("#masterProtocol").val('unspecified_protocol');
                    $('#fileFormat').addClass('off');
                    $('#fileFormat').find('input').prop('checked', false);
                    $('.wizard-footer-right0').prop('disabled', true);
                }
                $('.btn').removeClass('selectedButton').addClass('greyButton');
                $(event.target).removeClass('greyButton').addClass('selectedButton');
                //get selected text and remove whitespace
                this.selectedCategory = $(event.target).text().replace(/\s/g, '');
                $(event.target).parent().find('p').remove();
                if (this.selectedCategory === 'Proteomics') {
                    this.formats = this.proteomicFormats
                } else if (this.selectedCategory === 'Metabolomics') {
                    this.formats = this.metabolomicFormats
                } else if (this.selectedCategory === 'Transcriptomics') {
                    this.formats = this.transcriptomicFormats
                } else {
                    this.formats = this.otherFormats
                }
                $('#protocols').removeClass('off');
            },
            selectProtocol: function(event) {
                if ($(event.target).find('option:selected').text()) {
                    $('.wizard-footer-right0').prop('disabled', true);
                }
                if ($("#masterProtocol").val() != 'unspecified_protocol') {
                    $('#fileFormat').removeClass('off');
                }
            },
            selectFormats: function(event) {
                this.selectedFormat = $(event.target).text();

                //uncheck other boxes if one is checked
               $('#fileFormat').find('input').not($(event.target)).prop('checked', false);
               $('.wizard-footer-right0').prop('disabled', false);
            },
        }
    })
});
