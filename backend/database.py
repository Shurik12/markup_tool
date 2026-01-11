import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
import os
from datetime import datetime


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
    """Initialize database with a single markup_results table"""
    db = Database()

    with db.get_connection() as conn:
        cursor = conn.cursor()

        # Create single table for markup results
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS markup_results (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                filepath VARCHAR(500) NOT NULL,
                type VARCHAR(10) NOT NULL CHECK (type IN ('image', 'video')),
                emotion VARCHAR(20) CHECK (emotion IN (
                    'angry', 'sad', 'neutral', 'happy', 'disgust', 'surprise', 'fear'
                )),
                valence DECIMAL(3,2) CHECK (valence >= -1.0 AND valence <= 1.0),
                arousal DECIMAL(3,2) CHECK (arousal >= -1.0 AND arousal <= 1.0),
                title VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        # Create index for faster queries
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

    print("✅ Database initialized with single markup_results table!")


# Database singleton
db = Database()


class MarkupResult:
    @staticmethod
    def get_all():
        """Get all markup results"""
        with db.get_cursor() as cursor:
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

            # Convert to dict for easier JSON serialization
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
                (media_id,),
            )
            result = cursor.fetchone()
            return dict(result) if result else None

    @staticmethod
    def get_by_filename(filename):
        """Get markup result by filename"""
        with db.get_cursor() as cursor:
            cursor.execute(
                """
                SELECT * FROM markup_results 
                WHERE filename = %s
            """,
                (filename,),
            )
            result = cursor.fetchone()
            return dict(result) if result else None

    @staticmethod
    def create(filename, filepath, media_type, title=None):
        """Create new markup result entry"""
        with db.get_cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO markup_results (filename, filepath, type, title)
                VALUES (%s, %s, %s, %s)
                RETURNING *
            """,
                (filename, filepath, media_type, title or filename),
            )
            result = cursor.fetchone()
            return dict(result) if result else None

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
                    (media_id,),
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
                (emotion, valence, arousal, media_id),
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
                (valence, arousal, media_id),
            )
            result = cursor.fetchone()
            return dict(result) if result else None

    @staticmethod
    def get_next_unannotated(current_id=0):
        """Get next unannotated media item"""
        with db.get_cursor() as cursor:
            if current_id > 0:
                cursor.execute(
                    """
                    SELECT * FROM markup_results 
                    WHERE id > %s AND (emotion IS NULL OR valence IS NULL OR arousal IS NULL)
                    ORDER BY id
                    LIMIT 1
                """,
                    (current_id,),
                )
            else:
                cursor.execute(
                    """
                    SELECT * FROM markup_results 
                    WHERE emotion IS NULL OR valence IS NULL OR arousal IS NULL
                    ORDER BY id
                    LIMIT 1
                """
                )

            result = cursor.fetchone()
            return dict(result) if result else None

    @staticmethod
    def get_previous(current_id):
        """Get previous media item"""
        with db.get_cursor() as cursor:
            cursor.execute(
                """
                SELECT * FROM markup_results 
                WHERE id < %s
                ORDER BY id DESC
                LIMIT 1
            """,
                (current_id,),
            )
            result = cursor.fetchone()
            return dict(result) if result else None

    @staticmethod
    def get_stats():
        """Get statistics about markup results"""
        with db.get_cursor() as cursor:
            # Get total count
            cursor.execute("SELECT COUNT(*) as total FROM markup_results")
            total = cursor.fetchone()["total"]

            # Get fully annotated count (all three fields)
            cursor.execute(
                """
                SELECT COUNT(*) as annotated 
                FROM markup_results 
                WHERE emotion IS NOT NULL AND valence IS NOT NULL AND arousal IS NOT NULL
                """
            )
            annotated = cursor.fetchone()["annotated"]

            # Get emotion distribution
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

            # Convert to dict
            emotion_summary = {row["emotion"]: row["count"] for row in emotion_dist}

            # Get type distribution
            cursor.execute(
                """
                SELECT type, COUNT(*) as count 
                FROM markup_results 
                GROUP BY type 
                ORDER BY type
            """
            )
            type_dist = cursor.fetchall()
            type_summary = {row["type"]: row["count"] for row in type_dist}

            # Get VAD statistics
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
    def count():
        """Count total records"""
        with db.get_cursor() as cursor:
            cursor.execute("SELECT COUNT(*) as count FROM markup_results")
            return cursor.fetchone()["count"]

    @staticmethod
    def reset_annotations():
        """Reset all annotations (set emotion, valence, arousal to NULL)"""
        with db.get_cursor() as cursor:
            cursor.execute(
                """
                UPDATE markup_results 
                SET emotion = NULL, valence = NULL, arousal = NULL, updated_at = CURRENT_TIMESTAMP
            """
            )
            return cursor.rowcount

    @staticmethod
    def get_unannotated(limit=None):
        """Get unannotated media items"""
        with db.get_cursor() as cursor:
            query = """
                SELECT * FROM markup_results 
                WHERE emotion IS NULL OR valence IS NULL OR arousal IS NULL 
                ORDER BY id
            """
            if limit:
                cursor.execute(f"{query} LIMIT %s", (limit,))
            else:
                cursor.execute(query)
            results = cursor.fetchall()
            return [dict(result) for result in results]

    @staticmethod
    def get_annotated():
        """Get annotated media items"""
        with db.get_cursor() as cursor:
            cursor.execute(
                """
                SELECT * FROM markup_results 
                WHERE emotion IS NOT NULL AND valence IS NOT NULL AND arousal IS NOT NULL 
                ORDER BY updated_at DESC
                """
            )
            results = cursor.fetchall()
            return [dict(result) for result in results]
