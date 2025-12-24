import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
import os
import json
from datetime import datetime

class Database:
    def __init__(self):
        self.db_params = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'database': os.getenv('DB_NAME', 'annotation_db'),
            'user': os.getenv('DB_USER', 'annotator'),
            'password': os.getenv('DB_PASSWORD', 'password'),
            'port': os.getenv('DB_PORT', '5432')
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
    """Initialize database tables"""
    db = Database()
    
    with db.get_connection() as conn:
        cursor = conn.cursor()
        
        # Create categories table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                color VARCHAR(7) DEFAULT '#808080',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create media table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS media (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                filepath VARCHAR(500) NOT NULL,
                media_type VARCHAR(10) CHECK (media_type IN ('image', 'video')),
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed BOOLEAN DEFAULT FALSE,
                width INTEGER,
                height INTEGER,
                duration FLOAT
            )
        ''')
        
        # Create annotations table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS annotations (
                id SERIAL PRIMARY KEY,
                media_id INTEGER REFERENCES media(id) ON DELETE CASCADE,
                category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
                annotation_data JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                user_id VARCHAR(100) DEFAULT 'default_user',
                status VARCHAR(20) DEFAULT 'pending' 
                    CHECK (status IN ('pending', 'skipped', 'completed'))
            )
        ''')
        
        # Create annotation history table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS annotation_history (
                id SERIAL PRIMARY KEY,
                annotation_id INTEGER REFERENCES annotations(id) ON DELETE CASCADE,
                previous_data JSONB,
                new_data JSONB,
                action_type VARCHAR(20),
                changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                changed_by VARCHAR(100)
            )
        ''')
        
        # Insert default categories
        default_categories = [
            ('Person', '#FF6B6B'),
            ('Vehicle', '#4ECDC4'),
            ('Animal', '#FFD166'),
            ('Building', '#06D6A0'),
            ('Nature', '#118AB2')
        ]
        
        for name, color in default_categories:
            cursor.execute('''
                INSERT INTO categories (name, color)
                VALUES (%s, %s)
                ON CONFLICT (name) DO NOTHING
            ''', (name, color))
        
        conn.commit()
    
    print("✅ Database initialized successfully!")

# Database singleton
db = Database()

class MediaModel:
    @staticmethod
    def get_all():
        with db.get_cursor() as cursor:
            cursor.execute('''
                SELECT m.*, 
                       COALESCE(a.status, 'pending') as annotation_status,
                       a.id as annotation_id
                FROM media m
                LEFT JOIN annotations a ON m.id = a.media_id AND a.user_id = 'default_user'
                ORDER BY m.upload_date DESC
            ''')
            return cursor.fetchall()
    
    @staticmethod
    def get_by_id(media_id):
        with db.get_cursor() as cursor:
            cursor.execute('SELECT * FROM media WHERE id = %s', (media_id,))
            return cursor.fetchone()
    
    @staticmethod
    def get_unprocessed(limit=1):
        with db.get_cursor() as cursor:
            cursor.execute('''
                SELECT m.* 
                FROM media m
                LEFT JOIN annotations a ON m.id = a.media_id AND a.user_id = 'default_user'
                WHERE a.id IS NULL OR a.status = 'pending'
                ORDER BY m.upload_date
                LIMIT %s
            ''', (limit,))
            return cursor.fetchall()
    
    @staticmethod
    def create(filename, filepath, media_type, width=None, height=None, duration=None):
        with db.get_cursor() as cursor:
            cursor.execute('''
                INSERT INTO media (filename, filepath, media_type, width, height, duration)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING *
            ''', (filename, filepath, media_type, width, height, duration))
            return cursor.fetchone()
    
    @staticmethod
    def update_dimensions(media_id, width, height, duration=None):
        with db.get_cursor() as cursor:
            cursor.execute('''
                UPDATE media
                SET width = %s, height = %s, duration = %s
                WHERE id = %s
                RETURNING *
            ''', (width, height, duration, media_id))
            return cursor.fetchone()

class CategoryModel:
    @staticmethod
    def get_all():
        with db.get_cursor() as cursor:
            cursor.execute('SELECT * FROM categories ORDER BY name')
            return cursor.fetchall()
    
    @staticmethod
    def create(name, color):
        with db.get_cursor() as cursor:
            cursor.execute('''
                INSERT INTO categories (name, color)
                VALUES (%s, %s)
                RETURNING *
            ''', (name, color))
            return cursor.fetchone()
    
    @staticmethod
    def update(category_id, name, color):
        with db.get_cursor() as cursor:
            cursor.execute('''
                UPDATE categories
                SET name = %s, color = %s
                WHERE id = %s
                RETURNING *
            ''', (name, color, category_id))
            return cursor.fetchone()
    
    @staticmethod
    def delete(category_id):
        with db.get_cursor() as cursor:
            cursor.execute('DELETE FROM categories WHERE id = %s', (category_id,))

class AnnotationModel:
    @staticmethod
    def get_by_media(media_id, user_id='default_user'):
        with db.get_cursor() as cursor:
            cursor.execute('''
                SELECT a.*, c.name as category_name, c.color as category_color
                FROM annotations a
                JOIN categories c ON a.category_id = c.id
                WHERE a.media_id = %s AND a.user_id = %s
                ORDER BY a.created_at
            ''', (media_id, user_id))
            return cursor.fetchall()
    
    @staticmethod
    def create(media_id, category_id, annotation_data, user_id='default_user'):
        with db.get_cursor() as cursor:
            # Check if annotation already exists
            cursor.execute('''
                SELECT id FROM annotations 
                WHERE media_id = %s AND user_id = %s
            ''', (media_id, user_id))
            existing = cursor.fetchone()
            
            if existing:
                # Update existing annotation
                cursor.execute('''
                    UPDATE annotations
                    SET category_id = %s, annotation_data = %s, 
                        updated_at = CURRENT_TIMESTAMP, status = 'completed'
                    WHERE id = %s
                    RETURNING *
                ''', (category_id, json.dumps(annotation_data), existing['id']))
            else:
                # Create new annotation
                cursor.execute('''
                    INSERT INTO annotations (media_id, category_id, annotation_data, user_id, status)
                    VALUES (%s, %s, %s, %s, 'completed')
                    RETURNING *
                ''', (media_id, category_id, json.dumps(annotation_data), user_id))
            
            annotation = cursor.fetchone()
            
            # Get with category info
            cursor.execute('''
                SELECT a.*, c.name as category_name, c.color as category_color
                FROM annotations a
                JOIN categories c ON a.category_id = c.id
                WHERE a.id = %s
            ''', (annotation['id'],))
            
            return cursor.fetchone()
    
    @staticmethod
    def skip(media_id, user_id='default_user'):
        with db.get_cursor() as cursor:
            # Check if annotation already exists
            cursor.execute('''
                SELECT id FROM annotations 
                WHERE media_id = %s AND user_id = %s
            ''', (media_id, user_id))
            existing = cursor.fetchone()
            
            if existing:
                # Update status to skipped
                cursor.execute('''
                    UPDATE annotations
                    SET status = 'skipped', updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING *
                ''', (existing['id'],))
            else:
                # Create skipped annotation record
                cursor.execute('''
                    INSERT INTO annotations (media_id, user_id, status, annotation_data, category_id)
                    VALUES (%s, %s, 'skipped', '{}', 1)
                    RETURNING *
                ''', (media_id, user_id))
            
            return cursor.fetchone()
    
    @staticmethod
    def get_stats(user_id='default_user'):
        with db.get_cursor() as cursor:
            cursor.execute('''
                SELECT 
                    COUNT(DISTINCT m.id) as total_media,
                    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed,
                    COUNT(CASE WHEN a.status = 'skipped' THEN 1 END) as skipped,
                    COUNT(CASE WHEN a.status = 'pending' OR a.id IS NULL THEN 1 END) as pending
                FROM media m
                LEFT JOIN annotations a ON m.id = a.media_id AND a.user_id = %s
            ''', (user_id,))
            return cursor.fetchone()
    
    @staticmethod
    def get_next_media(current_id=None, user_id='default_user'):
        with db.get_cursor() as cursor:
            if current_id:
                cursor.execute('''
                    SELECT m.* 
                    FROM media m
                    LEFT JOIN annotations a ON m.id = a.media_id AND a.user_id = %s
                    WHERE m.id > %s AND (a.id IS NULL OR a.status = 'pending')
                    ORDER BY m.id
                    LIMIT 1
                ''', (user_id, current_id))
            else:
                cursor.execute('''
                    SELECT m.* 
                    FROM media m
                    LEFT JOIN annotations a ON m.id = a.media_id AND a.user_id = %s
                    WHERE a.id IS NULL OR a.status = 'pending'
                    ORDER BY m.id
                    LIMIT 1
                ''', (user_id,))
            
            return cursor.fetchone()
    
    @staticmethod
    def get_previous_media(current_id, user_id='default_user'):
        with db.get_cursor() as cursor:
            cursor.execute('''
                SELECT m.* 
                FROM media m
                LEFT JOIN annotations a ON m.id = a.media_id AND a.user_id = %s
                WHERE m.id < %s
                ORDER BY m.id DESC
                LIMIT 1
            ''', (user_id, current_id))
            return cursor.fetchone()
    
    @staticmethod
    def delete(annotation_id):
        with db.get_cursor() as cursor:
            cursor.execute('DELETE FROM annotations WHERE id = %s', (annotation_id,))
    
    @staticmethod
    def get_history(media_id):
        with db.get_cursor() as cursor:
            cursor.execute('''
                SELECT h.*, c.name as category_name
                FROM annotation_history h
                JOIN annotations a ON h.annotation_id = a.id
                JOIN categories c ON a.category_id = c.id
                WHERE a.media_id = %s
                ORDER BY h.changed_at DESC
                LIMIT 50
            ''', (media_id,))
            return cursor.fetchall()