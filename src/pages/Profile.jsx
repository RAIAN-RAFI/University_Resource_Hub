import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, orderBy, onSnapshot, getCountFromServer } from 'firebase/firestore';

const faculties = {
  'Faculty of Science': ['Mathematics', 'Physics', 'Chemistry', 'Statistics', 'Pharmacy'],
  'Faculty of Business Studies': ['Management Studies', 'Accounting and Information Systems', 'Marketing', 'Finance and Banking'],
  'Faculty of Social Sciences': ['Economics', 'Public Administration', 'Anthropology', 'Mass Communication and Journalism', 'Archaeology'],
  'Faculty of Arts and Humanities': ['English', 'Bangla'],
  'Faculty of Engineering': ['Computer Science and Engineering', 'Information and Communication Technology'],
  'Faculty of Law': ['Law'],
};

const CLOUD_NAME = 'bsgod5be';
const UPLOAD_PRESET = 'resource_hub_uploads';
const MAX_IMAGE_SIZE = 9 * 1024 * 1024;

function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const targetUserId = userId || auth.currentUser?.uid;
  const isOwnProfile = !!auth.currentUser && targetUserId === auth.currentUser.uid;

  const [profileData, setProfileData] = useState(null);
  const [bio, setBio] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [faculty, setFaculty] = useState('');
  const [department, setDepartment] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [notFound, setNotFound] = useState(false);

  const [contributions, setContributions] = useState([]);
  const [commentCounts, setCommentCounts] = useState({});

  useEffect(() => {
    if (!userId && !auth.currentUser) {
      navigate('/login');
    }
  }, [userId, navigate]);

  useEffect(() => {
    if (!targetUserId) return;

    const loadProfile = async () => {
      try {
        const profileRef = doc(db, 'users', targetUserId);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          setProfileData(data);
          setBio(data.bio || '');
          setLinkedin(data.linkedin || '');
          setFaculty(data.faculty || '');
          setDepartment(data.department || '');
          setPhotoURL(data.photoURL || '');
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [targetUserId]);

  useEffect(() => {
    if (!profileData) return;

    const displayName = profileData.username || profileData.email;
    const q = query(
      collection(db, 'resources'),
      where('uploadedBy', '==', displayName),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setContributions(items);

      items.forEach(async (item) => {
        try {
          const commentsRef = collection(db, 'resources', item.id, 'comments');
          const countSnap = await getCountFromServer(commentsRef);
          setCommentCounts((prev) => ({ ...prev, [item.id]: countSnap.data().count }));
        } catch (err) {
          console.error('Error counting comments:', err);
        }
      });
    });

    return () => unsubscribe();
  }, [profileData]);

  const handlePhotoChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.size > MAX_IMAGE_SIZE) {
      setMessage('That image is too large. Max 9MB.');
      e.target.value = '';
      return;
    }
    setMessage('');
    setPhotoFile(selected);
  };

  const uploadPhotoToCloudinary = (file) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);

      fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
        method: 'POST',
        body: formData,
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.secure_url) resolve(data.secure_url);
          else reject(new Error('Photo upload failed.'));
        })
        .catch(reject);
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      let newPhotoURL = photoURL;

      if (photoFile) {
        setUploadingPhoto(true);
        newPhotoURL = await uploadPhotoToCloudinary(photoFile);
        setUploadingPhoto(false);
      }

      await setDoc(
        doc(db, 'users', auth.currentUser.uid),
        {
          bio,
          linkedin,
          faculty,
          department,
          photoURL: newPhotoURL,
          username: auth.currentUser.displayName,
          email: auth.currentUser.email,
        },
        { merge: true }
      );

      setPhotoURL(newPhotoURL);
      setPhotoFile(null);
      setMessage('Profile updated!');
    } catch (err) {
      setMessage('Error: ' + err.message);
    } finally {
      setSaving(false);
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return <p style={{ textAlign: 'center', marginTop: '50px' }}>Loading profile...</p>;
  }

  if (notFound) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h2>Profile not found.</h2>
        <button onClick={() => navigate('/')} style={{ padding: '10px 18px', marginTop: '15px', cursor: 'pointer' }}>
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '700px', margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ textAlign: 'center' }}>
        {isOwnProfile ? 'My Profile' : `${profileData?.username || 'User'}'s Profile`}
      </h1>

      <div style={{ border: '1px solid #444', borderRadius: '10px', padding: '20px', marginBottom: '30px', textAlign: 'center' }}>
        <img
          src={photoURL || 'https://placehold.co/120x120?text=No+Photo'}
          alt="Profile"
          style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', marginBottom: '15px' }}
        />

        <p><strong>Username:</strong> {profileData?.username}</p>
        {isOwnProfile && <p><strong>Email:</strong> {profileData?.email}</p>}
        {profileData?.faculty && <p><strong>Faculty:</strong> {profileData.faculty}</p>}
        {profileData?.department && <p><strong>Department:</strong> {profileData.department}</p>}

        {!isOwnProfile && profileData?.bio && (
          <p style={{ marginTop: '10px' }}>{profileData.bio}</p>
        )}
        {!isOwnProfile && profileData?.linkedin && (
          <p>
            <a href={profileData.linkedin} target="_blank" rel="noopener noreferrer">
              🔗 LinkedIn / Portfolio
            </a>
          </p>
        )}

        {isOwnProfile && (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px', textAlign: 'left' }}>
            <label>
              Profile Picture
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'block', marginTop: '5px' }} />
            </label>

            <label>
              Bio
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows="3"
                placeholder="Tell others about yourself..."
                style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box' }}
              />
            </label>

            <label>
              LinkedIn / Portfolio Link
              <input
                type="url"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="https://linkedin.com/in/yourname"
                style={{ width: '100%', padding: '10px', marginTop: '5px', boxSizing: 'border-box' }}
              />
            </label>

            <label>
              Faculty
              <select
                value={faculty}
                onChange={(e) => { setFaculty(e.target.value); setDepartment(''); }}
                style={{ width: '100%', padding: '10px', marginTop: '5px' }}
              >
                <option value="">Select Faculty</option>
                {Object.keys(faculties).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </label>

            <label>
              Department
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={!faculty}
                style={{ width: '100%', padding: '10px', marginTop: '5px' }}
              >
                <option value="">{faculty ? 'Select Department' : 'Select Faculty First'}</option>
                {faculty && faculties[faculty].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>

            <button type="submit" disabled={saving || uploadingPhoto} style={{ padding: '10px', cursor: 'pointer' }}>
              {uploadingPhoto ? 'Uploading photo...' : saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        )}

        {message && <p style={{ marginTop: '10px' }}>{message}</p>}
      </div>

      <h2>{isOwnProfile ? 'My Contributions' : 'Contributions'} ({contributions.length})</h2>

      {contributions.length === 0 && <p style={{ color: '#888' }}>No uploads yet.</p>}

      {contributions.map((res) => {
        const ratingSum = Number(res.ratingSum || 0);
        const ratingCount = Number(res.ratingCount || 0);
        const avgRating = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : null;
        const commentCount = commentCounts[res.id];

        return (
          <div
            key={res.id}
            onClick={() => navigate(`/resource/${res.id}`)}
            style={{ border: '1px solid #444', borderRadius: '8px', padding: '12px 15px', marginBottom: '10px', cursor: 'pointer' }}
          >
            <strong>{res.title}</strong>
            <p style={{ margin: '4px 0 0 0', color: '#aaa', fontSize: '14px' }}>
              {res.faculty} • {res.department} • {res.subject} • {res.type}
            </p>
            <p style={{ margin: '6px 0 0 0', fontSize: '14px' }}>
              {avgRating ? `⭐ ${avgRating} (${ratingCount} rating${ratingCount !== 1 ? 's' : ''})` : '⭐ No ratings yet'}
              {' • '}
              {commentCount !== undefined ? `💬 ${commentCount} comment${commentCount !== 1 ? 's' : ''}` : '💬 ...'}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default Profile;