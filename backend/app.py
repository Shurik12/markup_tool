from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS
import os
import sys
from werkzeug.utils import secure_filename
from datetime import datetime

# Add parent directory to path to access frontend build
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = "uploads"
FRONTEND_BUILD_FOLDER = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "build"
)
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp", "mp4", "avi", "mov"}
MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(FRONTEND_BUILD_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# Emotions for markup
EMOTIONS = ["angry", "sad", "neutral", "happy", "disgust", "surprise", "fear"]

# Initialize database
from database import init_database, MarkupResult

# Initialize database on startup
init_database()


# Serve React frontend from build folder
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path != "" and os.path.exists(os.path.join(FRONTEND_BUILD_FOLDER, path)):
        return send_from_directory(FRONTEND_BUILD_FOLDER, path)
    else:
        return send_from_directory(FRONTEND_BUILD_FOLDER, "index.html")


# API Routes
@app.route("/api/health", methods=["GET"])
def health_check():
    stats = MarkupResult.get_stats()
    return jsonify(
        {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "service": "markup-tool-backend",
            "stats": stats,
        }
    )


@app.route("/api/media", methods=["GET"])
def get_all_media():
    """Get all media items with their markup status"""
    results = MarkupResult.get_all()
    return jsonify({"items": results, "total": len(results), "emotions": EMOTIONS})


@app.route("/api/media/<int:media_id>", methods=["GET"])
def get_media(media_id):
    """Get specific media item"""
    media = MarkupResult.get_by_id(media_id)
    if not media:
        return jsonify({"error": "Media not found"}), 404

    return jsonify(media)


@app.route("/api/media/<int:media_id>/file", methods=["GET"])
def get_media_file(media_id):
    """Serve media file"""
    media = MarkupResult.get_by_id(media_id)
    if not media:
        return jsonify({"error": "Media not found"}), 404

    filepath = media["filepath"]

    if os.path.exists(filepath):
        return send_file(filepath)
    else:
        # For demo, redirect to a placeholder
        if media["type"] == "image":
            return jsonify(
                {
                    "message": f"Image placeholder for media {media_id}",
                    "placeholder": True,
                }
            )
        else:
            # For videos, try to serve from a known source
            return jsonify(
                {
                    "message": f"Video placeholder for media {media_id}",
                    "placeholder": True,
                }
            )


@app.route("/api/media/upload", methods=["POST"])
def upload_media():
    """Upload new media file"""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed"}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    # Determine media type
    ext = filename.rsplit(".", 1)[-1].lower()
    media_type = "video" if ext in {"mp4", "avi", "mov"} else "image"

    # Create new media item
    media = MarkupResult.create(
        filename=filename,
        filepath=filepath,
        media_type=media_type,
        title=os.path.splitext(filename)[0],
    )

    return jsonify(media), 201


@app.route("/api/annotate", methods=["POST"])
def submit_annotation():
    """Submit annotation for media"""
    data = request.json

    if not data or "mediaId" not in data:
        return jsonify({"error": "Missing required fields"}), 400

    media_id = data["mediaId"]
    emotion = data.get("tag")
    valence = data.get("valence")
    arousal = data.get("arousal")

    # Validate that either emotion or VAD is provided
    if emotion is None and (valence is None or arousal is None):
        return jsonify({"error": "Provide either emotion tag or VAD values"}), 400

    # Validate emotion if provided
    if emotion and emotion not in EMOTIONS:
        return jsonify({"error": "Invalid emotion tag"}), 400

    # Validate VAD values if provided
    if valence is not None:
        try:
            valence_val = float(valence)
            if not -1.0 <= valence_val <= 1.0:
                return jsonify({"error": "Valence must be between -1.0 and 1.0"}), 400
        except (ValueError, TypeError):
            return jsonify({"error": "Valence must be a number"}), 400

    if arousal is not None:
        try:
            arousal_val = float(arousal)
            if not -1.0 <= arousal_val <= 1.0:
                return jsonify({"error": "Arousal must be between -1.0 and 1.0"}), 400
        except (ValueError, TypeError):
            return jsonify({"error": "Arousal must be a number"}), 400

    # Update markup result
    if emotion and (valence is not None or arousal is not None):
        # Update both emotion and VAD
        result = MarkupResult.update_emotion(media_id, emotion, valence, arousal)
    elif emotion:
        # Update only emotion
        result = MarkupResult.update_emotion(media_id, emotion)
    else:
        # Update only VAD
        result = MarkupResult.update_vad(media_id, valence, arousal)

    if not result:
        return jsonify({"error": "Media not found"}), 404

    # Get updated stats
    stats = MarkupResult.get_stats()

    return jsonify(
        {
            "success": True,
            "message": "Annotation saved successfully",
            "result": result,
            "stats": stats,
        }
    )


@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Get annotation statistics"""
    stats = MarkupResult.get_stats()
    return jsonify(stats)


@app.route("/api/scan", methods=["POST"])
def scan_upload_folder():
    """Scan upload folder for new files"""
    new_files = []

    for filename in os.listdir(UPLOAD_FOLDER):
        if filename.startswith("."):
            continue

        filepath = os.path.join(UPLOAD_FOLDER, filename)
        if os.path.isfile(filepath) and allowed_file(filename):
            # Check if file is already in database
            existing = MarkupResult.get_by_filename(filename)

            if not existing:
                ext = filename.rsplit(".", 1)[-1].lower()
                media_type = "video" if ext in {"mp4", "avi", "mov"} else "image"

                # Add to database
                media = MarkupResult.create(
                    filename=filename,
                    filepath=filepath,
                    media_type=media_type,
                    title=os.path.splitext(filename)[0],
                )

                new_files.append(media)

    return jsonify(
        {
            "message": f"Found {len(new_files)} new files",
            "files": new_files,
            "total": MarkupResult.count(),
        }
    )


@app.route("/api/reset", methods=["POST"])
def reset_data():
    """Reset all annotations (keep files)"""
    MarkupResult.reset_annotations()

    return jsonify(
        {
            "message": "Annotations reset successfully",
            "total": MarkupResult.count(),
            "annotated": 0,
        }
    )


@app.route("/api/next", methods=["GET"])
def get_next_media():
    """Get next unannotated media"""
    current_id = request.args.get("current_id", type=int, default=0)

    media = MarkupResult.get_next_unannotated(current_id)

    if media:
        return jsonify({"media": media, "has_next": True})
    else:
        return jsonify({"message": "No more media to annotate", "has_next": False})


@app.route("/api/prev", methods=["GET"])
def get_prev_media():
    """Get previous media"""
    current_id = request.args.get("current_id", type=int, default=0)

    if not current_id:
        return jsonify({"error": "current_id is required"}), 400

    media = MarkupResult.get_previous(current_id)

    if media:
        return jsonify({"media": media, "has_prev": True})
    else:
        return jsonify({"message": "No previous media", "has_prev": False})


@app.route("/api/export", methods=["GET"])
def export_results():
    """Export all markup results"""
    results = MarkupResult.get_all()

    # Create CSV format
    csv_data = "id,filename,filepath,type,emotion,created_at,updated_at\n"
    for item in results:
        csv_data += f"{item['id']},{item['filename']},{item['filepath']},{item['type']},{item['emotion'] or ''},{item['created_at']},{item['updated_at']}\n"

    return jsonify(
        {
            "results": results,
            "csv": csv_data,
            "total": len(results),
            "annotated": len([r for r in results if r["emotion"]]),
        }
    )


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("🚀 Markup Tool Backend Started!")
    print("=" * 60)
    print(f"📁 Upload folder: {os.path.abspath(UPLOAD_FOLDER)}")
    print(f"🌐 Application URL: http://localhost:5000")
    print(f"🏥 Health check: http://localhost:5000/api/health")
    print("\n📋 Main API endpoints:")
    print("  GET  /api/media                    - Get all media")
    print("  GET  /api/stats                   - Get statistics")
    print("  POST /api/annotate                - Submit annotation")
    print("  POST /api/media/upload           - Upload media")
    print("  GET  /api/next                    - Get next unannotated media")
    print("  GET  /api/prev                    - Get previous media")
    print("  GET  /api/export                  - Export results")
    print("  POST /api/scan                   - Scan for new files")
    print("  POST /api/reset                  - Reset annotations")
    print("=" * 60 + "\n")

    # Create uploads directory if it doesn't exist
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    # Create sample files for demo if none exist
    try:
        from PIL import Image, ImageDraw
        import random

        # Check if we have any files
        count = MarkupResult.count()
        if count == 0:
            print("📝 Creating sample files for demo...")

            for i in range(1, 6):
                filename = f"sample{i}.jpg"
                filepath = os.path.join(UPLOAD_FOLDER, filename)

                if not os.path.exists(filepath):
                    # Create a simple image with random color
                    colors = [
                        (73, 109, 137),  # Blue-gray
                        (216, 27, 96),  # Pink
                        (30, 136, 229),  # Blue
                        (255, 193, 7),  # Yellow
                        (76, 175, 80),  # Green
                    ]

                    img = Image.new("RGB", (800, 600), color=colors[i - 1])
                    d = ImageDraw.Draw(img)

                    # Add text
                    try:
                        font = ImageFont.truetype("arial.ttf", 40)
                    except:
                        font = ImageFont.load_default()

                    text = f"Sample {i}"
                    d.text(
                        (400, 300), text, fill=(255, 255, 255), font=font, anchor="mm"
                    )
                    img.save(filepath, "JPEG")
                    print(f"✅ Created: {filename}")

                # Add to database if not exists
                existing = MarkupResult.get_by_filename(filename)
                if not existing:
                    MarkupResult.create(
                        filename=filename,
                        filepath=filepath,
                        media_type="image",
                        title=f"Sample Image {i}",
                    )

            print(f"✅ Created {MarkupResult.count()} sample records")
    except ImportError:
        print("⚠️  PIL not installed, skipping sample image creation")

    # Run the app
    app.run(debug=True, port=5000, host="0.0.0.0")
