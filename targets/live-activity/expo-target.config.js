/**
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
  type: 'widget',
  name: 'IronPathLiveActivity',
  displayName: 'IronPath Rest',
  bundleIdentifier: '.liveactivity',
  deploymentTarget: '16.2',
  icon: '../../assets/icon.png',
  colors: {
    $accent: '#a3e635',
  },
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
  entitlements: {
    'com.apple.security.application-groups': ['group.com.alexpreo.ironpath.shared'],
    NSSupportsLiveActivities: true,
  },
  infoPlist: {
    NSSupportsLiveActivities: true,
  },
};
