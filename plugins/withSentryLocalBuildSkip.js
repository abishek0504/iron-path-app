const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const XCODE_ENV_UPDATES_MARKER = '# ironpath-sentry-local-build-skip';
const XCODE_ENV_UPDATES_BODY = `${XCODE_ENV_UPDATES_MARKER}
# Skip Sentry uploads locally when SENTRY_AUTH_TOKEN is unset (EAS production sets this secret).
if [ -z "$SENTRY_AUTH_TOKEN" ]; then
  export SENTRY_DISABLE_AUTO_UPLOAD=true
fi
`;

/**
 * Local Release builds should not fail when SENTRY_AUTH_TOKEN is absent.
 * EAS production injects the token; uploads run there only.
 */
function withSentryLocalBuildSkip(config) {
  return withFinalizedMod(config, [
    'ios',
    async (config) => {
      const updatesPath = path.join(
        config.modRequest.platformProjectRoot,
        '.xcode.env.updates'
      );

      let contents = '';
      if (fs.existsSync(updatesPath)) {
        contents = fs.readFileSync(updatesPath, 'utf8');
      }

      if (!contents.includes(XCODE_ENV_UPDATES_MARKER)) {
        const separator = contents.length > 0 && !contents.endsWith('\n') ? '\n' : '';
        fs.writeFileSync(updatesPath, `${contents}${separator}${XCODE_ENV_UPDATES_BODY}`);
      }

      return config;
    },
  ]);
}

module.exports = withSentryLocalBuildSkip;
