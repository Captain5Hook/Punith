import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  BatteryCharging,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  Signal,
  UserCircle2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AtmosphericBloodScene } from './components/AtmosphericBloodScene';
import { BloodSheet } from './components/BloodSheet';
import { BottomDock } from './components/BottomDock';
import { DonorCardModal } from './components/DonorCardModal';
import { IndiaMapModal } from './components/IndiaMapModal';
import { PostRequestModal } from './components/PostRequestModal';
import { OperationType, db, handleFirestoreError } from './firebase';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import type {
  BloodCenter,
  BloodRequest,
  BloodType,
  DonationLog,
  DonorProfile,
  RequestUrgency,
} from './types/blood';
import { computeEligibility } from './utils/bloodCompatibility';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
const DEVICE_DONOR_ID_KEY = 'pulsedrop_device_donor_id_v1';

const SKY_PARTICLES = [
  { top: '8%', left: '14%', size: 2, delay: '0s' },
  { top: '12%', left: '36%', size: 1.5, delay: '0.8s' },
  { top: '7%', left: '60%', size: 2.2, delay: '1.4s' },
  { top: '14%', left: '84%', size: 1.8, delay: '0.4s' },
  { top: '20%', left: '20%', size: 1.5, delay: '2.1s' },
  { top: '22%', left: '74%', size: 2, delay: '1.1s' },
  { top: '28%', left: '10%', size: 1.6, delay: '2.6s' },
  { top: '29%', left: '89%', size: 1.8, delay: '1.7s' },
];

function getOrCreateDeviceDonorId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_DONOR_ID_KEY);
    if (existing && /^[a-zA-Z0-9_-]{4,64}$/.test(existing)) {
      return existing;
    }
    const created = `donor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(DEVICE_DONOR_ID_KEY, created);
    return created;
  } catch {
    return `donor-${Date.now().toString(36)}`;
  }
}

function generateDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export default function App() {
  const [deviceDonorId] = useState<string>(getOrCreateDeviceDonorId);

  const [donorProfile, setDonorProfile] = useState<DonorProfile | null>(null);
  const [donations, setDonations] = useState<DonationLog[]>([]);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [pledgedRequestIds, setPledgedRequestIds] = useState<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<'needs' | 'banks'>('needs');
  const [selectedBloodFilter, setSelectedBloodFilter] = useState<BloodType | 'ALL'>('ALL');
  const [expandedSheet, setExpandedSheet] = useState(false);

  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isDonorModalOpen, setIsDonorModalOpen] = useState(false);
  const [donorModalView, setDonorModalView] = useState<'profile' | 'log'>('profile');
  const [prefillCenter, setPrefillCenter] = useState<BloodCenter | null>(null);

  const [cityName, setCityName] = useState('India');
  const [stateName, setStateName] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [centers, setCenters] = useState<BloodCenter[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const checkedPledgeIdsRef = useRef<Set<string>>(new Set());
  const [clockLabel, setClockLabel] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  const isOnline = useOnlineStatus();

  useEffect(() => {
    const onQuota = () => setIsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setClockLabel(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!statusNotice) return;
    const timer = setTimeout(() => setStatusNotice(null), 4200);
    return () => clearTimeout(timer);
  }, [statusNotice]);

  // Live Firestore subscriptions without login
  useEffect(() => {
    const donorRef = doc(db, 'donors', deviceDonorId);
    const unsubDonor = onSnapshot(
      donorRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as DonorProfile;
          setDonorProfile(data);
          if (data.city) setCityName(data.city);
        } else {
          setDonorProfile(null);
        }
      },
      (error) => {
        console.error('Firestore Error:', { error: error.message, operationType: OperationType.GET, path: `donors/${deviceDonorId}` });
        if (error.code === 'permission-denied') {
          setFatalError(new Error(JSON.stringify({ error: error.message, operationType: OperationType.GET, path: `donors/${deviceDonorId}` })));
        } else {
          setStatusNotice('Unable to sync donor card right now.');
        }
      }
    );

    const donationsPath = `donors/${deviceDonorId}/donations`;
    const donationsQuery = query(
      collection(db, donationsPath),
      where('userId', '==', deviceDonorId),
      limit(50)
    );
    const unsubDonations = onSnapshot(
      donationsQuery,
      (snap) => {
        const list: DonationLog[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DonationLog, 'id'>),
        }));
        list.sort((a, b) => b.donatedDate.localeCompare(a.donatedDate));
        setDonations(list);
      },
      (error) => {
        console.error('Firestore Error:', { error: error.message, operationType: OperationType.LIST, path: donationsPath });
        if (error.code === 'permission-denied') {
          setFatalError(new Error(JSON.stringify({ error: error.message, operationType: OperationType.LIST, path: donationsPath })));
        }
      }
    );

    const requestsQuery = query(
      collection(db, 'requests'),
      where('isPublic', '==', true),
      limit(50)
    );
    const unsubRequests = onSnapshot(
      requestsQuery,
      (snap) => {
        const list: BloodRequest[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<BloodRequest, 'id'>),
        }));
        list.sort((a, b) => {
          const aMs = a.createdAt?.toMillis?.() ?? 0;
          const bMs = b.createdAt?.toMillis?.() ?? 0;
          return bMs - aMs;
        });
        setRequests(list);
      },
      (error) => {
        console.error('Firestore Error:', { error: error.message, operationType: OperationType.LIST, path: 'requests' });
        if (error.code === 'permission-denied') {
          setFatalError(new Error(JSON.stringify({ error: error.message, operationType: OperationType.LIST, path: 'requests' })));
        } else {
          setStatusNotice('Unable to refresh live blood requests.');
        }
      }
    );

    return () => {
      unsubDonor();
      unsubDonations();
      unsubRequests();
    };
  }, [deviceDonorId]);

  // Check which open requests this device already pledged to (skipping already-checked IDs)
  useEffect(() => {
    const unchecked = requests.filter(
      (req) => req.status === 'open' && !checkedPledgeIdsRef.current.has(req.id)
    );
    if (unchecked.length === 0) return;
    let cancelled = false;

    const checkPledges = async () => {
      const newlyPledged: string[] = [];
      await Promise.all(
        unchecked.map(async (req) => {
          checkedPledgeIdsRef.current.add(req.id);
          try {
            const pSnap = await getDoc(doc(db, 'requests', req.id, 'pledges', deviceDonorId));
            if (pSnap.exists()) {
              newlyPledged.push(req.id);
            }
          } catch {
            checkedPledgeIdsRef.current.delete(req.id);
          }
        })
      );
      if (!cancelled && newlyPledged.length > 0) {
        setPledgedRequestIds((prev) => {
          const next = new Set(prev);
          for (const id of newlyPledged) next.add(id);
          return next;
        });
      }
    };

    void checkPledges();
    return () => {
      cancelled = true;
    };
  }, [deviceDonorId, requests]);

  const handleSaveProfile = async (data: {
    displayName: string;
    bloodType: BloodType;
    city: string;
    available: boolean;
    lastDonationDate: string;
  }) => {
    const path = `donors/${deviceDonorId}`;
    const ref = doc(db, 'donors', deviceDonorId);
    const cleanData = {
      displayName: (data.displayName.trim() || 'Donor').slice(0, 80),
      bloodType: data.bloodType,
      city: (data.city.trim() || 'India').slice(0, 80),
      available: data.available,
      lastDonationDate: data.lastDonationDate.trim(),
    };
    try {
      const existing = await getDoc(ref);
      if (existing.exists()) {
        await updateDoc(ref, {
          ...cleanData,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          uid: deviceDonorId,
          ...cleanData,
          donationsCount: donations.length,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setCityName(cleanData.city);
      setStatusNotice('Donor card saved');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleLogDonation = async (data: {
    centerName: string;
    city: string;
    bloodType: BloodType;
    volumeMl: number;
    donatedDate: string;
    notes: string;
  }) => {
    const donorRef = doc(db, 'donors', deviceDonorId);
    const donationId = generateDocId('don');
    const donationPath = `donors/${deviceDonorId}/donations/${donationId}`;

    try {
      const donorSnap = await getDoc(donorRef);
      if (!donorSnap.exists()) {
        await setDoc(donorRef, {
          uid: deviceDonorId,
          displayName: 'Donor',
          bloodType: data.bloodType,
          city: data.city,
          available: true,
          lastDonationDate: data.donatedDate,
          donationsCount: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const currentCount = Number(donorSnap.data().donationsCount ?? donations.length);
        await updateDoc(donorRef, {
          lastDonationDate: data.donatedDate,
          donationsCount: currentCount + 1,
          updatedAt: serverTimestamp(),
        });
      }

      await setDoc(doc(db, 'donors', deviceDonorId, 'donations', donationId), {
        userId: deviceDonorId,
        ...data,
        createdAt: serverTimestamp(),
      });
      setStatusNotice('Donation recorded');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, donationPath);
    }
  };

  const handleDeleteDonation = async (donationId: string) => {
    try {
      await deleteDoc(doc(db, 'donors', deviceDonorId, 'donations', donationId));
      const remaining = donations.filter((d) => d.id !== donationId);
      if (donorProfile) {
        await updateDoc(doc(db, 'donors', deviceDonorId), {
          donationsCount: remaining.length,
          lastDonationDate: remaining[0]?.donatedDate ?? '',
          updatedAt: serverTimestamp(),
        });
      }
      setStatusNotice('Donation entry removed');
    } catch (error) {
      console.error('Delete donation failed:', error);
      setStatusNotice('Could not remove donation entry. Please try again.');
    }
  };

  const handleCreateRequest = async (payload: {
    patientLabel: string;
    bloodType: BloodType;
    unitsNeeded: number;
    hospitalName: string;
    city: string;
    urgency: RequestUrgency;
    notes: string;
  }) => {
    const reqId = generateDocId('req');
    const path = `requests/${reqId}`;

    try {
      await setDoc(doc(db, 'requests', reqId), {
        requesterId: deviceDonorId,
        requesterName: (donorProfile?.displayName || 'Community Donor').slice(0, 80),
        patientLabel: payload.patientLabel,
        bloodType: payload.bloodType,
        unitsNeeded: payload.unitsNeeded,
        unitsPledged: 0,
        hospitalName: payload.hospitalName,
        city: payload.city,
        urgency: payload.urgency,
        notes: payload.notes,
        status: 'open',
        isPublic: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSelectedBloodFilter('ALL');
      setActiveTab('needs');
      setExpandedSheet(true);
      setStatusNotice(`Posted ${payload.bloodType} request`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handlePledgeUnit = async (req: BloodRequest) => {
    if (pledgedRequestIds.has(req.id) || req.unitsPledged >= req.unitsNeeded) return;

    setBusyRequestId(req.id);
    const batch = writeBatch(db);
    const pledgeRef = doc(db, 'requests', req.id, 'pledges', deviceDonorId);
    const reqRef = doc(db, 'requests', req.id);
    const nextUnits = req.unitsPledged + 1;

    batch.set(pledgeRef, {
      requestId: req.id,
      requesterId: req.requesterId,
      donorId: deviceDonorId,
      donorName: (donorProfile?.displayName || 'Community Donor').slice(0, 80),
      bloodType: donorProfile?.bloodType ?? req.bloodType,
      status: 'pledged',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.update(reqRef, {
      unitsPledged: nextUnits,
      status: nextUnits >= req.unitsNeeded ? 'fulfilled' : 'open',
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
      setPledgedRequestIds((prev) => new Set(prev).add(req.id));
      setStatusNotice(`Pledged 1 unit for ${req.hospitalName}`);
    } catch (error) {
      console.error('Pledge commit failed:', error);
      setStatusNotice('Could not confirm pledge. Please try again.');
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleUpdateRequestStatus = async (
    req: BloodRequest,
    status: 'fulfilled' | 'cancelled'
  ) => {
    setBusyRequestId(req.id);
    try {
      await updateDoc(doc(db, 'requests', req.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      setStatusNotice(`Request marked ${status}`);
    } catch (error) {
      console.error('Update request failed:', error);
      setStatusNotice('Could not update request status.');
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleLocateMe = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatusNotice('GPS location is unavailable on this device.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setUserCoords({ lat, lon });
        setGpsCoords({ lat, lon });
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
          );
          if (res.ok) {
            const data = await res.json();
            const detectedCity = data.city || data.locality || data.principalSubdivision;
            const detectedState = data.principalSubdivision || null;
            if (detectedState) setStateName(detectedState);
            if (detectedCity) {
              setCityName(detectedCity);
              setStatusNotice(
                detectedState && detectedCity !== detectedState
                  ? `Located ${detectedCity}, ${detectedState}`
                  : `Located ${detectedCity}`
              );
            }
          }
        } catch {
          setStatusNotice('Updated GPS coordinates');
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setIsLocating(false);
        setStatusNotice('Location permission denied.');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, []);

  if (fatalError) {
    throw fatalError;
  }

  const activeBloodType: BloodType = donorProfile?.bloodType ?? 'O-';
  const eligibility = useMemo(
    () => computeEligibility(donorProfile?.lastDonationDate ?? ''),
    [donorProfile?.lastDonationDate]
  );
  const openCount = useMemo(
    () => requests.filter((r) => r.status === 'open').length,
    [requests]
  );
  const locationDisplay = stateName
    ? cityName !== stateName && cityName !== 'India'
      ? `${cityName}, ${stateName}`
      : stateName
    : cityName;

  const phoneShell = (
    <div className="min-h-dvh w-full bg-[#0C050A] flex items-center justify-center sm:p-4">
      {/* Samsung Galaxy S20 FE Viewport Frame (360 x 800 dp / 20:9 aspect ratio on desktop, full-bleed on phones) */}
      <div
        className="relative w-full h-dvh sm:w-[360px] sm:h-[min(800px,95dvh)] sm:rounded-[34px] sm:border-[3px] sm:border-[#2C1824] sm:shadow-[0_28px_90px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col text-white"
        style={{
          background:
            'linear-gradient(180deg, #1A0A14 0%, #2D1020 44%, #44152B 78%, #1E0B16 100%)',
        }}
      >
        {isQuotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm shrink-0">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}
        {/* Ambient Crimson Sky Glow & Particles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div
            className="absolute -top-20 left-1/2 -translate-x-1/2 w-[340px] h-[250px] rounded-full blur-[90px] opacity-45"
            style={{
              background:
                'radial-gradient(circle, rgba(225,29,72,0.42) 0%, rgba(190,18,60,0.08) 55%, transparent 78%)',
            }}
          />
          {SKY_PARTICLES.map((dot, idx) => (
            <span
              key={idx}
              className="absolute rounded-full bg-rose-200 animate-twinkle"
              style={{
                top: dot.top,
                left: dot.left,
                width: `${dot.size}px`,
                height: `${dot.size}px`,
                opacity: 0.45,
                animationDelay: dot.delay,
              }}
            />
          ))}
        </div>

        {/* Samsung Galaxy S20 FE Top Status Bar & Centered Infinity-O Punch-Hole Camera (desktop preview) */}
        <div className="hidden sm:flex items-center justify-between px-5 pt-2.5 pb-1 relative z-20 text-[11px] font-medium text-white/85 tabular-nums select-none shrink-0">
          <span>{clockLabel}</span>

          <div
            aria-hidden="true"
            className="absolute left-1/2 -translate-x-1/2 top-2 w-3 h-3 rounded-full bg-[#070306] ring-1 ring-white/15 shadow-inner"
          />

          <div className="flex items-center gap-1.5">
            <Signal className="w-3 h-3" aria-hidden="true" />
            <Wifi className="w-3 h-3" aria-hidden="true" />
            <BatteryCharging className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
        </div>

        {/* Upper Hero Canvas (sits cleanly above the collapsed 288px glass sheet) */}
        <div
          className="relative z-10 flex-1 min-h-0 flex flex-col justify-between pb-[276px]"
          onClick={() => {
            if (expandedSheet) setExpandedSheet(false);
          }}
        >
          {/* Subtle Top App Row */}
          <div className="flex items-center justify-between px-4 pt-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleLocateMe();
              }}
              aria-label="Update location"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full text-white/75 hover:text-white transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </button>

            <div className="flex items-center gap-1.5 text-xs font-medium text-white/70">
              {!isOnline ? (
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
                  Offline
                </span>
              ) : (
                <span>PulseDrop</span>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDonorModalView('profile');
                setPrefillCenter(null);
                setIsDonorModalOpen(true);
              }}
              aria-label="Open donor card"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full text-white/85 hover:text-white transition-colors"
            >
              <UserCircle2 className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {statusNotice && (
            <div
              role="status"
              className="mx-auto w-fit max-w-[88%] px-3.5 py-1 rounded-full bg-[#260E1B]/95 border border-rose-300/25 text-xs font-medium text-white shadow-lg"
            >
              {statusNotice}
            </div>
          )}

          {/* Centered Typographic Hero matching reference screenshot */}
          <div className="flex flex-col items-center text-center px-6">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMapOpen(true);
              }}
              className="min-h-[32px] px-3 py-1 rounded-full bg-white/8 hover:bg-white/14 border border-white/12 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-rose-100 hover:text-white transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-rose-300" aria-hidden="true" />
              <span>{locationDisplay}</span>
            </button>

            <h1 className="font-display text-[26px] leading-tight font-normal tracking-tight text-white mt-1.5">
              {donorProfile ? donorProfile.displayName : 'Blood Donor'}
            </h1>

            <div className="font-display text-[66px] leading-[0.95] font-extralight tracking-tight text-white tabular-nums mt-0.5">
              {activeBloodType}
            </div>

            <div className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium">
              {eligibility.isEligible ? (
                <span className="inline-flex items-center gap-1.5 text-white/85">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" aria-hidden="true" />
                  Eligible to Donate
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-200 tabular-nums">
                  <Clock className="w-4 h-4" aria-hidden="true" />
                  {eligibility.daysRemaining}d recovery left
                </span>
              )}
            </div>

            <div className="mt-1 flex items-center justify-center gap-2 text-xs font-medium text-rose-100/80 tabular-nums">
              <span>Need: {openCount}</span>
              <span aria-hidden="true">·</span>
              <span>Logged: {donations.length}</span>
            </div>
          </div>

          {/* Centerpiece Crimson Droplet perched right above the Glass Sheet */}
          <div className="w-full px-6 -mb-3">
            <AtmosphericBloodScene
              bloodType={activeBloodType}
              isEligible={eligibility.isEligible}
            />
          </div>
        </div>

        {/* Dim backdrop when sheet is dragged up */}
        {expandedSheet && (
          <div
            onClick={() => setExpandedSheet(false)}
            aria-hidden="true"
            className="absolute inset-0 z-10 bg-black/35 transition-opacity"
          />
        )}

        {/* Draggable Frosted Glass Bottom Sheet */}
        <BloodSheet
          activeTab={activeTab}
          onTabChange={setActiveTab}
          expanded={expandedSheet}
          onExpandChange={setExpandedSheet}
          deviceDonorId={deviceDonorId}
          requests={requests}
          pledgedRequestIds={pledgedRequestIds}
          selectedBloodFilter={selectedBloodFilter}
          onSelectBloodFilter={setSelectedBloodFilter}
          onPledgeUnit={handlePledgeUnit}
          onUpdateRequestStatus={handleUpdateRequestStatus}
          busyRequestId={busyRequestId}
          centers={centers}
          userCoords={userCoords}
          donorProfile={donorProfile}
          donations={donations}
          onOpenRequestModal={() => setIsRequestModalOpen(true)}
          onOpenLogDonation={(center) => {
            setPrefillCenter(center ?? null);
            setDonorModalView('log');
            setIsDonorModalOpen(true);
          }}
          onDeleteDonation={handleDeleteDonation}
          onOpenMap={() => setIsMapOpen(true)}
        />

        {/* Sculpted Android Bottom Dock */}
        <BottomDock
          onOpenMap={() => setIsMapOpen(true)}
          onOpenRequestModal={() => setIsRequestModalOpen(true)}
          onOpenDonorCard={() => {
            setPrefillCenter(null);
            setDonorModalView('profile');
            setIsDonorModalOpen(true);
          }}
        />

        {/* Whole India Map & State Locator */}
        <IndiaMapModal
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          hasApiKey={Boolean(MAPS_API_KEY)}
          userCoords={
            userCoords ? { lat: userCoords.lat, lng: userCoords.lon } : null
          }
          gpsCoords={
            gpsCoords ? { lat: gpsCoords.lat, lng: gpsCoords.lon } : null
          }
          currentCity={cityName}
          currentState={stateName}
          centers={centers}
          onLocationUpdated={({ lat, lng, city, state, isGps }) => {
            setUserCoords(lat !== null && lng !== null ? { lat, lon: lng } : null);
            if (isGps && lat !== null && lng !== null) {
              setGpsCoords({ lat, lon: lng });
            }
            setCityName(city);
            setStateName(state);
          }}
          onCentersUpdated={setCenters}
          onOpenLogDonation={(center) => {
            setIsMapOpen(false);
            setPrefillCenter(center);
            setDonorModalView('log');
            setIsDonorModalOpen(true);
          }}
        />

        {/* Scoped S20 FE Modals */}
        <PostRequestModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          defaultCity={locationDisplay}
          defaultBloodType={activeBloodType}
          onSubmit={handleCreateRequest}
        />

        <DonorCardModal
          isOpen={isDonorModalOpen}
          onClose={() => setIsDonorModalOpen(false)}
          profile={donorProfile}
          donations={donations}
          defaultCity={locationDisplay}
          initialView={donorModalView}
          prefillCenter={prefillCenter}
          onSaveProfile={handleSaveProfile}
          onLogDonation={handleLogDonation}
          onDeleteDonation={handleDeleteDonation}
        />
      </div>
    </div>
  );

  if (!MAPS_API_KEY) {
    return phoneShell;
  }

  return (
    <APIProvider
      apiKey={MAPS_API_KEY}
      language="en"
      region="IN"
      libraries={['places', 'marker', 'geocoding']}
    >
      {phoneShell}
    </APIProvider>
  );
}
