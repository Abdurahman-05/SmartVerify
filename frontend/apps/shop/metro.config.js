const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// The shared code lives in frontend/src (two folders up); Expo watches the whole workspace.
const shared = path.resolve(__dirname, '../..');
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: path.join(shared, 'src/global.css'),
  configPath: path.join(shared, 'tailwind.config.js'),
});
