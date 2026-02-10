import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import apiService from '../services/api';

export const useAppState = () => {
  const [currentView, setCurrentView] = useState('welcome');
  const [selectedProject, setSelectedProject] = useState(null);
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [restoringState, setRestoringState] = useState(false);

  // Use localStorage hook for persistent state
  const [savedState, setSavedState] = useLocalStorage('markupApp_state', {
    currentView: 'welcome',
    selectedProject: null,
    currentIndex: 0,
    savedTime: null
  });

  // Save state whenever relevant state changes
  useEffect(() => {
    if (currentView !== 'welcome') {
      const newState = {
        currentView,
        selectedProject,
        currentIndex: 0, // Reset index when view changes
        savedTime: Date.now()
      };
      setSavedState(newState);
    }
  }, [currentView, selectedProject, setSavedState]);

  // Restore state on mount
  useEffect(() => {
    const restoreState = async () => {
      if (!savedState || !savedState.savedTime) return;
      
      const hoursDiff = (Date.now() - savedState.savedTime) / (1000 * 60 * 60);
      if (hoursDiff < 1) { // Less than 1 hour old
        setRestoringState(true);
        
        try {
          setCurrentView(savedState.currentView);
          
          if (savedState.currentView === 'markup' && savedState.selectedProject) {
            setSelectedProject(savedState.selectedProject);
            await loadProjectMedia(savedState.selectedProject.project);
          }
        } catch (err) {
          console.error('Error restoring state:', err);
          setError('Failed to restore your previous session');
          clearState();
        } finally {
          setRestoringState(false);
        }
      } else {
        clearState();
      }
    };

    restoreState();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearState = useCallback(() => {
    setSavedState({
      currentView: 'welcome',
      selectedProject: null,
      currentIndex: 0,
      savedTime: null
    });
    setSelectedProject(null);
    setMediaItems([]);
    setCurrentView('welcome');
    localStorage.removeItem('markupCurrentIndex');
  }, [setSavedState]);

  const loadProjectMedia = async (projectName) => {
    setLoading(true);
    setError('');

    try {
      const data = await apiService.getProjectMedia(projectName);
      setMediaItems(data.items || []);
    } catch (err) {
      console.error('Error loading project media:', err);
      setError('Failed to load project media. Please try again.');
      setCurrentView('project-select');
      clearState();
    } finally {
      setLoading(false);
    }
  };

  const handleStartMarkup = useCallback(() => {
    setCurrentView('project-select');
  }, []);

  const handleProjectSelect = useCallback(async (project) => {
    setSelectedProject(project);
    setCurrentView('markup');
    await loadProjectMedia(project.project);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBackToProjectSelect = useCallback(() => {
    setSelectedProject(null);
    setMediaItems([]);
    setCurrentView('project-select');
    
    setSavedState({
      currentView: 'project-select',
      selectedProject: null,
      currentIndex: 0,
      savedTime: Date.now()
    });
    localStorage.removeItem('markupCurrentIndex');
  }, [setSavedState]);

  const handleBackToWelcome = useCallback(() => {
    clearState();
  }, [clearState]);

  const refreshProjectMedia = async () => {
    if (selectedProject?.project) {
      await loadProjectMedia(selectedProject.project);
    }
  };

  return {
    // State
    currentView,
    selectedProject,
    mediaItems,
    loading,
    error,
    restoringState,
    
    // Setters
    setCurrentView,
    setSelectedProject,
    setMediaItems,
    setLoading,
    setError,
    
    // Actions
    loadProjectMedia,
    handleStartMarkup,
    handleProjectSelect,
    handleBackToProjectSelect,
    handleBackToWelcome,
    clearState,
    refreshProjectMedia
  };
};