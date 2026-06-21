/** Shared Tet-themed badminton racket SVG (red bg, gold strokes). */
export function racketIconSvg(size: number, cornerRadius = size * 0.1875): string {
  const scale = size / 32;
  const pad = 4 * scale;
  const stroke = 2 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="#DC2626"/>
  <g transform="translate(${pad}, ${2 * scale})" stroke="#FBBF24" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <ellipse cx="${12 * scale}" cy="${8.5 * scale}" rx="${6 * scale}" ry="${5 * scale}"/>
    <path d="M${7.5 * scale} ${8.5 * scale}h${9 * scale}"/>
    <path d="M${12 * scale} ${4.5 * scale}v${8 * scale}"/>
    <path d="M${9.5 * scale} ${6.5 * scale}h${5 * scale}"/>
    <path d="M${9.5 * scale} ${10.5 * scale}h${5 * scale}"/>
    <path d="M${12 * scale} ${13.5 * scale}v${10 * scale}"/>
  </g>
</svg>`;
}
