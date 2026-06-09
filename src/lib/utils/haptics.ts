/**
 * Tiny haptics wrapper.
 *
 * Centralizes expo-haptics so callers don't have to memorize the impact/notification API,
 * and so non-iOS / web platforms become no-ops (Android limited support; web has none).
 *
 * All calls are intentionally fire-and-forget: haptics should never block UX. Errors are
 * swallowed to keep the call site noise-free; expo-haptics surfaces only edge cases like
 * when the device has haptics disabled.
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const HAPTICS_ENABLED = Platform.OS === 'ios' || Platform.OS === 'android';

/** Light tap — use for tab presses, list-item selection, light toggles. */
export function hapticLight(): void {
  if (!HAPTICS_ENABLED) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** Medium tap — use for primary CTAs (Start Workout, Save, Submit). */
export function hapticMedium(): void {
  if (!HAPTICS_ENABLED) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

/** Heavy tap — reserved for high-importance, low-frequency interactions (e.g. Complete Set). */
export function hapticHeavy(): void {
  if (!HAPTICS_ENABLED) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
}

/** Success notification — use after a successful save / completion. */
export function hapticSuccess(): void {
  if (!HAPTICS_ENABLED) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

/** Warning notification — use for destructive confirmations (Reset, Delete). */
export function hapticWarning(): void {
  if (!HAPTICS_ENABLED) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
}

/** Error notification — use after a failed operation worth signaling tactilely. */
export function hapticError(): void {
  if (!HAPTICS_ENABLED) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
}

/** Selection change — use for picker / segmented control transitions. */
export function hapticSelection(): void {
  if (!HAPTICS_ENABLED) return;
  void Haptics.selectionAsync().catch(() => undefined);
}
