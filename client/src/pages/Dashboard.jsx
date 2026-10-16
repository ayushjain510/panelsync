import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, download } from '../api';
import { fmtDate, fmtTime, panelColor, toMin } from '../time';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get('/schedule').then(setData), []);
  useEffect(() => { load(); }, [load]);

  if (!data) return <p className="muted">Loading…</p>;
  const { settings, grid, groups, issues } = data;

  const scheduled = groups.filter((g) => g.slot);
  const capacity = grid.length * settings.dates.length * settings.panels.length;
  const toNotify = scheduled.filter((g) => !g.notifiedAt).length;
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warn');

  const dayStart = toMin(settings.dayStart);
  const dayLength = toMin(settings.dayEnd) - dayStart;
  const pct = (minutes) => `${(minutes / dayLength) * 100}%`;

  const notify = async (resend) => {
    setBusy(true);
    try {
      const r = await api.post('/notify', { resend });
      const text = r.live
        ? `Sent ${r.sent} emails covering ${r.groups} groups.`
        : `SMTP is not configured, so ${r.sent} emails were written to the server log instead of being sent.`;
      setNotice({ ok: !r.failed.length, text, list: r.failed.map((f) => `${f.to}: ${f.error}`) });
      load();
    } catch (err) {
      setNotice({ ok: false, text: err.message });
    }
    setBusy(false);
  };

  const exportAs = (kind) =>
    download(`/export/${kind}`, `presentation-schedule.${kind}`).catch((err) => setNotice({ ok: false, text: err.message }));

  const copyLink = async (panel) => {
    await navigator.clipboard.writeText(`${window.location.origin}/p/${panel.shareToken}`);
    setNotice({ ok: true, text: `Link for ${panel.name} copied.` });
  };

  return (
    <>
      <h1>Dashboard</h1>

      <dl className="stats">
        <div><dt>Groups</dt><dd>{groups.length}</dd></div>
        <div><dt>Scheduled</dt><dd>{scheduled.length}</dd></div>
        <div><dt>Slots available</dt><dd>{capacity}</dd></div>
        <div className={errors.length ? 'bad' : ''}><dt>Clashes</dt><dd>{errors.length}</dd></div>
        <div><dt>Awaiting email</dt><dd>{toNotify}</dd></div>
      </dl>
      {groups.length > capacity && (
        <div className="notice bad">
          There are {groups.length} groups but only {capacity} slots. Add a date, a panel, or longer hours.
        </div>
      )}

      <div className="toolbar">
        <button onClick={() => exportAs('pdf')}>Export PDF</button>
        <button onClick={() => exportAs('xlsx')}>Export Excel</button>
        <button className="primary" disabled={busy || !toNotify} onClick={() => notify(false)}>
          Email {toNotify} group{toNotify === 1 ? '' : 's'} their slot
        </button>
        <button disabled={busy || !scheduled.length} onClick={() => window.confirm('Email every scheduled group and mentor again?') && notify(true)}>
          Email everyone again
        </button>
      </div>
      {notice && (
        <div className={notice.ok ? 'notice ok' : 'notice bad'}>
          {notice.text}
          {notice.list?.length > 0 && <ul>{notice.list.map((t) => <li key={t}>{t}</li>)}</ul>}
        </div>
      )}

      <section className="panel-box">
        <h2>Panel timeline</h2>
        {!settings.panels.length && <p className="muted">No panels yet. <Link to="/setup">Set up panels and rooms</Link></p>}
        {settings.dates.map((date) => (
          <div key={date} className="timeline-day">
            <h3>{fmtDate(date)}</h3>
            {settings.panels.map((panel, i) => (
              <div className="lane" key={panel._id}>
                <div className="lane-name">{panel.name}<span className="room">{panel.room}</span></div>
                <div className="lane-track">
                  {settings.breaks.map((b, k) => (
                    <div key={k} className="lane-break" style={{ left: pct(toMin(b.start) - dayStart), width: pct(toMin(b.end) - toMin(b.start)) }} />
                  ))}
                  {scheduled
                    .filter((g) => g.slot.panelId === panel._id && g.slot.date === date)
                    .map((g) => (
                      <div
                        key={g._id}
                        className="lane-block"
                        style={{ left: pct(g.slot.start - dayStart), width: pct(settings.slotMinutes), background: panelColor(i) }}
                        title={`Group ${g.groupNo}, ${fmtTime(g.slot.start)}\n${g.title}\n${g.mentor.name}`}
                      >
                        {g.groupNo}
                      </div>
                    ))}
                </div>
              </div>
            ))}
            <div className="lane-scale"><span>{fmtTime(dayStart)}</span><span>{fmtTime(dayStart + dayLength)}</span></div>
          </div>
        ))}
      </section>

      <div className="two-col">
        <section className="panel-box">
          <h2>Clash and gap log</h2>
          {!issues.length && <p className="ok-text">Nothing to fix. Every group has a slot and nobody is double-booked.</p>}
          <ul className="log">
            {errors.map((it, k) => <li key={`e${k}`} className="log-error">{it.message}</li>)}
            {warnings.map((it, k) => <li key={`w${k}`} className="log-warn">{it.message}</li>)}
          </ul>
        </section>

        <section className="panel-box">
          <h2>Public links</h2>
          <p className="muted">Anyone with a link can view and print that panel’s schedule. No sign-in needed.</p>
          <ul className="log">
            {settings.panels.map((p) => (
              <li key={p._id}>
                <a href={`/p/${p.shareToken}`} target="_blank" rel="noreferrer">{p.name}, Room {p.room}</a>{' '}
                <button className="link" onClick={() => copyLink(p)}>Copy link</button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
