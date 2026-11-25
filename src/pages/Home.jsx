import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore';

const faculties = {
  'Faculty of Science': ['Mathematics', 'Physics', 'Chemistry', 'Statistics', 'Pharmacy'],
  'Faculty of Business Studies': ['Management Studies', 'Accounting and Information Systems', 'Marketing', 'Finance and Banking'],
  'Faculty of Social Sciences': ['Economics', 'Public Administration', 'Anthropology', 'Mass Communication and Journalism', 'Archaeology'],
  'Faculty of Arts and Humanities': ['English', 'Bangla'],
  'Faculty of Engineering': ['Computer Science and Engineering', 'Information and Communication Technology'],
  'Faculty of Law': ['Law'],
};

const TYPES = ['All', 'Note', 'Book', 'PDF', 'Slide', 'Solved Paper', 'Previous Year Question', 'Request / Query'];

const TYPE_STYLES = {
  'Note': { bg: '#dbeafe', color: '#1d4ed8' },
  'Book': { bg: '#fce7f3', color: '#be185d' },
  'PDF': { bg: '#fee2e2', color: '#b91c1c' },
  'Slide': { bg: '#ffedd5', color: '#c2410c' },
  'Solved Paper': { bg: '#dcfce7', color: '#15803d' },
  'Previous Year Question': { bg: '#ede9fe', color: '#6d28d9' },
  'Request / Query': { bg: '#fef9c3', color: '#a16207' },
};

function Home() {
  const navigate = useNavigate();

  const [resources, setResources] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const resourcesQuery = query(collection(db, 'resources'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      resourcesQuery,
      (snapshot) => {
        const resourceList = snapshot.docs.map((resourceDoc) => ({
          id: resourceDoc.id,
          ...resourceDoc.data(),
        }));
        setResources(resourceList);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading resources:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleDelete = async (resourceId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this resource?');
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, 'resources', resourceId));
    } catch (error) {
      console.error('Delete error:', error);
      alert('Could not delete the resource.');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedFaculty('');
    setSelectedDepartment('');
    setSelectedType('All');
  };

  const isOwner = (resource) => {
    if (!auth.currentUser) return false;
    if (resource.ownerId) return resource.ownerId === auth.currentUser.uid;
    return resource.uploadedBy === (auth.currentUser.displayName || auth.currentUser.email);
  };

  const filteredResources = resources.filter((resource) => {
    const search = searchTerm.toLowerCase().trim();

    const matchesSearch =
      !search ||
      resource.title?.toLowerCase().includes(search) ||
      resource.subject?.toLowerCase().includes(search) ||
      resource.department?.toLowerCase().includes(search) ||
      resource.faculty?.toLowerCase().includes(search);

    const matchesFaculty = !selectedFaculty || resource.faculty === selectedFaculty;
    const matchesDepartment = !selectedDepartment || resource.department === selectedDepartment;
    const matchesType = selectedType === 'All' || resource.type === selectedType;

    return matchesSearch && matchesFaculty && matchesDepartment && matchesType;
  });

  const queryCount = resources.filter((r) => r.type === 'Request / Query').length;
  const resourceCount = resources.length - queryCount;
  const hasFilters = searchTerm || selectedFaculty || selectedDepartment || selectedType !== 'All';

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="container">
          <span className="hero-badge">📚 Comilla University · Student Resource Library</span>
          <h1>University Note Hub</h1>
          <p>
            Find, share and discuss notes, books, slides and past papers — organized by
            faculty, department and subject.
          </p>

          <div className="search-wrap">
            <span className="search-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              className="search-input"
              type="text"
              placeholder="Search by title, subject, department or faculty..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="hero-stats">
            <div><strong>{resourceCount}</strong>Resources</div>
            <div><strong>{queryCount}</strong>Open Queries</div>
            <div><strong>{Object.keys(faculties).length}</strong>Faculties</div>
          </div>
        </div>
      </section>

      {/* FILTERS + RESULTS */}
      <main className="container">
        <div className="filters">
          <select
            value={selectedFaculty}
            onChange={(e) => { setSelectedFaculty(e.target.value); setSelectedDepartment(''); }}
          >
            <option value="">All Faculties</option>
            {Object.keys(faculties).map((facultyName) => (
              <option key={facultyName} value={facultyName}>{facultyName}</option>
            ))}
          </select>

          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            disabled={!selectedFaculty}
          >
            <option value="">{selectedFaculty ? 'All Departments' : 'Select Faculty First'}</option>
            {selectedFaculty && faculties[selectedFaculty].map((departmentName) => (
              <option key={departmentName} value={departmentName}>{departmentName}</option>
            ))}
          </select>

          {hasFilters && <button onClick={clearFilters}>Clear filters</button>}
        </div>

        <div className="pills">
          {TYPES.map((type) => (
            <button
              key={type}
              className={'pill' + (selectedType === type ? ' active' : '')}
              onClick={() => setSelectedType(type)}
            >
              {type === 'All' ? 'All types' : type}
            </button>
          ))}
        </div>

        <div className="results-head">
          <h2>Latest uploads</h2>
          <span className="results-count">
            Showing {filteredResources.length} result{filteredResources.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading && <p style={{ color: '#64748b' }}>Loading resources...</p>}

        {!loading && filteredResources.length === 0 && (
          <div className="empty">
            <h3>No resources found</h3>
            <p>Try changing your search or filters.</p>
          </div>
        )}

        <div className="grid">
          {filteredResources.map((resource) => {
            const typeStyle = TYPE_STYLES[resource.type] || { bg: '#f1f5f9', color: '#475569' };
            const isRequest = resource.type === 'Request / Query';
            const ratingCount = Number(resource.ratingCount || 0);
            const avgRating = ratingCount > 0
              ? (Number(resource.ratingSum || 0) / ratingCount).toFixed(1)
              : null;

            return (
              <article key={resource.id} className="card">
                <div className="card-top">
                  <span className="badge" style={{ background: typeStyle.bg, color: typeStyle.color }}>
                    {resource.type || 'Resource'}
                  </span>
                  <span className="rating">
                    {avgRating ? `★ ${avgRating} (${ratingCount})` : 'No ratings yet'}
                  </span>
                </div>

                <h3 className="card-title">
                  {isRequest && '🙋 '}{resource.title}
                </h3>

                <div className="card-meta">
                  <span><b>Subject:</b> {resource.subject || 'Not specified'}</span>
                  <span><b>Department:</b> {resource.department || 'Not specified'}</span>
                  <span><b>Faculty:</b> {resource.faculty || 'Not specified'}</span>
                </div>

                <div className="card-footer">
                  <div className="uploader">
                    {isRequest ? 'Asked by ' : 'Shared by '}
                    {resource.ownerId ? (
                      <Link to={`/profile/${resource.ownerId}`}>{resource.uploadedBy || 'Unknown'}</Link>
                    ) : (
                      <strong>{resource.uploadedBy || 'Unknown'}</strong>
                    )}
                  </div>

                  <div className="card-actions">
                    <button className="btn-primary" onClick={() => navigate(`/resource/${resource.id}`)}>
                      View Details
                    </button>
                    {isOwner(resource) && (
                      <button className="btn-danger" onClick={() => handleDelete(resource.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </>
  );
}

export default Home;