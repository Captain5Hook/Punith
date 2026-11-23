import type { BloodType } from '../types/blood';

interface AtmosphericBloodSceneProps {
  bloodType: BloodType;
  isEligible: boolean;
}

export function AtmosphericBloodScene({
  bloodType,
  isEligible,
}: AtmosphericBloodSceneProps) {
  return (
    <div
      className="relative mx-auto w-full max-w-[240px] select-none pointer-events-none"
      aria-hidden="true"
    >
      {/* Crimson atmospheric aura */}
      <div
        className="absolute inset-x-8 top-4 bottom-4 rounded-full blur-3xl transition-opacity duration-700"
        style={{
          background:
            'radial-gradient(circle, rgba(244,63,94,0.36) 0%, rgba(190,18,60,0.08) 65%, transparent 80%)',
        }}
      />

      <svg
        viewBox="0 0 300 185"
        className="relative z-10 w-full h-auto"
        fill="none"
      >
        <defs>
          <linearGradient id="bloodDropGrad" x1="150" y1="20" x2="150" y2="160" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDA4AF" />
            <stop offset="28%" stopColor="#F43F5E" />
            <stop offset="68%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#7F1D3A" />
          </linearGradient>

          <linearGradient id="dropHighlight" x1="118" y1="44" x2="152" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="pulseLineGrad" x1="16" y1="112" x2="284" y2="112" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FB7185" stopOpacity="0" />
            <stop offset="25%" stopColor="#FDA4AF" stopOpacity="0.82" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.96" />
            <stop offset="75%" stopColor="#FDA4AF" stopOpacity="0.82" />
            <stop offset="100%" stopColor="#FB7185" stopOpacity="0" />
          </linearGradient>

          <radialGradient id="pedestalGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E11D48" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#E11D48" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Concentric subtle pulse rings */}
        <circle
          cx="150"
          cy="102"
          r="70"
          stroke="rgba(253,164,175,0.16)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <circle
          cx="150"
          cy="102"
          r="52"
          stroke={isEligible ? 'rgba(52,211,153,0.28)' : 'rgba(251,113,133,0.28)'}
          strokeWidth="1.3"
        />

        {/* ECG Heartbeat waveform behind the droplet */}
        <path
          d="M16 112 H76 L88 94 L100 128 L113 78 L125 134 L136 112 H164 L175 96 L186 124 L198 86 L209 126 L220 112 H284"
          stroke="url(#pulseLineGrad)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Soft ground reflection */}
        <ellipse cx="150" cy="167" rx="74" ry="11" fill="url(#pedestalGlow)" />

        {/* Central 3D-styled Crimson Blood Droplet */}
        <g className="animate-float-slow">
          <path
            d="M150 22C150 22 102 78 102 111C102 137.5 123.5 159 150 159C176.5 159 198 137.5 198 111C198 78 150 22 150 22Z"
            fill="url(#bloodDropGrad)"
          />

          {/* Subtle liquid caustic rim inside */}
          <path
            d="M150 26C150 26 106 79 106 111C106 135.3 125.7 155 150 155C174.3 155 194 135.3 194 111C194 79 150 26 150 26Z"
            stroke="rgba(255,255,255,0.34)"
            strokeWidth="1.25"
          />

          {/* Curved specular highlight */}
          <path
            d="M135 55C124 72 116 92 117 112C117.5 122 122 131 128 137"
            stroke="url(#dropHighlight)"
            strokeWidth="5.5"
            strokeLinecap="round"
          />

          {/* Blood type badge inside droplet */}
          <text
            x="150"
            y="121"
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily="Outfit, sans-serif"
            fontSize="28"
            fontWeight="600"
            letterSpacing="-0.5"
          >
            {bloodType}
          </text>
        </g>

        {/* Floating micro platelets */}
        <circle cx="64" cy="70" r="2.8" fill="#FDA4AF" opacity="0.65" className="animate-twinkle" />
        <circle cx="238" cy="64" r="3.2" fill="#FDA4AF" opacity="0.55" className="animate-twinkle" />
        <circle cx="82" cy="144" r="2" fill="#FECDD3" opacity="0.5" />
        <circle cx="222" cy="142" r="2.4" fill="#FECDD3" opacity="0.6" />
      </svg>
    </div>
  );
}
