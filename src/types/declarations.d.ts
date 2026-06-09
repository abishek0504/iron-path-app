/**
 * Module shims for transitive packages that don't ship type declarations.
 * Keep this file minimal — prefer official @types/* packages when available.
 */

// react-native-body-highlighter ships .tsx that imports a deep ramda path
// without an accompanying .d.ts; declare it as `any` so consumers compile.
declare module 'ramda/src/differenceWith';
