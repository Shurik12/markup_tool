from database import db

def init_db():
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
                processed BOOLEAN DEFAULT FALSE
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
                user_id VARCHAR(100) DEFAULT 'default_user'
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
        
        # Insert default categories if not exist
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

class Category:
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

class Media:
    @staticmethod
    def get_all():
        with db.get_cursor() as cursor:
            cursor.execute('''
                SELECT m.*, 
                       COUNT(a.id) as annotation_count
                FROM media m
                LEFT JOIN annotations a ON m.id = a.media_id
                GROUP BY m.id
                ORDER BY m.upload_date DESC
            ''')
            return cursor.fetchall()
    
    @staticmethod
    def create(filename, filepath, media_type):
        with db.get_cursor() as cursor:
            cursor.execute('''
                INSERT INTO media (filename, filepath, media_type)
                VALUES (%s, %s, %s)
                RETURNING *
            ''', (filename, filepath, media_type))
            return cursor.fetchone()
    
    @staticmethod
    def get_by_id(media_id):
        with db.get_cursor() as cursor:
            cursor.execute('SELECT * FROM media WHERE id = %s', (media_id,))
            return cursor.fetchone()

class Annotation:
    @staticmethod
    def get_by_media(media_id):
        with db.get_cursor() as cursor:
            cursor.execute('''
                SELECT a.*, c.name as category_name, c.color as category_color
                FROM annotations a
                JOIN categories c ON a.category_id = c.id
                WHERE a.media_id = %s
                ORDER BY a.created_at
            ''', (media_id,))
            return cursor.fetchall()
    
    @staticmethod
    def create(media_id, category_id, annotation_data, user_id='default_user'):
        with db.get_cursor() as cursor:
            cursor.execute('''
                INSERT INTO annotations (media_id, category_id, annotation_data, user_id)
                VALUES (%s, %s, %s, %s)
                RETURNING *
            ''', (media_id, category_id, annotation_data, user_id))
            return cursor.fetchone()
    
    @staticmethod
    def update(annotation_id, annotation_data, user_id='default_user'):
        with db.get_cursor() as cursor:
            # Get previous data for history
            cursor.execute('SELECT annotation_data FROM annotations WHERE id = %s', (annotation_id,))
            previous_data = cursor.fetchone()['annotation_data']
            
            # Update annotation
            cursor.execute('''
                UPDATE annotations
                SET annotation_data = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING *
            ''', (annotation_data, annotation_id))
            updated = cursor.fetchone()
            
            # Save to history
            cursor.execute('''
                INSERT INTO annotation_history (annotation_id, previous_data, new_data, action_type, changed_by)
                VALUES (%s, %s, %s, 'update', %s)
            ''', (annotation_id, previous_data, annotation_data, user_id))
            
            return updated
    
    @staticmethod
    def delete(annotation_id, user_id='default_user'):
        with db.get_cursor() as cursor:
            # Get data for history before deleting
            cursor.execute('SELECT annotation_data FROM annotations WHERE id = %s', (annotation_id,))
            previous_data = cursor.fetchone()['annotation_data']
            
            # Save to history
            cursor.execute('''
                INSERT INTO annotation_history (annotation_id, previous_data, action_type, changed_by)
                VALUES (%s, %s, 'delete', %s)
            ''', (annotation_id, previous_data, user_id))
            
            # Delete annotation
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