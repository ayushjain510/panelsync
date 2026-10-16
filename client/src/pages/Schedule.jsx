import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { fmtDate, fmtTime, panelColor } from '../time';

function GroupCard({ group, color, dim, onDragStart, onDragEnd, onTogglePin }) {
  return (
    <div
      className={`card${dim ? ' dim' : ''}`}
      style={{ borderLeftColor: color }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', group._id);
        onDragStart(group._id);
      }}
      onDragEnd={onDragEnd}
      title={group.members.map((m) => `${m.studentId} ${m.name}`).join('\n')}
    >
      <strong>G{group.groupNo}</strong> {group.title}
      <div className="card-meta">
        {group.mentor.name}
        {onTogglePin && (
          <button
            className="pin"
            aria-pressed={group.locked}
            title={group.locked ? 'Pinned: auto-scheduling will not move this group' : 'Pin this group to its slot'}
            onClick={() => onTogglePin(group)}
          >
            {group.locked ? 'Pinned' : 'Pin'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Schedule() {
  const [data, setData] = useState(null);
  const [day, setDay] = useState('');
  const [dragId, setDragId] = useState(null);
  const [query, setQuery] = useState('');
  const [blocked, setBlocked] = useState(null); // a move the server refused: { groupId, target, conflicts }
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    const d = await api.get('/schedule');
    setData(d);
    setDay((cur) => (d.settings.dates.includes(cur) ? cur : d.settings.dates[0] || ''));
  }, []);
  useEffect(() => { load(); }, [load]);

  const bySlot = useMemo(() => {
    const map = new Map();
    for (const g of data?.groups || []) {
      if (g.slot) map.set(`${g.slot.panelId}|${g.slot.date}|${g.slot.start}`, g);
    }
    return map;
  }, [data]);

  if (!data) return <p className="muted">Loading…</p>;
  const { settings, grid, groups } = data;

  if (!settings.panels.length || !settings.dates.length) {
    return (
      <>
        <h1>Schedule</h1>
        <p>Add at least one panel and one presentation date under “Panels and rooms” before scheduling.</p>
      </>
    );
  }

  const dragging = groups.find((g) => g._id === dragId);
  const unscheduled = groups.filter((g) => !g.slot);
  const seatOf = (mentorId) => settings.panels.find((p) => p.members.includes(mentorId))?._id;

  // Why dropping the dragged group on this cell would be a problem, or null.
  // Mirrors the server check so the warning shows before the drop, not after.
  const warningFor = (panelId, start) => {
    if (!dragging) return null;
    const mentor = dragging.mentor;
    if (mentor.unavailable.includes(day)) return `${mentor.name} is unavailable on this date`;
    const clash = groups.find(
      (g) => g._id !== dragging._id && g.mentor._id === mentor._id && g.slot &&
        g.slot.date === day && g.slot.start === start && g.slot.panelId !== panelId
    );
    if (clash) return `${mentor.name} is with Group ${clash.groupNo} at this time`;
    const seat = seatOf(mentor._id);
    if (seat && seat !== panelId && bySlot.has(`${seat}|${day}|${start}`)) {
      return `${mentor.name} is evaluating on another panel at this time`;
    }
    return null;
  };

  const move = async (groupId, target, force = false) => {
    try {
      const res = await api.post('/schedule/move', { groupId, ...target, force });
      setBlocked(null);
      setNotice(res.swappedWith ? { ok: true, text: `Swapped with Group ${res.swappedWith}.` } : null);
      load();
    } catch (err) {
      if (err.status === 409 && err.body.conflicts) setBlocked({ groupId, target, conflicts: err.body.conflicts });
      else setNotice({ ok: false, text: err.message });
    }
  };

  const drop = (e, target) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    setDragId(null);
    if (id) move(id, target);
  };

  const unassign = async (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    setDragId(null);
    if (!id) return;
    await api.post('/schedule/unassign', { groupId: id });
    load();
  };

  const togglePin = async (g) => {
    await api.post('/schedule/lock', { groupId: g._id, locked: !g.locked });
    load();
  };

  const generate = async () => {
    const anyPlaced = groups.some((g) => g.slot && !g.locked);
    if (anyPlaced && !window.confirm('Generate again? Pinned groups stay where they are; every other group is reassigned.')) return;
    const res = await api.post('/schedule/generate');
    setNotice(
      res.unplaced.length
        ? { ok: false, text: `Placed ${res.placed} groups. ${res.unplaced.length} could not be placed:`, list: res.unplaced.map((u) => `Group ${u.groupNo}: ${u.reason}`) }
        : { ok: true, text: `Placed all ${res.placed} groups with no clashes.` }
    );
    load();
  };

  const clearAll = async () => {
    if (!window.confirm('Remove every group from the schedule, including pinned ones?')) return;
    await api.del('/schedule');
    setNotice(null);
    load();
  };

  const q = query.trim().toLowerCase();
  const matches = (g) =>
    !q ||
    String(g.groupNo) === q ||
    g.title.toLowerCase().includes(q) ||
    g.mentor.name.toLowerCase().includes(q) ||
    g.members.some((m) => m.studentId.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
  const hitDays = q ? new Set(groups.filter((g) => g.slot && matches(g)).map((g) => g.slot.date)) : new Set();

  return (
    <>
      <h1>Schedule</h1>
      <div className="toolbar">
        <button className="primary" onClick={generate}>Generate schedule</button>
        <button onClick={clearAll}>Clear schedule</button>
        <input type="search" placeholder="Find a student ID, group number or mentor" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {notice && (
        <div className={notice.ok ? 'notice ok' : 'notice bad'}>
          {notice.text}
          {notice.list && <ul>{notice.list.map((t) => <li key={t}>{t}</li>)}</ul>}
        </div>
      )}

      {blocked && (
        <div className="notice bad" role="alertdialog">
          <strong>This move was not saved because it creates a clash.</strong>
          <ul>{blocked.conflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul>
          <button onClick={() => move(blocked.groupId, blocked.target, true)}>Move anyway</button>{' '}
          <button className="primary" onClick={() => setBlocked(null)}>Keep the current slot</button>
        </div>
      )}

      <div className="tabs" role="tablist">
        {settings.dates.map((d) => (
          <button key={d} role="tab" aria-selected={d === day} className={d === day ? 'active' : ''} onClick={() => setDay(d)}>
            {fmtDate(d)}{hitDays.has(d) ? ' •' : ''}
          </button>
        ))}
      </div>

      <div className="board-wrap">
        <div className="scroll-x">
          <table className="board">
            <thead>
              <tr>
                <th>Time</th>
                {settings.panels.map((p, i) => (
                  <th key={p._id} style={{ borderTopColor: panelColor(i) }}>
                    {p.name}<span className="room">Room {p.room}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((start) => (
                <tr key={start}>
                  <th className="time">{fmtTime(start)}</th>
                  {settings.panels.map((p, i) => {
                    const g = bySlot.get(`${p._id}|${day}|${start}`);
                    const warning = g?._id === dragId ? null : warningFor(p._id, start);
                    return (
                      <td
                        key={p._id}
                        className={warning ? 'cell warn' : dragging ? 'cell open' : 'cell'}
                        title={warning || undefined}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => drop(e, { panelId: p._id, date: day, start })}
                      >
                        {g && (
                          <GroupCard
                            group={g}
                            color={panelColor(i)}
                            dim={q && !matches(g)}
                            onDragStart={setDragId}
                            onDragEnd={() => setDragId(null)}
                            onTogglePin={togglePin}
                          />
                        )}
                        {warning && <span className="warn-text">{warning}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="tray" onDragOver={(e) => e.preventDefault()} onDrop={unassign}>
          <h2>Not scheduled ({unscheduled.length})</h2>
          <p className="muted">Drag a group onto the board, or drop one here to take it off.</p>
          {unscheduled.map((g) => (
            <GroupCard key={g._id} group={g} color="#5d6b7a" dim={q && !matches(g)} onDragStart={setDragId} onDragEnd={() => setDragId(null)} />
          ))}
        </aside>
      </div>
    </>
  );
}
