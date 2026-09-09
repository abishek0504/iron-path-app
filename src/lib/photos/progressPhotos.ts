/**
 * Progress photo list / upload / delete against v2_progress_photos + avatars bucket.
 */

import { supabase } from '../supabase/client';
import { devError, devLog } from '../utils/logger';

export type ProgressPhoto = {
  id: string;
  user_id: string;
  storage_path: string;
  captured_at: string;
  note: string | null;
  created_at: string | null;
  public_url: string;
};

const AVATARS_BUCKET = 'avatars';

function publicUrlFor(storagePath: string): string {
  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function listProgressPhotos(userId: string): Promise<ProgressPhoto[]> {
  if (__DEV__) {
    devLog('progress-photos', { action: 'list', userId });
  }

  const { data, error } = await supabase
    .from('v2_progress_photos')
    .select('id, user_id, storage_path, captured_at, note, created_at')
    .eq('user_id', userId)
    .order('captured_at', { ascending: false });

  if (error) {
    if (__DEV__) {
      devError('progress-photos', error, { action: 'list', userId });
    }
    return [];
  }

  return (data ?? []).map((row) => ({
    ...row,
    public_url: publicUrlFor(row.storage_path),
  }));
}

export async function uploadProgressPhoto(
  userId: string,
  localUri: string,
  note?: string,
): Promise<ProgressPhoto | null> {
  const timestamp = Date.now();
  const storagePath = `${userId}/progress/${timestamp}.jpg`;

  if (__DEV__) {
    devLog('progress-photos', { action: 'upload', userId, storagePath });
  }

  try {
    const response = await fetch(localUri);
    const body = await response.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(storagePath, body, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      if (__DEV__) {
        devError('progress-photos', uploadError, { action: 'storage_upload', storagePath });
      }
      return null;
    }

    const capturedAt = new Date().toISOString();
    const { data, error: insertError } = await supabase
      .from('v2_progress_photos')
      .insert({
        user_id: userId,
        storage_path: storagePath,
        captured_at: capturedAt,
        note: note ?? null,
      })
      .select('id, user_id, storage_path, captured_at, note, created_at')
      .single();

    if (insertError || !data) {
      if (__DEV__) {
        devError('progress-photos', insertError ?? new Error('insert failed'), {
          action: 'insert_row',
          storagePath,
        });
      }
      await supabase.storage.from(AVATARS_BUCKET).remove([storagePath]);
      return null;
    }

    return {
      ...data,
      public_url: publicUrlFor(data.storage_path),
    };
  } catch (error) {
    if (__DEV__) {
      devError('progress-photos', error, { action: 'upload', userId });
    }
    return null;
  }
}

export async function deleteProgressPhoto(
  userId: string,
  photo: Pick<ProgressPhoto, 'id' | 'storage_path'>,
): Promise<boolean> {
  if (__DEV__) {
    devLog('progress-photos', { action: 'delete', userId, photoId: photo.id });
  }

  const { error: storageError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .remove([photo.storage_path]);
  if (storageError && __DEV__) {
    devError('progress-photos', storageError, { action: 'storage_delete', path: photo.storage_path });
  }

  const { error } = await supabase
    .from('v2_progress_photos')
    .delete()
    .eq('id', photo.id)
    .eq('user_id', userId);

  if (error) {
    if (__DEV__) {
      devError('progress-photos', error, { action: 'delete_row', photoId: photo.id });
    }
    return false;
  }
  return true;
}
