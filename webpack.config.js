/**
 * Created by tlopez on 6/13/17.
 */

var path = require('path');
var webpack = require('webpack');
module.exports = {
    entry: "./typescript/src/",
    output: {
        path: './bin',
        filename: "bundle.js"
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
