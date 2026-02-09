import React, { useState, useEffect } from 'react';

const ProjectSelector = ({ onProjectSelect, onBack }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('select'); // 'select' or 'upload'
  const [selectedProject, setSelectedProject] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loadFolderPath, setLoadFolderPath] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
  };

  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select files to upload');
      return;
    }

    let projectName = '';
    if (isCreatingNew) {
      if (!newProjectName.trim()) {
        alert('Please enter a project name');
        return;
      }
      projectName = newProjectName;
    } else {
      if (!selectedProject) {
        alert('Please select a project');
        return;
      }
      projectName = selectedProject;
    }

    setUploadingFiles(true);

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`/api/projects/${projectName}/upload`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();

        // Build detailed message
        let message = '';
        if (isCreatingNew) {
          message = `✅ Successfully created project "${projectName}"\n\n`;
        } else {
          message = `✅ Successfully updated project "${projectName}"\n\n`;
        }

        message += `📊 Results:\n`;
        message += `• Uploaded: ${data.total_uploaded || data.uploaded?.length || 0} file(s)\n`;

        if (data.skipped && data.skipped.length > 0) {
          const duplicates = data.skipped.filter(f => f.status === 'duplicate');
          const invalid = data.skipped.filter(f => f.status === 'skipped');

          if (duplicates.length > 0) {
            message += `• Skipped duplicates: ${duplicates.length} file(s)\n`;
          }
          if (invalid.length > 0) {
            message += `• Skipped invalid: ${invalid.length} file(s)\n`;
          }

          // Show first few duplicates if any
          if (duplicates.length > 0 && duplicates.length <= 5) {
            message += `\n📁 Duplicate files (already exist in project):\n`;
            duplicates.forEach(file => {
              message += `  • ${file.filename}\n`;
            });
          } else if (duplicates.length > 5) {
            message += `\n📁 ${duplicates.length} duplicate files (already exist in project)\n`;
          }
        }

        alert(message);
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
          media_count: data.total || (data.total_uploaded || 0),
          annotated_count: 0,
          last_updated: new Date().toISOString()
        };
        onProjectSelect(projectData);
      } else {
        const error = await response.json();
        alert(`❌ Error: ${error.error || 'Failed to upload files'}`);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('❌ Network error. Failed to upload files');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleLoadFolder = async () => {
    if (!loadFolderPath.trim()) {
      alert('Please enter a folder path');
      return;
    }

    let projectName = '';
    if (isCreatingNew) {
      if (!newProjectName.trim()) {
        alert('Please enter a project name');
        return;
      }
      projectName = newProjectName;
    } else {
      if (!selectedProject) {
        alert('Please select a project');
        return;
      }
      projectName = selectedProject;
    }

    try {
      const response = await fetch(`/api/projects/${projectName}/load-folder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_folder: loadFolderPath
        })
      });

      if (response.ok) {
        const data = await response.json();

        // Build detailed message
        let message = '';
        if (isCreatingNew) {
          message = `✅ Successfully created project "${projectName}" from folder\n\n`;
        } else {
          message = `✅ Successfully added files to project "${projectName}" from folder\n\n`;
        }

        message += `📊 Results:\n`;
        message += `• Loaded: ${data.total_loaded || data.loaded?.length || 0} file(s)\n`;

        if (data.skipped && data.skipped.length > 0) {
          const duplicates = data.skipped.filter(f => f.status === 'duplicate');

          if (duplicates.length > 0) {
            message += `• Skipped duplicates: ${duplicates.length} file(s)\n`;
          }

          // Show first few duplicates if any
          if (duplicates.length > 0 && duplicates.length <= 5) {
            message += `\n📁 Duplicate files (already exist in project):\n`;
            duplicates.forEach(file => {
              message += `  • ${file.filename}\n`;
            });
          } else if (duplicates.length > 5) {
            message += `\n📁 ${duplicates.length} duplicate files (already exist in project)\n`;
          }
        }

        alert(message);
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
          media_count: data.total || (data.total_loaded || 0),
          annotated_count: 0,
          last_updated: new Date().toISOString()
        };
        onProjectSelect(projectData);
      } else {
        const error = await response.json();
        alert(`❌ Error: ${error.error || 'Failed to load folder'}`);
      }
    } catch (error) {
      console.error('Error loading folder:', error);
      alert('❌ Network error. Failed to load folder');
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
      width: '100%'
    }}>
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