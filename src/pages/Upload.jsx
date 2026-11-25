import { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

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
const MAX_FILE_SIZE = 9 * 1024 * 1024;

function Upload() {
  const [title, setTitle] = useState('');
  const [faculty, setFaculty] = useState('');
  const [department, setDepartment] = useState('');
  const [subject, setSubject] = useState('');
  const [type, setType] = useState('Note');
  const [mode, setMode] = useState('file');
  const [file, setFile] = useState(null);
  const [externalLink, setExternalLink] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  const isRequest = type === 'Request / Query';

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

  const handleFacultyChange = (e) => {
    setFaculty(e.target.value);
    setDepartment('');
    setMessage('');
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.size > MAX_FILE_SIZE) {
      setMessage(`That file is too large (${(selected.size / 1024 / 1024).toFixed(1)}MB). Please use "Paste a Link" for files over 9MB.`);
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
    if (!isRequest && mode === 'file' && !file) {
      setMessage('Please choose a file.');
      return;
    }
    if (!isRequest && mode === 'link' && !externalLink.trim()) {
      setMessage('Please paste a link.');
      return;
    }
    if (!faculty) {
      setMessage('Please select a faculty.');
      return;
    }
    if (!department) {
      setMessage('Please select a department.');
      return;
    }

    setUploading(true);
    setProgress(0);
    setMessage('');

    try {
      let fileUrl = '';

      if (!isRequest) {
        if (mode === 'file') {
          const data = await uploadToCloudinary(file);
          if (!data.secure_url) throw new Error('File upload failed.');
          fileUrl = data.secure_url;
        } else {
          fileUrl = externalLink.trim();
        }
      }

      await addDoc(collection(db, 'resources'), {
        title: title.trim(),
        faculty,
        department,
        subject: subject.trim(),
        type,
        fileUrl,
        uploadedBy: auth.currentUser.displayName || auth.currentUser.email,
        createdAt: serverTimestamp(),
        ratingSum: 0,
        ratingCount: 0,
      });

      setMessage(isRequest ? 'Your request has been posted!' : 'Resource uploaded successfully!');
      setTitle('');
      setFaculty('');
      setDepartment('');
      setSubject('');
      setType('Note');
      setFile(null);
      setExternalLink('');
      e.target.reset();
    } catch (error) {
      setMessage('Error: ' + error.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>Upload a Resource</h1>
      <p style={{ textAlign: 'center', color: '#9ca3af', marginBottom: '30px' }}>
        Share notes, books, slides — or post a request asking others for a resource.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input type="text" placeholder="Title (e.g. 'Need DSP Chapter 4 notes')" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ padding: '12px', borderRadius: '6px', border: '1px solid #555' }} />

        <select value={faculty} onChange={handleFacultyChange} required style={{ padding: '12px', borderRadius: '6px' }}>
          <option value="" hidden>Select Faculty</option>
          {Object.keys(faculties).map((facultyName) => (
            <option key={facultyName} value={facultyName}>{facultyName}</option>
          ))}
        </select>

        <select value={department} onChange={(e) => { setDepartment(e.target.value); setMessage(''); }} required disabled={!faculty} style={{ padding: '12px', borderRadius: '6px' }}>
          <option value="" hidden>{faculty ? 'Select Department' : 'Select Faculty First'}</option>
          {faculty && faculties[faculty].map((departmentName) => (
            <option key={departmentName} value={departmentName}>{departmentName}</option>
          ))}
        </select>

        <input type="text" placeholder="Subject (e.g. Data Structures)" value={subject} onChange={(e) => setSubject(e.target.value)} required style={{ padding: '12px', borderRadius: '6px' }} />

        <select value={type} onChange={(e) => { setType(e.target.value); setMessage(''); }} style={{ padding: '12px', borderRadius: '6px' }}>
          <option value="Note">Note</option>
          <option value="Book">Book</option>
          <option value="PDF">PDF</option>
          <option value="Slide">Slide</option>
          <option value="Solved Paper">Solved Paper</option>
          <option value="Previous Year Question">Previous Year Question</option>
          <option value="Request / Query">Request / Query (asking for a resource)</option>
        </select>

        {isRequest ? (
          <p style={{ padding: '12px', background: '#f1f5f9', borderRadius: '6px', color: '#475569', fontSize: '14px' }}>
            This is a request post — no file needed. Others can reply in the comments with a file or link once you post it.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button type="button" onClick={() => { setMode('file'); setMessage(''); }} style={{ padding: '10px 16px', cursor: 'pointer', border: 'none', borderRadius: '6px', fontWeight: mode === 'file' ? 'bold' : 'normal' }}>
                Upload File
              </button>
              <button type="button" onClick={() => { setMode('link'); setMessage(''); }} style={{ padding: '10px 16px', cursor: 'pointer', border: 'none', borderRadius: '6px', fontWeight: mode === 'link' ? 'bold' : 'normal' }}>
                Paste a Link
              </button>
            </div>

            {mode === 'file' ? (
              <div>
                <input type="file" onChange={handleFileChange} style={{ padding: '10px' }} />
                <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '5px' }}>Max file size: 9MB. Larger files? Use "Paste a Link" instead.</p>
              </div>
            ) : (
              <input type="url" placeholder="Paste Google Drive / external link" value={externalLink} onChange={(e) => setExternalLink(e.target.value)} style={{ padding: '12px', borderRadius: '6px' }} />
            )}
          </>
        )}

        {uploading && !isRequest && mode === 'file' && (
          <div style={{ background: '#333', borderRadius: '5px', overflow: 'hidden', height: '22px' }}>
            <div style={{ width: `${progress}%`, background: '#4caf50', height: '100%', transition: 'width 0.2s', textAlign: 'center', color: 'white', fontSize: '12px', lineHeight: '22px' }}>
              {progress}%
            </div>
          </div>
        )}

        <button type="submit" disabled={uploading} style={{ padding: '12px', cursor: uploading ? 'not-allowed' : 'pointer', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
          {uploading ? 'Uploading...' : isRequest ? 'Post Request' : 'Upload Resource'}
        </button>
      </form>

      {message && <p style={{ textAlign: 'center', marginTop: '15px' }}>{message}</p>}
    </div>
  );
}

export default Upload;