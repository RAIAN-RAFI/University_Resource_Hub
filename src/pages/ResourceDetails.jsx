import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';

const CLOUD_NAME = 'bsgod5be';
const UPLOAD_PRESET = 'resource_hub_uploads';
const MAX_FILE_SIZE = 9 * 1024 * 1024;

function ResourceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [resource, setResource] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentFile, setCommentFile] = useState(null);
  const [commentLink, setCommentLink] = useState('');
  const [commentAttachMode, setCommentAttachMode] = useState('none');
  const [commentUploadProgress, setCommentUploadProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [commentMessage, setCommentMessage] = useState('');

  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [userRating, setUserRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingMessage, setRatingMessage] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadResource = async () => {
      try {
        const resourceRef = doc(db, 'resources', id);
        const resourceSnapshot = await getDoc(resourceRef);
        if (resourceSnapshot.exists()) {
          setResource({ id: resourceSnapshot.id, ...resourceSnapshot.data() });
        } else {
          setError('Resource not found.');
        }
      } catch (err) {
        console.error('Error loading resource:', err);
        setError('Could not load the resource.');
      } finally {
        setLoading(false);
      }
    };
    loadResource();
  }, [id]);

  useEffect(() => {
    const commentsRef = collection(db, 'resources', id, 'comments');
    const commentsQuery = query(commentsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      commentsQuery,
      (snapshot) => {
        const commentList = snapshot.docs.map((commentDoc) => ({
          id: commentDoc.id,
          ...commentDoc.data(),
        }));
        setComments(commentList);
      },
      (err) => {
        console.error('Error loading comments:', err);
      }
    );

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    const loadUserRating = async () => {
      if (!currentUser) {
        setUserRating(0);
        setSelectedRating(0);
        return;
      }
      try {
        const ratingRef = doc(db, 'resources', id, 'ratings', currentUser.uid);
        const ratingSnapshot = await getDoc(ratingRef);
        if (ratingSnapshot.exists()) {
          const ratingData = ratingSnapshot.data();
          setUserRating(ratingData.rating);
          setSelectedRating(ratingData.rating);
        }
      } catch (err) {
        console.error('Error loading rating:', err);
      }
    };
    loadUserRating();
  }, [id, currentUser]);

  const handleRatingSubmit = async () => {
    if (!currentUser) return;
    if (selectedRating < 1 || selectedRating > 5) {
      setRatingMessage('Please select a rating from 1 to 5.');
      return;
    }

    setSubmittingRating(true);
    setRatingMessage('');

    try {
      const resourceRef = doc(db, 'resources', id);
      const ratingRef = doc(db, 'resources', id, 'ratings', currentUser.uid);

      await runTransaction(db, async (transaction) => {
        const resourceSnapshot = await transaction.get(resourceRef);
        if (!resourceSnapshot.exists()) {
          throw new Error('Resource does not exist.');
        }

        const ratingSnapshot = await transaction.get(ratingRef);
        const resourceData = resourceSnapshot.data();
        const oldRatingSum = Number(resourceData.ratingSum || 0);
        const oldRatingCount = Number(resourceData.ratingCount || 0);

        let newRatingSum = oldRatingSum;
        let newRatingCount = oldRatingCount;

        if (ratingSnapshot.exists()) {
          const oldUserRating = Number(ratingSnapshot.data().rating || 0);
          newRatingSum = oldRatingSum - oldUserRating + selectedRating;
        } else {
          newRatingSum = oldRatingSum + selectedRating;
          newRatingCount = oldRatingCount + 1;
        }

        transaction.update(resourceRef, {
          ratingSum: newRatingSum,
          ratingCount: newRatingCount,
        });

        transaction.set(ratingRef, {
          rating: selectedRating,
          userId: currentUser.uid,
          user: currentUser.displayName || currentUser.email,
          updatedAt: serverTimestamp(),
        });
      });

      setUserRating(selectedRating);
      setRatingMessage('Your rating has been saved!');
    } catch (err) {
      console.error('Rating error:', err);
      setRatingMessage('Could not save your rating: ' + err.message);
    } finally {
      setSubmittingRating(false);
    }
  };

  const uploadCommentFileToCloudinary = (file) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setCommentUploadProgress(Math.round((event.loaded / event.total) * 100));
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

  const handleCommentFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.size > MAX_FILE_SIZE) {
      setCommentMessage(`That file is too large (${(selected.size / 1024 / 1024).toFixed(1)}MB). Max is 9MB — try "Attach a link" instead.`);
      setCommentFile(null);
      e.target.value = '';
      return;
    }
    setCommentMessage('');
    setCommentFile(selected);
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!commentText.trim()) return;

    setPostingComment(true);
    setCommentMessage('');
    setCommentUploadProgress(0);

    try {
      let attachmentUrl = '';

      if (commentAttachMode === 'file' && commentFile) {
        const data = await uploadCommentFileToCloudinary(commentFile);
        if (!data.secure_url) throw new Error('File upload failed.');
        attachmentUrl = data.secure_url;
      } else if (commentAttachMode === 'link' && commentLink.trim()) {
        attachmentUrl = commentLink.trim();
      }

      await addDoc(collection(db, 'resources', id, 'comments'), {
        text: commentText.trim(),
        user: currentUser.displayName || currentUser.email,
        userId: currentUser.uid,
        attachmentUrl,
        createdAt: serverTimestamp(),
      });

      setCommentText('');
      setCommentFile(null);
      setCommentLink('');
      setCommentAttachMode('none');
    } catch (err) {
      console.error('Comment error:', err);
      setCommentMessage('Could not post your comment: ' + err.message);
    } finally {
      setPostingComment(false);
      setCommentUploadProgress(0);
    }
  };

  const startEditingComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingText(comment.text);
  };

  const cancelEditingComment = () => {
    setEditingCommentId(null);
    setEditingText('');
  };

  const saveEditedComment = async (commentId) => {
    if (!editingText.trim()) return;
    setSavingEdit(true);
    try {
      const commentRef = doc(db, 'resources', id, 'comments', commentId);
      await updateDoc(commentRef, {
        text: editingText.trim(),
        editedAt: serverTimestamp(),
      });
      setEditingCommentId(null);
      setEditingText('');
    } catch (err) {
      console.error('Error editing comment:', err);
      alert('Could not update your comment.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    const confirmed = window.confirm('Delete this comment?');
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, 'resources', id, 'comments', commentId));
    } catch (err) {
      console.error('Error deleting comment:', err);
      alert('Could not delete your comment.');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h2>Loading resource...</h2>
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h2>{error || 'Resource not found.'}</h2>
        <button onClick={() => navigate('/')} style={{ padding: '10px 18px', marginTop: '15px', cursor: 'pointer' }}>
          Back to Home
        </button>
      </div>
    );
  }

  const ratingSum = Number(resource.ratingSum || 0);
  const ratingCount = Number(resource.ratingCount || 0);
  const averageRating = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : '0.0';
  const isRequestPost = resource.type === 'Request / Query';

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
      <button onClick={() => navigate('/')} style={{ padding: '10px 16px', marginBottom: '25px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
        ← Back to Resources
      </button>

      <div style={{ background: 'white', borderRadius: '15px', padding: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
        <h1 style={{ marginTop: 0, marginBottom: '25px' }}>
          {isRequestPost && '🙋 '}{resource.title}
        </h1>

        <div style={{ lineHeight: '1.8' }}>
          <p><strong>Faculty:</strong> {resource.faculty || 'Not specified'}</p>
          <p><strong>Department:</strong> {resource.department || 'Not specified'}</p>
          <p><strong>Subject:</strong> {resource.subject || 'Not specified'}</p>
          <p><strong>Type:</strong> {resource.type || 'Resource'}</p>
          <p>
            <strong>Posted by:</strong>{' '}
            {resource.ownerId ? (
              <Link to={`/profile/${resource.ownerId}`} style={{ color: '#1e293b', fontWeight: 'bold' }}>
                {resource.uploadedBy || 'Unknown'}
              </Link>
            ) : (
              resource.uploadedBy || 'Unknown'
            )}
          </p>
        </div>

        {isRequestPost ? (
          <p style={{ marginTop: '20px', padding: '12px', background: '#fef9c3', borderRadius: '8px', color: '#854d0e' }}>
            This is a request — check the comments below, someone may have already shared what's needed. If you have it, reply below with a file or link!
          </p>
        ) : (
          resource.fileUrl && (
            <a
              href={resource.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', marginTop: '20px', padding: '12px 20px', background: '#1e293b', color: 'white', textDecoration: 'none', borderRadius: '8px' }}
            >
              Open Resource
            </a>
          )
        )}
      </div>

      <div style={{ marginTop: '25px', background: 'white', borderRadius: '15px', padding: '30px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
        <h2>⭐ Ratings</h2>

        <div style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '5px' }}>
          {averageRating} / 5
        </div>

        <p style={{ color: '#64748b', marginTop: 0 }}>
          {ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'}
        </p>

        {currentUser ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', margin: '20px 0' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setSelectedRating(star)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: '38px',
                    cursor: 'pointer',
                    padding: '3px',
                    color: star <= selectedRating ? '#f59e0b' : '#cbd5e1',
                  }}
                >
                  ★
                </button>
              ))}
            </div>

            <p style={{ color: '#64748b' }}>
              {userRating > 0 ? `Your current rating: ${userRating}/5` : 'Select a rating'}
            </p>

            <button
              type="button"
              onClick={handleRatingSubmit}
              disabled={submittingRating}
              style={{
                padding: '12px 25px',
                border: 'none',
                borderRadius: '8px',
                cursor: submittingRating ? 'not-allowed' : 'pointer',
                background: '#1e293b',
                color: 'white',
                fontWeight: 'bold',
              }}
            >
              {submittingRating ? 'Saving...' : userRating > 0 ? 'Update Rating' : 'Submit Rating'}
            </button>

            {ratingMessage && <p style={{ marginTop: '15px', color: '#475569' }}>{ratingMessage}</p>}
          </>
        ) : (
          <div style={{ marginTop: '20px' }}>
            <p style={{ color: '#64748b', marginBottom: '15px' }}>You need an account to rate this resource.</p>
            <button
              onClick={() => navigate('/login')}
              style={{ padding: '12px 25px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: '#1e293b', color: 'white', fontWeight: 'bold' }}
            >
              Login to Rate
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: '25px', background: 'white', borderRadius: '15px', padding: '30px', border: '1px solid #e2e8f0' }}>
        <h2>💬 Comments</h2>

        {currentUser ? (
          <form onSubmit={handleCommentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px' }}>
            <textarea
              placeholder={isRequestPost ? 'Reply here — mention if you have what they need...' : 'Write a comment about this resource...'}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows="4"
              required
              style={{ padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical', fontSize: '15px' }}
            />

            {isRequestPost && (
              <>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => { setCommentAttachMode(commentAttachMode === 'file' ? 'none' : 'file'); setCommentLink(''); }}
                    style={{ padding: '8px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: commentAttachMode === 'file' ? 'bold' : 'normal' }}
                  >
                    📎 Attach a file
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCommentAttachMode(commentAttachMode === 'link' ? 'none' : 'link'); setCommentFile(null); }}
                    style={{ padding: '8px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: commentAttachMode === 'link' ? 'bold' : 'normal' }}
                  >
                    🔗 Attach a link
                  </button>
                </div>

                {commentAttachMode === 'file' && (
                  <div>
                    <input type="file" onChange={handleCommentFileChange} style={{ padding: '8px' }} />
                    <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '5px' }}>Max file size: 9MB. Bigger file? Use "Attach a link" instead.</p>
                  </div>
                )}

                {commentAttachMode === 'link' && (
                  <input
                    type="url"
                    placeholder="Paste a Google Drive / external link"
                    value={commentLink}
                    onChange={(e) => setCommentLink(e.target.value)}
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                )}

                {postingComment && commentAttachMode === 'file' && commentFile && (
                  <div style={{ background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden', height: '18px' }}>
                    <div style={{ width: `${commentUploadProgress}%`, background: '#4caf50', height: '100%', transition: 'width 0.2s', textAlign: 'center', color: 'white', fontSize: '11px', lineHeight: '18px' }}>
                      {commentUploadProgress}%
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              type="submit"
              disabled={postingComment}
              style={{ padding: '12px', border: 'none', borderRadius: '8px', cursor: postingComment ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
            >
              {postingComment ? 'Posting...' : 'Post Comment'}
            </button>

            {commentMessage && <p style={{ color: '#b91c1c', fontSize: '14px' }}>{commentMessage}</p>}
          </form>
        ) : (
          <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '8px', textAlign: 'center', marginBottom: '30px' }}>
            <p style={{ color: '#64748b', marginBottom: '15px' }}>You need an account to comment.</p>
            <button
              onClick={() => navigate('/login')}
              style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: '#1e293b', color: 'white', fontWeight: 'bold' }}
            >
              Login to Comment
            </button>
          </div>
        )}

        {comments.length === 0 ? (
          <p style={{ color: '#64748b' }}>No comments yet. Be the first to comment!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {comments.map((comment) => {
              const isOwner = currentUser && comment.userId === currentUser.uid;
              const isEditing = editingCommentId === comment.id;

              return (
                <div key={comment.id} style={{ padding: '15px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <strong>{comment.user || 'Anonymous'}</strong>

                  {isEditing ? (
                    <div style={{ marginTop: '8px' }}>
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows="3"
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                        <button type="button" onClick={() => saveEditedComment(comment.id)} disabled={savingEdit} style={{ padding: '8px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                          {savingEdit ? 'Saving...' : 'Save'}
                        </button>
                        <button type="button" onClick={cancelEditingComment} style={{ padding: '8px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p style={{ marginBottom: 0, marginTop: '8px' }}>
                        {comment.text}
                        {comment.editedAt && <span style={{ color: '#94a3b8', fontSize: '12px' }}> (edited)</span>}
                      </p>

                      {comment.attachmentUrl && (
                        <a
                          href={comment.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-block', marginTop: '8px', padding: '6px 12px', background: '#1e293b', color: 'white', textDecoration: 'none', borderRadius: '6px', fontSize: '13px' }}
                        >
                          📎 Open Attachment
                        </a>
                      )}

                      {isOwner && (
                        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                          <button type="button" onClick={() => startEditingComment(comment)} style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                            Edit
                          </button>
                          <button type="button" onClick={() => handleDeleteComment(comment.id)} style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                            Delete
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ResourceDetails;