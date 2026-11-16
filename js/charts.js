// Minimal dependency-free SVG line chart.

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const k of kids) if (k != null) el.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
  return el;
};

function niceTicks(min, max, count = 5) {
  if (!(max > min)) { max = min + 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= step0) || step0;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

/**
 * series: [{name, color, points:[{x, y, label?, marker?:'x'}]}]
 * opts: {height, xFmt, yFmt, xLabel, yLabel, invertY, xTicks}
 */
export function lineChart(series, opts = {}) {
  // Render at the real container width so text stays a normal size on any screen.
  const avail = (document.querySelector('#view')?.clientWidth || 900) - 60;
  const W = Math.max(320, Math.min(1400, opts.width || avail)), H = opts.height || (W < 600 ? 200 : 240);
  const m = { l: 56, r: 16, t: 14, b: 34 };
  const pts = series.flatMap((se) => se.points.filter((p) => Number.isFinite(p.y)));
  if (!pts.length) return null;
  let xmin = Math.min(...pts.map((p) => p.x)), xmax = Math.max(...pts.map((p) => p.x));
  let ymin = Math.min(...pts.map((p) => p.y)), ymax = Math.max(...pts.map((p) => p.y));
  if (xmin === xmax) { xmin -= 1; xmax += 1; }
  const pad = (ymax - ymin) * 0.12 || Math.abs(ymax) * 0.02 || 1;
  ymin -= pad; ymax += pad;
  const X = (x) => m.l + ((x - xmin) / (xmax - xmin)) * (W - m.l - m.r);
  const Y = (y) => m.t + ((ymax - y) / (ymax - ymin)) * (H - m.t - m.b);
  // Label precision follows the tick step so close values don't print identical labels.
  const ytk = niceTicks(ymin, ymax, 4);
  const stepY = ytk.length > 1 ? ytk[1] - ytk[0] : 1;
  let dec = 0;
  while (dec < 4 && Math.abs(Math.round(stepY * 10 ** dec) - stepY * 10 ** dec) > 1e-6) dec++;
  const yFmt = (v) => (opts.yFmt ? opts.yFmt(v, Math.max(1, dec)) : v.toFixed(Math.max(1, dec)));
  const xFmt = opts.xFmt || ((v) => String(v));
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': opts.title || 'chart' });
  const yt = ytk;
  for (const v of yt) {
    svg.appendChild(s('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'grid' }));
    svg.appendChild(s('text', { x: m.l - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'tick' }, yFmt(v)));
  }
  const xt = opts.xTicks || niceTicks(xmin, xmax, Math.min(8, Math.round(xmax - xmin) || 4)).filter((v) => !opts.integerX || Number.isInteger(v));
  for (const v of xt) svg.appendChild(s('text', { x: X(v), y: H - m.b + 16, 'text-anchor': 'middle', class: 'tick' }, xFmt(v)));
  if (opts.xLabel) svg.appendChild(s('text', { x: (W + m.l) / 2, y: H - 4, 'text-anchor': 'middle', class: 'axis-label' }, opts.xLabel));
  for (const se of series) {
    const good = se.points.filter((p) => Number.isFinite(p.y)).sort((a, b) => a.x - b.x);
    if (good.length > 1) svg.appendChild(s('polyline', { points: good.map((p) => `${X(p.x)},${Y(p.y)}`).join(' '), fill: 'none', stroke: se.color, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    for (const p of good) {
      const c = s('circle', { cx: X(p.x), cy: Y(p.y), r: p.highlight ? 5 : 3.5, fill: p.highlight ? se.color : '#0b0f14', stroke: se.color, 'stroke-width': 2 });
      c.appendChild(s('title', {}, `${se.name}: ${p.label || yFmt(p.y)}`));
      svg.appendChild(c);
    }
    for (const p of se.points.filter((q) => !Number.isFinite(q.y) && q.marker)) {
      const g = s('text', { x: X(p.x), y: m.t + 10, 'text-anchor': 'middle', fill: se.color, class: 'tick' }, '✕');
      g.appendChild(s('title', {}, `${se.name}: ${p.label}`));
      svg.appendChild(g);
    }
  }
  const legend = s('g', {});
  let lx = m.l;
  for (const se of series) {
    legend.appendChild(s('rect', { x: lx, y: 2, width: 10, height: 3, fill: se.color }));
    const t = s('text', { x: lx + 14, y: 8, class: 'tick' }, se.name);
    legend.appendChild(t);
    lx += 24 + se.name.length * 6.5;
  }
  if (series.length > 1) svg.appendChild(legend);
  return svg;
}
