const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const appDirectory = __dirname;

// Only our own source goes through Babel; dependencies ship prebuilt JS
const babelLoaderConfiguration = {
  test: /\.[jt]sx?$/,
  include: [
    path.resolve(appDirectory, 'index.web.js'),
    path.resolve(appDirectory, 'src'),
  ],
  use: {
    loader: 'babel-loader',
    options: {
      cacheDirectory: true,
      // Extends babel.config.js (RN preset + react-native-dotenv for @env)
      plugins: ['react-native-web'],
    },
  },
};

// Some React Native libraries (e.g. async-storage) ship ES modules whose
// imports leave out the file extension, which Metro allows but webpack
// rejects inside "type": "module" packages by default
const extensionlessEsmConfiguration = {
  test: /\.m?js$/,
  resolve: { fullySpecified: false },
};

const imageLoaderConfiguration = {
  test: /\.(gif|jpe?g|png|svg)$/,
  type: 'asset/resource',
};

module.exports = (env, argv) => {
  const isDev = argv.mode !== 'production';

  return {
    entry: path.resolve(appDirectory, 'index.web.js'),
    output: {
      path: path.resolve(appDirectory, 'web-build'),
      filename: 'bundle.[contenthash].js',
      clean: true,
    },
    devtool: isDev ? 'eval-cheap-module-source-map' : 'source-map',
    module: {
      rules: [
        babelLoaderConfiguration,
        extensionlessEsmConfiguration,
        imageLoaderConfiguration,
      ],
    },
    resolve: {
      alias: {
        'react-native$': 'react-native-web',
      },
      // .web.* files override their native counterparts
      extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(appDirectory, 'web/index.html'),
        // Generated from assets/brand (scripts/generate-icons.sh)
        favicon: path.resolve(appDirectory, 'assets/brand/app-icon.svg'),
      }),
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(isDev),
      }),
    ],
    devServer: {
      port: 8080,
      historyApiFallback: true,
      hot: true,
    },
  };
};
