// API service for the markup tool
const API_BASE_URL = '/api';

class ApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  // Generic request handler
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const requestOptions = { ...defaultOptions, ...options };

    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Health check
  async checkHealth() {
    return this.request('/health');
  }

  // Project methods
  async getProjects() {
    return this.request('/projects');
  }

  async getProjectMedia(projectName) {
    return this.request(`/projects/${projectName}/media`);
  }

  async uploadFiles(projectName, files) {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    return this.request(`/projects/${projectName}/upload`, {
      method: 'POST',
      body: formData,
      headers: {}, // Don't set Content-Type for FormData
    });
  }

  async loadFolder(projectName, folderPath) {
    return this.request(`/projects/${projectName}/load-folder`, {
      method: 'POST',
      body: JSON.stringify({ source_folder: folderPath }),
    });
  }

  async scanProject(projectName) {
    return this.request(`/projects/${projectName}/scan`, {
      method: 'POST',
    });
  }

  async resetProjectAnnotations(projectName) {
    return this.request(`/projects/${projectName}/reset`, {
      method: 'POST',
    });
  }

  async exportProject(projectName) {
    return this.request(`/projects/${projectName}/export`);
  }

  async deleteProject(projectName) {
    return this.request(`/projects/${projectName}`, {
      method: 'DELETE',
    });
  }

  async getNextProjectMedia(projectName, currentId = 0) {
    return this.request(`/projects/${projectName}/next?current_id=${currentId}`);
  }

  async getPreviousProjectMedia(projectName, currentId) {
    return this.request(`/projects/${projectName}/prev?current_id=${currentId}`);
  }

  // Annotation methods
  async submitAnnotation(annotationData) {
    return this.request('/annotate', {
      method: 'POST',
      body: JSON.stringify(annotationData),
    });
  }

  // Stats methods
  async getStats(projectName = null) {
    const endpoint = projectName ? `/stats?project=${encodeURIComponent(projectName)}` : '/stats';
    return this.request(endpoint);
  }

  // Media methods
  async getMedia(mediaId) {
    return this.request(`/media/${mediaId}`);
  }

  async getMediaFile(mediaId) {
    return this.request(`/media/${mediaId}/file`);
  }
}

// Create a singleton instance
const apiService = new ApiService();

// Export both the instance and the class for flexibility
export default apiService;
export { ApiService };