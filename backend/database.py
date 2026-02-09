import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
import os
from datetime import datetime
import sys

# Get the base directory where the app is running
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_FOLDER = "uploads"

class Database:
    def __init__(self):
        self.db_params = {
            "host": os.getenv("DB_HOST", "localhost"),
            "database": os.getenv("DB_NAME", "markup_db"),
            "user": os.getenv("DB_USER", "markup_user"),
            "password": os.getenv("DB_PASSWORD", "markup_pass"),
            "port": os.getenv("DB_PORT", "5432"),
        }

    @contextmanager
    def get_connection(self):
        conn = psycopg2.connect(**self.db_params)
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    @contextmanager
    def get_cursor(self):
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            try:
                yield cursor
            finally:
                cursor.close()


def init_database():
    """Initialize database with the markup_results table"""
    db = Database()

    with db.get_connection() as conn:
        cursor = conn.cursor()

        # Create single table for markup results with project field
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS markup_results (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                project VARCHAR(255) NOT NULL,
                type VARCHAR(10) NOT NULL CHECK (type IN ('image', 'video')),
                emotion VARCHAR(20) CHECK (emotion IN (
                    'angry', 'sad', 'neutral', 'happy', 'disgust', 'surprise', 'fear'
                )),
                valence DECIMAL(3,2) CHECK (valence >= -1.0 AND valence <= 1.0),
                arousal DECIMAL(3,2) CHECK (arousal >= -1.0 AND arousal <= 1.0),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        # Create indexes for faster queries
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_project ON markup_results(project)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_emotion ON markup_results(emotion)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_filename ON markup_results(filename)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_created ON markup_results(created_at DESC)"
        )

        conn.commit()

    print("✅ Database initialized with project support!")


# Database singleton
db = Database()


def allowed_file(filename):
    """Check if file has allowed extension"""
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp", "mp4", "avi", "mov"}
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def get_project_upload_path(project_name):
    """Get the full upload path for a project: uploads/project_name"""
    return os.path.join(BASE_DIR, UPLOAD_FOLDER, project_name)


class MarkupResult:
    @staticmethod
    def get_all(project=None):
        """Get all markup results for a project (or all if no project specified)"""
        with db.get_cursor() as cursor:
            if project:
                cursor.execute(
                    """
                    SELECT *, 
                           CASE 
                               WHEN emotion IS NULL OR valence IS NULL OR arousal IS NULL THEN 'pending'
                               ELSE 'completed'
                           END as status
                    FROM markup_results 
                    WHERE project = %s
                    ORDER BY created_at DESC
                    """,
                    (project,)
                )
            else:
                cursor.execute(
                    """
                    SELECT *, 
                           CASE 
                               WHEN emotion IS NULL OR valence IS NULL OR arousal IS NULL THEN 'pending'
                               ELSE 'completed'
                           END as status
                    FROM markup_results 
                    ORDER BY created_at DESC
                    """
                )
            results = cursor.fetchall()
            return [dict(result) for result in results]

    @staticmethod
    def get_by_id(media_id):
        """Get markup result by ID"""
        with db.get_cursor() as cursor:
            cursor.execute(
                """
                SELECT *, 
                       CASE 
                           WHEN emotion IS NULL OR valence IS NULL OR arousal IS NULL THEN 'pending'
                           ELSE 'completed'
                       END as status
                FROM markup_results 
                WHERE id = %s
                """,
                (media_id,)
            )
            result = cursor.fetchone()
            return dict(result) if result else None

    @staticmethod
    def get_by_filename_and_project(filename, project):
        """Get markup result by filename and project"""
        with db.get_cursor() as cursor:
            cursor.execute(
                """
                SELECT * FROM markup_results 
                WHERE filename = %s AND project = %s
                """,
                (filename, project)
            )
            result = cursor.fetchone()
            return dict(result) if result else None

    @staticmethod
    def create(filename, project, file_type):
        """Create new markup result entry (handles duplicates)"""
        with db.get_cursor() as cursor:
            # First check if file already exists in this project
            cursor.execute(
                """
                SELECT id FROM markup_results 
                WHERE filename = %s AND project = %s
                """,
                (filename, project)
            )
            existing = cursor.fetchone()
            
            if existing:
                # File already exists, return existing record
                cursor.execute(
                    """
                    SELECT * FROM markup_results WHERE id = %s
                    """,
                    (existing['id'],)
                )
            else:
                # Insert new record
                cursor.execute(
                    """
                    INSERT INTO markup_results (filename, project, type)
                    VALUES (%s, %s, %s)
                    RETURNING *
                    """,
                    (filename, project, file_type)
                )
            
            result = cursor.fetchone()
            
            if result:
                return dict(result)
            return None

    @staticmethod
    def update_emotion(media_id, emotion, valence=None, arousal=None):
        """Update emotion and VAD (valence, arousal) for a markup result"""
        with db.get_cursor() as cursor:
            # If only emotion is provided, keep existing VAD values
            if valence is None or arousal is None:
                cursor.execute(
                    """
                    SELECT valence, arousal FROM markup_results WHERE id = %s
                    """,
                    (media_id,)
                )
                existing = cursor.fetchone()
                if existing:
                    valence = valence if valence is not None else existing["valence"]
                    arousal = arousal if arousal is not None else existing["arousal"]

            cursor.execute(
                """
                UPDATE markup_results 
                SET emotion = %s, valence = %s, arousal = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING *
                """,
                (emotion, valence, arousal, media_id)
            )
            result = cursor.fetchone()
            return dict(result) if result else None

    @staticmethod
    def update_vad(media_id, valence, arousal):
        """Update only VAD values without changing emotion"""
        with db.get_cursor() as cursor:
            cursor.execute(
                """
                UPDATE markup_results 
                SET valence = %s, arousal = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING *
                """,
                (valence, arousal, media_id)
            )
            result = cursor.fetchone()
            return dict(result) if result else None

    @staticmethod
    def get_next_unannotated(project, current_id=0):
        """Get next unannotated media item in a project"""
        with db.get_cursor() as cursor:
            if current_id > 0:
                cursor.execute(
                    """
                    SELECT * FROM markup_results 
                    WHERE project = %s AND id > %s AND (emotion IS NULL OR valence IS NULL OR arousal IS NULL)
                    ORDER BY id
                    LIMIT 1
                    """,
                    (project, current_id)
                )
            else:
                cursor.execute(
                    """
                    SELECT * FROM markup_results 
                    WHERE project = %s AND (emotion IS NULL OR valence IS NULL OR arousal IS NULL)
                    ORDER BY id
                    LIMIT 1
                    """,
                    (project,)
                )

            result = cursor.fetchone()
            return dict(result) if result else None

    @staticmethod
    def get_previous(project, current_id):
        """Get previous media item in a project"""
        with db.get_cursor() as cursor:
            cursor.execute(
                """
                SELECT * FROM markup_results 
                WHERE project = %s AND id < %s
                ORDER BY id DESC
                LIMIT 1
                """,
                (project, current_id)
            )
            result = cursor.fetchone()
            return dict(result) if result else None

    @staticmethod
    def get_stats(project=None):
        """Get statistics about markup results for a project"""
        with db.get_cursor() as cursor:
            if project:
                # Get total count for project
                cursor.execute(
                    "SELECT COUNT(*) as total FROM markup_results WHERE project = %s",
                    (project,)
                )
                total = cursor.fetchone()["total"]

                # Get fully annotated count for project
                cursor.execute(
                    """
                    SELECT COUNT(*) as annotated 
                    FROM markup_results 
                    WHERE project = %s AND emotion IS NOT NULL AND valence IS NOT NULL AND arousal IS NOT NULL
                    """,
                    (project,)
                )
                annotated = cursor.fetchone()["annotated"]
                
                # Get emotion distribution for project
                cursor.execute(
                    """
                    SELECT emotion, COUNT(*) as count 
                    FROM markup_results 
                    WHERE project = %s AND emotion IS NOT NULL 
                    GROUP BY emotion 
                    ORDER BY count DESC
                    """,
                    (project,)
                )
                emotion_dist = cursor.fetchall()
                
                # Get type distribution for project
                cursor.execute(
                    """
                    SELECT type, COUNT(*) as count 
                    FROM markup_results 
                    WHERE project = %s
                    GROUP BY type 
                    ORDER BY type
                    """,
                    (project,)
                )
                type_dist = cursor.fetchall()
            else:
                # Global stats
                cursor.execute("SELECT COUNT(*) as total FROM markup_results")
                total = cursor.fetchone()["total"]
                
                cursor.execute(
                    """
                    SELECT COUNT(*) as annotated 
                    FROM markup_results 
                    WHERE emotion IS NOT NULL AND valence IS NOT NULL AND arousal IS NOT NULL
                    """
                )
                annotated = cursor.fetchone()["annotated"]
                
                cursor.execute(
                    """
                    SELECT emotion, COUNT(*) as count 
                    FROM markup_results 
                    WHERE emotion IS NOT NULL 
                    GROUP BY emotion 
                    ORDER BY count DESC
                    """
                )
                emotion_dist = cursor.fetchall()
                
                cursor.execute(
                    """
                    SELECT type, COUNT(*) as count 
                    FROM markup_results 
                    GROUP BY type 
                    ORDER BY type
                    """
                )
                type_dist = cursor.fetchall()
            
            emotion_summary = {row["emotion"]: row["count"] for row in emotion_dist}
            type_summary = {row["type"]: row["count"] for row in type_dist}
            
            # Get VAD statistics
            if project:
                cursor.execute(
                    """
                    SELECT 
                        ROUND(AVG(valence)::numeric, 2) as avg_valence,
                        ROUND(AVG(arousal)::numeric, 2) as avg_arousal,
                        ROUND(STDDEV(valence)::numeric, 2) as std_valence,
                        ROUND(STDDEV(arousal)::numeric, 2) as std_arousal
                    FROM markup_results 
                    WHERE project = %s AND valence IS NOT NULL AND arousal IS NOT NULL
                    """,
                    (project,)
                )
            else:
                cursor.execute(
                    """
                    SELECT 
                        ROUND(AVG(valence)::numeric, 2) as avg_valence,
                        ROUND(AVG(arousal)::numeric, 2) as avg_arousal,
                        ROUND(STDDEV(valence)::numeric, 2) as std_valence,
                        ROUND(STDDEV(arousal)::numeric, 2) as std_arousal
                    FROM markup_results 
                    WHERE valence IS NOT NULL AND arousal IS NOT NULL
                    """
                )
            vad_stats = cursor.fetchone()

            return {
                "total_media": total,
                "total_annotated": annotated,
                "pending": total - annotated,
                "completion_rate": (annotated / total * 100) if total > 0 else 0,
                "emotion_summary": emotion_summary,
                "type_summary": type_summary,
                "vad_summary": dict(vad_stats) if vad_stats else {},
            }

    @staticmethod
    def count(project=None):
        """Count total records for a project"""
        with db.get_cursor() as cursor:
            if project:
                cursor.execute(
                    "SELECT COUNT(*) as count FROM markup_results WHERE project = %s",
                    (project,)
                )
            else:
                cursor.execute("SELECT COUNT(*) as count FROM markup_results")
            return cursor.fetchone()["count"]

    @staticmethod
    def reset_annotations(project=None):
        """Reset all annotations for a project (set emotion, valence, arousal to NULL)"""
        with db.get_cursor() as cursor:
            if project:
                cursor.execute(
                    """
                    UPDATE markup_results 
                    SET emotion = NULL, valence = NULL, arousal = NULL, updated_at = CURRENT_TIMESTAMP
                    WHERE project = %s
                    """,
                    (project,)
                )
            else:
                cursor.execute(
                    """
                    UPDATE markup_results 
                    SET emotion = NULL, valence = NULL, arousal = NULL, updated_at = CURRENT_TIMESTAMP
                    """
                )
            return cursor.rowcount

    @staticmethod
    def get_projects():
        """Get list of all unique projects"""
        with db.get_cursor() as cursor:
            cursor.execute(
                """
                SELECT project, 
                       COUNT(*) as media_count,
                       SUM(CASE WHEN emotion IS NOT NULL AND valence IS NOT NULL AND arousal IS NOT NULL THEN 1 ELSE 0 END) as annotated_count,
                       MAX(updated_at) as last_updated
                FROM markup_results 
                GROUP BY project
                ORDER BY last_updated DESC
                """
            )
            results = cursor.fetchall()
            return [dict(result) for result in results]

    @staticmethod
    def delete_project(project):
        """Delete all records for a project"""
        with db.get_cursor() as cursor:
            cursor.execute(
                "DELETE FROM markup_results WHERE project = %s",
                (project,)
            )
            return cursor.rowcount