import React, { useState, useEffect } from 'react';

const Markup = ({ mediaItems, onBack }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [markups, setMarkups] = useState({});
  const [vadValues, setVadValues] = useState({});
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const tags = ['angry', 'sad', 'neutral', 'happy', 'disgust', 'surprise', 'fear'];

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const currentItem = mediaItems[currentIndex];
  const currentTag = markups[currentIndex];
  const currentValence = vadValues[currentIndex]?.valence || '';
  const currentArousal = vadValues[currentIndex]?.arousal || '';

  // Calculate annotation progress
  const annotatedCount = Object.keys(markups).filter(key =>
    markups[key] && vadValues[key]?.valence !== undefined && vadValues[key]?.arousal !== undefined
  ).length;

  const saveAnnotation = async (itemIndex, tag, valence, arousal) => {
    setError('');

    // Update local state
    setMarkups(prev => ({
      ...prev,
      [itemIndex]: tag
    }));

    setVadValues(prev => ({
      ...prev,
      [itemIndex]: {
        valence: valence || null,
        arousal: arousal || null
      }
    }));

    try {
      const response = await fetch('/api/annotate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaId: mediaItems[itemIndex].id,
          tag: tag || null,
          valence: valence || null,
          arousal: arousal || null
        })
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save annotation');
        // Revert local state on error
        setMarkups(prev => {
          const newMarkups = { ...prev };
          delete newMarkups[itemIndex];
          return newMarkups;
        });
        setVadValues(prev => {
          const newVad = { ...prev };
          delete newVad[itemIndex];
          return newVad;
        });
      }
    } catch (error) {
      console.error('Failed to save annotation:', error);
      setError('Network error. Please try again.');
      // Revert local state on error
      setMarkups(prev => {
        const newMarkups = { ...prev };
        delete newMarkups[itemIndex];
        return newMarkups;
      });
      setVadValues(prev => {
        const newVad = { ...prev };
        delete newVad[itemIndex];
        return newVad;
      });
    }
  };

  const goToNext = () => {
    if (currentIndex < mediaItems.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setError('');
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setError('');
    }
  };

  const handleFinish = () => {
    const completionRate = ((annotatedCount / mediaItems.length) * 100).toFixed(1);
    const message = `Session Complete!\n\nTotal: ${mediaItems.length}\nAnnotated: ${annotatedCount}\nProgress: ${completionRate}%\n\nReturn to Welcome?`;

    if (window.confirm(message)) {
      onBack();
    }
  };

  const handleTagClick = (tag) => {
    saveAnnotation(currentIndex, tag, currentValence, currentArousal);
  };

  const handleVadChange = (type, value) => {
    const numValue = parseFloat(value);
    if (value === '' || (!isNaN(numValue) && numValue >= -1 && numValue <= 1)) {
      const newValence = type === 'valence' ? value : currentValence;
      const newArousal = type === 'arousal' ? value : currentArousal;

      saveAnnotation(currentIndex, currentTag, newValence, newArousal);
    } else {
      // Update local state but don't save to server yet
      setVadValues(prev => ({
        ...prev,
        [currentIndex]: {
          valence: type === 'valence' ? value : currentValence,
          arousal: type === 'arousal' ? value : currentArousal
        }
      }));
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/export');
      if (response.ok) {
        const data = await response.json();
        // Create and download CSV
        const blob = new Blob([data.csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `markup-results-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        alert(`Exported ${data.total} records (${data.annotated} annotated)`);
      }
    } catch (error) {
      setError('Failed to export data');
    }
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset all annotations? This cannot be undone.')) {
      try {
        const response = await fetch('/api/reset', { method: 'POST' });
        if (response.ok) {
          const data = await response.json();
          setMarkups({});
          setVadValues({});
          setStats(prev => ({
            ...prev,
            total_annotated: 0,
            pending: prev?.total_media || 0,
            completion_rate: 0
          }));
          alert(data.message);
        }
      } catch (error) {
        setError('Failed to reset annotations');
      }
    }
  };

  const getMediaUrl = (item) => {
    if (!item) return '';

    if (item.url && (item.url.startsWith('http') || item.url.startsWith('/'))) {
      return item.url;
    }

    return `/api/media/${item.id}/file`;
  };

  if (!currentItem || mediaItems.length === 0) {
    return (
      <div className="markup-container">
        <div className="error-message" style={{ margin: 'auto' }}>
          No media items available.
        </div>
        <button
          onClick={onBack}
          className="control-button finish"
          style={{ margin: '1rem auto', width: '200px' }}
        >
          Back to Welcome
        </button>
      </div>
    );
  }

  const mediaUrl = getMediaUrl(currentItem);
  const progressPercentage = mediaItems.length > 0 ? ((annotatedCount / mediaItems.length) * 100).toFixed(0) : 0;

  return (
    <div className="markup-container">
      {/* Header - 5vh */}
      <div className="markup-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <div className="markup-title">Media Markup Tool</div>
        <div className="progress-info">
          {currentIndex + 1} / {mediaItems.length}
        </div>
      </div>

      {/* Main Content - 70vh */}
      <div className="markup-content">
        {/* Left Panel - Media */}
        <div className="media-panel">
          <div className="media-title">Media Preview</div>
          <div className="media-display">
            {currentItem.type === 'image' ? (
              <img
                src={mediaUrl}
                alt={`Media ${currentItem.id}`}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `https://picsum.photos/seed/${currentItem.id}/400/300?grayscale`;
                }}
              />
            ) : (
              <video
                controls
                key={currentItem.id}
              >
                <source src={mediaUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            )}
          </div>
          <div className="media-info">
            <span>ID: {currentItem.id}</span>
            <span className="media-id">{currentItem.type}</span>
          </div>
        </div>

        {/* Right Panel - Tags & Controls */}
        <div className="tags-panel">
          <div className="tags-title">Emotion Annotation</div>
          <div className="tags-container">
            {/* Emotion Tags Grid */}
            <div className="tags-grid">
              {tags.map(tag => (
                <button
                  key={tag}
                  className={`tag-btn ${currentTag === tag ? 'selected' : ''}`}
                  data-text={tag}
                  onClick={() => handleTagClick(tag)}
                ></button>
              ))}
            </div>

            {/* VAD Controls */}
            <div className="vad-controls">
              <div className="vad-title">VAD Dimensions</div>
              <div className="vad-inputs">
                <div className="vad-group">
                  <label className="vad-label">Valence (-1 to 1)</label>
                  <input
                    className="vad-input"
                    type="number"
                    min="-1"
                    max="1"
                    step="0.1"
                    value={currentValence}
                    onChange={(e) => handleVadChange('valence', e.target.value)}
                    placeholder="0.0"
                  />
                </div>
                <div className="vad-group">
                  <label className="vad-label">Arousal (-1 to 1)</label>
                  <input
                    className="vad-input"
                    type="number"
                    min="-1"
                    max="1"
                    step="0.1"
                    value={currentArousal}
                    onChange={(e) => handleVadChange('arousal', e.target.value)}
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
              onClick={goToPrev}
              disabled={currentIndex === 0}
            >
              Previous
            </button>
            <button
              className="nav-btn next"
              onClick={goToNext}
              disabled={currentIndex === mediaItems.length - 1}
            >
              Next
            </button>
            <button
              className="nav-btn finish"
              onClick={handleFinish}
            >
              Finish
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Panel - 25vh */}
      <div className="stats-panel">
        {/* Basic Statistics */}
        <div className="basic-stats">
          <div className="basic-stats-title">Statistics</div>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-label">Total</div>
              <div className="stat-value">{mediaItems.length}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Annotated</div>
              <div className="stat-value">{annotatedCount}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Progress</div>
              <div className="stat-value">{progressPercentage}%</div>
            </div>
          </div>
        </div>

        {/* Emotion Distribution */}
        <div className="emotion-distribution">
          <div className="dist-title">Emotion Distribution</div>
          <div className="dist-tags">
            {stats && stats.emotion_summary ? (
              Object.entries(stats.emotion_summary).map(([emotion, count]) => (
                <span key={emotion} className="dist-tag">
                  {emotion}: {count}
                </span>
              ))
            ) : (
              <span className="dist-tag">No annotations yet</span>
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
                {stats?.vad_summary?.avg_valence
                  ? parseFloat(stats.vad_summary.avg_valence).toFixed(2)
                  : '0.00'}
              </div>
            </div>
            <div className="vad-value-item">
              <div className="vad-value-label">Avg Arousal</div>
              <div className="vad-value-number">
                {stats?.vad_summary?.avg_arousal
                  ? parseFloat(stats.vad_summary.avg_arousal).toFixed(2)
                  : '0.00'}
              </div>
            </div>
          </div>
        </div>

        {/* Tools/Controls */}
        <div className="controls-panel">
          <div className="controls-title">Tools</div>
          <div className="controls-buttons">
            <button className="control-btn export" onClick={handleExport}>
              Export Data
            </button>
            <button className="control-btn reset" onClick={handleReset}>
              Reset All
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
    </div>
  );
};

export default Markup;