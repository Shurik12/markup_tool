from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS
import os
import sys
import json
from werkzeug.utils import secure_filename
from datetime import datetime

# Add parent directory to path to access frontend build
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = 'uploads'
FRONTEND_BUILD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'frontend', 'dist')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'mp4', 'avi', 'mov'}
MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(FRONTEND_BUILD_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# In-memory storage for demo purposes
media_items = []
annotations = {}
categories = [
    {'id': 1, 'name': 'angry', 'color': '#dc2626'},
    {'id': 2, 'name': 'sad', 'color': '#2563eb'},
    {'id': 3, 'name': 'neutral', 'color': '#6b7280'},
    {'id': 4, 'name': 'happy', 'color': '#16a34a'},
    {'id': 5, 'name': 'disgust', 'color': '#9333ea'},
    {'id': 6, 'name': 'surprise', 'color': '#f59e0b'},
    {'id': 7, 'name': 'fear', 'color': '#ea580c'}
]

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def initialize_sample_media():
    """Initialize with sample media items"""
    global media_items
    
    # Clear existing
    media_items.clear()
    
    # Add sample media
    for i in range(1, 6):
        media_items.append({
            'id': i,
            'type': 'image',
            'url': f'/api/media/{i}/file',
            'filename': f'sample{i}.jpg',
            'title': f'Sample Image {i}'
        })
    
    # Add a sample video
    media_items.append({
        'id': 6,
        'type': 'video',
        'url': f'/api/media/6/file',
        'filename': 'sample.mp4',
        'title': 'Sample Video'
    })
    
    print(f"✅ Initialized {len(media_items)} sample media items")

# Initialize on startup
initialize_sample_media()

# Serve React frontend from build folder
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path != "" and os.path.exists(os.path.join(FRONTEND_BUILD_FOLDER, path)):
        return send_from_directory(FRONTEND_BUILD_FOLDER, path)
    else:
        return send_from_directory(FRONTEND_BUILD_FOLDER, 'index.html')

# API Routes
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'markup-tool-backend',
        'media_count': len(media_items),
        'annotations_count': len(annotations)
    })

@app.route('/api/media', methods=['GET'])
def get_all_media():
    """Get all media items"""
    return jsonify({
        'items': media_items,
        'total': len(media_items),
        'categories': categories
    })

@app.route('/api/media/<int:media_id>', methods=['GET'])
def get_media(media_id):
    """Get specific media item"""
    media = next((item for item in media_items if item['id'] == media_id), None)
    if not media:
        return jsonify({'error': 'Media not found'}), 404
    
    # Get annotation for this media if exists
    annotation = annotations.get(media_id)
    
    return jsonify({
        'media': media,
        'annotation': annotation
    })

@app.route('/api/media/<int:media_id>/file', methods=['GET'])
def get_media_file(media_id):
    """Serve media file"""
    media = next((item for item in media_items if item['id'] == media_id), None)
    if not media:
        return jsonify({'error': 'Media not found'}), 404
    
    filename = media['filename']
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    
    if os.path.exists(filepath):
        return send_file(filepath)
    else:
        # Create a placeholder image/video for demo
        if media['type'] == 'image':
            # Create a simple colored image with text
            try:
                from PIL import Image, ImageDraw, ImageFont
                import io
                
                # Create image
                img = Image.new('RGB', (800, 600), color=(73, 109, 137))
                d = ImageDraw.Draw(img)
                
                # Try to use a font
                try:
                    font = ImageFont.truetype("arial.ttf", 40)
                except:
                    font = ImageFont.load_default()
                
                text = f"Sample {media_id}"
                text_bbox = d.textbbox((0, 0), text, font=font)
                text_width = text_bbox[2] - text_bbox[0]
                text_height = text_bbox[3] - text_bbox[1]
                
                d.text(
                    ((800 - text_width) / 2, (600 - text_height) / 2),
                    text,
                    fill=(255, 255, 255),
                    font=font
                )
                
                # Save to bytes
                img_io = io.BytesIO()
                img.save(img_io, 'JPEG', quality=85)
                img_io.seek(0)
                
                return send_file(img_io, mimetype='image/jpeg')
            except ImportError:
                # If PIL not available, return a simple response
                return jsonify({
                    'message': f'Placeholder for media {media_id}',
                    'type': 'image'
                })
        else:
            # For video, return a placeholder response
            return jsonify({
                'message': f'Video placeholder for media {media_id}',
                'type': 'video',
                'placeholder': True
            })

@app.route('/api/media/upload', methods=['POST'])
def upload_media():
    """Upload new media file"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    # Determine media type
    ext = filename.rsplit('.', 1)[-1].lower()
    media_type = 'video' if ext in {'mp4', 'avi', 'mov'} else 'image'
    
    # Create new media item
    new_id = max(item['id'] for item in media_items) + 1 if media_items else 1
    new_media = {
        'id': new_id,
        'type': media_type,
        'url': f'/api/media/{new_id}/file',
        'filename': filename,
        'title': f'Uploaded {media_type}'
    }
    
    media_items.append(new_media)
    
    return jsonify(new_media), 201

@app.route('/api/annotate', methods=['POST'])
def submit_annotation():
    """Submit annotation for media"""
    data = request.json
    
    if not data or 'mediaId' not in data or 'tag' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    media_id = data['mediaId']
    tag = data['tag']
    
    # Store annotation
    annotations[media_id] = {
        'id': len(annotations) + 1,
        'media_id': media_id,
        'tag': tag,
        'timestamp': datetime.now().isoformat(),
        'user_id': data.get('user_id', 'default')
    }
    
    # Get stats
    stats = {
        'total_annotated': len(annotations),
        'total_media': len(media_items),
        'completion_rate': (len(annotations) / len(media_items) * 100) if media_items else 0,
        'tags_summary': {}
    }
    
    # Count tags
    for ann in annotations.values():
        tag_name = ann['tag']
        stats['tags_summary'][tag_name] = stats['tags_summary'].get(tag_name, 0) + 1
    
    return jsonify({
        'success': True,
        'message': 'Annotation saved successfully',
        'annotation': annotations[media_id],
        'stats': stats
    })

@app.route('/api/annotations', methods=['GET'])
def get_all_annotations():
    """Get all annotations"""
    return jsonify({
        'annotations': list(annotations.values()),
        'total': len(annotations)
    })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get annotation statistics"""
    stats = {
        'total_media': len(media_items),
        'total_annotated': len(annotations),
        'completion_rate': (len(annotations) / len(media_items) * 100) if media_items else 0,
        'tags_summary': {}
    }
    
    # Count tags
    for ann in annotations.values():
        tag_name = ann['tag']
        stats['tags_summary'][tag_name] = stats['tags_summary'].get(tag_name, 0) + 1
    
    return jsonify(stats)

@app.route('/api/scan', methods=['POST'])
def scan_upload_folder():
    """Scan upload folder for new files"""
    new_files = []
    
    for filename in os.listdir(UPLOAD_FOLDER):
        if filename.startswith('.'):
            continue
            
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        if os.path.isfile(filepath) and allowed_file(filename):
            # Check if file is already in media_items
            exists = any(item['filename'] == filename for item in media_items)
            
            if not exists:
                ext = filename.rsplit('.', 1)[-1].lower()
                media_type = 'video' if ext in {'mp4', 'avi', 'mov'} else 'image'
                
                new_id = max(item['id'] for item in media_items) + 1 if media_items else 1
                new_media = {
                    'id': new_id,
                    'type': media_type,
                    'url': f'/api/media/{new_id}/file',
                    'filename': filename,
                    'title': os.path.splitext(filename)[0]
                }
                
                media_items.append(new_media)
                new_files.append(new_media)
    
    return jsonify({
        'message': f'Found {len(new_files)} new files',
        'files': new_files,
        'total_media': len(media_items)
    })

@app.route('/api/reset', methods=['POST'])
def reset_data():
    """Reset all data (for testing)"""
    global media_items, annotations
    media_items = []
    annotations = {}
    initialize_sample_media()
    
    return jsonify({
        'message': 'Data reset successfully',
        'media_count': len(media_items),
        'annotations_count': len(annotations)
    })

@app.route('/api/next', methods=['GET'])
def get_next_media():
    """Get next unannotated media"""
    current_id = request.args.get('current_id', type=int, default=0)
    
    # Find next media that hasn't been annotated
    for media in media_items:
        if media['id'] > current_id and media['id'] not in annotations:
            return jsonify({
                'media': media,
                'has_next': True
            })
    
    return jsonify({
        'message': 'No more media to annotate',
        'has_next': False
    })

@app.route('/api/prev', methods=['GET'])
def get_prev_media():
    """Get previous media"""
    current_id = request.args.get('current_id', type=int, default=0)
    
    if not current_id:
        return jsonify({'error': 'current_id is required'}), 400
    
    # Find previous media
    for media in reversed(media_items):
        if media['id'] < current_id:
            return jsonify({
                'media': media,
                'has_prev': True
            })
    
    return jsonify({
        'message': 'No previous media',
        'has_prev': False
    })

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 Markup Tool Backend Started!")
    print("="*60)
    print(f"📁 Upload folder: {os.path.abspath(UPLOAD_FOLDER)}")
    print(f"🌐 Application URL: http://localhost:5000")
    print(f"🏥 Health check: http://localhost:5000/api/health")
    print("\n📋 Main API endpoints:")
    print("  GET  /api/media                    - Get all media")
    print("  GET  /api/stats                   - Get statistics")
    print("  POST /api/annotate                - Submit annotation")
    print("  POST /api/media/upload           - Upload media")
    print("  GET  /api/next                    - Get next media")
    print("  GET  /api/prev                    - Get previous media")
    print("  POST /api/scan                   - Scan for new files")
    print("  POST /api/reset                  - Reset data")
    print("="*60 + "\n")
    
    # Create uploads directory if it doesn't exist
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    # Create sample placeholder files
    try:
        from PIL import Image, ImageDraw
        for i in range(1, 7):
            if i <= 5:
                filename = f'sample{i}.jpg'
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                if not os.path.exists(filepath):
                    img = Image.new('RGB', (800, 600), color=(50 + i*20, 100, 150))
                    d = ImageDraw.Draw(img)
                    d.text((400, 300), f"Sample {i}", fill=(255, 255, 255))
                    img.save(filepath, 'JPEG')
                    print(f"✅ Created placeholder: {filename}")
    except ImportError:
        print("⚠️  PIL not installed, skipping placeholder creation")
    
    # Run the app
    app.run(debug=True, port=5000, host='0.0.0.0')