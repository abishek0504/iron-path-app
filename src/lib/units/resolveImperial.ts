/** Default to imperial when the profile field is missing. */
export function resolveUseImperial(useImperial: boolean | null | undefined): boolean {
  return useImperial !== false;
}

export function unitsLabel(useImperial: boolean | null | undefined): 'lbs' | 'kg' {
  return resolveUseImperial(useImperial) ? 'lbs' : 'kg';
}
