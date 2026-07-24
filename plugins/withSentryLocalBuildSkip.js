const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const XCODE_ENV_MARKER = '# ironpath-sentry-local-build-skip';
const XCODE_ENV_BODY = `${XCODE_ENV_MARKER}
# Skip Sentry uploads locally; EAS production injects SENTRY_AUTH_TOKEN.
if [ -n "$SENTRY_AUTH_TOKEN" ]; then
  export SENTRY_DISABLE_AUTO_UPLOAD=false
else
  export SENTRY_DISABLE_AUTO_UPLOAD=true
fi
`;

function upsertMarkedBlock(filePath, body, marker) {
  let contents = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const markerIndex = contents.indexOf(marker);

  if (markerIndex >= 0) {
    contents = contents.slice(0, markerIndex).replace(/\s*$/, '\n');
  } else if (contents.length > 0 && !contents.endsWith('\n')) {
    contents += '\n';
  }

  fs.writeFileSync(filePath, `${contents}\n${body}`);
}

/**
 * Local Release builds should not fail when SENTRY_AUTH_TOKEN is absent.
 * EAS production injects the token; uploads run there only.
 */
function withSentryLocalBuildSkip(config) {
  return withFinalizedMod(config, [
    'ios',
    async (config) => {
      const iosRoot = config.modRequest.platformProjectRoot;

      upsertMarkedBlock(path.join(iosRoot, '.xcode.env'), XCODE_ENV_BODY, XCODE_ENV_MARKER);
      upsertMarkedBlock(
        path.join(iosRoot, '.xcode.env.updates'),
        XCODE_ENV_BODY,
        XCODE_ENV_MARKER
      );

      return config;
    },
  ]);
}

module.exports = withSentryLocalBuildSkip;
