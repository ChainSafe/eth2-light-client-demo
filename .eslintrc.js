module.exports = {
  root: true,
  env: {
    browser: true,
    es6: true,
    node: true,
    mocha: true,
  },
  globals: {
    BigInt: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 10,
    project: "./tsconfig.json",
  },
  plugins: ["prettier"],
  extends: [],
  rules: {
    "prettier/prettier": "error",
    "no-console": "warn",
  },
  settings: {},
  overrides: [],
};
