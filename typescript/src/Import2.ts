/// <reference path="typescript-declarations.d.ts" />
//global registration
// import VueFormWizard from 'vue-form-wizard'
// import 'vue-form-wizard/dist/vue-form-wizard.min.css'
Vue.use(VueFormWizard);


var category = {
    props: {
        'todo': {
          type:String
        },
        'select': {
            default: '',
            type: String
        }
    },
    data: function () {
    return {
      selected: this.select
    }
    },
    template: '<p><button v-on:click.prevent="alert">{{ todo }}</button>{{ select }}</p>',
    methods: {
        alert: function() {
            alert('working ' + this.todo + ' ' + this.select);
        },
    },
};

window.addEventListener('load', function () {
    var parent = new Vue({
        el: '#app',
        data: {
            loadingWizard: false,
            categoryList: [
                'Proteomics',
                'Metabolomics',
                'Transcriptomics',
                'OD600',
                'Other'
            ],
            selected: 't',
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