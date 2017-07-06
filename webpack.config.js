/**
 * Created by tlopez on 6/13/17.
 */

var path = require('path');
var webpack = require('webpack');
module.exports = {
    devtool: 'source-map',
    entry: {
        AssayTableDataGraphing: "./typescript/src/AssayTableDataGraphing.ts",
        EDDAutocomplete: "./typescript/src/EDDAutocomplete.ts",
        EDDDataInterface: "./typescript/src/EDDDataInterface.ts",
        EDDRest: "./typescript/src/EDDRest.ts",
        ExperimentDescHelp: "./typescript/src/Experiment-Desc-Help.ts",
        Import: "./typescript/src/Import.ts",
        index: "./typescript/src/index.ts",
        StudyCreate: "./typescript/src/Study-Create.ts",
        StudyData: "./typescript/src/Study-Data.ts",
        StudyLines: "./typescript/src/Study-Lines.ts",
        StudyOverview: "./typescript/src/Study-Overview.ts",
        StudySBMLExport: "./typescript/src/StudySBMLExport.ts"
    },
    output: {
        path: path.resolve(__dirname, './main/static/dist'),
        filename: '[name].js'
    },
    resolve: {
        extensions: ["", ".webpack.js", ".web.js", ".ts", ".js", ".vue"],
        modulesDirectories: ['node_modules',  './typescript/modules']
        },
    module: {
        loaders: [
            { test: /\.vue$/, loader: 'vue-loader' },
            { test: /\.ts$/, loader: "ts-loader" },
            { enforce: "pre", test: /\.js$/, loader: "source-map-loader" }
        ]
    }
};
