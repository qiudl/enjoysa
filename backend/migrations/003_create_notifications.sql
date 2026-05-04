-- 003_create_notifications.sql
-- Create notifications table for supplier/user/admin notifications

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    recipient_type VARCHAR(20) NOT NULL,
    recipient_id   INTEGER NOT NULL,
    type           VARCHAR(30) NOT NULL,
    title          VARCHAR(200) NOT NULL,
    content        TEXT,
    related_type   VARCHAR(30),
    related_id     INTEGER,
    is_read        BOOLEAN DEFAULT FALSE,
    read_at        TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_deleted_at ON notifications(deleted_at);
