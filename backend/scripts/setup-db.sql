-- Выполните от имени суперпользователя PostgreSQL (pgAdmin или psql):
-- psql -U postgres -f scripts/setup-db.sql

CREATE USER yourpet WITH PASSWORD 'yourpet';
CREATE DATABASE yourpet OWNER yourpet;
GRANT ALL PRIVILEGES ON DATABASE yourpet TO yourpet;
