export const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const fmtTime = (min) => {
  const h = Math.floor(min / 60);
  return `${h % 12 || 12}:${String(min % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export const fmtRange = (start, length) => `${fmtTime(start)} – ${fmtTime(start + length)}`;

export const fmtDate = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });

// Each panel keeps one colour everywhere it appears.
const HUES = ['#2f4cc0', '#b0531f', '#2e7d5b', '#8a3fa0', '#0f7c8c', '#9a7a12'];
export const panelColor = (index) => HUES[index % HUES.length];
