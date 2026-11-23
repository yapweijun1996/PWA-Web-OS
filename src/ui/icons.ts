// Decorative icons: the adjoining text or control supplies the accessible name.
const paths = {
  brand: 'M1 7 12 2l11 5-11 5z',
  cube: 'm12 2 9 5v10l-9 5-9-5V7z m-9 5 9 5 9-5 M12 12v10',
  document: 'M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h8',
  lines: 'M5 6h14 M5 12h14 M5 18h9',
  chevron: 'm6 9 6 6 6-6',
  minimize: 'M5 16h14',
  maximize: 'M5 5h14v14H5z',
  restore: 'M8 5h11v11 M5 8h11v11H5z',
  close: 'm6 6 12 12 M18 6 6 18',
  back: 'M20 12H4 m7-7-7 7 7 7',
  plus: 'M12 4v16 M4 12h16',
  check: 'm6 12 4 4 8-8',
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
  path.setAttribute('stroke-width', '1.6');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}
