import { useCallback, useEffect, useState } from 'react';
import Papa from 'papaparse';
import { api } from '../api';
import { fmtDate, fmtTime } from '../time';

const blank = { groupNo: '', title: '', mentorName: '', mentorEmail: '', membersText: '' };

// The members box takes one student per line: "ID, Name, Email".
const parseMembers = (text) =>
  text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const [studentId, name, email] = line.split(',').map((s) => s.trim());
    return { studentId, name, email };
  });

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [panels, setPanels] = useState([]);
  const [filters, setFilters] = useState({ q: '', panel: '', status: '' });
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState(null); // { ok, text, errors? }

  const load = useCallback(async () => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    setGroups(await api.get(`/groups?${params}`));
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(load, 200); // wait for the coordinator to stop typing
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api.get('/settings').then((s) => setPanels(s.panels));
  }, []);

  const importCsv = (file) => {
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: async ({ data }) => {
        // Only the first row of a group has to carry the title and mentor.
        const last = {};
        const rows = data.map((r) => {
          if (r.title) last[r.groupNo] = r;
          const head = last[r.groupNo] || {};
          return { ...r, title: r.title || head.title, mentorName: r.mentorName || head.mentorName, mentorEmail: r.mentorEmail || head.mentorEmail };
        });
        try {
          const { imported } = await api.post('/groups/import', { rows });
          setNotice({ ok: true, text: `Imported ${imported} groups.` });
          load();
        } catch (err) {
          setNotice({ ok: false, text: err.message, errors: err.body.errors });
        }
      },
    });
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = { ...form, groupNo: Number(form.groupNo), members: parseMembers(form.membersText) };
    try {
      if (editingId) await api.put(`/groups/${editingId}`, payload);
      else await api.post('/groups', payload);
      setNotice({ ok: true, text: `Saved group ${payload.groupNo}.` });
      setForm(blank);
      setEditingId(null);
      load();
    } catch (err) {
      setNotice({ ok: false, text: err.message });
    }
  };

  const edit = (g) => {
    setEditingId(g._id);
    setForm({
      groupNo: g.groupNo,
      title: g.title,
      mentorName: g.mentor.name,
      mentorEmail: g.mentor.email,
      membersText: g.members.map((m) => [m.studentId, m.name, m.email].filter(Boolean).join(', ')).join('\n'),
    });
    window.scrollTo({ top: 0 });
  };

  const remove = async (g) => {
    if (!window.confirm(`Delete group ${g.groupNo}? Its slot is freed.`)) return;
    await api.del(`/groups/${g._id}`);
    load();
  };

  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
  });
  const panelName = (id) => panels.find((p) => p._id === id)?.name || '';

  return (
    <>
      <h1>Groups</h1>
      <div className="two-col">
        <section className="panel-box">
          <h2>Import from a spreadsheet</h2>
          <p className="muted">
            One row per student, saved as CSV. Columns: groupNo, title, mentorName, mentorEmail,
            studentId, studentName, studentEmail. Importing a group that already exists updates it
            and keeps its slot. <a href="/sample-groups.csv" download>Download a sample file</a>
          </p>
          <input type="file" accept=".csv" onChange={(e) => { importCsv(e.target.files[0]); e.target.value = ''; }} />
        </section>

        <form className="panel-box" onSubmit={save}>
          <h2>{editingId ? `Edit group ${form.groupNo}` : 'Add one group'}</h2>
          <div className="row">
            <label className="narrow">Group no.<input type="number" min="1" required {...field('groupNo')} /></label>
            <label>Project title<input required {...field('title')} /></label>
          </div>
          <div className="row">
            <label>Mentor name<input required {...field('mentorName')} /></label>
            <label>Mentor email<input type="email" required {...field('mentorEmail')} /></label>
          </div>
          <label>
            Students, one per line as ID, Name, Email
            <textarea rows="3" required placeholder="22CS1001, Ananya Sharma, ananya@example.edu" {...field('membersText')} />
          </label>
          <div className="row">
            <button className="primary">{editingId ? 'Save changes' : 'Add group'}</button>
            {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(blank); }}>Cancel</button>}
          </div>
        </form>
      </div>

      {notice && (
        <div className={notice.ok ? 'notice ok' : 'notice bad'}>
          {notice.text}
          {notice.errors && (
            <ul>{notice.errors.map((e, i) => <li key={i}>Row {e.line}: {e.message}</li>)}</ul>
          )}
        </div>
      )}

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search student ID, group number, mentor or title"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        />
        <select value={filters.panel} onChange={(e) => setFilters({ ...filters, panel: e.target.value })}>
          <option value="">All panels</option>
          {panels.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Scheduled or not</option>
          <option value="scheduled">Scheduled</option>
          <option value="unscheduled">Not scheduled</option>
        </select>
        <span className="muted">{groups.length} shown</span>
      </div>

      <div className="scroll-x">
        <table className="data">
          <thead>
            <tr><th>No.</th><th>Title</th><th>Mentor</th><th>Students</th><th>Slot</th><th></th></tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g._id}>
                <td>{g.groupNo}</td>
                <td>{g.title}</td>
                <td>{g.mentor.name}</td>
                <td>{g.members.map((m) => <div key={m.studentId}>{m.studentId} {m.name}</div>)}</td>
                <td className="nowrap">
                  {g.slot
                    ? <>{panelName(g.slot.panelId)}<br />{fmtDate(g.slot.date)}, {fmtTime(g.slot.start)}</>
                    : <span className="muted">Not scheduled</span>}
                </td>
                <td className="nowrap">
                  <button className="link" onClick={() => edit(g)}>Edit</button>{' '}
                  <button className="link danger" onClick={() => remove(g)}>Delete</button>
                </td>
              </tr>
            ))}
            {!groups.length && (
              <tr><td colSpan="6" className="muted center">No groups match. Import a CSV or add a group above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
