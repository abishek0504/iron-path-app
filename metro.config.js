const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

config.resolver = {
  ...config.resolver,
  blockList: [/Archive\/.*/],
};
config.watchFolders = (config.watchFolders || []).filter(
  (folder) => !folder.includes('Archive')
);

module.exports = config;
