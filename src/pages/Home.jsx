import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';

function Home() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'resources'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setResources(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Delete this resource? This cannot be undone.');
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'resources', id));
    } catch (err) {
      alert('Error deleting: ' + err.message);
    }
  };

  if (loading) {
    return <p style={{ textAlign: 'center', marginTop: '50px' }}>Loading resources...</p>;
  }

  const currentUserName = auth.currentUser?.displayName || auth.currentUser?.email;

  return (
    <div style={{ maxWidth: '700px', margin: '30px auto', padding: '0 15px' }}>
      <h1 style={{ textAlign: 'center' }}>Home Feed</h1>

      {resources.length === 0 && (
        <p style={{ textAlign: 'center', color: '#888' }}>No resources uploaded yet. Be the first!</p>
      )}

      {resources.map((res) => (
        <div
          key={res.id}
          style={{
            border: '1px solid #444',
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '15px',
          }}
        >
          <h3 style={{ margin: '0 0 8px 0' }}>{res.title}</h3>
          <p style={{ margin: '0 0 4px 0', color: '#aaa' }}>
            {res.department} • {res.subject} • {res.type}
          </p>
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#888' }}>
            Uploaded by {res.uploadedBy}
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href={res.fileUrl} target="_blank" rel="noopener noreferrer">
              <button style={{ padding: '8px 16px', cursor: 'pointer' }}>Open File</button>
            </a>
            {res.uploadedBy === currentUserName && (
              <button
                onClick={() => handleDelete(res.id)}
                style={{ padding: '8px 16px', cursor: 'pointer', background: '#c0392b', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Home;