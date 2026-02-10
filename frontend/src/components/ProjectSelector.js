import React, { useState, useEffect } from 'react';
import apiService from '../services/api';

const ProjectSelector = ({ onProjectSelect, onBack }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('select');
  const [selectedProject, setSelectedProject] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loadFolderPath, setLoadFolderPath] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await apiService.getProjects();
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (message, type = 'info') => {
    if (type === 'success') {
      setSuccessMessage(message);
      setTimeout(() => setSuccessMessage(''), 5000);
    } else {
      setError(message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
  };

  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0) {
      showAlert('Please select files to upload', 'error');
      return;
    }

    let projectName = '';
    if (isCreatingNew) {
      if (!newProjectName.trim()) {
        showAlert('Please enter a project name', 'error');
        return;
      }
      projectName = newProjectName.trim();
    } else {
      if (!selectedProject) {
        showAlert('Please select a project', 'error');
        return;
      }
      projectName = selectedProject;
    }

    setUploadingFiles(true);
    setError('');
    setSuccessMessage('');

    try {
      const result = await apiService.uploadFiles(projectName, selectedFiles);

      // Build detailed message
      let message = '';
      if (isCreatingNew) {
        message = `✅ Successfully created project "${projectName}"\n\n`;
      } else {
        message = `✅ Successfully updated project "${projectName}"\n\n`;
      }

      message += `📊 Results:\n`;
      message += `• Uploaded: ${result.total_uploaded || result.uploaded?.length || 0} file(s)\n`;

      if (result.skipped && result.skipped.length > 0) {
        const duplicates = result.skipped.filter(f => f.status === 'duplicate');
        const invalid = result.skipped.filter(f => f.status === 'skipped');

        if (duplicates.length > 0) {
          message += `• Skipped duplicates: ${duplicates.length} file(s)\n`;
        }
        if (invalid.length > 0) {
          message += `• Skipped invalid: ${invalid.length} file(s)\n`;
        }
      }

      showAlert(message, 'success');
      setSelectedFiles([]);
      setNewProjectName('');
      setSelectedProject('');
      setIsCreatingNew(false);

      // Reload projects list
      await loadProjects();

      // Auto-select the project
      const projectData = projects.find(p => p.project === projectName) || {
        project: projectName,
        name: projectName,
        media_count: result.total || (result.total_uploaded || 0),
        annotated_count: 0,
        last_updated: new Date().toISOString()
      };
      onProjectSelect(projectData);
    } catch (err) {
      console.error('Error uploading files:', err);
      showAlert(`❌ Error: ${err.message || 'Failed to upload files'}`, 'error');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleLoadFolder = async () => {
    if (!loadFolderPath.trim()) {
      showAlert('Please enter a folder path', 'error');
      return;
    }

    let projectName = '';
    if (isCreatingNew) {
      if (!newProjectName.trim()) {
        showAlert('Please enter a project name', 'error');
        return;
      }
      projectName = newProjectName.trim();
    } else {
      if (!selectedProject) {
        showAlert('Please select a project', 'error');
        return;
      }
      projectName = selectedProject;
    }

    try {
      const result = await apiService.loadFolder(projectName, loadFolderPath);

      // Build detailed message
      let message = '';
      if (isCreatingNew) {
        message = `✅ Successfully created project "${projectName}" from folder\n\n`;
      } else {
        message = `✅ Successfully added files to project "${projectName}" from folder\n\n`;
      }

      message += `📊 Results:\n`;
      message += `• Loaded: ${result.total_loaded || result.loaded?.length || 0} file(s)\n`;

      if (result.skipped && result.skipped.length > 0) {
        const duplicates = result.skipped.filter(f => f.status === 'duplicate');

        if (duplicates.length > 0) {
          message += `• Skipped duplicates: ${duplicates.length} file(s)\n`;
        }
      }

      showAlert(message, 'success');
      setLoadFolderPath('');
      setNewProjectName('');
      setSelectedProject('');
      setIsCreatingNew(false);

      // Reload projects list
      await loadProjects();

      // Auto-select the project
      const projectData = projects.find(p => p.project === projectName) || {
        project: projectName,
        name: projectName,
        media_count: result.total || (result.total_loaded || 0),
        annotated_count: 0,
        last_updated: new Date().toISOString()
      };
      onProjectSelect(projectData);
    } catch (err) {
      console.error('Error loading folder:', err);
      showAlert(`❌ Error: ${err.message || 'Failed to load folder'}`, 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="loading-spinner"></div>
        <p style={{ marginTop: '1rem', color: '#666' }}>Loading projects...</p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      padding: '2rem',
      borderRadius: '8px',
      maxWidth: '800px',
      width: '100%',
      position: 'relative'
    }}>
      {/* Success Message */}
      {successMessage && (
        <div style={{
          position: 'absolute',
          top: '-60px',
          left: '0',
          right: '0',
          backgroundColor: '#1a5a2a',
          color: '#fff',
          padding: '10px',
          borderRadius: '4px',
          textAlign: 'center',
          whiteSpace: 'pre-line',
          zIndex: 100
        }}>
          {successMessage}
          <button 
            onClick={() => setSuccessMessage('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              marginLeft: '10px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{
          position: 'absolute',
          top: error.includes('✅') ? '-60px' : '10px',
          left: '0',
          right: '0',
          backgroundColor: '#5a1a1a',
          color: '#ff9999',
          padding: '10px',
          borderRadius: '4px',
          textAlign: 'center',
          whiteSpace: 'pre-line',
          zIndex: 100
        }}>
          {error}
          <button 
            onClick={() => setError('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ff9999',
              marginLeft: '10px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ color: '#fff', margin: 0 }}>Projects</h2>
        <button
          onClick={onBack}
          style={{
            background: '#333',
            color: '#fff',
            border: '1px solid #444',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Back to Welcome
        </button>
      </div>

      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1rem',
        borderBottom: '1px solid #333',
        paddingBottom: '0.5rem'
      }}>
        <button
          onClick={() => setActiveTab('select')}
          style={{
            background: activeTab === 'select' ? '#444' : 'transparent',
            color: '#fff',
            border: '1px solid #444',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Select Project
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          style={{
            background: activeTab === 'upload' ? '#444' : 'transparent',
            color: '#fff',
            border: '1px solid #444',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Upload Files to Project
        </button>
      </div>

      {activeTab === 'select' && (
        <>
          {projects.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              backgroundColor: '#222',
              borderRadius: '4px',
              marginBottom: '1rem'
            }}>
              <p style={{ color: '#ccc', marginBottom: '1rem' }}>
                No projects found. Go to "Upload Files to Project" to create your first project.
              </p>
              <button
                onClick={() => setActiveTab('upload')}
                style={{
                  background: '#fff',
                  color: '#000',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Upload Files to Project
              </button>
            </div>
          ) : (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                {projects.map(project => (
                  <div
                    key={project.project}
                    onClick={() => onProjectSelect(project)}
                    style={{
                      backgroundColor: '#222',
                      padding: '1rem',
                      borderRadius: '4px',
                      border: '1px solid #333',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#222'}
                  >
                    <h3 style={{
                      color: '#fff',
                      marginBottom: '0.5rem',
                      fontSize: '1.1rem'
                    }}>
                      {project.project}
                    </h3>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                      color: '#666',
                      marginBottom: '0.5rem'
                    }}>
                      <span>Files: {project.media_count || 0}</span>
                      <span>Annotated: {project.annotated_count || 0}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#888' }}>
                      Last updated: {new Date(project.last_updated).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'upload' && (
        <div style={{
          backgroundColor: '#222',
          padding: '1.5rem',
          borderRadius: '4px',
          border: '1px solid #333'
        }}>
          <h3 style={{ color: '#fff', marginBottom: '1rem' }}>Upload Files to Project</h3>

          <div style={{ marginBottom: '1rem' }}>
            {/* Project Selection/Creation */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              marginBottom: '1rem',
              alignItems: 'center'
            }}>
              <button
                onClick={() => setIsCreatingNew(false)}
                style={{
                  background: !isCreatingNew ? '#444' : 'transparent',
                  color: '#fff',
                  border: '1px solid #444',
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Select Existing Project
              </button>
              <button
                onClick={() => setIsCreatingNew(true)}
                style={{
                  background: isCreatingNew ? '#444' : 'transparent',
                  color: '#fff',
                  border: '1px solid #444',
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Create New Project
              </button>
            </div>

            {!isCreatingNew ? (
              <>
                <label style={{
                  display: 'block',
                  color: '#ccc',
                  marginBottom: '0.5rem',
                  fontSize: '0.9rem'
                }}>
                  Select Project *
                </label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: '#333',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff',
                    marginBottom: '1rem'
                  }}
                >
                  <option value="">Select an existing project...</option>
                  {projects.map(project => (
                    <option key={project.project} value={project.project}>
                      {project.project} ({project.media_count || 0} files)
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label style={{
                  display: 'block',
                  color: '#ccc',
                  marginBottom: '0.5rem',
                  fontSize: '0.9rem'
                }}>
                  New Project Name *
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Enter new project name"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: '#333',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff',
                    marginBottom: '1rem'
                  }}
                />
              </>
            )}

            {/* Upload Files Section */}
            <div style={{
              backgroundColor: '#2a2a2a',
              padding: '1rem',
              borderRadius: '4px',
              marginBottom: '1rem'
            }}>
              <h4 style={{ color: '#fff', marginBottom: '0.5rem' }}>Upload Files</h4>

              <label style={{
                display: 'block',
                color: '#ccc',
                marginBottom: '0.5rem',
                fontSize: '0.9rem'
              }}>
                Select Files *
              </label>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                accept=".png,.jpg,.jpeg,.gif,.bmp,.mp4,.avi,.mov"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: '#333',
                  border: '1px dashed #444',
                  borderRadius: '4px',
                  color: '#fff',
                  marginBottom: '1rem'
                }}
              />

              {selectedFiles.length > 0 && (
                <div style={{
                  backgroundColor: '#333',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  marginBottom: '1rem',
                  maxHeight: '150px',
                  overflowY: 'auto'
                }}>
                  <p style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    Selected {selectedFiles.length} file(s):
                  </p>
                  <ul style={{ color: '#aaa', fontSize: '0.8rem', paddingLeft: '1rem' }}>
                    {selectedFiles.slice(0, 10).map((file, index) => (
                      <li key={index} style={{ marginBottom: '0.25rem' }}>
                        {file.name} ({(file.size / 1024).toFixed(1)} KB)
                      </li>
                    ))}
                    {selectedFiles.length > 10 && (
                      <li style={{ color: '#888', fontStyle: 'italic' }}>
                        ... and {selectedFiles.length - 10} more files
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <button
                onClick={handleUploadFiles}
                disabled={uploadingFiles || selectedFiles.length === 0 ||
                  (!isCreatingNew && !selectedProject) ||
                  (isCreatingNew && !newProjectName.trim())}
                style={{
                  background: uploadingFiles ? '#666' : '#1a5a2a',
                  color: '#fff',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '4px',
                  cursor: uploadingFiles ? 'not-allowed' : 'pointer',
                  width: '100%',
                  fontWeight: 'bold'
                }}
              >
                {uploadingFiles ? 'Uploading...' :
                  isCreatingNew ? `Create "${newProjectName || 'New Project'}"` :
                    `Upload to "${selectedProject || 'Project'}"`}
              </button>
            </div>

            {/* Load Folder Section */}
            <div style={{
              backgroundColor: '#2a2a2a',
              padding: '1rem',
              borderRadius: '4px',
              marginBottom: '1rem'
            }}>
              <h4 style={{ color: '#fff', marginBottom: '0.5rem' }}>Or Load from Folder</h4>

              <label style={{
                display: 'block',
                color: '#ccc',
                marginBottom: '0.5rem',
                fontSize: '0.9rem'
              }}>
                Folder Path *
              </label>
              <input
                type="text"
                value={loadFolderPath}
                onChange={(e) => setLoadFolderPath(e.target.value)}
                placeholder="/path/to/your/images/folder"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: '#333',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  marginBottom: '1rem'
                }}
              />

              <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '1rem' }}>
                Note: All image/video files from the folder will be copied.
                Supported formats: PNG, JPG, JPEG, GIF, BMP, MP4, AVI, MOV
              </p>

              <button
                onClick={handleLoadFolder}
                disabled={!loadFolderPath.trim() ||
                  (!isCreatingNew && !selectedProject) ||
                  (isCreatingNew && !newProjectName.trim())}
                style={{
                  background: '#2a2a5a',
                  color: '#fff',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  width: '100%',
                  fontWeight: 'bold'
                }}
              >
                {isCreatingNew ? `Load Folder to "${newProjectName || 'New Project'}"` :
                  `Load Folder to "${selectedProject || 'Project'}"`}
              </button>
            </div>

            <div style={{
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'space-between'
            }}>
              <button
                onClick={() => {
                  setActiveTab('select');
                  setSelectedFiles([]);
                  setNewProjectName('');
                  setSelectedProject('');
                  setLoadFolderPath('');
                  setIsCreatingNew(false);
                }}
                style={{
                  background: 'transparent',
                  color: '#ccc',
                  border: '1px solid #444',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Back to Select
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectSelector;