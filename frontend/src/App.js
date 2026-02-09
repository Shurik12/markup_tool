import React, { useState, useEffect } from 'react';
import Welcome from './components/Welcome';
import Markup from './components/Markup';
import ProjectSelector from './components/ProjectSelector';
import './styles/App.css';

function App() {
  const [currentView, setCurrentView] = useState('welcome');
  const [selectedProject, setSelectedProject] = useState(null);
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [error, setError] = useState('');
  const [restoringState, setRestoringState] = useState(false);

  // Load saved state
  useEffect(() => {
    const restoreSavedState = async () => {
      try {
        const savedView = localStorage.getItem('markupApp_currentView');
        const savedProject = localStorage.getItem('markupApp_selectedProject');
        const savedTime = localStorage.getItem('markupApp_savedTime');

        if (savedView && savedTime) {
          const hoursDiff = (Date.now() - parseInt(savedTime)) / (1000 * 60 * 60);
          if (hoursDiff < 1) { // Less than 1 hour old
            setRestoringState(true);
            
            // Restore the view
            setCurrentView(savedView);
            
            // If we were on markup view, restore project and media
            if (savedView === 'markup' && savedProject) {
              const project = JSON.parse(savedProject);
              setSelectedProject(project);
              
              // Load project media
              await loadProjectMedia(project.project);
            }
            
            setRestoringState(false);
          } else {
            clearSavedState();
          }
        }
      } catch (error) {
        console.error('Error reading saved state:', error);
        clearSavedState();
        setRestoringState(false);
      }
    };

    restoreSavedState();
  }, []);

  // Save state when view changes
  useEffect(() => {
    if (currentView !== 'welcome') {
      localStorage.setItem('markupApp_currentView', currentView);
      localStorage.setItem('markupApp_savedTime', Date.now().toString());
    }
  }, [currentView]);

  // Save project when it changes
  useEffect(() => {
    if (selectedProject && currentView === 'markup') {
      localStorage.setItem('markupApp_selectedProject', JSON.stringify(selectedProject));
      localStorage.setItem('markupApp_savedTime', Date.now().toString());
    }
  }, [selectedProject, currentView]);

  const clearSavedState = () => {
    localStorage.removeItem('markupApp_currentView');
    localStorage.removeItem('markupApp_selectedProject');
    localStorage.removeItem('markupApp_savedTime');
    localStorage.removeItem('markupCurrentIndex');
  };

  const loadProjectMedia = async (projectName) => {
    setLoadingMedia(true);
    setError('');

    try {
      const response = await fetch(`/api/projects/${projectName}/media`);
      if (response.ok) {
        const data = await response.json();
        setMediaItems(data.items || []);
      } else {
        throw new Error('Failed to load project media');
      }
    } catch (err) {
      console.error('Error loading project media:', err);
      setError('Failed to load project media. Please try again.');
      setCurrentView('project-select');
      clearSavedState();
    } finally {
      setLoadingMedia(false);
    }
  };

  const handleStartMarkup = () => {
    setCurrentView('project-select');
  };

  const handleProjectSelect = async (project) => {
    setSelectedProject(project);
    setCurrentView('markup');
    
    // Load project media
    setLoadingMedia(true);
    await loadProjectMedia(project.project);
  };

  const handleBackToProjectSelect = () => {
    // Don't clear everything, just go back to project select
    setSelectedProject(null);
    setMediaItems([]);
    setCurrentView('project-select');
    
    // Update localStorage
    localStorage.setItem('markupApp_currentView', 'project-select');
    localStorage.setItem('markupApp_savedTime', Date.now().toString());
    localStorage.removeItem('markupApp_selectedProject');
    localStorage.removeItem('markupCurrentIndex');
  };

  const handleBackToWelcome = () => {
    clearSavedState();
    setSelectedProject(null);
    setMediaItems([]);
    setCurrentView('welcome');
  };

  // Show loading while restoring state
  if (restoringState) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p style={{ marginTop: '1rem', color: '#666' }}>Restoring your session...</p>
      </div>
    );
  }

  // Show loading while loading media for markup view
  if (currentView === 'markup' && loadingMedia) {
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
        />
      )}
    </div>
  );
}

export default App;