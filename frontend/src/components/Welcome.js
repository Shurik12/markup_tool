import React from 'react';

const Welcome = ({ onStart }) => {
  return (
    <div className="welcome-container">
      <div className="welcome-content">
        <h1 className="welcome-title">Media Markup Tool</h1>
        <p className="welcome-subtitle">
          Welcome to the emotional markup application. 
          Click the button below to start tagging images and videos with emotional labels.
        </p>
        <button 
          className="start-button"
          onClick={onStart}
        >
          Start Markup
        </button>
        <div style={{ marginTop: '2rem', textAlign: 'left' }}>
          <h3>Available Tags:</h3>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
            {['angry', 'sad', 'neutral', 'happy', 'disgust', 'surprise', 'fear'].map(tag => (
              <li 
                key={tag}
                style={{ 
                  display: 'inline-block', 
                  margin: '0.5rem', 
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  textTransform: 'capitalize'
                }}
              >
                {tag}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Welcome;