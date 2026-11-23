import type { BloodType } from '../types/blood';

export const BLOOD_TYPES: BloodType[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

export interface CompatibilityInfo {
  type: BloodType;
  label: string;
  canDonateTo: BloodType[];
  canReceiveFrom: BloodType[];
  populationNote: string;
}

export const BLOOD_COMPATIBILITY: Record<BloodType, CompatibilityInfo> = {
  'O-': {
    type: 'O-',
    label: 'Universal Red Cell Donor',
    canDonateTo: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    canReceiveFrom: ['O-'],
    populationNote: 'Critical for emergency trauma and neonatal transfusions.',
  },
  'O+': {
    type: 'O+',
    label: 'Most Requested Type',
    canDonateTo: ['O+', 'A+', 'B+', 'AB+'],
    canReceiveFrom: ['O-', 'O+'],
    populationNote: 'Supports any Rh-positive recipient in urgent surgeries.',
  },
  'A-': {
    type: 'A-',
    label: 'Universal Platelet & Plasma Ally',
    canDonateTo: ['A-', 'A+', 'AB-', 'AB+'],
    canReceiveFrom: ['O-', 'A-'],
    populationNote: 'Essential for A- and AB- oncology and surgical care.',
  },
  'A+': {
    type: 'A+',
    label: 'High-Demand Type',
    canDonateTo: ['A+', 'AB+'],
    canReceiveFrom: ['O-', 'O+', 'A-', 'A+'],
    populationNote: 'Second most common blood type with steady hospital demand.',
  },
  'B-': {
    type: 'B-',
    label: 'Rare Rh-Negative Type',
    canDonateTo: ['B-', 'B+', 'AB-', 'AB+'],
    canReceiveFrom: ['O-', 'B-'],
    populationNote: 'Less than 2% of donors carry B-negative blood.',
  },
  'B+': {
    type: 'B+',
    label: 'Targeted Donor Type',
    canDonateTo: ['B+', 'AB+'],
    canReceiveFrom: ['O-', 'O+', 'B-', 'B+'],
    populationNote: 'Frequently needed for sickle cell and chronic transfusions.',
  },
  'AB-': {
    type: 'AB-',
    label: 'Universal Plasma Donor',
    canDonateTo: ['AB-', 'AB+'],
    canReceiveFrom: ['O-', 'A-', 'B-', 'AB-'],
    populationNote: 'Rarest blood group; plasma can help patients of any type.',
  },
  'AB+': {
    type: 'AB+',
    label: 'Universal Red Cell Recipient',
    canDonateTo: ['AB+'],
    canReceiveFrom: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    populationNote: 'Can receive red cells from any group; ideal plasma donor.',
  },
};

export interface EligibilityStatus {
  isEligible: boolean;
  daysSinceLast: number | null;
  daysRemaining: number;
  nextEligibleDate: string | null;
  progressPct: number;
}

const WHOLE_BLOOD_INTERVAL_DAYS = 56;

export function computeEligibility(lastDonationDate: string): EligibilityStatus {
  if (!lastDonationDate) {
    return {
      isEligible: true,
      daysSinceLast: null,
      daysRemaining: 0,
      nextEligibleDate: null,
      progressPct: 100,
    };
  }

  const parsed = new Date(`${lastDonationDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return {
      isEligible: true,
      daysSinceLast: null,
      daysRemaining: 0,
      nextEligibleDate: null,
      progressPct: 100,
    };
  }

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = todayMidnight.getTime() - parsed.getTime();
  const daysSince = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, WHOLE_BLOOD_INTERVAL_DAYS - daysSince);
  const nextDate = new Date(parsed.getTime() + WHOLE_BLOOD_INTERVAL_DAYS * 86400000);
  const nextIso = nextDate.toISOString().slice(0, 10);

  return {
    isEligible: daysRemaining === 0,
    daysSinceLast: daysSince,
    daysRemaining,
    nextEligibleDate: nextIso,
    progressPct: Math.min(100, Math.round((daysSince / WHOLE_BLOOD_INTERVAL_DAYS) * 100)),
  };
}

export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

