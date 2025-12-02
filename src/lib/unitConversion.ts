/**
 * Unit conversion utilities for weight and height
 * Database stores weight in kg and height in cm
 * These functions convert between metric and imperial units
 */

export const kgToLbs = (kg: number): number => {
  return kg / 0.453592;
};

export const lbsToKg = (lbs: number): number => {
  return lbs * 0.453592;
};

export const cmToFtIn = (cm: number): { feet: number; inches: number } => {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
};

export const ftInToCm = (feet: number, inches: number): number => {
  return (feet * 30.48) + (inches * 2.54);
};

/**
 * Format weight with appropriate units
 * @param kg - Weight in kilograms (from database)
 * @param useImperial - Whether to display in imperial units
 * @returns Formatted weight string with units
 */
export const formatWeight = (kg: number | null | undefined, useImperial: boolean): string => {
  if (kg === null || kg === undefined || isNaN(kg)) {
    return 'N/A';
  }
  
  if (useImperial) {
    const lbs = kgToLbs(kg);
    return `${lbs.toFixed(1)} lbs`;
  } else {
    return `${kg.toFixed(1)} kg`;
  }
};

/**
 * Format height with appropriate units
 * @param cm - Height in centimeters (from database)
 * @param useImperial - Whether to display in imperial units
 * @returns Formatted height string with units
 */
export const formatHeight = (cm: number | null | undefined, useImperial: boolean): string => {
  if (cm === null || cm === undefined || isNaN(cm)) {
    return 'N/A';
  }
  
  if (useImperial) {
    const { feet, inches } = cmToFtIn(cm);
    return `${feet}'${inches}"`;
  } else {
    return `${cm.toFixed(0)} cm`;
  }
};

