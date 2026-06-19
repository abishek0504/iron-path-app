const {
  withEntitlementsPlist,
  withFinalizedMod,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function stripApsEnvironmentFromPlist(contents) {
  return contents
    .replace(/\s*<key>aps-environment<\/key>\s*<string>[^<]*<\/string>\s*/g, '\n')
    .replace(/\s*<key>aps-environment<\/key>\s*<string\/>?\s*/g, '\n');
}

function stripEntitlementsFile(platformProjectRoot) {
  const entitlementsPath = path.join(
    platformProjectRoot,
    'IronPath',
    'IronPath.entitlements'
  );

  if (!fs.existsSync(entitlementsPath)) {
    return;
  }

  const original = fs.readFileSync(entitlementsPath, 'utf8');
  const updated = stripApsEnvironmentFromPlist(original);
  if (updated !== original) {
    fs.writeFileSync(entitlementsPath, updated);
  }
}

/**
 * IronPath uses local scheduled reminders only (no APNs / remote push).
 * expo-notifications adds aps-environment by default, which requires a Push
 * Notifications provisioning profile. Personal/free teams cannot sign with it.
 */
function withLocalNotificationsOnly(config) {
  config = withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });

  return withFinalizedMod(config, [
    'ios',
    async (config) => {
      stripEntitlementsFile(config.modRequest.platformProjectRoot);
      return config;
    },
  ]);
}

module.exports = withLocalNotificationsOnly;
