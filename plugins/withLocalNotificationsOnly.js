const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * IronPath uses local scheduled reminders only (no APNs / remote push).
 * expo-notifications adds aps-environment by default, which requires a Push
 * Notifications provisioning profile. Strip it so device builds sign cleanly.
 */
function withLocalNotificationsOnly(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
}

module.exports = withLocalNotificationsOnly;
