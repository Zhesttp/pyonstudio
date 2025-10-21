-- Database schema for PYon Studio (MySQL version)
-- Create database if not exists
CREATE DATABASE IF NOT EXISTS pyon_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pyon_db;

-- Function to generate unique account number
DELIMITER $$
CREATE FUNCTION generate_account_number() RETURNS VARCHAR(10)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE new_number VARCHAR(10);
    DECLARE counter INT DEFAULT 1;
    DECLARE done INT DEFAULT FALSE;
    
    account_loop: LOOP
        -- Generate number in format: PY-XXXXXX (PY + 6 digits)
        SET new_number = CONCAT('PY-', LPAD(counter, 6, '0'));
        
        -- Check if number already exists
        IF NOT EXISTS (SELECT 1 FROM users WHERE account_number = new_number) THEN
            LEAVE account_loop;
        END IF;
        
        SET counter = counter + 1;
        
        -- Safety check to prevent infinite loop
        IF counter > 999999 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unable to generate unique account number';
        END IF;
    END LOOP;
    
    RETURN new_number;
END$$
DELIMITER ;

-- ADMINS
CREATE TABLE admins (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- USERS
CREATE TABLE users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    birth_date DATE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    visits_count INT DEFAULT 0,
    minutes_practice INT DEFAULT 0,
    is_quick_registration TINYINT(1) DEFAULT 0,
    account_number VARCHAR(10) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- TRAINERS
CREATE TABLE trainers (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    birth_date DATE,
    photo_url TEXT,
    bio TEXT,
    user_id CHAR(36) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- SUBSCRIPTIONS (plans)
CREATE TABLE plans (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    title VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    duration_days INT NOT NULL,
    class_count INT,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_duration_days CHECK (duration_days > 0),
    CONSTRAINT chk_class_count CHECK (class_count IS NULL OR class_count > 0),
    CONSTRAINT chk_price CHECK (price > 0)
);

-- USER_SUBSCRIPTIONS
CREATE TABLE user_subscriptions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    plan_id CHAR(36) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    UNIQUE KEY unique_subscription (user_id, plan_id, start_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
);

-- CLASSES (sessions)
CREATE TABLE classes (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    class_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 60,
    place TEXT,
    trainer_id CHAR(36),
    max_participants INT NOT NULL DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_duration_minutes CHECK (duration_minutes > 0),
    CONSTRAINT chk_max_participants CHECK (max_participants > 0),
    FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL
);

-- BOOKINGS
CREATE TABLE bookings (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    class_id CHAR(36) NOT NULL,
    booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'booked', -- booked | cancelled | attended | absent
    UNIQUE KEY unique_booking (user_id, class_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- INDEXES
CREATE INDEX idx_classes_date ON classes (class_date);
CREATE INDEX idx_bookings_user ON bookings (user_id);




-- === EXTENDED TABLES ===

-- ROLES & PERMISSIONS
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(255) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE user_roles (
    user_id CHAR(36) NOT NULL,
    role_id INT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- AUDIT LOG
CREATE TABLE audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_id CHAR(36),
    actor_type TEXT, -- admin / user / trainer
    action VARCHAR(255) NOT NULL,
    table_name TEXT,
    row_id CHAR(36),
    old_data JSON,
    new_data JSON,
    ip VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PAYMENTS
CREATE TABLE payments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    plan_id CHAR(36),
    amount DECIMAL(10,2) NOT NULL,
    currency CHAR(3) DEFAULT 'BYN',
    provider TEXT,
    provider_ref TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_amount CHECK (amount > 0),
    CONSTRAINT chk_currency CHECK (currency = 'BYN'),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL
);

-- CLASS TYPES
CREATE TABLE class_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT
);

ALTER TABLE classes ADD COLUMN type_id INT;
ALTER TABLE classes ADD CONSTRAINT fk_class_type FOREIGN KEY (type_id) REFERENCES class_types(id);

-- WAITLIST
CREATE TABLE waitlist_entries (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    class_id CHAR(36) NOT NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_waitlist (user_id, class_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- ATTENDANCE (separate from bookings)
CREATE TABLE attendance (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    booking_id CHAR(36) NOT NULL,
    status VARCHAR(20),
    marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_attendance (booking_id),
    CONSTRAINT chk_attendance_status CHECK (status IN ('attended','absent','late')),
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- UPLOADS
CREATE TABLE uploads (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    owner_table TEXT,
    owner_id CHAR(36),
    url VARCHAR(500) NOT NULL,
    mime TEXT,
    size INT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SETTINGS
CREATE TABLE settings (
    `key` VARCHAR(255) PRIMARY KEY,
    value JSON,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- TRANSLATIONS
CREATE TABLE translations (
    `key` VARCHAR(255) PRIMARY KEY,
    ru TEXT,
    en TEXT
);

-- WEBHOOKS
CREATE TABLE webhooks (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    event VARCHAR(255) NOT NULL,
    target_url VARCHAR(500) NOT NULL,
    secret TEXT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OPTIMISTIC LOCK EXAMPLE
ALTER TABLE users ADD COLUMN row_version INT DEFAULT 1;

-- ACHIEVEMENTS META
CREATE TABLE achievements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    icon TEXT
);

-- USER ACHIEVEMENTS
CREATE TABLE user_achievements (
    user_id CHAR(36) NOT NULL,
    achievement_id INT NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, achievement_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
);

