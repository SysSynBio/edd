/**
 * Created by tlopez on 6/13/17.
 */

var path = require('path');
var webpack = require('webpack');

module.exports = {
    devtool: 'source-map',
    entry: {
        EDDDataInterface: "./typescript/src/EDDDataInterface.ts",
        EDDRest: "./typescript/src/EDDRest.ts",
        ExperimentDescHelp: "./typescript/src/Experiment-Desc-Help.ts",
        Import: "./typescript/src/Import.ts",
        Import2: "./typescript/src/Import2.ts",
        index: "./typescript/src/index.ts",
        StudyData: "./typescript/src/Study-Data.ts",
        StudyLines: "./typescript/src/Study-Lines.ts",
        StudyOverview: "./typescript/src/Study-Overview.ts"
    },
    output: {
        path: path.resolve(__dirname, './main/static/dist'),
        filename: '[name].js'
    },
  resolve: {
    extensions: ['.ts', '.js', '.tsx', '.jsx', '.vue']
  },
  module: {
    rules: [
      {
        test: /\.ts?$/,
        exclude: /node_modules/,
        loader: 'ts-loader'
      }
    ]
  }
};
