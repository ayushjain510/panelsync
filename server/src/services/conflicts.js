const { buildGrid, fmtTime, fmtDate } = require('../lib/time');

// Flatten a populated Group document into what the scheduler and checker need.
const toPlain = (g) => ({
  id: String(g._id),
  groupNo: g.groupNo,
  locked: g.locked,
  mentor: {
    id: String(g.mentor._id),
    name: g.mentor.name,
    unavailable: g.mentor.unavailable || [],
  },
  slot: g.slot
    ? { panelId: String(g.slot.panelId), date: g.slot.date, start: g.slot.start }
    : null,
});

/*
 * Reads the whole schedule and reports everything wrong with it.
 * 'error' = somebody is double-booked or a slot is invalid.
 * 'warn'  = the schedule works but the coordinator should look.
 * The manual-override route runs this on a draft of the move before saving it.
 */
function findIssues(groups, settings) {
  const issues = [];
  const grid = buildGrid(settings);
  const validStart = new Set(grid);
  const panels = new Map(settings.panels.map((p) => [String(p._id), p]));
  const add = (type, severity, message, groupIds = []) =>
    issues.push({ type, severity, message, groupIds });

  const seats = new Map(); // mentorId -> panelId they evaluate on
  for (const p of settings.panels) {
    for (const m of p.members || []) seats.set(String(m), String(p._id));
  }

  const bySlot = new Map();
  const byMentorTime = new Map();
  const occupied = new Set();
  const push = (map, key, g) => map.set(key, [...(map.get(key) || []), g]);
  const when = (s) => `${fmtDate(s.date)}, ${fmtTime(s.start)}`;

  for (const g of groups) {
    if (!g.slot) {
      add('unscheduled', 'warn', `Group ${g.groupNo} has no slot yet`, [g.id]);
      continue;
    }
    const panel = panels.get(g.slot.panelId);
    if (!panel || !settings.dates.includes(g.slot.date) || !validStart.has(g.slot.start)) {
      add('off-grid', 'error',
        `Group ${g.groupNo} sits in a slot that no longer exists in the current setup`, [g.id]);
      continue;
    }
    push(bySlot, `${g.slot.panelId}|${g.slot.date}|${g.slot.start}`, g);
    push(byMentorTime, `${g.mentor.id}|${g.slot.date}|${g.slot.start}`, g);
    occupied.add(`${g.slot.panelId}|${g.slot.date}|${g.slot.start}`);

    if (g.mentor.unavailable.includes(g.slot.date)) {
      add('mentor-unavailable', 'error',
        `${g.mentor.name} is marked unavailable on ${fmtDate(g.slot.date)} (Group ${g.groupNo})`, [g.id]);
    }
  }

  for (const list of bySlot.values()) {
    if (list.length < 2) continue;
    const panel = panels.get(list[0].slot.panelId);
    add('room-clash', 'error',
      `${panel.name} / ${panel.room} has groups ${list.map((g) => g.groupNo).join(' and ')} at ${when(list[0].slot)}`,
      list.map((g) => g.id));
  }

  for (const list of byMentorTime.values()) {
    if (list.length < 2) continue;
    add('mentor-clash', 'error',
      `${list[0].mentor.name} is double-booked at ${when(list[0].slot)}: groups ${list.map((g) => g.groupNo).join(' and ')}`,
      list.map((g) => g.id));
  }

  // A mentor evaluating on panel A cannot attend their own group in panel B
  // while panel A is hearing someone.
  for (const g of groups) {
    if (!g.slot) continue;
    const seat = seats.get(g.mentor.id);
    if (!seat || seat === g.slot.panelId) continue;
    if (occupied.has(`${seat}|${g.slot.date}|${g.slot.start}`)) {
      add('mentor-clash', 'error',
        `${g.mentor.name} is evaluating on ${panels.get(seat).name} at ${when(g.slot)} while Group ${g.groupNo} presents elsewhere`,
        [g.id]);
    }
  }

  // Idle slots between a panel's first and last presentation of the day.
  for (const [panelId, panel] of panels) {
    for (const date of settings.dates) {
      const used = grid.filter((s) => occupied.has(`${panelId}|${date}|${s}`));
      if (used.length < 2) continue;
      const span = grid.filter((s) => s >= used[0] && s <= used[used.length - 1]);
      const idle = span.length - used.length;
      if (idle > 0) {
        add('gap', 'warn',
          `${panel.name} has ${idle} idle slot${idle > 1 ? 's' : ''} mid-session on ${fmtDate(date)}`);
      }
    }
  }

  return issues;
}

module.exports = { findIssues, toPlain };
