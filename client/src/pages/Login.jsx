import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { token } = await api.post('/auth/login', { password });
      setToken(token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="login" onSubmit={submit}>
      <h1>PanelSync</h1>
      <p className="muted">Coordinator sign-in</p>
      <label>
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
      </label>
      {error && <p className="error-text">{error}</p>}
      <button className="primary">Sign in</button>
    </form>
  );
}
