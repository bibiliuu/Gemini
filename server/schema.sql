-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user'
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(255) PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    image_url TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    amount DECIMAL(10, 2) NOT NULL,
    taker VARCHAR(255),
    controller VARCHAR(255),
    superior VARCHAR(255),
    order_date VARCHAR(255),
    content TEXT,
    distribution JSONB, -- Stores the calculated split {taker: 10, controller: 5...}
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Default Admin (Password: 123456)
INSERT INTO users (id, username, password_hash, name, role)
VALUES ('default-admin', 'admin', '123456', '超级管理员', 'admin')
ON CONFLICT (username) DO NOTHING;
