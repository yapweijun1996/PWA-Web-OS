// Decorative icons: the adjoining text or control supplies the accessible name.
// Catalog paths and upstream revisions are listed in docs/UPSTREAM_REUSE.md.
const paths = {
  brand: 'M1 7 12 2l11 5-11 5z',
  cube: 'm3 7 9-4 9 4-9 4z M3 7v10l9 4 9-4V7M12 11v10',
  document: 'M14 2.75H7a2 2 0 0 0-2 2v14.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.75L14 2.75Z M14 2.75v3a2 2 0 0 0 2 2h3M8.5 12h7M8.5 15h7M8.5 18h5',
  lines: 'M3 5h.01 M3 12h.01 M3 19h.01 M8 5h13 M8 12h13 M8 19h13',
  chevron: 'm5 9 7 7 7-7',
  minimize: 'M5 16h14',
  maximize: 'M5 5h14v14H5z',
  restore: 'M8 5h11v11 M5 8h11v11H5z',
  close: 'm6 6 12 12 M18 6 6 18',
  back: 'M19 12H5M11 6l-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  check: 'm4 12 5 5L20 6',
} as const;

export function icon(name: keyof typeof paths): SVGSVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (name === 'brand') {
    for (const [offset, fill] of [[10, '#53bde8'], [5, '#535fdf'], [0, '#9665ff']] as const) {
      const layer = document.createElementNS(namespace, 'path');
      layer.setAttribute('d', paths.brand);
      layer.setAttribute('transform', `translate(0 ${offset})`);
      layer.setAttribute('fill', fill);
      svg.append(layer);
    }
    return svg;
  }
  const path = document.createElementNS(namespace, 'path');
  path.setAttribute('d', paths[name]);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}
