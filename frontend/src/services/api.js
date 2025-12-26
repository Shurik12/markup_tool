import axios from 'axios';

// For production, use relative paths since we're served from Flask
const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const markupService = {
  // Health check
  checkHealth: async () => {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  },

  // Fetch all media with markup status
  getMediaItems: async () => {
    try {
      const response = await api.get('/media');
      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching media items:', error);
      return [];
    }
  },

  // Submit emotion markup
  submitMarkup: async (mediaId, emotion) => {
    try {
      const response = await api.post('/annotate', {
        mediaId,
        tag: emotion
      });
      return response.data;
    } catch (error) {
      console.error('Error submitting markup:', error);
      throw error;
    }
  },

  // Get statistics
  getStats: async () => {
    try {
      const response = await api.get('/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching stats:', error);
      return {
        total_media: 0,
        total_annotated: 0,
        pending: 0,
        completion_rate: 0,
        emotion_summary: {},
        type_summary: {}
      };
    }
  },

  // Upload media file
  uploadMedia: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post('/api/media/upload', formData);
      return response.data;
    } catch (error) {
      console.error('Error uploading media:', error);
      throw error;
    }
  },

  // Scan for new files
  scanFiles: async () => {
    try {
      const response = await api.post('/scan');
      return response.data;
    } catch (error) {
      console.error('Error scanning files:', error);
      throw error;
    }
  },

  // Reset annotations
  resetAnnotations: async () => {
    try {
      const response = await api.post('/reset');
      return response.data;
    } catch (error) {
      console.error('Error resetting annotations:', error);
      throw error;
    }
  },

  // Export results
  exportResults: async () => {
    try {
      const response = await api.get('/export');
      return response.data;
    } catch (error) {
      console.error('Error exporting results:', error);
      throw error;
    }
  },

  // Get next unannotated media
  getNextUnannotated: async (currentId) => {
    try {
      const response = await api.get('/next', {
        params: { current_id: currentId }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting next media:', error);
      throw error;
    }
  },

  // Get previous media
  getPrevious: async (currentId) => {
    try {
      const response = await api.get('/prev', {
        params: { current_id: currentId }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting previous media:', error);
      throw error;
    }
  }
};

export default api;