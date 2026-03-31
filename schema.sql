-- ============================================
-- Betegn Laundry Management System - Schema
-- Database: betegn_laundry
-- ============================================

CREATE DATABASE IF NOT EXISTS betegn_laundry;
USE betegn_laundry;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff') DEFAULT 'staff',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  customer_id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address VARCHAR(200),
  registration_date DATE DEFAULT NULL,
  total_orders INT DEFAULT 0,
  total_paid DECIMAL(10,2) DEFAULT 0.00
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  order_id VARCHAR(20) PRIMARY KEY,
  customer_id INT NOT NULL,
  order_date DATE NOT NULL,
  delivery_date DATE,
  status ENUM('Received','Washing','Ironing','Ready','Delivered') DEFAULT 'Received',
  subtotal DECIMAL(10,2) DEFAULT 0.00,
  discount_percent DECIMAL(5,2) DEFAULT 0.00,
  discount_amount DECIMAL(10,2) DEFAULT 0.00,
  total_amount DECIMAL(10,2) DEFAULT 0.00,
  paid_amount DECIMAL(10,2) DEFAULT 0.00,
  balance DECIMAL(10,2) DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  item_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(20) NOT NULL,
  cloth_type VARCHAR(50) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(20) NOT NULL,
  payment_amount DECIMAL(10,2) NOT NULL,
  payment_method ENUM('Cash','Bank Transfer','Mobile Money') DEFAULT 'Cash',
  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

-- Default admin user (password: admin123)
INSERT IGNORE INTO users (username, password, role)
VALUES ('admin', '$2b$10$ih1rVRkeM5el5tRJxOPIZ.v8jx9TG2Ekha4ml0ZJX6n2Kf51A9vma', 'admin');
