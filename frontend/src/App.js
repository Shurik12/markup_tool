import React, { useState, useEffect } from 'react';
import Welcome from './components/Welcome';
import Markup from './components/Markup';
import './styles/App.css';

function App() {
  const [isMarkupStarted, setIsMarkupStarted] = useState(false);
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Initialize or check health on app start
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        console.log('Backend health:', data);
      } else {
        setError('Backend not responding');
      }
    } catch (err) {
      console.warn('Backend health check failed:', err);
      setError('Cannot connect to backend');
    } finally {
      setLoading(false);
    }
  };

  const handleStartMarkup = async () => {
    setLoading(true);
    try {
      // Fetch media items from backend
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
      setError('Failed to load media items');
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
        <p>Loading application...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
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