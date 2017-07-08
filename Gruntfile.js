module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-protractor-runner');

    grunt.initConfig({
        protractor: {
              options: {
                // Location of your protractor config file
                configFile: "main/static/main/js/test/e2e/conf.js",
                noColor: false,

                // Set to true if you would like to use the Protractor command line debugging tool
                // debug: true,

                // Additional arguments that are passed to the webdriver command
                args: { }
              },
              e2e: {
                options: {
                  // Stops Grunt process if a test fails
                  keepAlive: false
                }
              },
              continuous: {
                options: {
                  keepAlive: true
                }
              }
            },

        karma: {
          unit: {
            configFile: 'karma.conf.js',
            singleRun: true,
            browsers: ['PhantomJS']
          }
        },
        concat: {
          options: {},
          dist: {
            files: [
                 'static/main/dist/*.js',
                 'fixtures/*.js',
                 '!main/static/main/js/test/*.js'
               ]
          }
        },
        jshint: {
            //include 'main/static/main/js/*.js' to lint all js files  
          files: ['Gruntfile.js',
                  './main/static/main/js/GroupedBarAssay.js',
                  './main/static/main/js/GroupedBarTime.js',
                  './main/static/main/js/GroupedBarTime.js'],
          options: {
            globals: {
              jQuery: true
            }
          }
        },
        screenshots: {
          default_options: {
            options: {
                spawn: false
            }
          }
        },
    });


    var production = grunt.option('production');
    var commit = grunt.option('commit');
    var watch = grunt.option('watch');

    grunt.registerTask('test', [
          'jshint',
          'karma'
    ]);

    grunt.registerTask('e2e-test', ['protractor:e2e']);

    grunt.registerMultiTask( 'screenshots', 'Use Grunt and PhantomJS to generate Screenshots of' +
        ' pages', function(){
        var server = require( "./main/fixtures/node-server/main" );
        var screenshot = require( "./main/fixtures/shot-wrapper" );

        var done = this.async();

        screenshot.takeShot( function(){
            done();
        });

    });

};



