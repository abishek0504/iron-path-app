const { withXcodeProject } = require('expo/config-plugins');

const WATCH_TARGET_NAME = 'IronPathWatch';

/**
 * @bacons/apple-targets currently sets TARGETED_DEVICE_FAMILY=1 (iPhone) on the
 * watchOS target. Apple Watch requires 4.
 */
function withWatchTargetDeviceFamily(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const nativeTargets = project.pbxNativeTargetSection();
    const configLists = project.pbxXCConfigurationList();
    const buildConfigs = project.pbxXCBuildConfigurationSection();

    for (const key of Object.keys(nativeTargets)) {
      if (key.endsWith('_comment')) continue;

      const target = nativeTargets[key];
      if (target.name !== WATCH_TARGET_NAME) continue;

      const configList = configLists[target.buildConfigurationList];
      if (!configList?.buildConfigurations) continue;

      for (const configRef of configList.buildConfigurations) {
        const buildConfig = buildConfigs[configRef.value];
        if (buildConfig?.buildSettings?.SDKROOT === 'watchos') {
          buildConfig.buildSettings.TARGETED_DEVICE_FAMILY = '4';
        }
      }
    }

    return config;
  });
}

module.exports = withWatchTargetDeviceFamily;
