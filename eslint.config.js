// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/**",
      "Archive/**",
      "node_modules/**",
      ".expo/**",
      "web-build/**",
      ".expo/types/**",
      // Deno edge functions use JSR imports; not resolvable by Node ESLint.
      "supabase/functions/**",
      // Metro requires static require() for bundled image assets.
      "src/lib/exerciseImages.ts",
    ],
  },
  {
    files: [
      "app/(stack)/workout/active.tsx",
      "app/_layout.tsx",
      "src/components/visualizations/BodyHeatmap.tsx",
      "src/components/workout/ExerciseTimer.tsx",
      "src/lib/subscriptions/revenueCat.ts",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
