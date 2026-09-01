import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { getExerciseImage } from '../../lib/exerciseImages';
import { borderRadius, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

interface ExerciseDemoMediaProps {
  exerciseName: string;
  demoVideoUrl?: string | null;
  height: number;
}

function DemoVideo({ uri, height }: { uri: string; height: number }) {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.play();
  });

  return (
    <VideoView
      player={player}
      style={{ width: '100%', height, borderRadius: borderRadius.lg }}
      contentFit="cover"
      nativeControls
    />
  );
}

export function ExerciseDemoMedia({
  exerciseName,
  demoVideoUrl,
  height,
}: ExerciseDemoMediaProps) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors, height), [colors, height]);
  const image = getExerciseImage(exerciseName);

  if (demoVideoUrl) {
    return <DemoVideo uri={demoVideoUrl} height={height} />;
  }

  if (!image) return null;

  return (
    <View style={styles.frame}>
      <Image source={image} style={styles.image} contentFit="cover" />
    </View>
  );
}

function createStyles(colors: ThemeColors, height: number) {
  return StyleSheet.create({
    frame: {
      width: '100%',
      height,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
      backgroundColor: colors.card,
    },
    image: {
      width: '100%',
      height: '100%',
    },
  });
}
