// File last modified on: Tue Jun 27 2017 17:09:52  
/// <reference path="typescript-declarations.d.ts" />
//global registration
// import VueFormWizard from 'vue-form-wizard'
// import 'vue-form-wizard/dist/vue-form-wizard.min.css'
Vue.use(VueFormWizard);


var category = {
    data: function () {
    return {
      categoryList: [
            'Proteomics',
            'Metabolomics',
            'Transcriptomics',
            'OD600',
            'Other'
      ],
        selected: '',
    }
    },
    template: '<div><div><button v-for="item in categoryList" v-on:click.prevent="selectProtocol(item)">' +
              '{{ item }}</button></div><div><h2>{{ selected }}</h2></div>',
    methods: {
        selectProtocol: function(item) {
            // this.selected = event.target.value;
            this.selected = item;
        },
    },
};

window.addEventListener('load', function () {
    var parent = new Vue({
        el: '#app',
        data: {
            loadingWizard: false,
            highlight: false
        },
        components: {
            // <my-component> will only be available in parent's template
            'category-selector': category
        },
        selectedCategory: {
            selectedButton: function() {
                return this.selected;
            }
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
            }
        },

    })
});