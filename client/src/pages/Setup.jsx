import { useEffect, useState } from 'react';
import { api } from '../api';
import { fmtDate } from '../time';

export default function Setup() {
  const [form, setForm] = useState(null);
  const [mentors, setMentors] = useState([]);
  const [newDate, setNewDate] = useState('');
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    api.get('/settings').then(setForm);
    api.get('/mentors').then(setMentors);
  }, []);

  if (!form) return <p className="muted">Loading…</p>;

  const set = (patch) => setForm({ ...form, ...patch });
  const setPanel = (i, patch) =>
    set({ panels: form.panels.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const setBreak = (i, patch) =>
    set({ breaks: form.breaks.map((b, j) => (j === i ? { ...b, ...patch } : b)) });

  const addDate = () => {
    if (newDate && !form.dates.includes(newDate)) set({ dates: [...form.dates, newDate].sort() });
    setNewDate('');
  };

  const toggleSeat = (i, mentorId) => {
    const members = form.panels[i].members;
    setPanel(i, {
      members: members.includes(mentorId) ? members.filter((m) => m !== mentorId) : [...members, mentorId],
    });
  };

  const save = async () => {
    try {
      setForm(await api.put('/settings', { ...form, slotMinutes: Number(form.slotMinutes) }));
      setNotice({ ok: true, text: 'Setup saved. Re-generate the schedule if hours, dates or panels changed.' });
    } catch (err) {
      setNotice({ ok: false, text: err.message });
    }
  };

  const toggleUnavailable = async (mentor, date) => {
    const unavailable = mentor.unavailable.includes(date)
      ? mentor.unavailable.filter((d) => d !== date)
      : [...mentor.unavailable, date];
    const saved = await api.put(`/mentors/${mentor._id}`, { unavailable });
    setMentors(mentors.map((m) => (m._id === saved._id ? saved : m)));
  };

  return (
    <>
      <h1>Panels and rooms</h1>

      <section className="panel-box">
        <h2>Heading on the printed schedule</h2>
        <div className="row">
          <label>Institution<input value={form.institution} onChange={(e) => set({ institution: e.target.value })} /></label>
          <label>Schedule title<input value={form.eventName} onChange={(e) => set({ eventName: e.target.value })} /></label>
        </div>
      </section>

      <section className="panel-box">
        <h2>Dates and hours</h2>
        <div className="chips">
          {form.dates.map((d) => (
            <span className="chip" key={d}>
              {fmtDate(d)}
              <button aria-label={`Remove ${d}`} onClick={() => set({ dates: form.dates.filter((x) => x !== d) })}>×</button>
            </span>
          ))}
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <button onClick={addDate}>Add date</button>
        </div>
        <div className="row">
          <label className="narrow">Day starts<input type="time" value={form.dayStart} onChange={(e) => set({ dayStart: e.target.value })} /></label>
          <label className="narrow">Day ends<input type="time" value={form.dayEnd} onChange={(e) => set({ dayEnd: e.target.value })} /></label>
          <label className="narrow">Slot length (minutes)<input type="number" min="5" step="5" value={form.slotMinutes} onChange={(e) => set({ slotMinutes: e.target.value })} /></label>
        </div>
        <h3>Breaks</h3>
        {form.breaks.map((b, i) => (
          <div className="row" key={i}>
            <label className="narrow">From<input type="time" value={b.start} onChange={(e) => setBreak(i, { start: e.target.value })} /></label>
            <label className="narrow">To<input type="time" value={b.end} onChange={(e) => setBreak(i, { end: e.target.value })} /></label>
            <button className="link danger" onClick={() => set({ breaks: form.breaks.filter((_, j) => j !== i) })}>Remove</button>
          </div>
        ))}
        <button onClick={() => set({ breaks: [...form.breaks, { start: '13:00', end: '14:00' }] })}>Add a break</button>
      </section>

      <section className="panel-box">
        <h2>Panels</h2>
        <p className="muted">
          Each panel sits in one room. Tick the faculty evaluating on a panel: their own groups are
          then scheduled into that panel, because they cannot be in two rooms.
        </p>
        {form.panels.map((p, i) => (
          <div className="panel-row" key={p._id || i}>
            <div className="row">
              <label>Panel name<input value={p.name} onChange={(e) => setPanel(i, { name: e.target.value })} /></label>
              <label>Room<input value={p.room} onChange={(e) => setPanel(i, { room: e.target.value })} /></label>
              <button className="link danger" onClick={() => set({ panels: form.panels.filter((_, j) => j !== i) })}>Remove panel</button>
            </div>
            <div className="checks">
              {mentors.map((m) => (
                <label key={m._id}>
                  <input type="checkbox" checked={p.members.includes(m._id)} onChange={() => toggleSeat(i, m._id)} />
                  {m.name}
                </label>
              ))}
              {!mentors.length && <span className="muted">Mentors appear here once groups are added.</span>}
            </div>
          </div>
        ))}
        <button onClick={() => set({ panels: [...form.panels, { name: `Panel ${form.panels.length + 1}`, room: '', members: [] }] })}>
          Add a panel
        </button>
      </section>

      {notice && <div className={notice.ok ? 'notice ok' : 'notice bad'}>{notice.text}</div>}
      <button className="primary" onClick={save}>Save setup</button>

      <section className="panel-box spaced">
        <h2>Mentor availability</h2>
        <p className="muted">Tick the dates a mentor cannot attend. These save as you click.</p>
        {form.dates.length && mentors.length ? (
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr><th>Mentor</th>{form.dates.map((d) => <th key={d}>{fmtDate(d)}</th>)}</tr>
              </thead>
              <tbody>
                {mentors.map((m) => (
                  <tr key={m._id}>
                    <td>{m.name}</td>
                    {form.dates.map((d) => (
                      <td key={d} className="center">
                        <input
                          type="checkbox"
                          aria-label={`${m.name} unavailable on ${d}`}
                          checked={m.unavailable.includes(d)}
                          onChange={() => toggleUnavailable(m, d)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Add presentation dates and at least one group first.</p>
        )}
      </section>
    </>
  );
}
