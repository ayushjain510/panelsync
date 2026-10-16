import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fmtDate, fmtRange } from '../time';

export default function PublicPanel() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/public/panel/${token}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.message);
        setData(body);
      })
      .catch((err) => setError(err.message));
  }, [token]);

  if (error) return <main className="page"><p className="error-text">{error}</p></main>;
  if (!data) return <main className="page"><p className="muted">Loading schedule…</p></main>;

  return (
    <main className="page sheet">
      <div className="sheet-head">
        {data.institution && <h1>{data.institution}</h1>}
        <h2>{data.eventName}</h2>
        <h2>{data.panel.name} (Room {data.panel.room})</h2>
      </div>
      <button className="no-print" onClick={() => window.print()}>Print this schedule</button>
      <table className="official">
        <thead>
          <tr><th>Group No.</th><th>Title</th><th>Students</th><th>Mentor</th><th>Panel/Room</th><th>Time</th><th>Date</th></tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.groupNo}>
              <td className="center">{r.groupNo}</td>
              <td>{r.title}</td>
              <td>{r.members.map((m) => <div key={m.studentId}>{m.studentId} {m.name}</div>)}</td>
              <td>{r.mentor}</td>
              <td className="center">{data.panel.name} / {data.panel.room}</td>
              <td className="center nowrap">{fmtRange(r.start, data.slotMinutes)}</td>
              <td className="center nowrap">{fmtDate(r.date)}</td>
            </tr>
          ))}
          {!data.rows.length && (
            <tr><td colSpan="7" className="center muted">No groups have been scheduled for this panel yet.</td></tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
