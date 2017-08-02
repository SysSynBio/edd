import { Utl } from "../modules/Utl"

Vue.use(VueFormWizard);

//dropzone component
var dropzone = {
    template:'#importDropZone2',
    data: function () {
    return {
      csvOutput: ''
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
            var mode = 'std';
            formData['X_EDD_IMPORT_MODE'] = mode;
            var ft = file.name.split('.');
            ft = ft[1];
            formData['X_EDD_FILE_TYPE'] = ft;
        },
        fileReturnedFromServer: function(fileContainer, result, response){
            
            if (response.file_type === 'csv') {
                this.csvOutput = response.file_data;
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
              value = value[0];
              this.headers = (value['headers']);
              this.importedData = value['values'];
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