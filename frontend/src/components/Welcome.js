import React from 'react';

const Welcome = ({ onStart }) => {
  return (
    <div className="welcome-container" style={{
      minHeight: '100vh',
      backgroundColor: '#000',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div className="welcome-content" style={{
        maxWidth: '600px',
        textAlign: 'center',
        backgroundColor: '#1a1a1a',
        padding: '3rem',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        border: '1px solid #333'
      }}>
        <h1 className="welcome-title" style={{
          fontSize: '2.5rem',
          marginBottom: '1rem',
          background: 'linear-gradient(90deg, #fff, #aaa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: 'bold'
        }}>
          Media Markup Tool
        </h1>
        <p className="welcome-subtitle" style={{
          color: '#ccc',
          fontSize: '1.1rem',
          lineHeight: '1.6',
          marginBottom: '2rem'
        }}>
          Welcome to the emotional markup application. 
          Click the button below to start tagging images and videos with emotional labels and VAD (Valence-Arousal) dimensions.
        </p>
        <button 
          className="start-button"
          onClick={onStart}
          style={{
            backgroundColor: '#fff',
            color: '#000',
            border: 'none',
            padding: '1rem 2rem',
            fontSize: '1.1rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s',
            marginBottom: '2rem'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#e6e6e6'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
        >
          Start Markup
        </button>
        
        <div style={{ 
          marginTop: '2rem', 
          textAlign: 'left',
          backgroundColor: '#222',
          padding: '1.5rem',
          borderRadius: '8px',
          border: '1px solid #333'
        }}>
          <h3 style={{ color: '#fff', marginBottom: '1rem' }}>Annotation Guide:</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Emotion Tags:</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {['angry', 'sad', 'neutral', 'happy', 'disgust', 'surprise', 'fear'].map(tag => (
                <span 
                  key={tag}
                  style={{ 
                    display: 'inline-block', 
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    backgroundColor: '#333',
                    color: '#fff',
                    textTransform: 'capitalize',
                    fontSize: '0.9rem'
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          
          <div>
            <h4 style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '0.5rem' }}>VAD Dimensions:</h4>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              fontSize: '0.85rem'
            }}>
              <div style={{ backgroundColor: '#2a2a2a', padding: '0.75rem', borderRadius: '4px' }}>
                <strong style={{ color: '#fff' }}>Valence:</strong>
                <div style={{ color: '#aaa', marginTop: '0.25rem' }}>
                  -1 (Negative) to 1 (Positive)
                </div>
              </div>
              <div style={{ backgroundColor: '#2a2a2a', padding: '0.75rem', borderRadius: '4px' }}>
                <strong style={{ color: '#fff' }}>Arousal:</strong>
                <div style={{ color: '#aaa', marginTop: '0.25rem' }}>
                  -1 (Calm) to 1 (Excited)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;