-- EnjoySA Database Migration
-- Version: 001
-- Description: Create initial tables for users, suppliers, and orders

-- Users table (C端用户)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255),
    name VARCHAR(100),
    phone VARCHAR(20),
    avatar VARCHAR(500),

    google_id VARCHAR(100),
    facebook_id VARCHAR(100),

    status VARCHAR(20) DEFAULT 'active',
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,

    language VARCHAR(10) DEFAULT 'en',
    currency VARCHAR(10) DEFAULT 'ZAR',
    timezone VARCHAR(50) DEFAULT 'Africa/Johannesburg',

    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip VARCHAR(50)
);

CREATE INDEX idx_users_deleted_at ON users(deleted_at);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_facebook_id ON users(facebook_id);

-- Suppliers table (B端供应商)
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    name VARCHAR(200) NOT NULL,
    type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    description VARCHAR(2000),
    logo VARCHAR(500),

    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    website VARCHAR(200),

    address VARCHAR(500),
    city VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'South Africa',

    business_license VARCHAR(100),
    license_image VARCHAR(500),
    tax_number VARCHAR(50),

    bank_name VARCHAR(100),
    bank_account VARCHAR(50),
    bank_branch VARCHAR(100),
    account_holder VARCHAR(100),

    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by INTEGER,
    rejected_at TIMESTAMP WITH TIME ZONE,
    reject_reason VARCHAR(500),

    rating DECIMAL(3,2) DEFAULT 0,
    review_count INTEGER DEFAULT 0,

    auto_accept BOOLEAN DEFAULT FALSE,
    notify_email BOOLEAN DEFAULT TRUE,
    notify_sms BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_suppliers_deleted_at ON suppliers(deleted_at);
CREATE INDEX idx_suppliers_type ON suppliers(type);
CREATE INDEX idx_suppliers_status ON suppliers(status);

-- Supplier Users table (供应商登录账号)
CREATE TABLE IF NOT EXISTS supplier_users (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255),
    name VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'staff',
    status VARCHAR(20) DEFAULT 'active',

    last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_supplier_users_deleted_at ON supplier_users(deleted_at);
CREATE INDEX idx_supplier_users_supplier_id ON supplier_users(supplier_id);

-- Orders table (订单)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    order_no VARCHAR(32) UNIQUE NOT NULL,
    order_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    user_id INTEGER NOT NULL REFERENCES users(id),
    user_name VARCHAR(100),
    user_phone VARCHAR(20),
    user_email VARCHAR(100),

    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    supplier_name VARCHAR(200),

    product_id INTEGER NOT NULL,
    product_name VARCHAR(500),
    product_sku VARCHAR(100),

    booking_date DATE,
    check_in_date DATE,
    check_out_date DATE,
    quantity INTEGER NOT NULL DEFAULT 1,
    guest_count INTEGER DEFAULT 1,

    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'ZAR',

    payment_method VARCHAR(50),
    payment_time TIMESTAMP WITH TIME ZONE,
    payment_ref VARCHAR(100),

    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_by INTEGER,
    rejected_at TIMESTAMP WITH TIME ZONE,
    reject_reason VARCHAR(500),

    completed_at TIMESTAMP WITH TIME ZONE,

    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancel_reason VARCHAR(500),
    refunded_at TIMESTAMP WITH TIME ZONE,
    refund_amount DECIMAL(10,2),

    user_remark VARCHAR(1000),
    supplier_remark VARCHAR(1000),
    internal_note VARCHAR(1000),

    contact_name VARCHAR(100),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(100)
);

CREATE INDEX idx_orders_deleted_at ON orders(deleted_at);
CREATE INDEX idx_orders_order_no ON orders(order_no);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_supplier_id ON orders(supplier_id);
CREATE INDEX idx_orders_product_id ON orders(product_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_booking_date ON orders(booking_date);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Order Status Histories table (订单状态变更历史)
CREATE TABLE IF NOT EXISTS order_status_histories (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    order_id INTEGER NOT NULL REFERENCES orders(id),
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    operator_id INTEGER,
    operator_type VARCHAR(20),
    remark VARCHAR(500)
);

CREATE INDEX idx_order_status_histories_order_id ON order_status_histories(order_id);

-- Add comments
COMMENT ON TABLE users IS 'C端用户表';
COMMENT ON TABLE suppliers IS 'B端供应商表';
COMMENT ON TABLE supplier_users IS '供应商登录账号表';
COMMENT ON TABLE orders IS '订单表';
COMMENT ON TABLE order_status_histories IS '订单状态变更历史表';

COMMENT ON COLUMN orders.status IS 'pending-待支付, paid-已支付待接单, accepted-已接单, processing-处理中, completed-已完成, cancelled-已取消, refunded-已退款';
COMMENT ON COLUMN suppliers.type IS 'travel_agency-旅行社, hotel-酒店, attraction-景点, restaurant-餐厅, car_rental-租车';
COMMENT ON COLUMN suppliers.status IS 'pending-待审核, approved-已通过, suspended-已暂停, rejected-已拒绝';
