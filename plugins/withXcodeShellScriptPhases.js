const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const WARNING_C_FLAGS =
  '$(inherited) -Wno-nullability-completeness -Wno-nonportable-include-path -Wno-deprecated-declarations -Wno-undeclared-selector -Wno-protocol -Wno-incomplete-implementation -Wno-objc-protocol-property-synthesis -Wno-duplicate-method-match';

function patchPbxproj(platformProjectRoot) {
  const pbxprojPath = path.join(
    platformProjectRoot,
    'IronPath.xcodeproj',
    'project.pbxproj'
  );

  if (!fs.existsSync(pbxprojPath)) {
    return;
  }

  let contents = fs.readFileSync(pbxprojPath, 'utf8');

  if (!contents.includes('-Wno-nullability-completeness')) {
    const flagsBlock =
      `\t\t\t\tOTHER_CFLAGS = "${WARNING_C_FLAGS}";\n` +
      '\t\t\t\tSWIFT_SUPPRESS_WARNINGS = YES;\n';

    contents = contents.replace(
      /(PRODUCT_BUNDLE_IDENTIFIER = com\.alexpreo\.ironpath;\n\t\t\t\tPRODUCT_NAME = IronPath;[\s\S]*?)(\t\t\t\};)/g,
      (match, body, close) => {
        if (body.includes('-Wno-nullability-completeness')) {
          return match;
        }
        return body + flagsBlock + close;
      }
    );
  }

  if (
    contents.includes('/* Upload Debug Symbols to Sentry */') &&
    !contents.match(
      /\/\* Upload Debug Symbols to Sentry \*\/[\s\S]{0,200}alwaysOutOfDate/
    )
  ) {
    contents = contents.replace(
      /(\/\* Upload Debug Symbols to Sentry \*\/ = \{\n\t\t\tisa = PBXShellScriptBuildPhase;)/,
      '$1\n\t\t\talwaysOutOfDate = 1;'
    );
  }

  fs.writeFileSync(pbxprojPath, contents);
}

function withXcodeShellScriptPhases(config) {
  return withFinalizedMod(config, [
    'ios',
    async (config) => {
      patchPbxproj(config.modRequest.platformProjectRoot);
      return config;
    },
  ]);
}

module.exports = withXcodeShellScriptPhases;
