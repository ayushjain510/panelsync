const test = require('node:test');
const assert = require('node:assert');
const { generateSchedule } = require('../src/services/scheduler');
const { findIssues } = require('../src/services/conflicts');
const { buildGrid } = require('../src/lib/time');

const settings = (over = {}) => ({
  dates: ['2026-11-10', '2026-11-11'],
  dayStart: '09:00',
  dayEnd: '11:00',
  slotMinutes: 20,
  breaks: [],
  panels: [
    { _id: 'p1', name: 'Panel 1', room: 'A-101', members: [] },
    { _id: 'p2', name: 'Panel 2', room: 'A-102', members: [] },
  ],
  ...over,
});

const group = (n, mentorId, extra = {}) => ({
  id: `g${n}`, groupNo: n, locked: false, slot: null,
  mentor: { id: mentorId, name: mentorId, unavailable: [] },
  ...extra,
});

const apply = (groups, result) =>
  groups.map((g) => {
    const p = result.placements.find((x) => x.id === g.id);
    return p ? { ...g, slot: { panelId: p.panelId, date: p.date, start: p.start } } : g;
  });

const errors = (groups, s) => findIssues(groups, s).filter((i) => i.severity === 'error');

test('grid skips breaks and stops at day end', () => {
  const grid = buildGrid({ dayStart: '09:00', dayEnd: '11:00', slotMinutes: 20, breaks: [{ start: '09:30', end: '10:00' }] });
  assert.deepStrictEqual(grid, [540, 600, 620, 640]);
});

test('24 groups over 8 mentors: all placed, no clashes', () => {
  const s = settings();
  const groups = Array.from({ length: 24 }, (_, i) => group(i + 1, `m${i % 8}`));
  const result = generateSchedule(groups, s);
  assert.strictEqual(result.capacity, 24);
  assert.strictEqual(result.unplaced.length, 0);
  assert.deepStrictEqual(errors(apply(groups, result), s), []);
});

test('pinned groups are kept and scheduled around', () => {
  const s = settings();
  const pinned = group(1, 'm1', { locked: true, slot: { panelId: 'p2', date: '2026-11-11', start: 560 } });
  const groups = [pinned, group(2, 'm1'), group(3, 'm2')];
  const result = generateSchedule(groups, s);
  assert.ok(!result.placements.some((p) => p.id === 'g1'));
  assert.deepStrictEqual(errors(apply(groups, result), s), []);
});

test('a mentor is never placed on a date they are unavailable', () => {
  const s = settings();
  const g = group(1, 'm1');
  g.mentor.unavailable = ['2026-11-10'];
  const [placed] = generateSchedule([g], s).placements;
  assert.strictEqual(placed.date, '2026-11-11');
});

test('a panel member has their groups heard by their own panel', () => {
  const s = settings();
  s.panels[1].members = ['m1'];
  const result = generateSchedule([group(1, 'm1'), group(2, 'm1'), group(3, 'm2')], s);
  for (const p of result.placements.filter((x) => x.id !== 'g3')) assert.strictEqual(p.panelId, 'p2');
});

test('overflow is reported, not silently dropped', () => {
  const s = settings({ dates: ['2026-11-10'], panels: [{ _id: 'p1', name: 'Panel 1', room: 'A-101', members: [] }] });
  const groups = Array.from({ length: 8 }, (_, i) => group(i + 1, `m${i}`));
  const result = generateSchedule(groups, s);
  assert.strictEqual(result.placements.length, 6);
  assert.strictEqual(result.unplaced.length, 2);
});

test('checker catches a mentor in two rooms at once', () => {
  const s = settings();
  const slot = (panelId) => ({ panelId, date: '2026-11-10', start: 540 });
  const found = errors([group(1, 'm1', { slot: slot('p1') }), group(2, 'm1', { slot: slot('p2') })], s);
  assert.strictEqual(found[0].type, 'mentor-clash');
});
