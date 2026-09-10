const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const STOREKIT_FILE_NAME = 'IronPath.storekit';
const FILE_REF_ID = '8F3A1C2B0D4E5F6789AB0001';
// Xcode resolves this relative to the .xcworkspace bundle (ios/IronPath.xcworkspace).
const SCHEME_REF = '../IronPath.storekit';

function copyStoreKitFile(projectRoot, iosRoot) {
  const src = path.join(projectRoot, 'plugins', STOREKIT_FILE_NAME);
  const dest = path.join(iosRoot, STOREKIT_FILE_NAME);
  if (!fs.existsSync(src)) {
    return;
  }
  fs.copyFileSync(src, dest);
}

function ensurePbxFileReference(iosRoot) {
  const pbxprojPath = path.join(iosRoot, 'IronPath.xcodeproj', 'project.pbxproj');
  if (!fs.existsSync(pbxprojPath)) {
    return;
  }

  let contents = fs.readFileSync(pbxprojPath, 'utf8');
  const fileRefLine = `\t\t${FILE_REF_ID} /* ${STOREKIT_FILE_NAME} */ = {isa = PBXFileReference; lastKnownFileType = text.json; path = ${STOREKIT_FILE_NAME}; sourceTree = "<group>"; };\n`;
  const childLine = `\t\t\t\t${FILE_REF_ID} /* ${STOREKIT_FILE_NAME} */,\n`;

  if (!contents.includes(`${FILE_REF_ID} /* ${STOREKIT_FILE_NAME} */ = {isa = PBXFileReference`)) {
    contents = contents.replace(
      /\/\* Begin PBXFileReference section \*\/\n/,
      `/* Begin PBXFileReference section */\n${fileRefLine}`,
    );
  }

  if (!contents.includes(childLine)) {
    contents = contents.replace(
      /(83CBB9F61A601CBA00E9B192 = \{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = \(\n)/,
      `$1${childLine}`,
    );
  }

  fs.writeFileSync(pbxprojPath, contents);
}

function patchScheme(schemePath) {
  let xml = fs.readFileSync(schemePath, 'utf8');
  const block = `      <StoreKitConfigurationFileReference\n         identifier = "${SCHEME_REF}">\n      </StoreKitConfigurationFileReference>\n`;

  xml = xml.replace(
    /\s*<StoreKitConfigurationFileReference[\s\S]*?<\/StoreKitConfigurationFileReference>\n/g,
    '\n',
  );

  xml = xml.replace(/(<LaunchAction[\s\S]*?>\n)/, `$1${block}`);
  xml = xml.replace(/(<TestAction[\s\S]*?>\n)/, `$1${block}`);

  fs.writeFileSync(schemePath, xml);
}

function attachStoreKitToSchemes(iosRoot) {
  const schemesDir = path.join(
    iosRoot,
    'IronPath.xcodeproj',
    'xcshareddata',
    'xcschemes',
  );
  if (!fs.existsSync(schemesDir)) {
    return;
  }

  for (const name of fs.readdirSync(schemesDir)) {
    if (!name.endsWith('.xcscheme')) continue;
    if (name.includes('Watch')) continue;
    patchScheme(path.join(schemesDir, name));
  }
}

function withStoreKitConfig(config) {
  return withFinalizedMod(config, [
    'ios',
    async (config) => {
      const iosRoot = config.modRequest.platformProjectRoot;
      copyStoreKitFile(config.modRequest.projectRoot, iosRoot);
      ensurePbxFileReference(iosRoot);
      attachStoreKitToSchemes(iosRoot);
      return config;
    },
  ]);
}

module.exports = withStoreKitConfig;
