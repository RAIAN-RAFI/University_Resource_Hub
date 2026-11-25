import { signOut } from 'firebase/auth';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';

function Navbar({ user }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const name = user?.displayName || user?.email || '';
  const linkClass = ({ isActive }) => 'nav-link' + (isActive ? ' active' : '');

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-icon">📘</span>
          <span className="brand-text">University Note Hub</span>
        </Link>

        <nav className="nav-links">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          <NavLink to="/queries" className={linkClass}>Queries</NavLink>
          {user && <NavLink to="/upload" className={linkClass}>Upload</NavLink>}
          {!user && <NavLink to="/login" className={linkClass}>Login</NavLink>}

          {user && (
            <>
              <Link to="/profile" className="user-chip">
                <span className="user-avatar">{name.charAt(0).toUpperCase()}</span>
                {name}
              </Link>
              <button onClick={handleLogout}>Logout</button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Navbar;