import axios from 'axios';

// For production, use relative paths since we're served from Flask
const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const mediaService = {
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

  // Fetch media items from server
  getMediaItems: async () => {
    try {
      const response = await api.get('/media');
      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching media items:', error);
      // Return fallback data if API fails
      return Array.from({ length: 6 }, (_, i) => ({
        id: i + 1,
        type: i === 5 ? 'video' : 'image',
        url: `/api/media/${i + 1}/file`,
        title: `Sample ${i === 5 ? 'Video' : 'Image'} ${i + 1}`
      }));
    }
  },

  // Get next media item
  getNextMedia: async (currentId) => {
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

  // Get previous media item
  getPrevMedia: async (currentId) => {
    try {
      const response = await api.get('/prev', {
        params: { current_id: currentId }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting previous media:', error);
      throw error;
    }
  },

  // Submit annotation to server
  submitAnnotation: async (mediaId, tag) => {
    try {
      const response = await api.post('/annotate', {
        mediaId,
        tag
      });
      return response.data;
    } catch (error) {
      console.error('Error submitting annotation:', error);
      throw error;
    }
  },

  // Get statistics from server
  getStats: async () => {
    try {
      const response = await api.get('/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching stats:', error);
      return {
        total_media: 6,
        total_annotated: 0,
        completion_rate: 0,
        tags_summary: {}
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

  // Reset data
  resetData: async () => {
    try {
      const response = await api.post('/reset');
      return response.data;
    } catch (error) {
      console.error('Error resetting data:', error);
      throw error;
    }
  },

  // Get media file URL
  getMediaFileUrl: (media) => {
    if (media.url && media.url.startsWith('/')) {
      return media.url;
    }
    return `/api/media/${media.id}/file`;
  }
};

export default api;