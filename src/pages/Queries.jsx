import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, where } from 'firebase/firestore';

const faculties = {
  'Faculty of Science': ['Mathematics', 'Physics', 'Chemistry', 'Statistics', 'Pharmacy'],
  'Faculty of Business Studies': ['Management Studies', 'Accounting and Information Systems', 'Marketing', 'Finance and Banking'],
  'Faculty of Social Sciences': ['Economics', 'Public Administration', 'Anthropology', 'Mass Communication and Journalism', 'Archaeology'],
  'Faculty of Arts and Humanities': ['English', 'Bangla'],
  'Faculty of Engineering': ['Computer Science and Engineering', 'Information and Communication Technology'],
  'Faculty of Law': ['Law'],
};

function Queries() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [faculty, setFaculty] = useState('');
  const [department, setDepartment] = useState('');
  const [subject, setSubject] = useState('');
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState('');

  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'resources'),
      where('type', '==', 'Request / Query'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setQueries(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading queries:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleFacultyChange = (e) => {
    setFaculty(e.target.value);
    setDepartment('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!auth.currentUser) {
      setMessage('You must be logged in to post a query.');
      return;
    }
    if (!title.trim() || !faculty || !department || !subject.trim()) {
      setMessage('Please fill in all fields.');
      return;
    }

    setPosting(true);
    setMessage('');

    try {
      await addDoc(collection(db, 'resources'), {
        title: title.trim(),
        faculty,
        department,
        subject: subject.trim(),
        type: 'Request / Query',
        fileUrl: '',
        uploadedBy: auth.currentUser.displayName || auth.currentUser.email,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        ratingSum: 0,
        ratingCount: 0,
      });

      setMessage('Your query has been posted!');
      setTitle('');
      setFaculty('');
      setDepartment('');
      setSubject('');
    } catch (err) {
      setMessage('Error: ' + err.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>🙋 Queries</h1>
      <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '30px' }}>
        Ask the community — "Does anyone have this note or PDF?" Others can reply with a file or link.
      </p>

      {/* COMPOSER */}
      <div style={{ background: 'white', borderRadius: '15px', padding: '25px', border: '1px solid #e2e8f0', marginBottom: '35px' }}>
        {auth.currentUser ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              placeholder="What are you looking for? (e.g. 'Need DSP Chapter 4 notes')"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            />

            <select value={faculty} onChange={handleFacultyChange} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <option value="" hidden>Select Faculty</option>
              {Object.keys(faculties).map((facultyName) => (
                <option key={facultyName} value={facultyName}>{facultyName}</option>
              ))}
            </select>

            <select value={department} onChange={(e) => setDepartment(e.target.value)} disabled={!faculty} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <option value="" hidden>{faculty ? 'Select Department' : 'Select Faculty First'}</option>
              {faculty && faculties[faculty].map((departmentName) => (
                <option key={departmentName} value={departmentName}>{departmentName}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Subject (e.g. Data Structures)"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{ padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            />

            <button
              type="submit"
              disabled={posting}
              style={{ padding: '12px', border: 'none', borderRadius: '8px', cursor: posting ? 'not-allowed' : 'pointer', background: '#1e293b', color: 'white', fontWeight: 'bold' }}
            >
              {posting ? 'Posting...' : 'Post Query'}
            </button>

            {message && <p style={{ textAlign: 'center', color: '#475569' }}>{message}</p>}
          </form>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#64748b', marginBottom: '15px' }}>You need an account to post a query.</p>
            <button
              onClick={() => navigate('/login')}
              style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: '#1e293b', color: 'white', fontWeight: 'bold' }}
            >
              Login to Post a Query
            </button>
          </div>
        )}
      </div>

      {/* LIST OF QUERIES */}
      <h2>Recent Queries ({queries.length})</h2>

      {loading && <p style={{ color: '#64748b' }}>Loading queries...</p>}

      {!loading && queries.length === 0 && (
        <p style={{ color: '#64748b' }}>No queries posted yet. Be the first to ask!</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {queries.map((q) => (
          <div
            key={q.id}
            onClick={() => navigate(`/resource/${q.id}`)}
            style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px 20px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <strong>🙋 {q.title}</strong>
            <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '14px' }}>
              {q.faculty} • {q.department} • {q.subject}
            </p>
            <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '13px' }}>
              Asked by {q.uploadedBy}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Queries;