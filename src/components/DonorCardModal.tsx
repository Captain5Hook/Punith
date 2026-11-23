import {
  CheckCircle2,
  Download,
  Droplet,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import type { BloodCenter, BloodType, DonationLog, DonorProfile } from '../types/blood';
import { BLOOD_TYPES, computeEligibility } from '../utils/bloodCompatibility';

interface DonorCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: DonorProfile | null;
  donations: DonationLog[];
  defaultCity: string;
  initialView?: 'profile' | 'log';
  prefillCenter?: BloodCenter | null;
  onSaveProfile: (data: {
    displayName: string;
    bloodType: BloodType;
    city: string;
    available: boolean;
    lastDonationDate: string;
  }) => Promise<void>;
  onLogDonation: (data: {
    centerName: string;
    city: string;
    bloodType: BloodType;
    volumeMl: number;
    donatedDate: string;
    notes: string;
  }) => Promise<void>;
  onDeleteDonation: (donationId: string) => Promise<void>;
}

export function DonorCardModal({
  isOpen,
  onClose,
  profile,
  donations,
  defaultCity,
  initialView = 'profile',
  prefillCenter,
  onSaveProfile,
  onLogDonation,
  onDeleteDonation,
}: DonorCardModalProps) {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [subView, setSubView] = useState<'profile' | 'log'>(initialView);

  // Profile fields
  const [displayName, setDisplayName] = useState(profile?.displayName ?? 'Donor');
  const [bloodType, setBloodType] = useState<BloodType>(profile?.bloodType ?? 'O-');
  const [city, setCity] = useState(profile?.city ?? defaultCity);
  const [available, setAvailable] = useState(profile?.available ?? true);
  const [lastDonationDate, setLastDonationDate] = useState(profile?.lastDonationDate ?? '');

  // Log donation fields
  const [centerName, setCenterName] = useState('');
  const [logCity, setLogCity] = useState(defaultCity);
  const [logBloodType, setLogBloodType] = useState<BloodType>(profile?.bloodType ?? 'O-');
  const [volumeMl, setVolumeMl] = useState(450);
  const [donatedDate, setDonatedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logNotes, setLogNotes] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const formatError = (err: unknown, fallback: string) => {
    if (!(err instanceof Error)) return fallback;
    try {
      const parsed = JSON.parse(err.message) as { error?: string };
      return parsed.error || fallback;
    } catch {
      return err.message || fallback;
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setSubView(initialView);
    setDisplayName(profile?.displayName ?? 'Donor');
    setBloodType(profile?.bloodType ?? 'O-');
    setCity(profile?.city ?? defaultCity);
    setAvailable(profile?.available ?? true);
    setLastDonationDate(profile?.lastDonationDate ?? '');
    setCenterName(prefillCenter?.name ?? '');
    setLogCity(prefillCenter?.city ?? profile?.city ?? defaultCity);
    setLogBloodType(profile?.bloodType ?? 'O-');
    setFeedback(null);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, initialView, profile, defaultCity, prefillCenter, onClose]);

  if (!isOpen) return null;

  const eligibility = computeEligibility(lastDonationDate);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSaving(true);
    try {
      await onSaveProfile({
        displayName: (displayName.trim() || 'Donor').slice(0, 80),
        bloodType,
        city: (city.trim() || defaultCity).slice(0, 80),
        available,
        lastDonationDate: lastDonationDate.trim(),
      });
      setFeedback('Donor card saved.');
    } catch (err) {
      setFeedback(formatError(err, 'Failed to save donor card.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!centerName.trim() || !logCity.trim()) {
      setFeedback('Please enter center name and city.');
      return;
    }
    setIsSaving(true);
    try {
      await onLogDonation({
        centerName: centerName.trim().slice(0, 100),
        city: logCity.trim().slice(0, 80),
        bloodType: logBloodType,
        volumeMl: Math.min(600, Math.max(100, Math.round(volumeMl))),
        donatedDate,
        notes: logNotes.trim().slice(0, 240),
      });
      setCenterName('');
      setLogNotes('');
      setSubView('profile');
      setFeedback('Donation logged and recovery timer updated.');
    } catch (err) {
      setFeedback(formatError(err, 'Could not log donation.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="donor-card-title"
      className="absolute inset-0 z-50 flex flex-col bg-[#180A12]"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-white/10 shrink-0">
        <h2 id="donor-card-title" className="font-display text-lg font-semibold text-white">
          My Donor Card
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close donor card"
          className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4 no-scrollbar">
        {/* Segmented switch: Profile vs Log Donation */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#12060D] border border-white/10">
          <button
            type="button"
            onClick={() => setSubView('profile')}
            className={`min-h-[40px] rounded-xl text-xs font-semibold transition-colors ${
              subView === 'profile'
                ? 'bg-[#BE123C] text-white'
                : 'text-white/65 hover:text-white'
            }`}
          >
            Donor Profile
          </button>
          <button
            type="button"
            onClick={() => setSubView('log')}
            className={`min-h-[40px] rounded-xl text-xs font-semibold transition-colors ${
              subView === 'log'
                ? 'bg-[#BE123C] text-white'
                : 'text-white/65 hover:text-white'
            }`}
          >
            Log Donation
          </button>
        </div>

        {feedback && (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3.5 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{feedback}</span>
          </div>
        )}

        {subView === 'profile' ? (
          <div className="space-y-4">
            {/* Digital Card Preview */}
            <div className="rounded-[24px] border border-rose-300/30 bg-gradient-to-br from-[#6D1331] via-[#3F1226] to-[#210A15] p-5 shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-medium text-rose-200/85">
                    Registered Blood Donor
                  </div>
                  <div className="mt-1 font-display text-xl font-semibold text-white">
                    {displayName || 'Donor'}
                  </div>
                  <div className="text-xs text-white/70 truncate">
                    {city}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center font-display text-xl font-bold text-white shrink-0">
                  {bloodType}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-white/80 tabular-nums">
                <span>{donations.length} donations logged</span>
                <span className={eligibility.isEligible ? 'text-emerald-300 font-semibold' : 'text-amber-200'}>
                  {eligibility.isEligible
                    ? 'Eligible Now'
                    : `${eligibility.daysRemaining}d recovery left`}
                </span>
              </div>
            </div>

            <form onSubmit={handleProfileSave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-white/65 mb-1.5">
                  Blood Type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {BLOOD_TYPES.map((bt) => (
                    <button
                      key={bt}
                      type="button"
                      onClick={() => setBloodType(bt)}
                      className={`min-h-[40px] rounded-xl font-display text-sm font-semibold transition-colors ${
                        bloodType === bt
                          ? 'bg-[#BE123C] text-white border border-rose-300/50'
                          : 'bg-[#12060D] text-white/75 border border-white/12'
                      }`}
                    >
                      {bt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/65 mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-[#12060D] border border-white/15 text-sm text-white focus:outline-none focus:border-rose-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/65 mb-1.5">
                    City
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-[#12060D] border border-white/15 text-sm text-white focus:outline-none focus:border-rose-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/65 mb-1.5">
                  Last Donation Date
                </label>
                <input
                  type="date"
                  value={lastDonationDate}
                  onChange={(e) => setLastDonationDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-[#12060D] border border-white/15 text-sm text-white [color-scheme:dark] focus:outline-none focus:border-rose-400"
                />
              </div>

              <label className="flex items-center justify-between gap-3 rounded-2xl bg-[#12060D] border border-white/12 px-4 py-3 cursor-pointer">
                <span className="text-xs font-medium text-white/85">
                  Available for emergency donor alerts
                </span>
                <input
                  type="checkbox"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                  className="w-5 h-5 accent-[#E11D48]"
                />
              </label>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full min-h-[46px] rounded-2xl bg-[#E11D48] hover:bg-[#BE123C] disabled:opacity-60 text-sm font-semibold text-white inline-flex items-center justify-center gap-2 transition-colors"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                Save Donor Card
              </button>
            </form>

            {/* Donation History */}
            <div className="pt-2 space-y-2.5">
              <div className="text-xs font-medium text-white/60">
                Donation History ({donations.length})
              </div>
              {donations.length === 0 ? (
                <p className="text-xs text-white/50 py-2">
                  No donations logged yet. Tap Log Donation after your visit.
                </p>
              ) : (
                donations.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#220E19] px-3.5 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">{d.centerName}</div>
                      <div className="text-white/60 tabular-nums">
                        {d.donatedDate} · {d.bloodType} · {d.volumeMl} mL
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={deletingId === d.id}
                      onClick={async () => {
                        setDeletingId(d.id);
                        try {
                          await onDeleteDonation(d.id);
                        } finally {
                          setDeletingId(null);
                        }
                      }}
                      aria-label={`Delete donation at ${d.centerName}`}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-white/45 hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-40 transition-colors"
                    >
                      {deletingId === d.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleLogSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-white/65 mb-1.5">
                Blood Bank / Hospital
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={centerName}
                onChange={(e) => setCenterName(e.target.value)}
                placeholder="e.g., Apollo / Red Cross Blood Bank"
                className="w-full h-11 px-3.5 rounded-xl bg-[#12060D] border border-white/15 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/65 mb-1.5">
                  City
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={logCity}
                  onChange={(e) => setLogCity(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-[#12060D] border border-white/15 text-sm text-white focus:outline-none focus:border-rose-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/65 mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={donatedDate}
                  onChange={(e) => setDonatedDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-[#12060D] border border-white/15 text-sm text-white [color-scheme:dark] focus:outline-none focus:border-rose-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/65 mb-1.5">
                  Blood Group
                </label>
                <select
                  value={logBloodType}
                  onChange={(e) => setLogBloodType(e.target.value as BloodType)}
                  className="w-full h-11 px-3 rounded-xl bg-[#12060D] border border-white/15 text-sm text-white [color-scheme:dark] focus:outline-none focus:border-rose-400"
                >
                  {BLOOD_TYPES.map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/65 mb-1.5">
                  Volume (mL)
                </label>
                <input
                  type="number"
                  min={100}
                  max={600}
                  step={10}
                  value={volumeMl}
                  onChange={(e) => setVolumeMl(Number(e.target.value) || 450)}
                  className="w-full h-11 px-3 rounded-xl bg-[#12060D] border border-white/15 text-sm text-white tabular-nums focus:outline-none focus:border-rose-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/65 mb-1.5">
                Notes (optional)
              </label>
              <textarea
                rows={2}
                maxLength={240}
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                placeholder="Whole blood, platelets, hemoglobin reading..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#12060D] border border-white/15 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-rose-400 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full min-h-[48px] rounded-2xl bg-[#E11D48] hover:bg-[#BE123C] disabled:opacity-60 text-sm font-semibold text-white inline-flex items-center justify-center gap-2 transition-colors"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Droplet className="w-4 h-4 fill-current" aria-hidden="true" />
              )}
              Record Blood Donation
            </button>
          </form>
        )}
      </div>

      {/* Footer PWA Install */}
      {!isInstalled && isInstallable && (
        <div className="p-4 border-t border-white/10 bg-[#13070D] shrink-0">
          <button
            type="button"
            onClick={install}
            className="w-full min-h-[44px] rounded-2xl border border-rose-300/35 bg-white/8 hover:bg-white/14 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4 text-rose-300" aria-hidden="true" />
            Install Android App
          </button>
        </div>
      )}
    </div>
  );
}
