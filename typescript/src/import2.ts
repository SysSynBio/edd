// File last modified on: Tue Jun 27 2017 17:09:52  
/// <reference path="typescript-declarations.d.ts" />
//global registration
// import VueFormWizard from 'vue-form-wizard'
// import 'vue-form-wizard/dist/vue-form-wizard.min.css'
Vue.use(VueFormWizard);
// import Dropzone from 'vue2-dropzone'

// export default {
//     name: 'MainApp',
//     components: {
//       Dropzone
//     },
//     methods: {
//       'showSuccess': function (file) {
//         console.log('A file was successfully uploaded')
//       }
//     }
// }

// var category = {
//     data: function () {
//     return {
//       categoryList: [
//           {name: 'Proteomics'},
//           { name: 'Metabolomics'},
//           { name: 'Transcriptomics'},
//           { name: 'OD600'},
//           { name: 'Other'}
//       ],
//       selectedCategory: '',
//     }
//     },
//     template: '<div class="categories">' +
//                 '<div><button v-for="item in categoryList" v-on:click.prevent="selectProtocol">' +
//                 '{{ item.name }}</button></div>' +
//                 '<div><h2>{{ selectedCategory }}</h2></div>' +
//              '</div>',
//     methods: {
//
//     },
// };
//
// var protocol = {
//     data: function () {
//     return {
//       proteomics: [
//           { name: 'JBEI Targeted Proteomics'},
//           { name: 'PNNL Targeted Proteomics'},
//           { name: 'JBEI Shotgun Proteomics'},
//       ],
//       metabolomics : [
//           { name: 'JBEI Targeted Metabolomics'},
//           { name: 'PNNL Targeted Metabolomics'},
//       ],
//         selectedProtocol: category.data()
//     }
//     },
//     template:
//     methods: {
//         selectProtocol: function(event) {
//             $('#protocols').find('button').css('color', 'grey');
//             event.target.style.color = 'blue';
//             this.selected = $(event.target).text();
//             $('#fileFormat').show();
//         },
//     },
// };

window.addEventListener('load', function () {
    var parent = new Vue({
        delimiters: ['${', '}'],
        el: '#app',
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