import { useState, useRef } from 'react';
import { FiCamera, FiX, FiLoader } from 'react-icons/fi';
import api from '../../api/axios';
import './ImageUpload.css';

export default function ImageUpload({ currentImage, onImageUploaded, label }) {
  const [preview, setPreview] = useState(currentImage || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, GIF, or WEBP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }

    setError('');

    // Instant local preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (response.data.success) {
        const imageUrl = response.data.data.url;
        setPreview(imageUrl);
        onImageUploaded(imageUrl);
      } else {
        setError('Upload failed. Please try again.');
        setPreview(currentImage || null);
      }
    } catch {
      setError('Upload failed. Please try again.');
      setPreview(currentImage || null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onImageUploaded('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="image-upload">
      {label && <label className="image-upload-label">{label}</label>}
      <div className="image-upload-area">
        {preview ? (
          <div className="image-preview-container">
            <img src={preview} alt="Profile preview" className="image-preview" />
            {uploading && (
              <div className="image-uploading-overlay">
                <FiLoader className="upload-spinner" />
                <span>Uploading...</span>
              </div>
            )}
            {!uploading && (
              <button type="button" className="image-remove-btn" onClick={handleRemove} title="Remove image">
                <FiX />
              </button>
            )}
          </div>
        ) : (
          <div className="image-upload-placeholder" onClick={() => fileInputRef.current?.click()}>
            <FiCamera className="upload-icon" />
            <span>Click to upload photo</span>
            <span className="upload-hint">JPEG, PNG, GIF or WEBP — max 5MB</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileSelect}
          className="image-file-input"
        />
      </div>
      {error && <p className="image-upload-error">{error}</p>}
    </div>
  );
}
