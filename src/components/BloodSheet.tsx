import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Droplet,
  MapPin,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type {
  BloodCenter,
  BloodRequest,
  BloodType,
  DonationLog,
  DonorProfile,
  RequestUrgency,
} from '../types/blood';
import {
  BLOOD_COMPATIBILITY,
  BLOOD_TYPES,
  computeEligibility,
  distanceKm,
} from '../utils/bloodCompatibility';

interface BloodSheetProps {
  activeTab: 'needs' | 'banks';
  onTabChange: (tab: 'needs' | 'banks') => void;
  expanded: boolean;
  onExpandChange: (expanded: boolean) => void;
  deviceDonorId: string;
  requests: BloodRequest[];
  pledgedRequestIds: Set<string>;
  selectedBloodFilter: BloodType | 'ALL';
  onSelectBloodFilter: (bt: BloodType | 'ALL') => void;
  onPledgeUnit: (req: BloodRequest) => Promise<void>;
  onUpdateRequestStatus: (req: BloodRequest, status: 'fulfilled' | 'cancelled') => Promise<void>;
  busyRequestId: string | null;
  centers: BloodCenter[];
  userCoords: { lat: number; lon: number } | null;
  donorProfile: DonorProfile | null;
  donations: DonationLog[];
  onOpenRequestModal: () => void;
  onOpenLogDonation: (prefillCenter?: BloodCenter) => void;
  onDeleteDonation: (donationId: string) => Promise<void>;
  onOpenMap: () => void;
}

function urgencyMeta(urgency: RequestUrgency) {
  switch (urgency) {
    case 'critical':
      return {
        label: 'Critical',
        textClass: 'text-rose-300',
        Icon: AlertTriangle,
      };
    case 'urgent':
      return {
        label: 'Urgent',
        textClass: 'text-amber-300',
        Icon: Clock,
      };
    case 'scheduled':
      return {
        label: 'Scheduled',
        textClass: 'text-rose-200',
        Icon: Calendar,
      };
  }
}

export function BloodSheet({
  activeTab,
  onTabChange,
  expanded,
  onExpandChange,
  deviceDonorId,
  requests,
  pledgedRequestIds,
  selectedBloodFilter,
  onSelectBloodFilter,
  onPledgeUnit,
  onUpdateRequestStatus,
  busyRequestId,
  centers,
  userCoords,
  donorProfile,
  donations,
  onOpenRequestModal,
  onOpenLogDonation,
  onDeleteDonation,
  onOpenMap,
}: BloodSheetProps) {
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const railDragRef = useRef<{
    startX: number;
    startY: number;
    startScrollLeft: number;
    didDragX: boolean;
  } | null>(null);
  const suppressRailClickRef = useRef(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [selectedCenterId, setSelectedCenterId] = useState<string>(centers[0]?.id ?? '');
  const [matchType, setMatchType] = useState<BloodType>(donorProfile?.bloodType ?? 'O-');

  useEffect(() => {
    if (centers.length === 0) {
      setSelectedCenterId('');
    } else if (!centers.some((c) => c.id === selectedCenterId)) {
      setSelectedCenterId(centers[0].id);
    }
  }, [centers, selectedCenterId]);

  useEffect(() => {
    if (donorProfile?.bloodType) {
      setMatchType(donorProfile.bloodType);
    }
  }, [donorProfile?.bloodType]);

  const openRequests = requests.filter((r) => r.status === 'open');
  const filteredRequests =
    selectedBloodFilter === 'ALL'
      ? requests
      : requests.filter((r) => r.bloodType === selectedBloodFilter);

  const sortedCenters = [...centers].sort((a, b) => {
    if (!userCoords) return 0;
    return (
      distanceKm(userCoords.lat, userCoords.lon, a.latitude, a.longitude) -
      distanceKm(userCoords.lat, userCoords.lon, b.latitude, b.longitude)
    );
  });

  const eligibility = computeEligibility(donorProfile?.lastDonationDate ?? '');
  const compat = BLOOD_COMPATIBILITY[matchType];

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setDragOffsetY(0);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    if (Math.abs(deltaY) <= Math.abs(deltaX)) return;

    if (!expanded && deltaY < 0) {
      setDragOffsetY(Math.max(-90, deltaY));
    } else if (expanded && deltaY > 0) {
      setDragOffsetY(Math.min(90, deltaY));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    dragStartRef.current = null;
    setDragOffsetY(0);

    if (Math.abs(deltaY) > 8) {
      suppressRailClickRef.current = true;
      setTimeout(() => {
        suppressRailClickRef.current = false;
      }, 0);
    }

    if (Math.abs(deltaY) <= Math.abs(deltaX)) return;

    if (!expanded && deltaY < -24) {
      onExpandChange(true);
    } else if (expanded && deltaY > 28) {
      onExpandChange(false);
    }
  };

  const handleRailWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = railRef.current;
    if (!el || expanded) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
    }
  };

  const handleRailPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !railRef.current) return;
    railDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: railRef.current.scrollLeft,
      didDragX: false,
    };
  };

  const handleRailPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = railDragRef.current;
    const el = railRef.current;
    if (!state || !el) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy)) {
      state.didDragX = true;
      el.scrollLeft = state.startScrollLeft - dx;
    }
  };

  const handleRailPointerUp = () => {
    if (railDragRef.current?.didDragX) {
      suppressRailClickRef.current = true;
      setTimeout(() => {
        suppressRailClickRef.current = false;
      }, 0);
    }
    railDragRef.current = null;
  };

  return (
    <section
      aria-label="Blood Hub Drawer"
      onPointerDown={!expanded ? handlePointerDown : undefined}
      onPointerMove={!expanded ? handlePointerMove : undefined}
      onPointerUp={!expanded ? handlePointerUp : undefined}
      onPointerCancel={!expanded ? handlePointerUp : undefined}
      className={`absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[36px] border-t border-x border-white/18 bg-[#2C1323]/75 backdrop-blur-2xl shadow-[0_-12px_40px_rgba(12,2,8,0.55)] transition-all duration-300 ease-out ${
        expanded ? 'h-[78%]' : 'h-[288px]'
      }`}
      style={{
        transform: dragOffsetY !== 0 ? `translateY(${dragOffsetY}px)` : undefined,
      }}
    >
      {/* Top specular highlight */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
        aria-hidden="true"
      />

      {/* Draggable Handle + 2-Tab Header (exact screenshot rhythm) */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="shrink-0 touch-none select-none cursor-grab active:cursor-grabbing"
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <button
            type="button"
            onClick={() => onExpandChange(!expanded)}
            aria-label={expanded ? 'Collapse sheet' : 'Drag or tap to expand details'}
            className="min-h-[20px] px-8 flex items-center justify-center focus-visible:outline-2 focus-visible:outline-rose-300 rounded-full"
          >
            <span className="block w-11 h-1 rounded-full bg-white/30" />
          </button>
        </div>

        <div className="relative flex items-center border-b border-white/10 px-5">
          <button
            type="button"
            onClick={() => onTabChange('needs')}
            className={`relative flex-1 pb-2.5 text-[13px] font-medium tracking-wide whitespace-nowrap shrink-0 transition-colors min-h-[38px] focus-visible:outline-2 focus-visible:outline-rose-300 ${
              activeTab === 'needs' ? 'text-white' : 'text-white/55 hover:text-white/85'
            }`}
          >
            Urgent Needs
            {activeTab === 'needs' && (
              <span
                className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-rose-300 to-transparent"
                aria-hidden="true"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => onTabChange('banks')}
            className={`relative flex-1 pb-2.5 text-[13px] font-medium tracking-wide whitespace-nowrap shrink-0 transition-colors min-h-[38px] focus-visible:outline-2 focus-visible:outline-rose-300 ${
              activeTab === 'banks' ? 'text-white' : 'text-white/55 hover:text-white/85'
            }`}
          >
            Blood Banks
            {activeTab === 'banks' && (
              <span
                className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-rose-300 to-transparent"
                aria-hidden="true"
              />
            )}
          </button>
        </div>
      </div>

      {/* Sheet Body */}
      <div
        className={`flex-1 min-h-0 px-4 pt-3 pb-[96px] overscroll-contain ${
          expanded ? 'overflow-y-auto touch-pan-y no-scrollbar' : 'overflow-hidden'
        }`}
      >
        {activeTab === 'needs' ? (
          <div className="space-y-4">
            {/* Horizontal Capsule Row (matches screenshot capsules directly above dock) */}
            <div
              ref={railRef}
              onWheel={handleRailWheel}
              onPointerDown={handleRailPointerDown}
              onPointerMove={handleRailPointerMove}
              onPointerUp={handleRailPointerUp}
              onPointerCancel={handleRailPointerUp}
              className="flex items-stretch gap-2.5 overflow-x-auto touch-pan-x overscroll-x-contain no-scrollbar select-none cursor-grab active:cursor-grabbing"
            >
              <button
                type="button"
                onClick={() => {
                  if (suppressRailClickRef.current) return;
                  if (selectedBloodFilter === 'ALL' && !expanded) {
                    onExpandChange(true);
                  } else {
                    onSelectBloodFilter('ALL');
                  }
                }}
                aria-pressed={selectedBloodFilter === 'ALL'}
                className={`shrink-0 w-[56px] h-[116px] rounded-full px-2 py-3 flex flex-col items-center justify-between transition-all focus-visible:outline-2 focus-visible:outline-rose-300 ${
                  selectedBloodFilter === 'ALL'
                    ? 'bg-[#BE123C] border border-rose-300/50 shadow-[0_8px_22px_rgba(190,18,60,0.58)]'
                    : 'bg-[#210D19]/65 border border-white/14 hover:bg-[#351627]'
                }`}
              >
                <span className="text-[12px] font-medium text-white">All</span>
                <div className="flex flex-col items-center gap-0.5">
                  <Droplet className="w-4 h-4 text-rose-200 fill-rose-300/35" aria-hidden="true" />
                  <span className="text-[10px] font-semibold text-rose-100 tabular-nums">
                    {openRequests.length > 0 ? `${openRequests.length} open` : 'Live'}
                  </span>
                </div>
                <span className="font-display text-[16px] font-medium text-white tabular-nums">
                  {requests.length}
                </span>
              </button>

              {BLOOD_TYPES.map((bt) => {
                const isSelected = selectedBloodFilter === bt;
                const count = openRequests.filter((r) => r.bloodType === bt).length;
                return (
                  <button
                    key={bt}
                    type="button"
                    onClick={() => {
                      if (suppressRailClickRef.current) return;
                      if (isSelected && !expanded) {
                        onExpandChange(true);
                      } else {
                        onSelectBloodFilter(bt);
                      }
                    }}
                    aria-pressed={isSelected}
                    className={`shrink-0 w-[56px] h-[116px] rounded-full px-2 py-3 flex flex-col items-center justify-between transition-all focus-visible:outline-2 focus-visible:outline-rose-300 ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#E11D48] to-[#9F1239] border border-rose-200/55 shadow-[0_8px_22px_rgba(190,18,60,0.58)]'
                        : 'bg-[#210D19]/70 border border-white/14 hover:bg-[#351627]'
                    }`}
                  >
                    <span className="text-[12px] font-medium text-white/95">{bt}</span>
                    <div className="flex flex-col items-center gap-0.5">
                      <Droplet className="w-4 h-4 text-rose-300 fill-rose-400/40" aria-hidden="true" />
                      <span
                        className={`text-[10px] font-semibold tabular-nums ${
                          count > 0 ? 'text-rose-200' : 'text-transparent select-none'
                        }`}
                      >
                        {count > 0 ? `${count} need` : '0'}
                      </span>
                    </div>
                    <span className="font-display text-[16px] font-medium text-white tabular-nums">
                      {count}u
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Revealed ONLY after dragging up / expanding */}
            {expanded && (
              <div className="space-y-4 pt-1">
                {/* 56-Day Eligibility Strip */}
                <div className="rounded-[20px] border border-white/12 bg-[#220D19]/75 p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-medium text-white/55">
                        Donor Recovery Status
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-white">
                        {eligibility.isEligible ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                            <span>Eligible to Donate Today</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4 text-amber-300" aria-hidden="true" />
                            <span className="tabular-nums">
                              {eligibility.daysRemaining}d left
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenLogDonation()}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#BE123C] hover:bg-[#E11D48] text-xs font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                    >
                      <Droplet className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                      Log Donation
                    </button>
                  </div>

                  <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        eligibility.isEligible
                          ? 'bg-emerald-400'
                          : 'bg-gradient-to-r from-rose-400 to-amber-300'
                      }`}
                      style={{ width: `${eligibility.progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Live Requests Feed */}
                {filteredRequests.length === 0 ? (
                  <div className="rounded-[22px] border border-white/12 bg-[#220E1A]/65 p-5 text-center space-y-3">
                    <p className="text-sm text-white/80">
                      No {selectedBloodFilter === 'ALL' ? '' : `${selectedBloodFilter} `}blood requests right now.
                    </p>
                    <button
                      type="button"
                      onClick={onOpenRequestModal}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#BE123C] hover:bg-[#E11D48] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Droplet className="w-4 h-4 fill-current" aria-hidden="true" />
                      Post Blood Request
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredRequests.map((req) => {
                      const meta = urgencyMeta(req.urgency);
                      const UrgencyIcon = meta.Icon;
                      const isOwnRequest = req.requesterId === deviceDonorId;
                      const hasPledged = pledgedRequestIds.has(req.id);
                      const isBusy = busyRequestId === req.id;
                      const pct = Math.min(
                        100,
                        Math.round((req.unitsPledged / Math.max(1, req.unitsNeeded)) * 100)
                      );

                      return (
                        <article
                          key={req.id}
                          className="rounded-[22px] border border-white/12 bg-[#230E1A]/85 p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-2xl bg-[#BE123C]/90 border border-rose-300/35 flex items-center justify-center font-display text-base font-bold text-white shrink-0">
                                {req.bloodType}
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-sm font-semibold text-white truncate">
                                  {req.hospitalName}
                                </h3>
                                <p className="text-xs text-white/65 truncate">
                                  {req.patientLabel} · {req.city}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold shrink-0 ${meta.textClass}`}
                            >
                              <UrgencyIcon className="w-3.5 h-3.5" aria-hidden="true" />
                              {req.status === 'open'
                                ? meta.label
                                : req.status === 'fulfilled'
                                  ? 'Fulfilled'
                                  : 'Cancelled'}
                            </span>
                          </div>

                          {req.notes && (
                            <p className="text-xs text-white/75 leading-relaxed">{req.notes}</p>
                          )}

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-white/70 tabular-nums">
                              <span>Posted by {req.requesterName}</span>
                              <span className="font-medium text-white">
                                {req.unitsPledged} / {req.unitsNeeded} units
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-300 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          {req.status === 'open' && (
                            <div className="flex items-center gap-2 pt-0.5">
                              {isOwnRequest ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => onUpdateRequestStatus(req, 'fulfilled')}
                                    className="flex-1 min-h-[40px] rounded-xl bg-emerald-600/85 hover:bg-emerald-600 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
                                  >
                                    Mark Fulfilled
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => onUpdateRequestStatus(req, 'cancelled')}
                                    className="min-h-[40px] px-3.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-xs font-medium text-white/80 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : hasPledged ? (
                                <div className="w-full min-h-[40px] rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                                  You pledged 1 unit
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isBusy || req.unitsPledged >= req.unitsNeeded}
                                  onClick={() => onPledgeUnit(req)}
                                  className="w-full min-h-[42px] rounded-xl bg-[#E11D48] hover:bg-[#BE123C] disabled:opacity-50 text-xs font-semibold text-white transition-colors"
                                >
                                  {isBusy ? 'Confirming Pledge...' : 'Pledge 1 Unit'}
                                </button>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}

                {/* Blood Compatibility Explorer inside expanded sheet */}
                <div className="rounded-[22px] border border-white/12 bg-[#230E1A]/85 p-4 space-y-3">
                  <div className="text-xs font-semibold text-white">
                    Compatibility Check
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {BLOOD_TYPES.map((bt) => (
                      <button
                        key={bt}
                        type="button"
                        onClick={() => setMatchType(bt)}
                        className={`min-h-[36px] rounded-xl font-display text-xs font-semibold transition-colors ${
                          matchType === bt
                            ? 'bg-[#BE123C] text-white'
                            : 'bg-white/6 text-white/75 hover:text-white'
                        }`}
                      >
                        {bt}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-rose-200 font-medium">{compat.label}</div>
                  <div className="text-xs text-white/70">
                    Can donate to: <span className="text-emerald-300 font-medium">{compat.canDonateTo.join(', ')}</span>
                  </div>
                  <div className="text-xs text-white/70">
                    Can receive from: <span className="text-rose-200 font-medium">{compat.canReceiveFrom.join(', ')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Horizontal Capsules for Blood Banks when collapsed/expanded */}
            <div
              ref={railRef}
              onWheel={handleRailWheel}
              onPointerDown={handleRailPointerDown}
              onPointerMove={handleRailPointerMove}
              onPointerUp={handleRailPointerUp}
              onPointerCancel={handleRailPointerUp}
              className="flex items-stretch gap-2.5 overflow-x-auto touch-pan-x overscroll-x-contain no-scrollbar select-none cursor-grab active:cursor-grabbing"
            >
              <button
                type="button"
                onClick={() => {
                  if (suppressRailClickRef.current) return;
                  onOpenMap();
                }}
                className="shrink-0 w-[62px] h-[116px] rounded-full px-2 py-3 flex flex-col items-center justify-between bg-[#BE123C] border border-rose-300/50 shadow-[0_8px_22px_rgba(190,18,60,0.58)] transition-all focus-visible:outline-2 focus-visible:outline-rose-300"
              >
                <span className="text-[11px] font-medium text-white">India</span>
                <div className="flex flex-col items-center gap-0.5">
                  <MapPin className="w-4 h-4 text-white" aria-hidden="true" />
                  <span className="text-[10px] font-semibold text-rose-100">Map</span>
                </div>
                <span className="font-display text-[13px] font-semibold text-white">
                  {sortedCenters.length > 0 ? `${sortedCenters.length}` : 'Open'}
                </span>
              </button>

              {sortedCenters.map((center) => {
                const isSelected = selectedCenterId === center.id;
                const dist = userCoords
                  ? distanceKm(userCoords.lat, userCoords.lon, center.latitude, center.longitude)
                  : null;
                const shortName = center.name.slice(0, 6);

                return (
                  <button
                    key={center.id}
                    type="button"
                    onClick={() => {
                      if (suppressRailClickRef.current) return;
                      if (isSelected && !expanded) {
                        onExpandChange(true);
                      } else {
                        setSelectedCenterId(center.id);
                      }
                    }}
                    className={`shrink-0 w-[62px] h-[116px] rounded-full px-2 py-3 flex flex-col items-center justify-between transition-all focus-visible:outline-2 focus-visible:outline-rose-300 ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#E11D48] to-[#9F1239] border border-rose-200/55 shadow-[0_8px_22px_rgba(190,18,60,0.58)]'
                        : 'bg-[#210D19]/70 border border-white/14 hover:bg-[#351627]'
                    }`}
                  >
                    <span className="text-[11px] font-medium text-white truncate max-w-full">
                      {shortName}
                    </span>
                    <div className="flex flex-col items-center gap-0.5">
                      <MapPin className="w-4 h-4 text-rose-200" aria-hidden="true" />
                      <span className="text-[10px] font-semibold text-rose-200 tabular-nums">
                        {dist !== null ? `${Math.round(dist)}km` : 'Open'}
                      </span>
                    </div>
                    <span className="font-display text-[14px] font-semibold text-white">
                      {center.neededTypes[0]}
                    </span>
                  </button>
                );
              })}
            </div>

            {expanded && (
              <div className="space-y-3 pt-1">
                {sortedCenters.length === 0 ? (
                  <div className="rounded-[22px] border border-white/12 bg-[#230E1A]/85 p-5 text-center space-y-3">
                    <p className="text-xs text-white/75">
                      Open the India Map and turn on location or select a state to load nearby blood banks.
                    </p>
                    <button
                      type="button"
                      onClick={onOpenMap}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#BE123C] hover:bg-[#E11D48] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors"
                    >
                      <MapPin className="w-4 h-4" aria-hidden="true" />
                      Open India Map
                    </button>
                  </div>
                ) : (
                  sortedCenters.map((center) => {
                  const dist = userCoords
                    ? distanceKm(
                        userCoords.lat,
                        userCoords.lon,
                        center.latitude,
                        center.longitude
                      )
                    : null;

                  return (
                    <article
                      key={center.id}
                      onClick={() => setSelectedCenterId(center.id)}
                      className={`rounded-[22px] border p-4 space-y-2.5 transition-colors cursor-pointer ${
                        selectedCenterId === center.id
                          ? 'border-rose-300/55 bg-[#361325]/90'
                          : 'border-white/12 bg-[#230E1A]/85'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-white">{center.name}</h3>
                          <p className="text-xs text-white/60 mt-0.5">{center.address}</p>
                        </div>
                        {dist !== null && (
                          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-rose-200 tabular-nums">
                            <MapPin className="w-3 h-3" aria-hidden="true" />
                            {dist < 10 ? dist.toFixed(1) : Math.round(dist)} km
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="text-xs text-white/70">
                          <span>{center.hours}</span>
                          <span aria-hidden="true"> · </span>
                          <span className="text-rose-200 font-medium">
                            Needs {center.neededTypes.join(', ')}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenLogDonation(center)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/18 text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors"
                        >
                          Log Visit
                        </button>
                      </div>
                    </article>
                  );
                }))}

                {donations.length > 0 && (
                  <div className="rounded-[22px] border border-white/12 bg-[#230E1A]/85 p-4 space-y-2">
                    <div className="text-xs font-semibold text-white">
                      Your Recent Donations ({donations.length})
                    </div>
                    {donations.slice(0, 3).map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate">{d.centerName}</div>
                          <div className="text-white/55 tabular-nums">
                            {d.donatedDate} · {d.bloodType} · {d.volumeMl} mL
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteDonation(d.id)}
                          aria-label={`Delete donation at ${d.centerName}`}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-white/45 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
