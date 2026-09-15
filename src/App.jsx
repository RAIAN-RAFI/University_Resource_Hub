import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import Home from './pages/Home';
import Upload from './pages/Upload';
import Login from './pages/Login';

function Navbar({ user }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <nav style={{ display: 'flex', gap: '20px', alignItems: 'center', justifyContent: 'center', padding: '20px', borderBottom: '1px solid #ccc' }}>
      <Link to="/">Home</Link>
      <Link to="/upload">Upload</Link>
      {!user && <Link to="/login">Login</Link>}
      {user && (
        <>
          <span>Logged in as: {user.displayName || user.email}</span>
          <button onClick={handleLogout} style={{ cursor: 'pointer' }}>Logout</button>
        </>
      )}
    </nav>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  if (checkingAuth) {
    return <p style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</p>;
  }

  return (
    <BrowserRouter>
      <Navbar user={user} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;