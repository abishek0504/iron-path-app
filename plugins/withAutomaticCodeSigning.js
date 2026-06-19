const { withXcodeProject, IOSConfig } = require('expo/config-plugins');

/**
 * Ensures every signable iOS target uses automatic code signing with the team
 * from app.json. Prebuild sets DEVELOPMENT_TEAM but can leave CODE_SIGN_STYLE unset
 * on the main app target (watch target from @bacons/apple-targets gets Automatic).
 */
function withAutomaticCodeSigning(config) {
  const appleTeamId = config.ios?.appleTeamId;
  if (!appleTeamId) {
    return config;
  }

  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const targets = IOSConfig.Target.findSignableTargets(project);
    const quotedTeamId = appleTeamId.match(/^['"]/) ? appleTeamId : `"${appleTeamId}"`;

    for (const [nativeTargetId, nativeTarget] of targets) {
      IOSConfig.XcodeUtils.getBuildConfigurationsForListId(
        project,
        nativeTarget.buildConfigurationList
      )
        .filter(([, item]) => item.buildSettings.PRODUCT_NAME)
        .forEach(([, item]) => {
          item.buildSettings.DEVELOPMENT_TEAM = quotedTeamId;
          item.buildSettings.CODE_SIGN_STYLE = 'Automatic';
        });

      Object.entries(IOSConfig.XcodeUtils.getProjectSection(project))
        .filter(IOSConfig.XcodeUtils.isNotComment)
        .forEach(([, item]) => {
          if (!item.attributes.TargetAttributes) {
            item.attributes.TargetAttributes = {};
          }
          if (!item.attributes.TargetAttributes[nativeTargetId]) {
            item.attributes.TargetAttributes[nativeTargetId] = {};
          }
          item.attributes.TargetAttributes[nativeTargetId].DevelopmentTeam =
            quotedTeamId;
          item.attributes.TargetAttributes[nativeTargetId].ProvisioningStyle =
            'Automatic';
        });
    }

    return config;
  });
}

module.exports = withAutomaticCodeSigning;
