const { withPodfile } = require('expo/config-plugins');

const PODFILE_MARKER = 'ironpath-ios-warning-suppression';

const PODFILE_SNIPPET = `
    # ${PODFILE_MARKER} -- suppress third-party pod warnings
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        bc.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
        bc.build_settings['SWIFT_SUPPRESS_WARNINGS'] = 'YES'
      end
      target.build_phases.each do |phase|
        if phase.is_a?(Xcodeproj::Project::Object::PBXShellScriptBuildPhase)
          if phase.name&.include?('Hermes')
            phase.always_out_of_date = '1'
          end
        end
      end
    end
`;

function withIosDependencyWarnings(config) {
  return withPodfile(config, (config) => {
    if (config.modResults.contents.includes(PODFILE_MARKER)) {
      return config;
    }

    const anchor = /react_native_post_install\([\s\S]*?\)\n/;
    if (!anchor.test(config.modResults.contents)) {
      throw new Error(
        `${PODFILE_MARKER}: could not find react_native_post_install in Podfile`
      );
    }

    config.modResults.contents = config.modResults.contents.replace(
      anchor,
      (match) => `${match}${PODFILE_SNIPPET}`
    );

    return config;
  });
}

module.exports = withIosDependencyWarnings;
