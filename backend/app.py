from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS
import os
import sys
from werkzeug.utils import secure_filename
from datetime import datetime
import shutil

# Add parent directory to path to access frontend build
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

app = Flask(__name__)
CORS(app)

# Configuration
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_FOLDER = "uploads"
FRONTEND_BUILD_FOLDER = os.path.join(BASE_DIR, "frontend", "build")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp", "mp4", "avi", "mov"}
MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB

# Create uploads directory
UPLOAD_FULL_PATH = os.path.join(BASE_DIR, UPLOAD_FOLDER)
os.makedirs(UPLOAD_FULL_PATH, exist_ok=True)
os.makedirs(FRONTEND_BUILD_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# Emotions for markup
EMOTIONS = ["angry", "sad", "neutral", "happy", "disgust", "surprise", "fear"]

# Initialize database
from database import init_database, MarkupResult, allowed_file, BASE_DIR, UPLOAD_FOLDER, get_project_upload_path

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


@app.route("/api/projects", methods=["GET"])
def get_projects():
    """Get all projects"""
    projects = MarkupResult.get_projects()
    return jsonify({"projects": projects, "total": len(projects)})


@app.route("/api/projects/<project_name>/media", methods=["GET"])
def get_project_media(project_name):
    """Get all media items for a project"""
    results = MarkupResult.get_all(project_name)
    
    # Generate dynamic filepath for each result
    for item in results:
        # Create filepath: uploads/project/filename
        item['filepath'] = os.path.join(UPLOAD_FOLDER, project_name, item['filename'])
    
    return jsonify({
        "items": results, 
        "total": len(results), 
        "emotions": EMOTIONS,
        "project": project_name
    })


@app.route("/api/media/<int:media_id>", methods=["GET"])
def get_media(media_id):
    """Get specific media item"""
    media = MarkupResult.get_by_id(media_id)
    if not media:
        return jsonify({"error": "Media not found"}), 404

    # Generate dynamic filepath: uploads/project/filename
    media['filepath'] = os.path.join(UPLOAD_FOLDER, media['project'], media['filename'])
    
    return jsonify(media)


@app.route("/api/media/<int:media_id>/file", methods=["GET"])
def get_media_file(media_id):
    """Serve media file"""
    media = MarkupResult.get_by_id(media_id)
    if not media:
        return jsonify({"error": "Media not found"}), 404

    # Build filepath dynamically: uploads/project/filename from base directory
    filepath = os.path.join(BASE_DIR, UPLOAD_FOLDER, media["project"], media["filename"])
    
    if os.path.exists(filepath):
        return send_file(filepath)
    else:
        return jsonify({
            "error": "File not found",
            "expected_path": filepath,
            "filename": media["filename"],
            "project": media["project"]
        }), 404


@app.route("/api/projects/<project_name>/upload", methods=["POST"])
def upload_media(project_name):
    """Upload new media files to a project"""
    print(f"DEBUG: Upload endpoint called for project: {project_name}")
    print(f"DEBUG: Request files keys: {list(request.files.keys())}")
    
    # Get files from request - try multiple possible keys
    files = []
    
    if "files" in request.files:
        files = request.files.getlist("files")
        print(f"DEBUG: Found {len(files)} files under 'files' key")
    elif "file" in request.files:
        files = request.files.getlist("file")
        print(f"DEBUG: Found {len(files)} files under 'file' key")
    else:
        # Check for any file keys
        file_keys = [key for key in request.files.keys() if key.startswith('file')]
        if file_keys:
            for key in file_keys:
                files.extend(request.files.getlist(key))
            print(f"DEBUG: Found {len(files)} files under keys: {file_keys}")
        else:
            print(f"DEBUG: No files found in request")
            return jsonify({"error": "No files provided"}), 400
    
    print(f"DEBUG: Total files to process: {len(files)}")
    
    if not files or (len(files) == 1 and files[0].filename == ""):
        print(f"DEBUG: No files or empty filename")
        return jsonify({"error": "No files selected"}), 400

    uploaded_files = []
    skipped_files = []
    
    # Create project directory in uploads folder if it doesn't exist
    project_dir = get_project_upload_path(project_name)
    os.makedirs(project_dir, exist_ok=True)
    print(f"DEBUG: Project directory: {project_dir}")
    
    for i, file in enumerate(files):
        original_filename = file.filename
        print(f"DEBUG: Processing file {i+1}: {original_filename}")
        
        if original_filename == "":
            print(f"DEBUG: Skipping empty filename")
            skipped_files.append({"filename": original_filename, "reason": "Empty filename", "status": "skipped"})
            continue
            
        if not allowed_file(original_filename):
            print(f"DEBUG: File type not allowed: {original_filename}")
            skipped_files.append({"filename": original_filename, "reason": f"Invalid file type: {original_filename.rsplit('.', 1)[-1] if '.' in original_filename else 'no extension'}", "status": "skipped"})
            continue

        filename = secure_filename(original_filename)
        filepath = os.path.join(project_dir, filename)
        
        # Check if file already exists in database
        existing = MarkupResult.get_by_filename_and_project(filename, project_name)
        if existing:
            print(f"DEBUG: File already exists in database: {filename}")
            # File already exists, just update the file on disk
            file.save(filepath)
            skipped_files.append({
                "filename": filename, 
                "original_filename": original_filename,
                "reason": f"File '{filename}' already exists in project '{project_name}'", 
                "status": "duplicate"
            })
            continue
        
        # Save file to disk
        try:
            file.save(filepath)
            print(f"DEBUG: Saved file to {filepath}")
        except Exception as e:
            print(f"DEBUG: Error saving file {filename}: {str(e)}")
            skipped_files.append({
                "filename": filename,
                "original_filename": original_filename,
                "reason": f"Error saving file: {str(e)}",
                "status": "error"
            })
            continue

        # Determine media type
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        media_type = "video" if ext in {"mp4", "avi", "mov"} else "image"

        # Create new media item in database
        media = MarkupResult.create(
            filename=filename,
            project=project_name,
            file_type=media_type
        )
        
        if media:
            print(f"DEBUG: Created database entry for {filename}")
            # Generate dynamic filepath for response
            media['filepath'] = os.path.join(UPLOAD_FOLDER, project_name, filename)
            media['status'] = 'uploaded'
            media['original_filename'] = original_filename
            uploaded_files.append(media)
        else:
            print(f"DEBUG: Failed to create database entry for {filename}")
            skipped_files.append({
                "filename": filename,
                "original_filename": original_filename,
                "reason": "Failed to create database entry",
                "status": "error"
            })

    message = f"Uploaded {len(uploaded_files)} files"
    if skipped_files:
        skipped_duplicates = len([f for f in skipped_files if f.get('status') == 'duplicate'])
        skipped_invalid = len([f for f in skipped_files if f.get('status') == 'skipped'])
        skipped_errors = len([f for f in skipped_files if f.get('status') == 'error'])
        
        if skipped_duplicates > 0:
            message += f", skipped {skipped_duplicates} duplicate file(s)"
        if skipped_invalid > 0:
            message += f", skipped {skipped_invalid} invalid file(s)"
        if skipped_errors > 0:
            message += f", failed to process {skipped_errors} file(s)"

    print(f"DEBUG: Final result - uploaded: {len(uploaded_files)}, skipped: {len(skipped_files)}")
    print(f"DEBUG: Response - uploaded_files: {len(uploaded_files)}, skipped_files: {len(skipped_files)}")
    
    return jsonify({
        "message": message,
        "uploaded": uploaded_files,
        "skipped": skipped_files,
        "total_uploaded": len(uploaded_files),
        "total_skipped": len(skipped_files),
        "total": MarkupResult.count(project_name),
        "project": project_name
    }), 201


@app.route("/api/projects/<project_name>/load-folder", methods=["POST"])
def load_folder_to_project(project_name):
    """Load all files from a folder into project"""
    data = request.json
    if not data or "source_folder" not in data:
        return jsonify({"error": "Source folder path is required"}), 400
    
    source_folder = data["source_folder"]
    if not os.path.exists(source_folder) or not os.path.isdir(source_folder):
        return jsonify({"error": "Source folder does not exist"}), 400
    
    # Create project directory in uploads folder
    project_dir = get_project_upload_path(project_name)
    os.makedirs(project_dir, exist_ok=True)
    
    loaded_files = []
    skipped_files = []
    
    # Copy files from source folder to project folder
    for filename in os.listdir(source_folder):
        if filename.startswith("."):
            continue
        
        source_path = os.path.join(source_folder, filename)
        if os.path.isfile(source_path) and allowed_file(filename):
            dest_path = os.path.join(project_dir, filename)
            
            # Check if file already exists in database
            existing = MarkupResult.get_by_filename_and_project(filename, project_name)
            if existing:
                # Copy file if it doesn't exist in destination
                if not os.path.exists(dest_path):
                    shutil.copy2(source_path, dest_path)
                skipped_files.append({
                    "filename": filename, 
                    "reason": f"File '{filename}' already exists in project '{project_name}'", 
                    "status": "duplicate"
                })
                continue
                
            # Copy file to destination
            if not os.path.exists(dest_path):
                shutil.copy2(source_path, dest_path)
            
            # Determine media type
            ext = filename.rsplit(".", 1)[-1].lower()
            media_type = "video" if ext in {"mp4", "avi", "mov"} else "image"
            
            # Add to database
            media = MarkupResult.create(
                filename=filename,
                project=project_name,
                file_type=media_type
            )
            
            if media:
                # Generate dynamic filepath for response
                media['filepath'] = os.path.join(UPLOAD_FOLDER, project_name, filename)
                media['status'] = 'loaded'
                loaded_files.append(media)
    
    message = f"Loaded {len(loaded_files)} files from folder"
    
    if skipped_files:
        skipped_duplicates = len([f for f in skipped_files if f.get('status') == 'duplicate'])
        
        if skipped_duplicates > 0:
            message += f", skipped {skipped_duplicates} duplicate file(s)"
    
    return jsonify({
        "message": message,
        "loaded": loaded_files,
        "skipped": skipped_files,
        "total_loaded": len(loaded_files),
        "total_skipped": len(skipped_files),
        "total": MarkupResult.count(project_name)
    }), 201


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
    """Get annotation statistics for a project or globally"""
    project = request.args.get("project")
    stats = MarkupResult.get_stats(project)
    return jsonify(stats)


@app.route("/api/projects/<project_name>/scan", methods=["POST"])
def scan_project_folder(project_name):
    """Scan project folder for new files"""
    project_dir = get_project_upload_path(project_name)
    
    if not os.path.exists(project_dir):
        os.makedirs(project_dir, exist_ok=True)
        return jsonify({
            "message": f"Created project folder, but no files found",
            "files": [],
            "total": 0,
        })
    
    new_files = []
    existing_files = []
    
    for filename in os.listdir(project_dir):
        if filename.startswith("."):
            continue

        filepath = os.path.join(project_dir, filename)
        if os.path.isfile(filepath) and allowed_file(filename):
            # Check if file is already in database for this project
            existing = MarkupResult.get_by_filename_and_project(filename, project_name)

            if not existing:
                ext = filename.rsplit(".", 1)[-1].lower()
                media_type = "video" if ext in {"mp4", "avi", "mov"} else "image"

                # Add to database
                media = MarkupResult.create(
                    filename=filename,
                    project=project_name,
                    file_type=media_type
                )

                if media:
                    # Generate dynamic filepath for response
                    media['filepath'] = os.path.join(UPLOAD_FOLDER, project_name, filename)
                    new_files.append(media)
            else:
                existing_files.append(filename)

    message = f"Found {len(new_files)} new files"
    if existing_files:
        message += f", {len(existing_files)} files already in database"

    return jsonify(
        {
            "message": message,
            "files": new_files,
            "existing_count": len(existing_files),
            "total": MarkupResult.count(project_name),
        }
    )


@app.route("/api/projects/<project_name>/reset", methods=["POST"])
def reset_project_data(project_name):
    """Reset all annotations for a project (keep files)"""
    count = MarkupResult.reset_annotations(project_name)

    return jsonify(
        {
            "message": f"Reset {count} annotations for project '{project_name}'",
            "project": project_name,
            "reset_count": count,
            "annotated": 0,
        }
    )


@app.route("/api/projects/<project_name>/next", methods=["GET"])
def get_next_project_media(project_name):
    """Get next unannotated media in a project"""
    current_id = request.args.get("current_id", type=int, default=0)

    media = MarkupResult.get_next_unannotated(project_name, current_id)
    
    if media:
        # Generate dynamic filepath: uploads/project/filename
        media['filepath'] = os.path.join(UPLOAD_FOLDER, project_name, media['filename'])
        return jsonify({"media": media, "has_next": True})
    else:
        return jsonify({"message": "No more media to annotate", "has_next": False})


@app.route("/api/projects/<project_name>/prev", methods=["GET"])
def get_prev_project_media(project_name):
    """Get previous media in a project"""
    current_id = request.args.get("current_id", type=int, default=0)

    if not current_id:
        return jsonify({"error": "current_id is required"}), 400

    media = MarkupResult.get_previous(project_name, current_id)
    
    if media:
        # Generate dynamic filepath: uploads/project/filename
        media['filepath'] = os.path.join(UPLOAD_FOLDER, project_name, media['filename'])
        return jsonify({"media": media, "has_prev": True})
    else:
        return jsonify({"message": "No previous media", "has_prev": False})


@app.route("/api/projects/<project_name>/export", methods=["GET"])
def export_project_results(project_name):
    """Export all markup results for a project"""
    results = MarkupResult.get_all(project_name)

    # Create CSV format
    csv_data = "id,project,filename,type,emotion,valence,arousal,created_at,updated_at\n"
    for item in results:
        csv_data += f"{item['id']},{item['project']},{item['filename']},{item['type']},{item['emotion'] or ''},{item['valence'] or ''},{item['arousal'] or ''},{item['created_at']},{item['updated_at']}\n"

    return jsonify(
        {
            "project": project_name,
            "results": results,
            "csv": csv_data,
            "total": len(results),
            "annotated": len([r for r in results if r["emotion"]]),
        }
    )


@app.route("/api/projects/<project_name>", methods=["DELETE"])
def delete_project(project_name):
    """Delete a project and all its files"""
    # Delete from database
    count = MarkupResult.delete_project(project_name)
    
    # Delete project folder from uploads
    project_dir = get_project_upload_path(project_name)
    if os.path.exists(project_dir):
        shutil.rmtree(project_dir)
    
    return jsonify({
        "message": f"Deleted project '{project_name}' with {count} files",
        "deleted_count": count
    })


@app.route("/api/uploads/<path:filename>")
def serve_uploaded_file(filename):
    """Serve uploaded files directly"""
    filepath = os.path.join(BASE_DIR, UPLOAD_FOLDER, filename)
    if os.path.exists(filepath):
        return send_file(filepath)
    else:
        return jsonify({"error": "File not found"}), 404


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("🚀 Markup Tool Backend Started!")
    print("=" * 60)
    print(f"📁 Base directory: {BASE_DIR}")
    print(f"📁 Uploads folder: {UPLOAD_FULL_PATH}")
    print(f"🌐 Application URL: http://localhost:5000")
    print(f"🏥 Health check: http://localhost:5000/api/health")
    print("\n📋 Main API endpoints:")
    print("  GET  /api/projects                   - Get all projects")
    print("  GET  /api/projects/<name>/media     - Get project media")
    print("  POST /api/projects/<name>/upload    - Upload to project")
    print("  POST /api/projects/<name>/load-folder - Load folder to project")
    print("  POST /api/annotate                  - Submit annotation")
    print("  GET  /api/projects/<name>/next      - Get next unannotated media")
    print("  GET  /api/projects/<name>/prev      - Get previous media")
    print("  GET  /api/projects/<name>/export    - Export project results")
    print("  POST /api/projects/<name>/scan      - Scan for new files")
    print("  POST /api/projects/<name>/reset     - Reset annotations")
    print("  DELETE /api/projects/<name>         - Delete project")
    print("  GET  /api/uploads/<path:filename>   - Serve uploaded file")
    print("=" * 60 + "\n")

    # Create uploads directory if it doesn't exist
    os.makedirs(UPLOAD_FULL_PATH, exist_ok=True)

    app.run(debug=True, port=5000, host="0.0.0.0")