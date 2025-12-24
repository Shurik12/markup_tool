import React, { createContext, useState, useContext, useCallback } from 'react';

const MarkupContext = createContext();

export const useMarkup = () => {
  const context = useContext(MarkupContext);
  if (!context) {
    throw new Error('useMarkup must be used within a MarkupProvider');
  }
  return context;
};

export const MarkupProvider = ({ children }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [markups, setMarkups] = useState({});
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const tags = ['angry', 'sad', 'neutral', 'happy', 'disgust', 'surprise', 'fear'];

  const setCurrentTag = useCallback((itemIndex, tag) => {
    setMarkups(prev => ({
      ...prev,
      [itemIndex]: tag
    }));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => prev + 1);
  }, []);

  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);

  const loadMediaItems = useCallback(async () => {
    setLoading(true);
    try {
      // In a real app, this would come from an API
      const mockMedia = [
        { id: 1, type: 'image', url: 'https://picsum.photos/800/600?random=1' },
        { id: 2, type: 'image', url: 'https://picsum.photos/800/600?random=2' },
        { id: 3, type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
        { id: 4, type: 'image', url: 'https://picsum.photos/800/600?random=3' },
        { id: 5, type: 'image', url: 'https://picsum.photos/800/600?random=4' },
      ];
      setMediaItems(mockMedia);
    } catch (error) {
      console.error('Failed to load media:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const submitMarkups = useCallback(async () => {
    try {
      // In a real app, this would send data to an API
      console.log('Submitting markups:', markups);
      alert(`Markups submitted successfully!\n${JSON.stringify(markups, null, 2)}`);
    } catch (error) {
      console.error('Failed to submit markups:', error);
      alert('Failed to submit markups. Please try again.');
    }
  }, [markups]);

  const value = {
    currentIndex,
    setCurrentIndex,
    markups,
    setCurrentTag,
    mediaItems,
    loading,
    loadMediaItems,
    goToNext,
    goToPrev,
    submitMarkups,
    tags,
    totalItems: mediaItems.length,
    currentItem: mediaItems[currentIndex],
    currentTag: markups[currentIndex],
    hasNext: currentIndex < mediaItems.length - 1,
    hasPrev: currentIndex > 0,
  };

  return (
    <MarkupContext.Provider value={value}>
      {children}
    </MarkupContext.Provider>
  );
};