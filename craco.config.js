const webpack = require("webpack");

module.exports = {
    babel: {
        plugins: [
            "@babel/plugin-transform-async-to-generator",
            "@babel/plugin-proposal-nullish-coalescing-operator",
            "@babel/plugin-proposal-optional-chaining",
        ],
    },
    webpack: {
        configure: {
            experiments: {
                topLevelAwait: true,
            },
            resolve: {
                fallback: {
                    "crypto": require.resolve("crypto-browserify"),
                    "http": require.resolve("stream-http"),
                    "https": require.resolve("https-browserify"),
                    "stream": require.resolve("stream-browserify"),
                    "url": require.resolve("url/"),
                    "os": require.resolve("os-browserify/browser"),
                    "path": require.resolve("path-browserify"),
                    "zlib": require.resolve("browserify-zlib"),
                    "fs": false
                }
            }
        }
    }
}
