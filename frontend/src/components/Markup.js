import React, { useState, useEffect } from 'react';

const Markup = ({ mediaItems, onBack }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [markups, setMarkups] = useState({});
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
  const annotatedCount = Object.keys(markups).length;

  const setCurrentTag = async (itemIndex, tag) => {
    setError('');
    setMarkups(prev => ({
      ...prev,
      [itemIndex]: tag
    }));

    try {
      const response = await fetch('/api/annotate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaId: mediaItems[itemIndex].id,
          tag: tag
        })
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      } else {
        setError('Failed to save annotation');
      }
    } catch (error) {
      console.error('Failed to save annotation:', error);
      setError('Network error. Please try again.');
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
    setCurrentTag(currentIndex, tag);
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

  return (
    <div className="markup-container">
      {/* Header */}
      <div className="markup-header">
        <div className="header-left">
          <button 
            onClick={onBack}
            className="back-button"
            title="Back to Welcome"
          >
            ← Back
          </button>
          <h1 className="markup-title">Markup Tool</h1>
        </div>
        <div className="progress-info">
          {currentIndex + 1} / {mediaItems.length}
        </div>
      </div>

      {/* Main Content */}
      <div className="markup-content">
        {/* Left: Media Preview */}
        <div className="media-card">
          <div className="media-header">
            <h3>Media Preview</h3>
            <span className="media-id">ID: {currentItem.id}</span>
          </div>
          <div className="media-display">
            {currentItem.type === 'image' ? (
              <img 
                src={mediaUrl} 
                alt={`Media ${currentItem.id}`}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `https://picsum.photos/400/300?random=${currentItem.id}&blur=1`;
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
        </div>

        {/* Right: Tags Section */}
        <div className="tags-card">
          <div className="tags-header">
            <h3>Select Emotion Tag</h3>
            {currentTag && (
              <span className="current-tag-display">
                Selected: <strong>{currentTag}</strong>
              </span>
            )}
          </div>
          
          <div className="tags-grid">
            {tags.map(tag => (
              <button
                key={tag}
                className={`tag-button ${tag} ${currentTag === tag ? 'selected' : ''}`}
                onClick={() => handleTagClick(tag)}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Controls */}
          <div className="controls-row">
            <button
              className="control-button prev"
              onClick={goToPrev}
              disabled={currentIndex === 0}
            >
              Previous
            </button>
            
            <button
              className="control-button next"
              onClick={goToNext}
              disabled={currentIndex === mediaItems.length - 1}
            >
              Next →
            </button>
            
            <button
              className="control-button finish"
              onClick={handleFinish}
            >
              Finish
            </button>
          </div>
        </div>

        {/* Statistics - Full Width */}
        <div className="stats-card">
          <div className="stats-header">
            <h3>Statistics</h3>
            <span className="stats-progress">
              {annotatedCount} / {mediaItems.length} completed
            </span>
          </div>
          
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
              <div className="stat-value">
                {((annotatedCount / mediaItems.length) * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Tag Distribution */}
          {stats && stats.tags_summary && Object.keys(stats.tags_summary).length > 0 && (
            <div className="tags-distribution">
              <h4>Tag Distribution</h4>
              <div className="tags-list">
                {Object.entries(stats.tags_summary).map(([tag, count]) => (
                  <span key={tag} className="tag-badge">
                    {tag}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Markup;