import { useState } from 'react';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import './App.css';

function App() {
  // 임시 로그인 상태 (실제로는 JWT 토큰 유무나 Context API로 관리)
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <div className="app">
      {isLoggedIn ? (
        <Dashboard onLogout={() => setIsLoggedIn(false)} />
      ) : (
        <Login onLogin={() => setIsLoggedIn(true)} />
      )}
    </div>
  );
}

export default App;
