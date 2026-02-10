import React from 'react';
import Welcome from './components/Welcome';
import Markup from './components/Markup';
import ProjectSelector from './components/ProjectSelector';
import { useAppState } from './hooks/useAppState';
import './styles/App.css';

function App() {
  const {
    currentView,
    selectedProject,
    mediaItems,
    loading,
    error,
    restoringState,
    handleStartMarkup,
    handleProjectSelect,
    handleBackToProjectSelect,
    handleBackToWelcome,
    setError
  } = useAppState();

  // Clear error after 5 seconds
  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, setError]);

  // Show loading while restoring state
  if (restoringState) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p style={{ marginTop: '1rem', color: '#666' }}>Restoring your session...</p>
      </div>
    );
  }

  // Show loading while loading media
  if (currentView === 'markup' && loading && mediaItems.length === 0) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p style={{ marginTop: '1rem', color: '#666' }}>Loading project media...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {currentView === 'welcome' && (
        <Welcome onStart={handleStartMarkup} />
      )}

      {currentView === 'project-select' && (
        <div className="welcome-container">
          <ProjectSelector
            onProjectSelect={handleProjectSelect}
            onBack={handleBackToWelcome}
          />
        </div>
      )}

      {currentView === 'markup' && selectedProject && (
        <Markup
          mediaItems={mediaItems}
          selectedProject={selectedProject}
          onBack={handleBackToProjectSelect}
          loading={loading}
        />
      )}

      {error && (
        <div className="error-toast">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{error}</span>
            <button 
              className="error-close" 
              onClick={() => setError('')}
              aria-label="Close error message"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;