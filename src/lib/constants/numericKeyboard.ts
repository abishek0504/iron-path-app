/** iOS number/decimal pad has no Return key; RN shows Next/Done only when returnKeyType is set. */
export const NUMERIC_DONE_PROPS = {
  returnKeyType: 'done' as const,
  blurOnSubmit: true,
};

export const NUMERIC_NEXT_PROPS = {
  returnKeyType: 'next' as const,
  blurOnSubmit: true,
};
