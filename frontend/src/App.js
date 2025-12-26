import React, { useState, useEffect } from 'react';
import Welcome from './components/Welcome';
import Markup from './components/Markup';
import './styles/App.css';

function App() {
  const [isMarkupStarted, setIsMarkupStarted] = useState(false);
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStartMarkup = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/media');
      if (response.ok) {
        const data = await response.json();
        setMediaItems(data.items || []);
        setIsMarkupStarted(true);
      } else {
        throw new Error('Failed to fetch media');
      }
    } catch (err) {
      console.error('Error starting markup:', err);
      setError('Failed to load media items. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToWelcome = () => {
    setIsMarkupStarted(false);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

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