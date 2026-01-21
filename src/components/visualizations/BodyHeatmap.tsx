/**
 * Body Heatmap Component (Skia)
 * 
 * High-performance muscle visualization using React Native Skia
 * Displays all 28 canonical muscles with color-coded freshness
 * 
 * ViewBox: 0 0 360 720 (width x height)
 */

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useMuscleColors } from '../../hooks/useMuscleColors';

// Complete SVG paths for all 28 muscles (from DATA PACK)
const MUSCLE_PATHS: Record<string, string> = {
  // Upper Body Push (7 muscles)
  chest: "M145,160 Q180,160 215,160 Q205,200 180,200 Q155,200 145,160 Z",
  upper_chest: "M140,145 Q180,140 220,145 Q215,160 180,160 Q145,160 140,145 Z",
  lower_chest: "M150,190 Q180,190 210,190 Q200,210 180,215 Q160,210 150,190 Z",
  anterior_deltoids: "M120,150 Q135,140 145,160 Q135,180 125,170 Z",
  lateral_deltoids: "M110,150 Q120,145 125,165 Q115,180 105,170 Z",
  posterior_deltoids: "M115,155 Q125,155 130,170 Q120,175 115,155 Z",
  triceps: "M110,170 Q120,170 125,220 Q110,215 105,180 Z",
  
  // Upper Body Pull (6 muscles)
  lats: "M125,200 Q140,280 180,300 Q220,280 235,200 L235,220 Q180,320 125,220 Z",
  upper_back: "M155,140 L205,140 L200,180 L160,180 Z",
  lower_back: "M160,280 L200,280 L195,330 L165,330 Z",
  traps: "M160,110 L200,110 L210,140 L150,140 Z",
  biceps: "M110,170 Q120,180 120,210 Q105,200 110,170 Z",
  forearms: "M100,220 Q115,220 110,280 Q95,275 100,220 Z",
  
  // Core (2 muscles)
  abs: "M160,200 L200,200 L195,320 L165,320 Z",
  obliques: "M140,220 Q155,220 160,320 Q130,300 140,220 Z",
  
  // Lower Body Front (2 muscles)
  quads: "M140,340 Q180,340 220,340 Q210,500 180,520 Q150,500 140,340 Z",
  hip_flexors: "M150,330 Q180,330 210,330 L205,360 L155,360 Z",
  
  // Lower Body Back (4 muscles)
  hamstrings: "M380,360 Q420,360 460,360 Q450,500 420,520 Q390,500 380,360 Z",
  glutes: "M380,280 Q420,280 460,280 Q460,350 420,360 Q380,350 380,280 Z",
  calves: "M150,540 Q180,540 210,540 Q200,650 180,680 Q160,650 150,540 Z",
  soleus: "M160,600 Q180,600 200,600 L195,670 L165,670 Z",
  
  // Stabilizers (7 muscles)
  rotator_cuff: "M130,150 Q140,150 145,160 L135,165 Z",
  serratus_anterior: "M145,180 Q155,185 155,210 L145,205 Z",
  transverse_abdominis: "M150,250 L210,250 L205,280 L155,280 Z",
  glute_medius: "M370,290 Q380,285 390,310 L380,315 Z",
  glute_minimus: "M375,300 Q385,300 390,320 L380,320 Z",
  piriformis: "M400,310 L440,310 L435,320 L405,320 Z",
  tibialis_anterior: "M155,550 Q165,550 160,620 L150,615 Z"
};

interface BodyHeatmapProps {
  freshnessData: Record<string, number | null | undefined>;
  width?: number;
  height?: number;
}

export const BodyHeatmap: React.FC<BodyHeatmapProps> = ({
  freshnessData,
  width = Dimensions.get('window').width - 32,
  height = (Dimensions.get('window').width - 32) * 2, // 2:1 aspect ratio (720/360)
}) => {
  const muscleColors = useMuscleColors(freshnessData);

  // Create Skia paths for each muscle
  const renderMusclePaths = () => {
    const paths = [];
    
    for (const [muscleKey, pathData] of Object.entries(MUSCLE_PATHS)) {
      const color = muscleColors[muscleKey] || '#9ca3af';
      const path = Skia.Path.MakeFromSVGString(pathData);
      
      if (path) {
        paths.push(
          <Path
            key={muscleKey}
            path={path}
            color={color}
            style="fill"
            opacity={0.9}
          />
        );
      }
    }
    
    return paths;
  };

  return (
    <View style={[styles.container, { width, height }]}>
      <Canvas style={{ width, height }}>
        {/* Scale the canvas to match our viewBox (0 0 360 720) */}
        {renderMusclePaths()}
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
