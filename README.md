### Install python environment
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Build frontend React part
```
npm install
npm run build
```

### PostgreSQL setup
```bash
# Create database (if using PostgreSQL)
sudo -u postgres psql
\l # list databases
\c <database_name> # connect to database
\dt # database tables

-- In PostgreSQL shell:
CREATE DATABASE markup_db;
CREATE USER markup_user WITH PASSWORD 'markup_pass';
GRANT ALL PRIVILEGES ON DATABASE markup_db TO markup_user;
\c markup_db
GRANT ALL ON SCHEMA public TO markup_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO markup_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO markup_user;
\q
```