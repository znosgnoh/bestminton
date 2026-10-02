/** Brand mark SVG fallback (racket + shuttlecock), gold tile for PWA/legacy. */
export function racketIconSvg(size: number, cornerRadius = size * 0.22): string {
  const s = size / 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fcd34d"/>
      <stop offset="55%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="url(#bg)"/>
  <g transform="translate(${12 * s},${10 * s}) scale(${1.65 * s})">
    <!-- racket head -->
    <circle cx="14" cy="14" r="11" fill="#0f172a"/>
    <g stroke="#f59e0b" stroke-width="1.1" opacity="0.55">
      <path d="M6 10h16M6 14h16M6 18h16"/>
      <path d="M10 6v16M14 6v16M18 6v16"/>
    </g>
    <circle cx="14" cy="14" r="11" fill="none" stroke="#0f172a" stroke-width="2.4"/>
    <!-- handle -->
    <path d="M21 21l10 12" stroke="#0f172a" stroke-width="3.6" stroke-linecap="round"/>
    <!-- shuttlecock -->
    <g transform="translate(18,4)">
      <path d="M2 10c0 3 2.2 5 5 5s5-2 5-5c0-4-2.5-8-5-9.5C7 2 2 6 2 10z" fill="#0f172a"/>
      <ellipse cx="7" cy="13.2" rx="3.2" ry="2.2" fill="#0f172a"/>
      <path d="M4.2 0.8c1.2 1.6 1.6 3.4 1.6 5.2M7 0.2c.4 1.8.6 3.6.6 5.6M9.8 0.8c-1 1.6-1.4 3.4-1.4 5.2" stroke="#f59e0b" stroke-width="1" stroke-linecap="round" opacity="0.0"/>
    </g>
  </g>
</svg>`;
}
