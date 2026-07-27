/**
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
  type: 'watch',
  name: 'IronPathWatch',
  displayName: 'IronPath',
  bundleIdentifier: '.watch',
  deploymentTarget: '10.0',
  icon: '../../assets/icon.png',
  colors: {
    $accent: '#a3e635',
  },
  entitlements: {
    'com.apple.developer.healthkit': true,
    'com.apple.security.application-groups': ['group.com.alexpreo.ironpath.shared'],
  },
  infoPlist: {
    NSHealthShareUsageDescription:
      'IronPath reads heart rate during workouts to show live effort on your watch and sync to Apple Health.',
    NSHealthUpdateUsageDescription:
      'IronPath writes strength training workouts and heart rate to Apple Health when you complete a session.',
  },
};
