import { Utl } from "../modules/Utl"

Vue.use(VueFormWizard);


var dropzone = {
    template:'#importDropZone2',
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
                // Since we're handling this format entirely client-side, we can get rid of the
                // drop zone immediately.
                console.log(response.file_data);
                return
            }

            if (response.file_type == "xlsx") {
                var ws = response.file_data["worksheets"][0];
                var table = ws[0];
                var csv = [];
                if (table.headers) {
                    csv.push(table.headers.join());
                }
                csv = csv.concat(table.values.map((row: string[]) => row.join()));
                console.log(csv);
                return;
            }
        },
    },
    mounted() {
      this.prepareDropzone()
    }
};

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
        },
        methods: {
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