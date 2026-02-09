import React, { useState, useEffect, useCallback } from 'react';

const Markup = ({ mediaItems, selectedProject, onBack }) => {
  const [currentMedia, setCurrentMedia] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedEmotion, setSelectedEmotion] = useState(null);
  const [valence, setValence] = useState('');
  const [arousal, setArousal] = useState('');
  const [stats, setStats] = useState({
    total_media: 0,
    total_annotated: 0,
    pending: 0,
    completion_rate: 0,
    emotion_summary: {},
    type_summary: {},
    vad_summary: {}
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showLoadFolderModal, setShowLoadFolderModal] = useState(false);
  const [loadFolderPath, setLoadFolderPath] = useState('');

  // Load stats on component mount and when mediaItems change
  useEffect(() => {
    loadStats();
  }, [mediaItems, selectedProject]);

  // Set current media when mediaItems or currentIndex changes
  useEffect(() => {
    if (mediaItems.length > 0 && currentIndex < mediaItems.length) {
      const media = mediaItems[currentIndex];
      setCurrentMedia(media);
      setSelectedEmotion(media.emotion || null);
      setValence(media.valence !== null && media.valence !== undefined ? media.valence.toString() : '');
      setArousal(media.arousal !== null && media.arousal !== undefined ? media.arousal.toString() : '');

      // Save current index to localStorage
      localStorage.setItem('markupCurrentIndex', currentIndex.toString());
    } else {
      setCurrentMedia(null);
    }
  }, [mediaItems, currentIndex]);

  // Load saved index from localStorage
  useEffect(() => {
    const savedIndex = localStorage.getItem('markupCurrentIndex');
    if (savedIndex && parseInt(savedIndex) < mediaItems.length) {
      setCurrentIndex(parseInt(savedIndex));
    }
  }, [mediaItems.length]);

  const loadStats = async () => {
    try {
      const projectName = selectedProject?.name || selectedProject?.project;
      const url = projectName ? `/api/stats?project=${encodeURIComponent(projectName)}` : '/api/stats';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleEmotionSelect = (emotion) => {
    setSelectedEmotion(emotion);
  };

  const handleVADChange = (type, value) => {
    const numValue = parseFloat(value);
    if (type === 'valence') {
      if (value === '' || (!isNaN(numValue) && numValue >= -1 && numValue <= 1)) {
        setValence(value);
      }
    } else if (type === 'arousal') {
      if (value === '' || (!isNaN(numValue) && numValue >= -1 && numValue <= 1)) {
        setArousal(value);
      }
    }
  };

  const handleSubmitAnnotation = async () => {
    if (!currentMedia) return;

    // Validate that either emotion or VAD is provided
    if (!selectedEmotion && (valence === '' || arousal === '')) {
      setError('Please select an emotion or provide VAD values');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const annotationData = {
        mediaId: currentMedia.id,
        tag: selectedEmotion,
        valence: valence !== '' ? parseFloat(valence) : null,
        arousal: arousal !== '' ? parseFloat(arousal) : null
      };

      const response = await fetch('/api/annotate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(annotationData),
      });

      if (response.ok) {
        const data = await response.json();

        // Update current media with new annotation
        const updatedMedia = {
          ...currentMedia,
          emotion: data.result.emotion,
          valence: data.result.valence,
          arousal: data.result.arousal,
          status: 'completed'
        };

        // Update mediaItems array
        const updatedMediaItems = [...mediaItems];
        updatedMediaItems[currentIndex] = updatedMedia;

        // Update stats
        setStats(data.stats);

        // Move to next item if available
        if (currentIndex < mediaItems.length - 1) {
          setCurrentIndex(currentIndex + 1);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save annotation');
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      console.error('Error submitting annotation:', error);
      setError('Network error. Please try again.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < mediaItems.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleFinish = () => {
    // Go to the first unannotated item
    const unannotatedIndex = mediaItems.findIndex(item =>
      item.emotion === null || item.valence === null || item.arousal === null
    );

    if (unannotatedIndex !== -1) {
      setCurrentIndex(unannotatedIndex);
    } else {
      // All items are annotated
      setCurrentIndex(0);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
  };

  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select files to upload');
      return;
    }

    setUploading(true);

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    try {
      const projectName = selectedProject?.name || selectedProject?.project;
      const response = await fetch(`/api/projects/${projectName}/upload`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();

        // Build detailed message
        let message = `✅ Successfully added files to project "${projectName}"\n\n`;
        message += `📊 Results:\n`;
        message += `• Uploaded: ${data.total_uploaded || data.uploaded?.length || 0} file(s)\n`;

        if (data.skipped && data.skipped.length > 0) {
          const duplicates = data.skipped.filter(f => f.status === 'duplicate');
          const invalid = data.skipped.filter(f => f.status === 'skipped');

          if (duplicates.length > 0) {
            message += `• Skipped duplicates: ${duplicates.length} file(s)\n`;
          }
          if (invalid.length > 0) {
            message += `• Skipped invalid: ${invalid.length} file(s)\n`;
          }

          // Show first few duplicates if any
          if (duplicates.length > 0 && duplicates.length <= 5) {
            message += `\n📁 Duplicate files (already exist in project):\n`;
            duplicates.forEach(file => {
              message += `  • ${file.filename}\n`;
            });
          } else if (duplicates.length > 5) {
            message += `\n📁 ${duplicates.length} duplicate files (already exist in project)\n`;
          }
        }

        alert(message);
        setShowUploadModal(false);
        setSelectedFiles([]);

        // Reload the page to refresh media items
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`❌ Error: ${error.error || 'Failed to upload files'}`);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('❌ Network error. Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleLoadFolder = async () => {
    if (!loadFolderPath.trim()) {
      alert('Please enter a folder path');
      return;
    }

    try {
      const projectName = selectedProject?.name || selectedProject?.project;
      const response = await fetch(`/api/projects/${projectName}/load-folder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_folder: loadFolderPath
        })
      });

      if (response.ok) {
        const data = await response.json();

        // Build detailed message
        let message = `✅ Successfully added files to project "${projectName}" from folder\n\n`;
        message += `📊 Results:\n`;
        message += `• Loaded: ${data.total_loaded || data.loaded?.length || 0} file(s)\n`;

        if (data.skipped && data.skipped.length > 0) {
          const duplicates = data.skipped.filter(f => f.status === 'duplicate');

          if (duplicates.length > 0) {
            message += `• Skipped duplicates: ${duplicates.length} file(s)\n`;
          }

          // Show first few duplicates if any
          if (duplicates.length > 0 && duplicates.length <= 5) {
            message += `\n📁 Duplicate files (already exist in project):\n`;
            duplicates.forEach(file => {
              message += `  • ${file.filename}\n`;
            });
          } else if (duplicates.length > 5) {
            message += `\n📁 ${duplicates.length} duplicate files (already exist in project)\n`;
          }
        }

        alert(message);
        setShowLoadFolderModal(false);
        setLoadFolderPath('');

        // Reload the page to refresh media items
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`❌ Error: ${error.error || 'Failed to load folder'}`);
      }
    } catch (error) {
      console.error('Error loading folder:', error);
      alert('❌ Network error. Failed to load folder');
    }
  };

  const handleScanFolder = async () => {
    try {
      const projectName = selectedProject?.name || selectedProject?.project;
      const response = await fetch(`/api/projects/${projectName}/scan`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Found ${data.files.length} new files in project folder`);

        // Reload the page to refresh media items
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to scan folder');
      }
    } catch (error) {
      console.error('Error scanning folder:', error);
      alert('Failed to scan folder');
    }
  };

  const handleExport = async () => {
    try {
      const projectName = selectedProject?.name || selectedProject?.project;
      const response = await fetch(`/api/projects/${projectName}/export`);

      if (response.ok) {
        const data = await response.json();

        // Create and download CSV file
        const blob = new Blob([data.csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `markup-export-${projectName}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data');
    }
  };

  const handleResetAnnotations = async () => {
    if (!window.confirm('Are you sure you want to reset all annotations for this project? This cannot be undone.')) {
      return;
    }

    try {
      const projectName = selectedProject?.name || selectedProject?.project;
      const response = await fetch(`/api/projects/${projectName}/reset`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Reset ${data.reset_count} annotations`);

        // Reload the page to refresh data
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to reset annotations');
      }
    } catch (error) {
      console.error('Error resetting annotations:', error);
      alert('Failed to reset annotations');
    }
  };

  const getMediaUrl = (media) => {
    if (!media) return '';
    return `/api/uploads/${media.project}/${media.filename}`;
  };

  if (!currentMedia && mediaItems.length > 0) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p style={{ marginTop: '1rem', color: '#666' }}>Loading media...</p>
      </div>
    );
  }

  if (mediaItems.length === 0) {
    return (
      <div className="welcome-container">
        <div className="welcome-content">
          <h1 className="welcome-title">Project: {selectedProject?.name || selectedProject?.project}</h1>
          <p className="welcome-subtitle">
            This project has no media files yet.
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button
              className="start-button"
              onClick={() => setShowUploadModal(true)}
              style={{ flex: 1 }}
            >
              Upload Files
            </button>
            <button
              className="start-button"
              onClick={() => setShowLoadFolderModal(true)}
              style={{ flex: 1, background: '#333', color: '#fff' }}
            >
              Load Folder
            </button>
          </div>
          <button
            className="start-button"
            onClick={onBack}
            style={{ marginTop: '1rem', background: '#333', color: '#fff' }}
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="markup-container">
      {/* Header */}
      <div className="markup-header">
        <button className="back-button" onClick={onBack}>
          ← Back to Projects
        </button>
        <div className="markup-title">
          Media Markup - Project: {selectedProject?.name || selectedProject?.project}
        </div>
        <div className="progress-info">
          {currentIndex + 1} / {mediaItems.length} • {stats.completion_rate.toFixed(1)}% Complete
        </div>
      </div>

      {/* Main Content */}
      <div className="markup-content">
        {/* Left Panel - Media Display */}
        <div className="media-panel">
          <div className="media-title">
            {currentMedia?.filename || 'No Media'}
          </div>
          <div className="media-display">
            {currentMedia && (
              currentMedia.type === 'image' ? (
                <img
                  src={getMediaUrl(currentMedia)}
                  alt={currentMedia.filename}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://via.placeholder.com/800x600/333/fff?text=${encodeURIComponent(currentMedia.filename)}`;
                  }}
                />
              ) : (
                <video
                  src={getMediaUrl(currentMedia)}
                  controls
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.innerHTML = `
                      <div style="
                        width: 100%; 
                        height: 100%; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        background: #222; 
                        color: #fff;
                        font-size: 1.2rem;
                      ">
                        Video: ${currentMedia.filename}
                      </div>
                    `;
                  }}
                />
              )
            )}
          </div>
          <div className="media-info">
            <span className="media-id">ID: {currentMedia?.id}</span>
            <span className="media-type">{currentMedia?.type?.toUpperCase() || 'Unknown'}</span>
          </div>
        </div>

        {/* Right Panel - Tags & VAD */}
        <div className="tags-panel">
          <div className="tags-title">
            Annotation Controls
          </div>
          <div className="tags-container">
            {/* Emotion Tags */}
            <div className="tags-grid">
              {['angry', 'sad', 'neutral', 'happy', 'disgust', 'surprise', 'fear'].map(emotion => (
                <button
                  key={emotion}
                  className={`tag-btn ${selectedEmotion === emotion ? 'selected' : ''}`}
                  data-text={emotion}
                  onClick={() => handleEmotionSelect(emotion)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {emotion}
                </button>
              ))}
            </div>

            {/* VAD Controls */}
            <div className="vad-controls">
              <div className="vad-title">VAD Dimensions (-1.0 to 1.0)</div>
              <div className="vad-inputs">
                <div className="vad-group">
                  <label className="vad-label">Valence</label>
                  <input
                    type="number"
                    className="vad-input"
                    min="-1.0"
                    max="1.0"
                    step="0.1"
                    value={valence}
                    onChange={(e) => handleVADChange('valence', e.target.value)}
                    placeholder="0.0"
                  />
                </div>
                <div className="vad-group">
                  <label className="vad-label">Arousal</label>
                  <input
                    type="number"
                    className="vad-input"
                    min="-1.0"
                    max="1.0"
                    step="0.1"
                    value={arousal}
                    onChange={(e) => handleVADChange('arousal', e.target.value)}
                    placeholder="0.0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="nav-controls">
            <button
              className="nav-btn prev"
              onClick={handlePrev}
              disabled={currentIndex === 0 || loading}
            >
              ← Previous
            </button>
            <button
              className="nav-btn finish"
              onClick={handleSubmitAnnotation}
              disabled={loading || (!selectedEmotion && (valence === '' || arousal === ''))}
            >
              {loading ? 'Saving...' : 'Save & Next'}
            </button>
            <button
              className="nav-btn next"
              onClick={handleNext}
              disabled={currentIndex === mediaItems.length - 1 || loading}
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Panel */}
      <div className="stats-panel">
        {/* Basic Stats */}
        <div className="basic-stats">
          <div className="basic-stats-title">Basic Statistics</div>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-label">Total Media</div>
              <div className="stat-value">{stats.total_media}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Annotated</div>
              <div className="stat-value">{stats.total_annotated}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Completion</div>
              <div className="stat-value">{stats.completion_rate.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        {/* Emotion Distribution */}
        <div className="emotion-distribution">
          <div className="dist-title">Emotion Distribution</div>
          <div className="dist-tags">
            {Object.entries(stats.emotion_summary || {}).map(([emotion, count]) => (
              <span key={emotion} className="dist-tag" style={{ textTransform: 'capitalize' }}>
                {emotion}: {count}
              </span>
            ))}
            {Object.keys(stats.emotion_summary || {}).length === 0 && (
              <span style={{ color: '#888', fontSize: '0.9rem', padding: '0.5rem' }}>
                No emotions tagged yet
              </span>
            )}
          </div>
        </div>

        {/* VAD Statistics */}
        <div className="vad-stats">
          <div className="vad-stats-title">VAD Statistics</div>
          <div className="vad-values">
            <div className="vad-value-item">
              <div className="vad-value-label">Avg Valence</div>
              <div className="vad-value-number">
                {stats.vad_summary?.avg_valence !== undefined ? stats.vad_summary.avg_valence : '0.00'}
              </div>
            </div>
            <div className="vad-value-item">
              <div className="vad-value-label">Avg Arousal</div>
              <div className="vad-value-number">
                {stats.vad_summary?.avg_arousal !== undefined ? stats.vad_summary.avg_arousal : '0.00'}
              </div>
            </div>
          </div>
        </div>

        {/* Controls Panel */}
        <div className="controls-panel">
          <div className="controls-title">Project Controls</div>
          <div className="controls-buttons">
            <button
              className="control-btn export"
              onClick={handleExport}
            >
              Export Data
            </button>
            <button
              className="control-btn reset"
              onClick={handleResetAnnotations}
            >
              Reset Annotations
            </button>
            <button
              className="control-btn"
              onClick={() => setShowUploadModal(true)}
              style={{ background: '#1a5a2a', color: '#fff' }}
            >
              Upload Files
            </button>
            <button
              className="control-btn"
              onClick={handleScanFolder}
              style={{ background: '#2a2a5a', color: '#fff' }}
            >
              Scan Folder
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%',
            border: '1px solid #333'
          }}>
            <h3 style={{ color: '#fff', marginBottom: '1rem' }}>
              Upload Files to {selectedProject?.name || selectedProject?.project}
            </h3>

            <div style={{ marginBottom: '1rem' }}>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                accept=".png,.jpg,.jpeg,.gif,.bmp,.mp4,.avi,.mov"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: '#333',
                  border: '1px dashed #444',
                  borderRadius: '4px',
                  color: '#fff',
                  marginBottom: '1rem'
                }}
              />

              {selectedFiles.length > 0 && (
                <div style={{
                  backgroundColor: '#2a2a2a',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  marginBottom: '1rem',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  <p style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    Selected {selectedFiles.length} file(s):
                  </p>
                  <ul style={{ color: '#aaa', fontSize: '0.8rem', paddingLeft: '1rem' }}>
                    {selectedFiles.map((file, index) => (
                      <li key={index} style={{ marginBottom: '0.25rem' }}>
                        {file.name} ({(file.size / 1024).toFixed(1)} KB)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFiles([]);
                }}
                style={{
                  background: 'transparent',
                  color: '#ccc',
                  border: '1px solid #444',
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUploadFiles}
                disabled={uploading || selectedFiles.length === 0}
                style={{
                  background: uploading ? '#666' : '#fff',
                  color: uploading ? '#999' : '#000',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Folder Modal */}
      {showLoadFolderModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%',
            border: '1px solid #333'
          }}>
            <h3 style={{ color: '#fff', marginBottom: '1rem' }}>
              Load Folder to {selectedProject?.name || selectedProject?.project}
            </h3>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                color: '#ccc',
                marginBottom: '0.5rem',
                fontSize: '0.9rem'
              }}>
                Source Folder Path
              </label>
              <input
                type="text"
                value={loadFolderPath}
                onChange={(e) => setLoadFolderPath(e.target.value)}
                placeholder="/path/to/your/images/folder"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: '#333',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  marginBottom: '1rem'
                }}
              />

              <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '1rem' }}>
                Note: All image/video files from the folder will be copied to the project.
                Supported formats: PNG, JPG, JPEG, GIF, BMP, MP4, AVI, MOV
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowLoadFolderModal(false);
                  setLoadFolderPath('');
                }}
                style={{
                  background: 'transparent',
                  color: '#ccc',
                  border: '1px solid #444',
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleLoadFolder}
                style={{
                  background: '#fff',
                  color: '#000',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Load Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Markup;