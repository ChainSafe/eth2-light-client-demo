const webpack = require("webpack");

module.exports = {
  babel: {
    plugins: [
      "@babel/plugin-proposal-nullish-coalescing-operator",
      "@babel/plugin-proposal-optional-chaining",
    ],
  },
  webpack: {
    configure: {
      module: {
        exprContextCritical: false, // turns off Critical dependency: the request of a dependency is an expression error
      },
      experiments: {
        topLevelAwait: true,
      },
      resolve: {
        fallback: {
          crypto: false,
          http: require.resolve("stream-http"),
          https: require.resolve("https-browserify"),
          stream: false,
          url: false,
          os: false,
          path: false,
          zlib: false,
          fs: false,
        },
      },
    },
    plugins: [
      new webpack.DefinePlugin({
        process: { argv: [] },
      }),
      new webpack.ProvidePlugin({
        Buffer: ["buffer", "Buffer"],
      }),
    ],
  },
};
