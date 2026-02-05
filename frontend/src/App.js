import React, { useState, useEffect } from 'react';
import Welcome from './components/Welcome';
import Markup from './components/Markup';
import './styles/App.css';

function App() {
  // Read initial state from localStorage
  const getInitialState = () => {
    try {
      const saved = localStorage.getItem('markupApp_isMarkupStarted');
      // Check if saved state is recent (less than 1 hour)
      const savedTime = localStorage.getItem('markupApp_savedTime');
      if (savedTime) {
        const hoursDiff = (Date.now() - parseInt(savedTime)) / (1000 * 60 * 60);
        if (hoursDiff > 1) {
          // Clear stale state (older than 1 hour)
          localStorage.removeItem('markupApp_isMarkupStarted');
          localStorage.removeItem('markupApp_savedTime');
          return false;
        }
      }
      return saved === 'true';
    } catch (error) {
      console.error('Error reading saved state:', error);
      return false;
    }
  };

  const [isMarkupStarted, setIsMarkupStarted] = useState(getInitialState());
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [error, setError] = useState('');

  // Load media items on component mount AND when isMarkupStarted changes
  useEffect(() => {
    const loadMediaItems = async () => {
      // Only load if we have no items yet
      if (mediaItems.length === 0) {
        setLoading(true);
        setError('');
        try {
          const response = await fetch('/api/media');
          if (response.ok) {
            const data = await response.json();
            setMediaItems(data.items || []);
          } else {
            throw new Error('Failed to fetch media');
          }
        } catch (err) {
          console.error('Error loading media items:', err);
          setError('Failed to load media items. Please try again.');
          // If we're in markup mode but failed to load, go back to welcome
          if (isMarkupStarted) {
            setIsMarkupStarted(false);
            localStorage.removeItem('markupApp_isMarkupStarted');
            localStorage.removeItem('markupApp_savedTime');
          }
        } finally {
          setLoading(false);
        }
      }
    };

    loadMediaItems();
  }, [isMarkupStarted]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (isMarkupStarted) {
      localStorage.setItem('markupApp_isMarkupStarted', 'true');
      localStorage.setItem('markupApp_savedTime', Date.now().toString());
    } else {
      localStorage.removeItem('markupApp_isMarkupStarted');
      localStorage.removeItem('markupApp_savedTime');
    }
  }, [isMarkupStarted]);

  const handleStartMarkup = () => {
    // If we already have media items, just switch to markup
    if (mediaItems.length > 0) {
      setIsMarkupStarted(true);
    } else {
      // Otherwise, reload media items first
      setLoading(true);
      fetch('/api/media')
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Failed to fetch media');
        })
        .then(data => {
          setMediaItems(data.items || []);
          setIsMarkupStarted(true);
        })
        .catch(err => {
          console.error('Error starting markup:', err);
          setError('Failed to load media items. Please try again.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  const handleBackToWelcome = () => {
    setIsMarkupStarted(false);
    // Also clear current position in Markup if saved
    localStorage.removeItem('markupCurrentIndex');
  };

  // Clear stale state on page unload (optional)
  useEffect(() => {
    const clearStaleState = () => {
      const savedTime = localStorage.getItem('markupApp_savedTime');
      if (savedTime) {
        const hoursDiff = (Date.now() - parseInt(savedTime)) / (1000 * 60 * 60);
        if (hoursDiff > 24) {
          // Clear state older than 24 hours
          localStorage.removeItem('markupApp_isMarkupStarted');
          localStorage.removeItem('markupApp_savedTime');
          localStorage.removeItem('markupCurrentIndex');
        }
      }
    };

    // Run on component mount
    clearStaleState();

    // Also run when tab/window is about to close
    window.addEventListener('beforeunload', clearStaleState);
    
    return () => {
      window.removeEventListener('beforeunload', clearStaleState);
    };
  }, []);

  // Show loading spinner if we're loading media items
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p style={{ marginTop: '1rem', color: '#666' }}>Loading media items...</p>
      </div>
    );
  }

  // Show error if we're in welcome mode and have an error
  if (error && !isMarkupStarted) {
    return (
      <div className="welcome-container">
        <div className="welcome-content">
          <h1 className="welcome-title">Error</h1>
          <p className="welcome-subtitle" style={{ color: '#dc2626' }}>
            {error}
          </p>
          <button 
            className="start-button"
            onClick={() => window.location.reload()}
            style={{ background: '#dc2626' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // If we're in markup mode but have no media items, show error
  if (isMarkupStarted && mediaItems.length === 0) {
    return (
      <div className="welcome-container">
        <div className="welcome-content">
          <h1 className="welcome-title">No Media Available</h1>
          <p className="welcome-subtitle">
            No media items were found. Please upload some media first or check your connection.
          </p>
          <button 
            className="start-button"
            onClick={handleBackToWelcome}
          >
            Back to Welcome
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {isMarkupStarted ? (
        <Markup 
          mediaItems={mediaItems} 
          onBack={handleBackToWelcome}
        />
      ) : (
        <Welcome onStart={handleStartMarkup} />
      )}
    </div>
  );
}

export default App;