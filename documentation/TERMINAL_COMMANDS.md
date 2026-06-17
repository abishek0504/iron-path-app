# Terminal Commands Reference

Quick reminder sheet for commands used most often on IronPath and day-to-day dev.  
Run these from the project root (`iron-path-app/`) unless noted otherwise.

---

## Daily development (IronPath)

| Command | What it does | When to use |
|---------|--------------|-------------|
| `cd ~/Documents/GitHub/iron-path-app` | Go to the project folder | Start of every session |
| `npm install` | Install / update dependencies from `package.json` | After `git pull` if packages changed, or fresh clone |
| `npm start` | Start Expo dev server (`expo start`) | Web preview or Expo Go |
| `npm run start:dev` | Start Expo with dev-client (`expo start --dev-client`) | **Most common** — custom native dev build (HealthKit, watch, etc.) |
| `npm run web` | Start Expo for web (`expo start --web`) | Fast UI/layout testing in browser at http://localhost:8081 |
| `node scripts/dev-log-server.js` | Run dev log server on port 3333 | Second terminal while on web — `devLog` output shows in terminal instead of browser console |

### While Metro is running (keyboard shortcuts in the Expo terminal)

| Key | What it does |
|-----|--------------|
| `i` | Open iOS simulator |
| `a` | Open Android emulator |
| `w` | Open web |
| `r` | Reload the app |
| `j` | Open debugger |
| `m` | Toggle dev menu |
| `Ctrl+C` | Stop the dev server |

---

## iOS builds & simulator

| Command | What it does | When to use |
|---------|--------------|-------------|
| `npm run ios` | Build and run native iOS dev app (`expo run:ios`) | Simulator or default device |
| `npm run ios:simulator` | Boot iPhone 17 Pro Max simulator, then open Simulator app | Before `npm run ios` if simulator is closed |
| `npm run ios:device` | Run on physical device named `iPhone 17 Pro Max` | Scripted device name from `package.json` |
| `npx expo run:ios --device` | Build & install dev build on a connected iPhone | Physical device testing (pick device from list) |
| `npx expo run:ios --device "Alex's iPhone" --configuration Release` | Release build installed on a specific device | Test performance / watch / HealthKit like production |
| `npm run prebuild:ios` | Regenerate `ios/` from Expo config (`expo prebuild --platform ios --clean`) | After native config changes (watch target, plugins, entitlements) |
| `npm run prebuild:android` | Regenerate `android/` (`expo prebuild --platform android --clean`) | Same, for Android |
| `npm run prebuild:all` | Regenerate both platforms (`expo prebuild --clean`) | Big native changes affecting both platforms |
| `cd ios && pod install && cd ..` | Install / update CocoaPods | iOS build fails with pod-related errors |
| `xcrun simctl list devices` | List all simulators and their state | Find exact simulator name or UDID |
| `open -a Simulator` | Open the iOS Simulator app | Manually launch simulator |

---

## Android

| Command | What it does | When to use |
|---------|--------------|-------------|
| `npm run android` | Build and run on Android emulator/device (`expo run:android`) | Android testing |
| `cd android && ./gradlew clean && cd ..` | Clean Android Gradle build | Android build cache issues |

---

## EAS (cloud builds & App Store)

| Command | What it does | When to use |
|---------|--------------|-------------|
| `npx eas-cli@latest login` | Log in to your Expo account | First time or after token expiry |
| `npm run eas:dev:ios` | EAS development build for iOS simulator | Cloud dev client when local build is slow |
| `npm run eas:dev:android` | EAS development build for Android | Same for Android |
| `npx eas-cli@latest build --profile production --platform ios` | Production iOS build on EAS | App Store / TestFlight |
| `npx eas-cli@latest build --profile production --platform android` | Production Android build on EAS | Play Store |
| `npx eas-cli@latest build --profile preview --platform ios` | Internal preview build | Share with testers |
| `npx eas-cli@latest submit --platform ios --profile production` | Upload latest build to App Store Connect | After a successful production build |

Profiles live in `eas.json`: `development`, `preview`, `production`, `development-simulator`.

---

## Supabase (database, functions, types)

| Command | What it does | When to use |
|---------|--------------|-------------|
| `npx supabase login` | Authenticate Supabase CLI | First-time CLI setup |
| `npx supabase link --project-ref YOUR_PROJECT_REF` | Link local project to remote Supabase | One-time per machine |
| `npx supabase db push` | Apply local migrations to linked project | Deploy schema changes via CLI |
| `npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.gen.ts` | Regenerate TypeScript types from DB schema | **After every migration** — keeps types in sync |
| `npx supabase functions deploy generate-workout` | Deploy AI workout generation edge function | After editing `supabase/functions/generate-workout` |
| `npx supabase functions deploy update-muscle-freshness` | Deploy freshness recomputation function | After editing that function |
| `npx supabase functions deploy delete-account` | Deploy account deletion function | After editing that function |
| `npx supabase functions deploy revenuecat-webhook --no-verify-jwt` | Deploy RevenueCat webhook (no JWT verify) | Subscription sync setup |
| `npx supabase secrets set OPENAI_API_KEY=sk-...` | Set a secret for edge functions | One-time or key rotation |
| `npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=...` | Set webhook verification secret | Subscription setup |

**Preferred in Cursor:** use Supabase MCP `apply_migration` for migrations instead of manual SQL in the dashboard.

---

## Code quality & tests

| Command | What it does | When to use |
|---------|--------------|-------------|
| `npm run lint` | TypeScript check (`tsc --noEmit`) | Before commit — catch type errors |
| `npm run lint:eslint` | ESLint via Expo (`expo lint`) | Style / lint issues |
| `npm test` | Run Vitest suite (`vitest run`) | After logic changes with tests |
| `npx tsc --noEmit` | Same as `npm run lint` | Direct TypeScript check |

---

## Git & GitHub

| Command | What it does | When to use |
|---------|--------------|-------------|
| `git status` | Show changed / untracked files | Before every commit |
| `git diff` | Show unstaged changes | Review what you changed |
| `git diff --staged` | Show staged changes | Before commit |
| `git pull` | Fetch and merge remote changes | Start of day / before new work |
| `git checkout -b feature/my-feature` | Create and switch to a new branch | New feature or fix |
| `git checkout V2-Dev` | Switch to main dev branch | IronPath active development branch |
| `git add path/to/file` | Stage specific files | Selective commit |
| `git add -A` | Stage all changes | Commit everything intentional |
| `git commit -m "Short description of why"` | Create a commit | After staging |
| `git push -u origin HEAD` | Push current branch and set upstream | First push of a new branch |
| `git push` | Push commits to remote | After commit |
| `git log --oneline -10` | Last 10 commits, one line each | See recent history |
| `git stash` | Temporarily shelve uncommitted changes | Switch branches with dirty tree |
| `git stash pop` | Restore stashed changes | After switching back |

### GitHub CLI (`gh`)

| Command | What it does | When to use |
|---------|--------------|-------------|
| `gh pr create --title "Title" --body "Summary"` | Open a pull request | Ready to merge `V2-Dev` → `main` |
| `gh pr list` | List open PRs | Check PR status |
| `gh pr view 123` | View PR details | Review a specific PR |
| `gh pr checks` | Show CI status on current branch PR | Debug failing checks |
| `gh issue list` | List issues | Track bugs / tasks |

---

## Troubleshooting & cache clears

| Command | What it does | When to use |
|---------|--------------|-------------|
| `npx expo start --clear` | Start Metro with cache cleared | "Unable to resolve module", stale bundle |
| `rm -rf node_modules/.cache` | Delete Metro cache folder | Persistent cache issues |
| `rm -rf node_modules && npm install` | Full dependency reinstall | Broken or mismatched packages |
| `npm start -- --tunnel` | Expo dev server via tunnel | Physical device can't reach your Mac on LAN |
| `npx expo export --platform web` | Static web export to `dist/` | Production web build |

---

## Project scripts & tooling

| Command | What it does | When to use |
|---------|--------------|-------------|
| `node scripts/generate-exercise-import-sql.mjs` | Regenerate exercise import SQL from master CSV | Updating exercise catalog from seed CSV |
| `npm install package-name` | Add a new dependency | Adding a library — restart dev server after |

---

## Cursor & Claude (terminal)

| Command | What it does | When to use |
|---------|--------------|-------------|
| `cursor .` | Open current folder in Cursor | Open project from terminal |
| `claude` | Start Claude Code CLI session | Terminal-based AI coding |
| `claude --resume SESSION_ID` | Resume a previous Claude session | Continue where you left off (ID shown when you exit) |
| `claude mcp add` | Add an MCP server to Claude Code | Wire up Supabase or other tools |

---

## General macOS terminal (handy everywhere)

| Command | What it does | When to use |
|---------|--------------|-------------|
| `ls -la` | List all files including hidden, with details | Inspect folder contents |
| `pwd` | Print current directory | Confirm where you are |
| `cd ..` | Go up one directory | Navigate out of a subfolder |
| `mkdir my-folder` | Create a directory | New folder |
| `cp source dest` | Copy file | Backup or duplicate |
| `mv source dest` | Move or rename | Rename files / move |
| `rm file` | Delete file (permanent) | Remove a file — no trash |
| `rm -rf folder` | Delete folder and contents (permanent) | Remove directory — use carefully |
| `cat file.txt` | Print file contents | Quick read in terminal |
| `grep -r "searchterm" src/` | Search text recursively in folder | Find code by string |
| `which node` | Show path to `node` binary | Check Node is installed / which version path |
| `node -v` | Node.js version | Verify Node version (need 20+) |
| `npm -v` | npm version | Verify package manager |
| `killall node` | Force-stop all Node processes | Stuck Metro / dev servers won't die |
| `lsof -i :8081` | What's using port 8081 (Metro) | Port already in use |
| `source ~/.zshrc` | Reload shell config | After editing `.zshrc` (e.g. PATH changes) |

---

## Typical IronPath session (copy-paste flow)

```bash
cd ~/Documents/GitHub/iron-path-app
git pull
npm install                    # only if package.json changed
npm run ios:simulator          # optional — boot simulator first
npm run start:dev              # terminal 1 — Metro
# OR for device release testing:
npx expo run:ios --device "Alex's iPhone" --configuration Release
```

Before committing schema work:

```bash
npm run lint
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.gen.ts
```

---

*Last updated: 2026-06-16 — add commands here as your workflow evolves.*
