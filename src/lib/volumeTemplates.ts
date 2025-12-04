export interface VolumeTemplateInput {
  name?: string | null;
  target_sets?: number | null;
  target_reps?: number | string | null;
  rest_time_sec?: number | null;
}

export interface VolumeTemplateOutput {
  target_sets: number;
  target_reps: number;
  rest_time_sec: number;
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

type VolumeCategory =
  | 'upper_compound'
  | 'lower_compound'
  | 'accessory'
  | 'calf_core'
  | 'cardio'
  | 'other';

const inferVolumeCategory = (name?: string | null): VolumeCategory => {
  const n = (name || '').toLowerCase();
  if (!n) return 'other';

  if (
    n.includes('bench') ||
    n.includes('overhead press') ||
    n.includes('ohp') ||
    n.includes('barbell row') ||
    (n.includes('row') && !n.includes('upright')) ||
    n.includes('pull up') ||
    n.includes('chin up')
  ) {
    return 'upper_compound';
  }

  if (
    n.includes('squat') ||
    n.includes('deadlift') ||
    n.includes('rdl') ||
    n.includes('romanian') ||
    n.includes('hip thrust') ||
    n.includes('leg press')
  ) {
    return 'lower_compound';
  }

  if (
    n.includes('calf') ||
    n.includes('shrug') ||
    n.includes('crunch') ||
    n.includes('plank') ||
    n.includes('sit up') ||
    n.includes('sit-up')
  ) {
    return 'calf_core';
  }

  if (
    n.includes('run') ||
    n.includes('bike') ||
    n.includes('rower') ||
    n.includes('erg') ||
    n.includes('treadmill') ||
    n.includes('interval')
  ) {
    return 'cardio';
  }

  if (
    n.includes('curl') ||
    n.includes('raise') ||
    n.includes('fly') ||
    n.includes('extension') ||
    n.includes('pressdown') ||
    n.includes('pushdown') ||
    n.includes('wrist')
  ) {
    return 'accessory';
  }

  return 'other';
};

export const applyVolumeTemplate = (exercise: any): any => {
  const input: VolumeTemplateInput = {
    name: exercise?.name,
    target_sets: exercise?.target_sets,
    target_reps: exercise?.target_reps,
    rest_time_sec: exercise?.rest_time_sec,
  };

  const category = inferVolumeCategory(input.name);

  let minSets = 3;
  let maxSets = 5;
  let defaultSets = 3;
  let minReps = 3;
  let maxReps = 15;
  let defaultReps = 8;
  let minRest = 45;
  let maxRest = 180;
  let defaultRest = 90;

  if (category === 'upper_compound' || category === 'lower_compound') {
    minSets = 3;
    maxSets = 5;
    defaultSets = 4;
    minReps = 3;
    maxReps = 8;
    defaultReps = 6;
    minRest = 90;
    maxRest = 210;
    defaultRest = 150;
  } else if (category === 'accessory') {
    minSets = 2;
    maxSets = 4;
    defaultSets = 3;
    minReps = 8;
    maxReps = 15;
    defaultReps = 12;
    minRest = 45;
    maxRest = 90;
    defaultRest = 60;
  } else if (category === 'calf_core') {
    minSets = 3;
    maxSets = 5;
    defaultSets = 4;
    minReps = 10;
    maxReps = 20;
    defaultReps = 15;
    minRest = 30;
    maxRest = 75;
    defaultRest = 45;
  } else if (category === 'cardio') {
    minSets = 1;
    maxSets = 4;
    defaultSets = 2;
    minReps = 1;
    maxReps = 5;
    defaultReps = 1;
    minRest = 30;
    maxRest = 90;
    defaultRest = 60;
  }

  // Resolve target_sets
  let setsNum: number | null = null;
  if (typeof input.target_sets === 'number') {
    setsNum = Number.isFinite(input.target_sets) ? input.target_sets : null;
  }
  if (!setsNum || setsNum <= 0) {
    setsNum = defaultSets;
  }
  setsNum = clamp(Math.round(setsNum), minSets, maxSets);

  // Resolve target_reps
  let repsNum: number | null = null;
  if (typeof input.target_reps === 'number') {
    repsNum = Number.isFinite(input.target_reps) ? input.target_reps : null;
  } else if (typeof input.target_reps === 'string') {
    const match = input.target_reps.match(/\d+/);
    if (match) {
      repsNum = parseInt(match[0], 10);
    }
  }
  if (!repsNum || repsNum <= 0) {
    repsNum = defaultReps;
  }
  repsNum = clamp(Math.round(repsNum), minReps, maxReps);

  // Resolve rest_time_sec
  let restNum: number | null = null;
  if (typeof input.rest_time_sec === 'number') {
    restNum = Number.isFinite(input.rest_time_sec) ? input.rest_time_sec : null;
  }
  if (restNum === null || restNum === undefined || restNum < 0) {
    restNum = defaultRest;
  }
  restNum = clamp(Math.round(restNum), minRest, maxRest);

  const output: VolumeTemplateOutput = {
    target_sets: setsNum,
    target_reps: repsNum,
    rest_time_sec: restNum,
  };

  const merged = {
    ...exercise,
    target_sets: output.target_sets,
    target_reps: output.target_reps,
    rest_time_sec: output.rest_time_sec,
  };

  if (__DEV__) {
    console.log('[volumeTemplates] applied template', {
      name: input.name,
      category,
      before: {
        target_sets: input.target_sets,
        target_reps: input.target_reps,
        rest_time_sec: input.rest_time_sec,
      },
      after: output,
    });
  }

  return merged;
};


