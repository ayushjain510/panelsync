const { buildGrid } = require('../lib/time');

/*
 * Greedy, most-constrained-first placement.
 *
 * Groups arrive as plain objects:
 *   { id, groupNo, locked, mentor: { id, unavailable }, slot | null }
 *
 * Mentors with the most groups are placed first because they are the hardest
 * to fit. A mentor's groups go back-to-back in one panel where possible, so
 * the mentor walks into one room once. A mentor who sits on a panel has their
 * groups heard by that panel, since they are in that room all day anyway.
 */
function generateSchedule(groups, settings) {
  const grid = buildGrid(settings);
  const panels = settings.panels.map((p) => ({
    id: String(p._id),
    name: p.name,
    members: new Set((p.members || []).map(String)),
  }));

  const taken = new Set();       // "panel|date|start"
  const mentorBusy = new Map();  // mentorId -> Set("date|start")
  const load = new Map(panels.map((p) => [p.id, 0]));
  const placements = [];
  const unplaced = [];

  const occupy = (group, panelId, date, start) => {
    taken.add(`${panelId}|${date}|${start}`);
    if (!mentorBusy.has(group.mentor.id)) mentorBusy.set(group.mentor.id, new Set());
    mentorBusy.get(group.mentor.id).add(`${date}|${start}`);
    load.set(panelId, (load.get(panelId) || 0) + 1);
  };

  const pending = [];
  for (const g of groups) {
    if (g.locked && g.slot) occupy(g, g.slot.panelId, g.slot.date, g.slot.start);
    else pending.push(g);
  }

  const byMentor = new Map();
  for (const g of pending) {
    if (!byMentor.has(g.mentor.id)) byMentor.set(g.mentor.id, []);
    byMentor.get(g.mentor.id).push(g);
  }
  const queue = [...byMentor.values()].sort(
    (a, b) => b.length - a.length || a[0].groupNo - b[0].groupNo
  );

  const firstFree = (panelId, mentor) => {
    const busy = mentorBusy.get(mentor.id);
    for (const date of settings.dates) {
      if (mentor.unavailable.includes(date)) continue;
      for (const start of grid) {
        if (taken.has(`${panelId}|${date}|${start}`)) continue;
        if (busy && busy.has(`${date}|${start}`)) continue;
        return { date, start };
      }
    }
    return null;
  };

  for (const list of queue) {
    const mentor = list[0].mentor;
    const home = panels.filter((p) => p.members.has(mentor.id));
    const candidates = home.length ? home : panels;
    let lastPanel = null;

    for (const g of list.sort((a, b) => a.groupNo - b.groupNo)) {
      const ordered = [...candidates].sort(
        (a, b) =>
          (b.id === lastPanel) - (a.id === lastPanel) || load.get(a.id) - load.get(b.id)
      );
      let placed = null;
      for (const p of ordered) {
        const spot = firstFree(p.id, mentor);
        if (spot) { placed = { panelId: p.id, ...spot }; break; }
      }
      if (placed) {
        occupy(g, placed.panelId, placed.date, placed.start);
        placements.push({ id: g.id, ...placed });
        lastPanel = placed.panelId;
      } else {
        unplaced.push({ id: g.id, groupNo: g.groupNo, reason: whyNot(mentor, home, settings) });
      }
    }
  }

  return { placements, unplaced, capacity: grid.length * settings.dates.length * panels.length };
}

function whyNot(mentor, home, settings) {
  if (!settings.panels.length || !settings.dates.length) return 'No panels or dates are configured';
  if (settings.dates.every((d) => mentor.unavailable.includes(d))) {
    return 'Mentor is unavailable on every presentation date';
  }
  if (home.length) return `${home[0].name} is full, and the mentor sits on that panel`;
  return 'No free slot left that avoids a mentor clash';
}

module.exports = { generateSchedule };
