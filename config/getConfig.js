// Generate Webpack config, dependending on the environment (development or production)
// The exported function is used by `webpack.*.config.js` files.

const path = require('path')
const webpack = require('webpack')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const autoprefixer = require('autoprefixer')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const WebpackMonitor = require('webpack-monitor')

const getFullPage = require('../scripts/build/getFullPage')
const constants = require('./constants')
const packageJson = require('../package.json')

const USE_PREACT = true
const USE_MONITOR = false

function getPlugins(env) {
  // Rather than importing the whole package.json in the source code,
  // we make available a global variable `PACKAGEJSON_VERSION`
  const envPlugin = new webpack.DefinePlugin({
    PACKAGEJSON_VERSION: JSON.stringify(packageJson.version),
    'process.env': {
      NODE_ENV: JSON.stringify(env),
      VERSION: JSON.stringify(packageJson.version),
      GITHUB_URL: JSON.stringify(packageJson.repository.url),
      USE_PREACT
    }
  })
  const monitor =
    USE_MONITOR &&
    new WebpackMonitor({
      launch: true, // -> default 'false'
      port: 3030 // default -> 8081
    })
  const concatPlugin = new webpack.optimize.ModuleConcatenationPlugin()
  const plugins = [envPlugin, concatPlugin]
  if (env === 'development') {
    // plugins.push(monitor)
    plugins.push(new webpack.HotModuleReplacementPlugin())
    plugins.push(new webpack.NamedModulesPlugin())
    // Get the html template
    const html = getFullPage({ isDev: true })
    plugins.push(
      new HtmlWebpackPlugin({
        inject: false,
        templateContent: html
      })
    )
  } else {
    // ExtractTextPlugin used to generate a separate CSS file, in production only.
    // documentation: http://webpack.github.io/docs/stylesheets.html
    plugins.push(new ExtractTextPlugin('build/[name].css'))
    if (USE_MONITOR) plugins.push(monitor)

    // Do not display warning messages from Uglify
    plugins.push(
      new webpack.optimize.UglifyJsPlugin({
        sourceMap: true,
        compress: {
          warnings: false
        }
      })
    )
  }

  return plugins
}

function getRules(env) {
  // transform-runtime plugin is required to perform module async loading
  const plugins = ['transform-runtime'].concat(
    USE_PREACT ? [] : 'react-hot-loader/babel'
  )
  const jsRule = {
    test: /\.jsx?$/,
    exclude: /node_modules/,
    use: [
      {
        loader: 'babel-loader',
        options: {
          babelrc: false, // required otherwise src/.babelrc settings will be used
          presets: [['es2015', { modules: false }], 'react-app'],
          plugins
        }
      }
    ]
  }
  const cssRule = {
    test: /\.css$/
  }
  const stylusRule = {
    test: /\.styl$/
  }

  const postCssLoader = {
    loader: 'postcss-loader',
    options: {
      plugins: function() {
        return [autoprefixer]
      }
    }
  }

  const urlRule = {
    test: /\.svg$/,
    use: { loader: 'url-loader', options: { limit: 5000 } }
  }

  if (env === 'development') {
    cssRule.use = [
      { loader: 'style-loader' },
      { loader: 'css-loader' },
      postCssLoader
    ]
    stylusRule.use = [
      { loader: 'style-loader' },
      { loader: 'css-loader' },
      { loader: 'stylus-loader' }
    ]
  } else {
    cssRule.use = ExtractTextPlugin.extract({
      fallback: 'style-loader',
      use: ['css-loader', postCssLoader]
    })
    stylusRule.use = ExtractTextPlugin.extract({
      fallback: 'style-loader',
      use: ['css-loader', postCssLoader, 'stylus-loader']
    })
  }
  const rules = [jsRule, stylusRule, cssRule, urlRule]
  return rules
}

function getEntry(env) {
  const devPipeline = [
    `webpack-dev-server/client?http://localhost:${constants.port}`,
    'webpack/hot/only-dev-server',
    './src/entry.js'
  ]
  return {
    app:
      env === 'development'
        ? (!USE_PREACT ? ['react-hot-loader/patch'] : []).concat(devPipeline)
        : './src/entry.js'
  }
}

function getOutput(env) {
  const rootPath = path.resolve(__dirname, '..', constants.staticFolder)
  const filename = 'build/bundle-[name].js'
  const output = {
    path: rootPath,
    filename,
    chunkFilename: filename,
    publicPath: '/'
  }
  return env === 'development'
    ? Object.assign({}, output, {
        publicPath: '/' // required when using browserHistory, to make nested URLs work
      })
    : output
}

const defaultResolveOptions = {
  extensions: ['.js', '.jsx']
}
const preactAlias = {
  react: 'preact-compat',
  'react-dom': 'preact-compat'
}
const resolve = Object.assign(
  {},
  defaultResolveOptions,
  USE_PREACT ? { alias: preactAlias } : {}
)

module.exports = function(env) {
  process.traceDeprecation = true
  const config = {
    entry: getEntry(env),
    target: env === 'test' ? 'node' : 'web', // necessary per https://webpack.github.io/docs/testing.html#compile-and-test
    output: getOutput(env),
    plugins: getPlugins(env),
    module: {
      rules: getRules(env)
    },
    resolve,
    devtool: env === 'development' ? 'eval' : 'source-map'
  }
  return config
}
