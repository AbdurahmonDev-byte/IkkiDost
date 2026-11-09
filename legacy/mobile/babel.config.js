const { expoRouterBabelPlugin } = require('babel-preset-expo/build/expo-router-plugin');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // babel-preset-expo only auto-enables its router transform when
    // `expo-router` resolves from the preset's own location. In this npm
    // workspace the router lives in apps/mobile/node_modules, so enable the
    // same plugin explicitly (it reads the router root from the Babel caller).
    plugins: [expoRouterBabelPlugin],
  };
};
