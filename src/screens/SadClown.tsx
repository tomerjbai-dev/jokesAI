// An original crying clown drawn in SVG (no red hair or yellow suit, to stay clear of any known mascot).
// Decorative only: hidden from screen readers. Animations live in global.css and respect reduced motion.
export default function SadClown() {
  return (
    <div className="sad-clown" aria-hidden="true">
      <svg viewBox="0 0 160 180" width="150" height="168">
        <g className="sad-clown__head">
          {/* Ruff collar */}
          <g fill="#a8820a">
            <circle cx="44" cy="150" r="14" />
            <circle cx="62" cy="158" r="14" />
            <circle cx="80" cy="160" r="14" />
            <circle cx="98" cy="158" r="14" />
            <circle cx="116" cy="150" r="14" />
          </g>

          {/* Grey hair tufts */}
          <g fill="#5a524b">
            <circle cx="30" cy="88" r="14" />
            <circle cx="24" cy="104" r="12" />
            <circle cx="130" cy="88" r="14" />
            <circle cx="136" cy="104" r="12" />
          </g>

          {/* Face */}
          <ellipse cx="80" cy="96" rx="48" ry="52" fill="#e9e2d6" />

          {/* Small bowler hat, tilted */}
          <g transform="rotate(-8 80 46)">
            <rect x="46" y="44" width="68" height="7" rx="3.5" fill="#2a2420" />
            <path d="M56 46 Q56 18 80 18 Q104 18 104 46 Z" fill="#2a2420" />
            <rect x="56" y="38" width="48" height="5" fill="#b3200c" />
          </g>

          {/* Eyebrows slanting up toward the middle */}
          <g stroke="#2a2420" strokeWidth="3.5" strokeLinecap="round" fill="none">
            <path d="M48 74 L68 68" />
            <path d="M112 74 L92 68" />
          </g>

          {/* Closed, drooping eyes */}
          <g stroke="#2a2420" strokeWidth="3" strokeLinecap="round" fill="none">
            <path d="M52 86 Q60 80 68 86" />
            <path d="M92 86 Q100 80 108 86" />
          </g>

          {/* Diamond markings under the eyes */}
          <g fill="#3a4a66">
            <path d="M60 92 L64 100 L60 108 L56 100 Z" />
            <path d="M100 92 L104 100 L100 108 L96 100 Z" />
          </g>

          {/* Nose */}
          <circle cx="80" cy="104" r="9" fill="#b3200c" />
          <circle cx="77" cy="101" r="2.5" fill="#e9e2d6" opacity="0.6" />

          {/* Frown */}
          <path
            d="M62 132 Q80 116 98 132"
            stroke="#2a2420"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* Falling tears, one per eye, out of step with each other */}
        <path className="sad-clown__tear" d="M60 110 Q55 118 60 122 Q65 118 60 110 Z" fill="#6fa8dc" />
        <path
          className="sad-clown__tear sad-clown__tear--late"
          d="M100 110 Q95 118 100 122 Q105 118 100 110 Z"
          fill="#6fa8dc"
        />
      </svg>
    </div>
  )
}
