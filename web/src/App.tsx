import { useState } from 'react';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import './App.css';

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  const handleLogin = (nextToken: string) => {
    localStorage.setItem('token', nextToken);
    setToken(nextToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  return (
    <div className="app">
      {token ? (
        <Dashboard token={token} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;
