import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Camera, ImagePlus, Trash2 } from 'lucide-react-native';
import { Button } from '../src/components/ui/Button';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';
import { LoadingScreen } from '../src/components/ui/LoadingScreen';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { useUIStore } from '../src/stores/uiStore';
import { useUserStore } from '../src/stores/userStore';
import {
  deleteProgressPhoto,
  listProgressPhotos,
  uploadProgressPhoto,
  type ProgressPhoto,
} from '../src/lib/photos/progressPhotos';
import { borderRadius, spacing, typography, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme } from '../src/lib/utils/ThemeContext';
import { devError, devLog } from '../src/lib/utils/logger';

type ImagePickerAsset = { uri: string };
type ImagePickerResult = { canceled: boolean; assets?: ImagePickerAsset[] };
type ImagePickerModule = {
  requestCameraPermissionsAsync: () => Promise<{ granted: boolean }>;
  requestMediaLibraryPermissionsAsync: () => Promise<{ granted: boolean }>;
  launchCameraAsync: (options: Record<string, unknown>) => Promise<ImagePickerResult>;
  launchImageLibraryAsync: (options: Record<string, unknown>) => Promise<ImagePickerResult>;
};

function getImagePicker(): ImagePickerModule | null {
  try {
    return require('expo-image-picker') as ImagePickerModule;
  } catch {
    return null;
  }
}

export default function ProgressPhotosScreen() {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const userId = useUserStore((state) => state.profile?.id);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<ProgressPhoto | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setPhotos([]);
      setLoading(false);
      return;
    }
    const rows = await listProgressPhotos(userId);
    setPhotos(rows);
    setLoading(false);
    if (__DEV__) {
      devLog('progress-photos', { action: 'screen_list', count: rows.length });
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pickAndUpload = useCallback(
    async (source: 'camera' | 'library') => {
      if (!userId) {
        showToast('Please log in', 'error');
        return;
      }
      if (Platform.OS === 'web') {
        showToast('Progress photos are available on iOS and Android', 'info');
        return;
      }
      const ImagePicker = getImagePicker();
      if (!ImagePicker) {
        showToast('expo-image-picker is not installed. Run npm install.', 'error');
        return;
      }

      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          showToast('Camera permission is required', 'error');
          return;
        }
      }

      const options = {
        mediaTypes: 'images',
        quality: 0.8,
        allowsEditing: true,
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setBusy(true);
      try {
        const uploaded = await uploadProgressPhoto(userId, result.assets[0].uri);
        if (!uploaded) {
          showToast('Failed to save photo', 'error');
          return;
        }
        showToast('Photo saved', 'success');
        await reload();
      } catch (error) {
        if (__DEV__) {
          devError('progress-photos', error, { action: 'pickAndUpload', source });
        }
        showToast('Failed to save photo', 'error');
      } finally {
        setBusy(false);
      }
    },
    [reload, showToast, userId],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!userId || !photoToDelete) return;
    setBusy(true);
    try {
      const ok = await deleteProgressPhoto(userId, photoToDelete);
      if (!ok) {
        showToast('Failed to delete photo', 'error');
        return;
      }
      showToast('Photo deleted', 'success');
      setPhotoToDelete(null);
      await reload();
    } finally {
      setBusy(false);
    }
  }, [photoToDelete, reload, showToast, userId]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Progress photos" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.actions}>
          <Button
            label="Take photo"
            onPress={() => void pickAndUpload('camera')}
            disabled={busy}
            fullWidth
          >
            <View style={styles.buttonRow}>
              <Camera size={18} color={colors.onPrimaryContrast} />
              <Text style={styles.buttonLabel}>Take photo</Text>
            </View>
          </Button>
          <Button
            label="Add from library"
            variant="secondary"
            onPress={() => void pickAndUpload('library')}
            disabled={busy}
            fullWidth
          >
            <View style={styles.buttonRow}>
              <ImagePlus size={18} color={colors.primary} />
              <Text style={[styles.buttonLabel, { color: colors.primary }]}>Add from library</Text>
            </View>
          </Button>
        </View>

        {photos.length === 0 ? (
          <Text style={styles.empty}>No progress photos yet. Add one from the camera or library.</Text>
        ) : (
          photos.map((photo) => (
            <View key={photo.id} style={styles.card}>
              <Image source={{ uri: photo.public_url }} style={styles.image} contentFit="cover" />
              <View style={styles.cardMeta}>
                <Text style={styles.date}>
                  {new Date(photo.captured_at).toLocaleString()}
                </Text>
                <TouchableOpacity
                  onPress={() => setPhotoToDelete(photo)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Delete photo"
                >
                  <Trash2 size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <ConfirmDialog
        visible={photoToDelete != null}
        title="Delete this photo?"
        message="This removes the photo from your account."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmDestructive
        confirmDisabled={busy}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (busy) return;
          setPhotoToDelete(null);
        }}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.lg,
      gap: spacing.lg,
    },
    actions: {
      gap: spacing.sm,
    },
    buttonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    buttonLabel: {
      color: colors.onPrimaryContrast,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
    },
    empty: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      textAlign: 'center',
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      overflow: 'hidden',
    },
    image: {
      width: '100%',
      height: 280,
      backgroundColor: colors.border,
    },
    cardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
    },
    date: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
    },
  });
}
