import { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const CLOUD_NAME = 'bsgod5be';
const UPLOAD_PRESET = 'resource_hub_uploads';
const MAX_FILE_SIZE = 9 * 1024 * 1024; // 9MB safety margin under Cloudinary's free limit

function Upload() {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [subject, setSubject] = useState('');
  const [type, setType] = useState('Note');
  const [mode, setMode] = useState('file'); // 'file' or 'link'
  const [file, setFile] = useState(null);
  const [externalLink, setExternalLink] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  const uploadToCloudinary = (file) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error('Upload failed (' + xhr.status + '): ' + xhr.responseText));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload.'));
      xhr.send(formData);
    });
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.size > MAX_FILE_SIZE) {
      setMessage(
        `That file is too large (${(selected.size / 1024 / 1024).toFixed(1)}MB). Please use "Paste a link" instead for files over 9MB, or compress the PDF.`
      );
      setFile(null);
      e.target.value = '';
      return;
    }
    setMessage('');
    setFile(selected);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) {
      setMessage('You must be logged in to upload.');
      return;
    }
    if (mode === 'file' && !file) {
      setMessage('Please choose a file.');
      return;
    }
    if (mode === 'link' && !externalLink.trim()) {
      setMessage('Please paste a link.');
      return;
    }

    setUploading(true);
    setProgress(0);
    setMessage('');

    try {
      let fileUrl = '';

      if (mode === 'file') {
        const data = await uploadToCloudinary(file);
        if (!data.secure_url) throw new Error('File upload failed.');
        fileUrl = data.secure_url;
      } else {
        fileUrl = externalLink.trim();
      }

      await addDoc(collection(db, 'resources'), {
        title,
        department,
        subject,
        type,
        fileUrl,
        uploadedBy: auth.currentUser.displayName || auth.currentUser.email,
        createdAt: serverTimestamp(),
        ratingSum: 0,
        ratingCount: 0,
      });

      setMessage('Uploaded successfully!');
      setTitle('');
      setDepartment('');
      setSubject('');
      setType('Note');
      setFile(null);
      setExternalLink('');
      e.target.reset();
    } catch (err) {
      setMessage('Error: ' + err.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '50px auto' }}>
      <h1 style={{ textAlign: 'center' }}>Upload a Resource</h1>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '15px' }}>
        <button
          type="button"
          onClick={() => setMode('file')}
          style={{ padding: '8px 16px', cursor: 'pointer', fontWeight: mode === 'file' ? 'bold' : 'normal' }}
        >
          Upload File (under 9MB)
        </button>
        <button
          type="button"
          onClick={() => setMode('link')}
          style={{ padding: '8px 16px', cursor: 'pointer', fontWeight: mode === 'link' ? 'bold' : 'normal' }}
        >
          Paste a Link (big files/books)
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input
          type="text"
          placeholder="Title (e.g. Midterm Notes - Chapter 3)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={{ padding: '10px' }}
        />
        <input
          type="text"
          placeholder="Department (e.g. CSE)"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          required
          style={{ padding: '10px' }}
        />
        <input
          type="text"
          placeholder="Subject (e.g. Data Structures)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          style={{ padding: '10px' }}
        />
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ padding: '10px' }}>
          <option value="Note">Note</option>
          <option value="Book">Book</option>
          <option value="PDF">PDF</option>
          <option value="Slide">Slide</option>
          <option value="Solved Paper">Solved Paper</option>
          <option value="Previous Year Question">Previous Year Question</option>
        </select>

        {mode === 'file' ? (
          <input type="file" onChange={handleFileChange} style={{ padding: '10px' }} />
        ) : (
          <input
            type="url"
            placeholder="Paste Google Drive / external link here"
            value={externalLink}
            onChange={(e) => setExternalLink(e.target.value)}
            style={{ padding: '10px' }}
          />
        )}

        {uploading && mode === 'file' && (
          <div style={{ background: '#333', borderRadius: '4px', overflow: 'hidden', height: '20px' }}>
            <div
              style={{
                width: `${progress}%`,
                background: '#4caf50',
                height: '100%',
                transition: 'width 0.2s',
                textAlign: 'center',
                color: 'white',
                fontSize: '12px',
                lineHeight: '20px',
              }}
            >
              {progress}%
            </div>
          </div>
        )}

        <button type="submit" disabled={uploading} style={{ padding: '10px', cursor: 'pointer' }}>
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>

      {message && <p style={{ textAlign: 'center', marginTop: '10px' }}>{message}</p>}
    </div>
  );
}

export default Upload;