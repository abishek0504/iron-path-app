import type { UserProfile } from '../../stores/userStore';

/** True when the profile is in the soft-delete grace window (purge not yet due). */
export function isAccountPendingDeletion(profile: UserProfile | null | undefined): boolean {
  if (!profile?.deleted_at || !profile.scheduled_purge_at) return false;
  return new Date(profile.scheduled_purge_at).getTime() > Date.now();
}
