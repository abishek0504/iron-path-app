const { withPodfile } = require('expo/config-plugins');

const PODFILE_MARKER = 'ironpath-ios-warning-suppression';
const MIN_IOS_DEPLOYMENT_TARGET = '15.0';

const PODFILE_SNIPPET = `
    # ${PODFILE_MARKER} -- suppress third-party pod warnings
    installer.pods_project.build_configurations.each do |bc|
      current = bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
      if current.nil? || current.to_f < ${MIN_IOS_DEPLOYMENT_TARGET}.to_f
        bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS_DEPLOYMENT_TARGET}'
      end
      # Xcode 27's explicit-modules pipeline crashes C pods such as libwebp.
      bc.build_settings['CLANG_ENABLE_EXPLICIT_MODULES'] = 'NO'
    end
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        bc.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
        bc.build_settings['SWIFT_SUPPRESS_WARNINGS'] = 'YES'
        bc.build_settings['CLANG_ENABLE_EXPLICIT_MODULES'] = 'NO'
        bc.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO'
        current = bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || current.to_f < ${MIN_IOS_DEPLOYMENT_TARGET}.to_f
          bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS_DEPLOYMENT_TARGET}'
        end
      end
      target.build_phases.each do |phase|
        if phase.is_a?(Xcodeproj::Project::Object::PBXShellScriptBuildPhase)
          if phase.name&.include?('Hermes')
            phase.always_out_of_date = '1'
          end
        end
      end
    end

    # RevenueCat 5.32: Xcode 27 synthesizes init(stringRepresentation:) and
    # collides with the public throwing initializer (fixed upstream in 5.78.0).
    revenuecat_root = installer.sandbox.pod_dir('RevenueCat')
    if revenuecat_root
      paywall_color = File.join(revenuecat_root.to_s, 'Sources/Paywalls/PaywallColor.swift')
      if File.exist?(paywall_color)
        contents = File.read(paywall_color)
        designated = [
          '    /// "Designated" initializer',
          '    private init(stringRepresentation: String, underlyingColor: (any Sendable)?) {',
          '        self.stringRepresentation = stringRepresentation',
          '        self._underlyingColor = underlyingColor',
          '    }',
        ].join("\\n")
        marker = '    fileprivate var _underlyingColor: (any Sendable)?'
        already_patched = contents.include?("#{marker}\\n\\n#{designated}")
        unless already_patched
          if contents.include?(designated)
            contents = contents.sub("\\n#{designated}\\n", "\\n")
            contents = contents.sub("#{marker}\\n", "#{marker}\\n\\n#{designated}\\n")
            File.chmod(0644, paywall_color)
            File.write(paywall_color, contents)
          end
        end
      end
    end
`;

const EXISTING_BLOCK = /\n    # ironpath-ios-warning-suppression[\s\S]*?(?=\n  end\n)/;

function withIosDependencyWarnings(config) {
  return withPodfile(config, (config) => {
    if (config.modResults.contents.includes(PODFILE_MARKER)) {
      config.modResults.contents = config.modResults.contents.replace(
        EXISTING_BLOCK,
        PODFILE_SNIPPET
      );
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
