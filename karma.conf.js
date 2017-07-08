// Karma configuration
// Generated on Tue Jul 12 2016 15:36:02 GMT-0700 (PDT)

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '.',

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine'],


    // list of files / patterns to load in the browser
    files: [
      'main/static/main/js/lib/d3/d3.min.js',
      'main/static/main/js/lib/filedrop-min.js',
      'main/static/main/js/lib/jquery/jquery.js',
      'main/static/main/js/lib/jquery-ui/jquery-ui.min.js',
      'main/static/main/js/lib/jasmine/jasmine-jquery.js',
      'main/static/dist/StudyLines.js',
        'main/static/dist/StudyData.js.map',
      'main/static/dist/StudyData.js',
      'main/static/dist/Import.js',
      'main/static/main/js/test/*.js',
      'main/static/main/js/lib/underscore/underscore.js',
       // JSON fixture
      { pattern:  'main/static/main/js/test/EDDData.json',
        watched:  true,
        served:   true,
        included: false },
        { pattern:  'main/static/main/js/test/SpecRunner.html',
        watched:  true,
        served:   true,
        included: false }
    ],

    proxies: {
      '/edddata/': '/base/main/static/main/js/test/EDDData.json',
      '/study/10/assaydata/': '/base/main/static/main/js/test/assay.json'
    },

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,
    
    singleRun: true,
    browsers: ['PhantomJS']

    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher

  })
};
