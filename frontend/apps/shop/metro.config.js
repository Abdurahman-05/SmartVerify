const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// The shared code lives in frontend/src (two folders up).
const shared = path.resolve(__dirname, '../..');
const config = getDefaultConfig(__dirname);
// Expo watches only the workspaces and node_modules: add the shared code and images, or
// changes there would not reload the app.
config.watchFolders = [
  ...config.watchFolders,
  path.join(shared, 'src'),
  path.join(shared, 'assets'),
];

module.exports = withNativeWind(config, {
  input: path.join(shared, 'src/global.css'),
});
