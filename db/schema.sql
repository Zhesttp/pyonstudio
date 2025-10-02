-- Reset schema
-- Idempotent reset: удаляем объекты, не трогая саму схему (чтобы не требовались права суперпользователя)
SET search_path TO public;

-- Удаляем таблицы, если они есть (правильный порядок каскадом)
DROP TABLE IF EXISTS user_achievements CASCADE;
DROP TABLE IF EXISTS achievements CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS waitlist_entries CASCADE;
DROP TABLE IF EXISTS uploads CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS class_types CASCADE;
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS trainers CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS translations CASCADE;
DROP TABLE IF EXISTS webhooks CASCADE;

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ADMINS
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email CITEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date DATE NOT NULL,
    phone TEXT UNIQUE,
    email CITEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    level TEXT CHECK (level IN ('Начинающий', 'Средний', 'Продвинутый')),
    avatar_url TEXT,
    visits_count INT DEFAULT 0,
    minutes_practice INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- TRAINERS
CREATE TABLE trainers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date DATE,
    photo_url TEXT,
    bio TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- SUBSCRIPTIONS (plans)
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    duration_days INT NOT NULL,
    class_count INT, -- <-- Новое поле: количество занятий
    price NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- USER_SUBSCRIPTIONS
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    remaining_classes INT, -- NULL означает безлимит
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, plan_id, start_date)
);

-- CLASSES (sessions)
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    class_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    place TEXT,
    trainer_id UUID REFERENCES trainers(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- BOOKINGS
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    booked_at TIMESTAMP DEFAULT NOW(),
    status TEXT DEFAULT 'booked', -- booked | cancelled | attended | absent
    UNIQUE(user_id, class_id)
);

-- INDEXES
CREATE INDEX ON classes (class_date);
CREATE INDEX ON bookings (user_id);

-- SAMPLE ADMIN (пароль admin123 захешируем через pgcrypto)
INSERT INTO admins (name, email, password_hash)
VALUES ('SuperAdmin','admin@pyon.local', crypt('admin123', gen_salt('bf')));

-- === EXTENDED TABLES ===

-- ROLES & PERMISSIONS
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE role_permissions (
    role_id INT REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id INT REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- AUDIT LOG
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_id UUID,
    actor_type TEXT, -- admin / user / trainer
    action TEXT NOT NULL,
    table_name TEXT,
    row_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip INET,
    created_at TIMESTAMP DEFAULT NOW()
);

-- PAYMENTS
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    currency CHAR(3) DEFAULT 'BYN' CHECK (currency = 'BYN'),
    provider TEXT,
    provider_ref TEXT,
    status TEXT DEFAULT 'pending',
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- CLASS TYPES
CREATE TABLE class_types (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);
ALTER TABLE classes ADD COLUMN type_id INT REFERENCES class_types(id);

-- WAITLIST
CREATE TABLE waitlist_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    requested_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id,class_id)
);

-- ATTENDANCE (separate from bookings)
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('attended','absent','late')),
    marked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(booking_id)
);

-- UPLOADS
CREATE TABLE uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_table TEXT,
    owner_id UUID,
    url TEXT NOT NULL,
    mime TEXT,
    size INT,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- SETTINGS
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- TRANSLATIONS
CREATE TABLE translations (
    key TEXT PRIMARY KEY,
    ru TEXT,
    en TEXT
);

-- WEBHOOKS
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event TEXT NOT NULL,
    target_url TEXT NOT NULL,
    secret TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- OPTIMISTIC LOCK EXAMPLE
ALTER TABLE users ADD COLUMN row_version INT DEFAULT 1;

-- ACHIEVEMENTS META

CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT
);

INSERT INTO achievements(code,title,description,icon) VALUES
  ('first_class','Первое занятие','Проведено 5 занятий','fa-star'),
  ('streak_5_weeks','Серия посещений','5 недель без пропусков','fa-fire'),
  ('yoga_master','Йога-мастер','50 посещённых занятий','fa-award'),
  ('discipline_3_months','Дисциплина','3 месяца регулярной практики','fa-calendar-check');

-- USER ACHIEVEMENTS

CREATE TABLE user_achievements (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    achievement_id INT REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, achievement_id)
);
