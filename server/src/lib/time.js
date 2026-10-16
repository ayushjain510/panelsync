// Dates travel as 'YYYY-MM-DD' strings and times as minutes from midnight,
// so nothing in the schedule depends on the server's timezone.

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const fmtTime = (min) => {
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
};

const fmtRange = (start, length) => `${fmtTime(start)} – ${fmtTime(start + length)}`;

const fmtDate = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });

// Start minutes of every slot in one working day. A slot that would run into
// a break is pushed to the end of that break.
function buildGrid(settings) {
  const slot = settings.slotMinutes;
  const dayEnd = toMin(settings.dayEnd);
  const breaks = (settings.breaks || []).map((b) => [toMin(b.start), toMin(b.end)]);
  const starts = [];
  let t = toMin(settings.dayStart);
  while (t + slot <= dayEnd) {
    const hit = breaks.find(([from, to]) => t < to && t + slot > from);
    if (hit) { t = hit[1]; continue; }
    starts.push(t);
    t += slot;
  }
  return starts;
}

module.exports = { toMin, fmtTime, fmtRange, fmtDate, buildGrid };
