/**
 * Created by tlopez on 6/13/17.
 */

var CommonsPlugin = new require ('webpack/lib/optimize/CommonsChunkPlugin');

var path = require('path');
var webpack = require('webpack');
module.exports = {
    devtool: 'source-map',
    entry: {
        AssayTableDataGraphing: "./typescript/src/AssayTableDataGraphing.ts",
        BiomassCalculationUI: "./typescript/src/BiomassCalculationUI.ts",
        CarbonSummation: "./typescript/src/CarbonSummation.ts",
        DataGrid: "./typescript/src/DataGrid.ts",
        Dragboxes: "./typescript/src/Dragboxes.ts",
        EDDAutocomplete: "./typescript/src/EDDAutocomplete.ts",
        EDDDataInterface: "./typescript/src/EDDDataInterface.ts",
        EDDEditableElement: "./typescript/src/EDDEditableElement.ts",
        EDDGraphingTools: "./typescript/src/EDDGraphingTools.ts",
        EDDRest: "./typescript/src/EDDRest.ts",
        ExperimentDescHelp: "./typescript/src/Experiment-Desc-Help.ts",
        FileDropZone: "./typescript/src/FileDropZone.ts",
        Import: "./typescript/src/Import.ts",
        index: "./typescript/src/index.ts",
        StudyCreate: "./typescript/src/Study-Create.ts",
        StudyData: "./typescript/src/Study-Data.ts",
        StudyLines: "./typescript/src/Study-Lines.ts",
        StudyOverview: "./typescript/src/Study-Overview.ts",
        Study: "./typescript/src/Study.ts",
        StudyCarbonBalance: "./typescript/src/StudyCarbonBalance.ts",
        StudySBMLExport: "./typescript/src/StudySBMLExport.ts",
        Utl: "./typescript/src/Utl.ts"
    },
    plugins: [
      new CommonsPlugin({
          minChunks: 3,
          name: "common"
      })
    ],
    output: {
        path: path.resolve(__dirname, './main/static/dist'),
        filename: '[name].js'
    },
    resolve: {
        extensions: ["", ".webpack.js", ".web.js", ".ts", ".js", ".vue"],
        modulesDirectories: ['node_modules']
        },
    module: {
        loaders: [
            { test: /\.vue$/, loader: 'vue-loader' },
            { test: /\.ts$/, loader: "awesome-typescript-loader" },
            { enforce: "pre", test: /\.js$/, loader: "source-map-loader" }
        ]
    }
};
