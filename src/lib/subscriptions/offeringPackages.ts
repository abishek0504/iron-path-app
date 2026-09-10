import { PRODUCT_ID_ANNUAL, PRODUCT_ID_MONTHLY } from './constants';

export const OFFERING_PACKAGE_TYPE_MONTHLY = 'MONTHLY';
export const OFFERING_PACKAGE_TYPE_ANNUAL = 'ANNUAL';

export interface OfferingPackageLike {
  packageType?: string;
  product?: { identifier?: string };
}

export interface OfferingLike<T extends OfferingPackageLike = OfferingPackageLike> {
  monthly?: T | null;
  annual?: T | null;
  availablePackages?: T[];
}

function matchesType(pkg: OfferingPackageLike, type: string): boolean {
  return pkg.packageType === type;
}

function matchesProductId(pkg: OfferingPackageLike, productId: string): boolean {
  return pkg.product?.identifier === productId;
}

function findPackage<T extends OfferingPackageLike>(
  packages: T[] | undefined,
  type: string,
  productId: string,
): T | null {
  if (!packages?.length) return null;
  return (
    packages.find((pkg) => matchesType(pkg, type)) ??
    packages.find((pkg) => matchesProductId(pkg, productId)) ??
    null
  );
}

export function resolveOfferingPackages<T extends OfferingPackageLike>(
  offering: OfferingLike<T> | null | undefined,
): { monthly: T | null; annual: T | null } {
  if (!offering) {
    return { monthly: null, annual: null };
  }

  const packages = offering.availablePackages;
  return {
    monthly:
      offering.monthly ??
      findPackage(packages, OFFERING_PACKAGE_TYPE_MONTHLY, PRODUCT_ID_MONTHLY),
    annual:
      offering.annual ??
      findPackage(packages, OFFERING_PACKAGE_TYPE_ANNUAL, PRODUCT_ID_ANNUAL),
  };
}
