import { List, MapPin } from 'lucide-react';

interface BottomDockProps {
  onOpenMap: () => void;
  onOpenRequestModal: () => void;
  onOpenDonorCard: () => void;
}

export function BottomDock({
  onOpenMap,
  onOpenRequestModal,
  onOpenDonorCard,
}: BottomDockProps) {
  return (
    <nav
      aria-label="Primary actions"
      className="absolute bottom-0 inset-x-0 z-30 pointer-events-none"
    >
      <div className="relative w-full h-[80px] flex items-end justify-between px-7 pb-3.5">
        {/* Sculpted wave dock matching the home backdrop */}
        <svg
          viewBox="0 0 360 80"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-auto"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="bloodDockFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4E1C36" stopOpacity="0.96" />
              <stop offset="100%" stopColor="#190812" stopOpacity="0.99" />
            </linearGradient>
            <linearGradient id="bloodDockStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
              <stop offset="50%" stopColor="rgba(253,164,175,0.42)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.12)" />
            </linearGradient>
          </defs>
          <path
            d="M0 26 C 82 26, 114 2, 180 2 C 246 2, 278 26, 360 26 L 360 80 L 0 80 Z"
            fill="url(#bloodDockFill)"
          />
          <path
            d="M0 26 C 82 26, 114 2, 180 2 C 246 2, 278 26, 360 26"
            fill="none"
            stroke="url(#bloodDockStroke)"
            strokeWidth="1.35"
          />
        </svg>

        {/* Left: Open Whole India Map & State Locator */}
        <button
          type="button"
          onClick={onOpenMap}
          aria-label="Open India map and locate state"
          className="relative z-10 pointer-events-auto min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-rose-100/90 hover:text-white hover:bg-white/8 active:scale-95 transition-all focus-visible:outline-2 focus-visible:outline-rose-300"
        >
          <MapPin className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* Center: Elevated Circular Pearl-White Blood Drop Button */}
        <button
          type="button"
          onClick={onOpenRequestModal}
          aria-label="Post blood request"
          className="relative z-10 pointer-events-auto -translate-y-2 w-[54px] h-[54px] rounded-full bg-gradient-to-b from-[#FFFFFF] via-[#FFF1F4] to-[#F5DDE4] flex items-center justify-center shadow-[0_10px_26px_rgba(12,2,8,0.68)] ring-4 ring-[#2C1020]/75 hover:scale-105 active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-white"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-7 h-7"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="dockDropFill" x1="12" y1="3" x2="12" y2="21" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FB7185" />
                <stop offset="48%" stopColor="#E11D48" />
                <stop offset="100%" stopColor="#9F1239" />
              </linearGradient>
            </defs>
            <path
              d="M12 2.8C12 2.8 5.5 10.1 5.5 14.5C5.5 18.09 8.41 21 12 21C15.59 21 18.5 18.09 18.5 14.5C18.5 10.1 12 2.8 12 2.8Z"
              fill="url(#dockDropFill)"
              stroke="#881337"
              strokeWidth="0.9"
            />
            <path
              d="M9.6 11.4C8.9 12.8 8.6 14.2 8.9 15.6"
              stroke="#FFFFFF"
              strokeOpacity="0.65"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Right: List / Donor Card & History */}
        <button
          type="button"
          onClick={onOpenDonorCard}
          aria-label="Open donor card and history"
          className="relative z-10 pointer-events-auto min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-rose-100/90 hover:text-white hover:bg-white/8 active:scale-95 transition-all focus-visible:outline-2 focus-visible:outline-rose-300"
        >
          <List className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* Samsung One UI gesture bar */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 rounded-full bg-white/30"
        />
      </div>
    </nav>
  );
}
