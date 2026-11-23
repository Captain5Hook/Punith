import type { Timestamp } from 'firebase/firestore';

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type RequestUrgency = 'critical' | 'urgent' | 'scheduled';

export type RequestStatus = 'open' | 'fulfilled' | 'cancelled';

export interface DonorProfile {
  uid: string;
  displayName: string;
  bloodType: BloodType;
  city: string;
  available: boolean;
  lastDonationDate: string;
  donationsCount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface DonationLog {
  id: string;
  userId: string;
  centerName: string;
  city: string;
  bloodType: BloodType;
  volumeMl: number;
  donatedDate: string;
  notes: string;
  createdAt?: Timestamp;
}

export interface BloodRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  patientLabel: string;
  bloodType: BloodType;
  unitsNeeded: number;
  unitsPledged: number;
  hospitalName: string;
  city: string;
  urgency: RequestUrgency;
  notes: string;
  status: RequestStatus;
  isPublic: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface RequestPledge {
  id: string;
  requestId: string;
  requesterId: string;
  donorId: string;
  donorName: string;
  bloodType: BloodType;
  status: 'pledged' | 'cancelled';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface BloodCenter {
  id: string;
  name: string;
  city: string;
  state?: string;
  address: string;
  hours: string;
  latitude: number;
  longitude: number;
  neededTypes: BloodType[];
}

