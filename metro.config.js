// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude Archive folder from Metro bundler
config.watchFolders = config.watchFolders || [];
config.resolver = {
  ...config.resolver,
  blockList: [
    // Exclude Archive folder
    /Archive\/.*/,
  ],
};

// Exclude Archive from file watching
config.watchFolders = config.watchFolders.filter(
  (folder) => !folder.includes('Archive')
);

module.exports = config;

