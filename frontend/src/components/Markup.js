import React, { useState, useEffect } from 'react';

const Markup = ({ mediaItems, onBack }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [markups, setMarkups] = useState({});
  const [stats, setStats] = useState(null);
  
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

  const setCurrentTag = async (itemIndex, tag) => {
    // Update local state
    setMarkups(prev => ({
      ...prev,
      [itemIndex]: tag
    }));

    // Send to backend
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
      }
    } catch (error) {
      console.error('Failed to save annotation:', error);
    }
  };

  const goToNext = () => {
    if (currentIndex < mediaItems.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleFinish = () => {
    const annotatedCount = Object.keys(markups).length;
    const message = `Markup Session Complete!\n\nTotal Items: ${mediaItems.length}\nAnnotated Items: ${annotatedCount}\nCompletion Rate: ${((annotatedCount / mediaItems.length) * 100).toFixed(1)}%`;
    
    if (window.confirm(message + '\n\nReturn to Welcome screen?')) {
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
        <div className="media-loading">No media items available.</div>
        <button 
          onClick={onBack}
          className="control-button"
          style={{ margin: '2rem auto', display: 'block' }}
        >
          Back to Welcome
        </button>
      </div>
    );
  }

  const mediaUrl = getMediaUrl(currentItem);
  const annotatedCount = Object.keys(markups).length;

  return (
    <div className="markup-container">
      {/* Header */}
      <div className="markup-header">
        <button 
          onClick={onBack}
          className="back-button"
          title="Back to Welcome"
        >
          ← Back
        </button>
        <h1 className="markup-title">Markup Tool</h1>
        <div className="progress-info">
          {currentIndex + 1}/{mediaItems.length}
        </div>
      </div>

      {/* Main Content */}
      <div className="markup-content">
        {/* Left - Media Display */}
        <div className="media-section">
          <div className="media-header">
            <h3>Media Preview</h3>
          </div>
          <div className="media-display">
            {currentItem.type === 'image' ? (
              <img 
                src={mediaUrl} 
                alt={currentItem.title || `Media ${currentIndex + 1}`}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `https://picsum.photos/800/600?random=${currentIndex + 1}`;
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
          <div className="media-title">
            {currentItem.title || `Media Item ${currentIndex + 1}`}
          </div>
        </div>

        {/* Right - Tags and Controls */}
        <div className="controls-section">
          {/* Tags */}
          <div className="tags-container">
            <h2 className="tags-title">Select Emotion Tag</h2>
            <div className="tags-grid">
              {tags.map(tag => (
                <button
                  key={tag}
                  className={`tag-button ${tag} ${currentTag === tag ? 'selected' : ''}`}
                  onClick={() => handleTagClick(tag)}
                  title={`Tag as ${tag}`}
                >
                  {tag}
                </button>
              ))}
            </div>
            {currentTag && (
              <div className="current-tag">
                Selected: <strong>{currentTag}</strong>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="controls-container">
            <div className="controls-buttons">
              <button
                className="control-button prev"
                onClick={goToPrev}
                disabled={currentIndex === 0}
                title="Previous media"
              >
                ← Previous
              </button>
              
              <button
                className="control-button next"
                onClick={goToNext}
                disabled={currentIndex === mediaItems.length - 1}
                title="Next media"
              >
                Next →
              </button>
              
              <button
                className="control-button submit"
                onClick={handleFinish}
                title="Finish markup session"
              >
                Finish
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="stats-container">
            <div className="stats-title">
              <span>Statistics</span>
              <span style={{ fontSize: '0.9rem', color: '#666' }}>
                {annotatedCount}/{mediaItems.length} completed
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
              {stats && stats.tags_summary && Object.keys(stats.tags_summary).length > 0 && (
                <div className="stat-tags">
                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem', textAlign: 'center' }}>
                    Tag Distribution
                  </div>
                  <div className="tags-summary">
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
      </div>
    </div>
  );
};

export default Markup;