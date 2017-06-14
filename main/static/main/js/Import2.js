/// <reference path="typescript-declarations.d.ts" />
//global registration
window.addEventListener('load', function () {
    var app = new Vue({
        delimiters: ['${', '}'],
        el: '#app',
        data: {
            libraries: ['angular.js', 'd3', 'node', 'jquery'],
            message: 'HI!',
            newlibrary: '',
        },
        methods: {
            addLibrary: function () {
                this.libraries.push(this.newlibrary);
                this.newlibrary = '';
            },
            deleteLibraries: function () {
                this.libraries = [];
            }
        },
        ready: function () {
            this.$http.get('http://localhost.com/api/jobs').then(function (response) {
                this.libraries = response.data;
            }, function (response) {
                console.log(response);
            });
        }
    });
});
