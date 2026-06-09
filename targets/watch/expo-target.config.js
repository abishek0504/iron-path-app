/**
 * IronPath watchOS companion (mirror app).
 *
 * Pure SwiftUI — React Native cannot run on watchOS. The watch mirrors the
 * active workout pushed from the phone over WCSession and sends set-completion
 * taps back; the phone remains the canonical writer to Supabase.
 *
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
  type: 'watch',
  name: 'IronPathWatch',
  displayName: 'IronPath',
  bundleIdentifier: '.watch',
  deploymentTarget: '9.4',
  icon: '../../assets/icon.png',
  colors: {
    $accent: '#a3e635',
  },
};
