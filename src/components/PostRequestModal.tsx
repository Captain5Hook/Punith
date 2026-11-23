import { Droplet, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { BloodType, RequestUrgency } from '../types/blood';
import { BLOOD_TYPES } from '../utils/bloodCompatibility';

interface PostRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCity: string;
  defaultBloodType: BloodType;
  onSubmit: (payload: {
    patientLabel: string;
    bloodType: BloodType;
    unitsNeeded: number;
    hospitalName: string;
    city: string;
    urgency: RequestUrgency;
    notes: string;
  }) => Promise<void>;
}

export function PostRequestModal({
  isOpen,
  onClose,
  defaultCity,
  defaultBloodType,
  onSubmit,
}: PostRequestModalProps) {
  const [patientLabel, setPatientLabel] = useState('');
  const [bloodType, setBloodType] = useState<BloodType>(defaultBloodType);
  const [unitsNeeded, setUnitsNeeded] = useState(2);
  const [hospitalName, setHospitalName] = useState('');
  const [city, setCity] = useState(defaultCity);
  const [urgency, setUrgency] = useState<RequestUrgency>('urgent');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCity(defaultCity);
    setBloodType(defaultBloodType);
    setError(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, defaultCity, defaultBloodType, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const pLabel = patientLabel.trim().slice(0, 80);
    const hosp = hospitalName.trim().slice(0, 120);
    const cityVal = city.trim().slice(0, 80);
    const notesVal = notes.trim().slice(0, 280);

    if (!pLabel || !hosp || !cityVal) {
      setError('Please enter patient ward/label, hospital name, and city.');
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({
        patientLabel: pLabel,
        bloodType,
        unitsNeeded: Math.min(10, Math.max(1, Math.round(unitsNeeded))),
        hospitalName: hosp,
        city: cityVal,
        urgency,
        notes: notesVal,
      });
      setPatientLabel('');
      setHospitalName('');
      setNotes('');
      onClose();
    } catch (err) {
      let readable = 'Unable to post blood request.';
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message) as { error?: string };
          readable = parsed.error || readable;
        } catch {
          readable = err.message || readable;
        }
      }
      setError(readable);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-request-title"
      className="absolute inset-0 z-50 flex items-end justify-center bg-[#0B0408]/80 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-h-[90%] flex flex-col rounded-t-[32px] border-t border-x border-white/15 bg-[#230E1A] shadow-[0_-16px_48px_rgba(0,0,0,0.65)] overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10 shrink-0">
          <h2 id="post-request-title" className="font-display text-lg font-semibold text-white">
            Request Blood
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close request modal"
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4 no-scrollbar">
          {error && (
            <div className="rounded-xl border border-rose-400/35 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}

          <div>
            <span className="block text-xs font-medium text-white/65 mb-2">
              Blood Group Needed
            </span>
            <div className="grid grid-cols-4 gap-2">
              {BLOOD_TYPES.map((bt) => (
                <button
                  key={bt}
                  type="button"
                  onClick={() => setBloodType(bt)}
                  className={`min-h-[42px] rounded-xl font-display text-sm font-semibold transition-colors ${
                    bloodType === bt
                      ? 'bg-[#BE123C] text-white border border-rose-300/50'
                      : 'bg-[#170911] text-white/75 border border-white/12 hover:text-white'
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
                Urgency
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as RequestUrgency)}
                className="w-full h-11 px-3 rounded-xl bg-[#170911] border border-white/15 text-sm text-white [color-scheme:dark] focus:outline-none focus:border-rose-400"
              >
                <option value="critical">Critical</option>
                <option value="urgent">Urgent</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/65 mb-1.5">
                Units Needed (1–10)
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={unitsNeeded}
                onChange={(e) => setUnitsNeeded(Number(e.target.value) || 1)}
                className="w-full h-11 px-3 rounded-xl bg-[#170911] border border-white/15 text-sm text-white tabular-nums focus:outline-none focus:border-rose-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/65 mb-1.5">
              Hospital / Blood Center
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={hospitalName}
              onChange={(e) => setHospitalName(e.target.value)}
              placeholder="e.g., Apollo Hospitals"
              className="w-full h-11 px-3.5 rounded-xl bg-[#170911] border border-white/15 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-rose-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/65 mb-1.5">
                Ward / Patient Ref
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={patientLabel}
                onChange={(e) => setPatientLabel(e.target.value)}
                placeholder="e.g., Trauma Ward B"
                className="w-full h-11 px-3.5 rounded-xl bg-[#170911] border border-white/15 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-rose-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/65 mb-1.5">
                City / State
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Hyderabad, Telangana"
                className="w-full h-11 px-3.5 rounded-xl bg-[#170911] border border-white/15 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-rose-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/65 mb-1.5">
              Notes for Donors (optional)
            </label>
            <textarea
              rows={2}
              maxLength={280}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Donor desk hours, cross-match instructions..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#170911] border border-white/15 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-rose-400 resize-none"
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
            {isSaving ? 'Publishing Request...' : 'Publish Blood Request'}
          </button>
        </form>
      </div>
    </div>
  );
}
