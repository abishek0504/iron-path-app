import { describe, expect, it } from 'vitest';
import { PRODUCT_ID_ANNUAL, PRODUCT_ID_MONTHLY } from './constants';
import { resolveOfferingPackages, type OfferingPackageLike } from './offeringPackages';

const MONTHLY_ID = PRODUCT_ID_MONTHLY;
const ANNUAL_ID = PRODUCT_ID_ANNUAL;

function pkg(
  identifier: string,
  packageType: OfferingPackageLike['packageType'] = 'CUSTOM',
): OfferingPackageLike {
  return { packageType, product: { identifier } };
}

describe('resolveOfferingPackages', () => {
  it('returns nulls when offering is missing', () => {
    expect(resolveOfferingPackages(null)).toEqual({ monthly: null, annual: null });
    expect(resolveOfferingPackages(undefined)).toEqual({ monthly: null, annual: null });
  });

  it('prefers offering.monthly and offering.annual helpers', () => {
    const monthly = pkg(MONTHLY_ID, 'MONTHLY');
    const annual = pkg(ANNUAL_ID, 'ANNUAL');
    const otherMonthly = pkg(MONTHLY_ID, 'CUSTOM');
    expect(
      resolveOfferingPackages({
        monthly,
        annual,
        availablePackages: [otherMonthly],
      }),
    ).toEqual({ monthly, annual });
  });

  it('falls back to packageType on availablePackages', () => {
    const monthly = pkg('custom_month', 'MONTHLY');
    const annual = pkg('custom_year', 'ANNUAL');
    expect(
      resolveOfferingPackages({
        availablePackages: [annual, monthly],
      }),
    ).toEqual({ monthly, annual });
  });

  it('falls back to product identifiers for custom package types', () => {
    const monthly = pkg(MONTHLY_ID, 'CUSTOM');
    const annual = pkg(ANNUAL_ID, 'CUSTOM');
    expect(
      resolveOfferingPackages({
        availablePackages: [monthly, annual],
      }),
    ).toEqual({ monthly, annual });
  });

  it('does not treat a weekly custom package as monthly', () => {
    expect(
      resolveOfferingPackages({
        availablePackages: [pkg('ironpath_pro_weekly', 'CUSTOM')],
      }),
    ).toEqual({ monthly: null, annual: null });
  });
});
