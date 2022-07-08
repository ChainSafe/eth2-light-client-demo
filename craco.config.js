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
          '@chainsafe/blst': false, // @chainsafe/blst is a peer dependency which is not needed in a browser environment
          http: require.resolve("stream-http"),
          https: require.resolve("https-browserify"),
          crypto: false,
          stream: false,
          url: false,
          os: false,
          path: false,
          zlib: false,
          fs: false
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
