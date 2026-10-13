-- ====================================================================
-- BARANGAY E-CERTIFICATE PORTAL: DATABASE MIGRATION SCRIPT
-- Location: Barangay Concepcion, Valencia City, Bukidnon
-- Target Documents:
--   1. Barangay Clearance
--   2. Certificate of Residency
--   3. Certificate of Indigency
-- ====================================================================

CREATE DATABASE IF NOT EXISTS barangay_concepcion_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE barangay_concepcion_db;

-- --------------------------------------------------------------------
-- Table 1: admins
-- System administrators, Barangay Secretary, and front-desk clerks
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Barangay Secretary',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- Table 2: requests
-- Resident online applications for Barangay Certificates
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    control_number VARCHAR(32) NOT NULL UNIQUE,
    cert_type ENUM('Barangay Clearance', 'Certificate of Residency', 'Certificate of Indigency') NOT NULL,
    first_name VARCHAR(80) NOT NULL,
    middle_name VARCHAR(80) NULL,
    last_name VARCHAR(80) NOT NULL,
    suffix VARCHAR(20) NULL,
    purok VARCHAR(50) NOT NULL,
    birth_date DATE NOT NULL,
    civil_status ENUM('Single', 'Married', 'Widowed', 'Separated', 'Divorced') NOT NULL,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    purpose VARCHAR(255) NOT NULL,
    years_of_residency INT NOT NULL DEFAULT 1,
    cedula_no VARCHAR(50) NULL,
    valid_id_path VARCHAR(255) NULL,
    status ENUM('Pending Review', 'Processing', 'Ready for Pickup', 'Released', 'Rejected') NOT NULL DEFAULT 'Pending Review',
    admin_remarks TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_requests_control_no (control_number),
    INDEX idx_requests_status (status),
    INDEX idx_requests_cert_type (cert_type),
    INDEX idx_requests_contact (contact_number),
    INDEX idx_requests_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- Table 3: status_logs
-- Audit trail tracking changes to request statuses
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS status_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    old_status VARCHAR(50) NULL,
    new_status VARCHAR(50) NOT NULL,
    remarks TEXT NULL,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'System',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_status_logs_request
        FOREIGN KEY (request_id) REFERENCES requests(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    INDEX idx_status_logs_req_id (request_id),
    INDEX idx_status_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- Table 4: sms_logs
-- Audit logs of Semaphore SMS gateway dispatches and responses
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sms_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NULL,
    recipient_number VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    api_response TEXT NULL,
    status ENUM('SENT', 'FAILED', 'MOCK_SENT') NOT NULL DEFAULT 'MOCK_SENT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sms_logs_request
        FOREIGN KEY (request_id) REFERENCES requests(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    INDEX idx_sms_logs_req_id (request_id),
    INDEX idx_sms_logs_recipient (recipient_number),
    INDEX idx_sms_logs_status (status),
    INDEX idx_sms_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- SEED DATA
-- Default Admin Accounts:
--   1) admin / Admin@123 (Administrator)
--   2) secretary / Secretary@123 (Barangay Secretary)
-- ====================================================================

INSERT INTO admins (username, password_hash, full_name, role) VALUES
('admin', '$2b$10$esfi0XBmgoIMoqUMbEOTPuM5iC3fEl14FyVqtCNxLYQ5LXxJsODgS', 'Hon. Merlyn G. Antiga (Punong Barangay)', 'Admin'),
('secretary', '$2b$10$5teH7BmxncVLi7i4DQFSRek/27sLIuXjqBfK0KYpAQ.aD0q0w5OK6', 'Hon. Redin T. Butanas', 'Barangay Secretary')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

-- --------------------------------------------------------------------
-- Sample Seed Requests for Barangay Concepcion, Valencia City
-- --------------------------------------------------------------------
INSERT INTO requests (
    control_number, cert_type, first_name, middle_name, last_name, suffix,
    purok, birth_date, civil_status, gender, contact_number, purpose,
    years_of_residency, cedula_no, valid_id_path, status, admin_remarks, created_at
) VALUES
(
    'BC-20261012-7A12',
    'Barangay Clearance',
    'Juan',
    'Mercado',
    'Dela Cruz',
    '',
    'Purok 4 - Pag-asa',
    '1995-06-15',
    'Single',
    'Male',
    '09171234567',
    'Local Employment Requirement (Valencia City Commercial)',
    5,
    'CCI2026-987123',
    NULL,
    'Ready for Pickup',
    'Application verified. Please bring 1 valid ID and CTC for verification during pickup.',
    NOW() - INTERVAL 1 DAY
),
(
    'BC-20261013-3F90',
    'Certificate of Indigency',
    'Maria Lourdes',
    'Santos',
    'Macaspac',
    '',
    'Purok 2 - Maharlika',
    '1988-11-20',
    'Married',
    'Female',
    '09289876543',
    'Medical Assistance at Bukidnon Provincial Hospital',
    12,
    NULL,
    NULL,
    'Processing',
    'Under review by Committee on Social Services. Verification of indigent status ongoing.',
    NOW() - INTERVAL 5 HOUR
),
(
    'BC-20261013-8D44',
    'Certificate of Residency',
    'Carlos Jose',
    'Reyes',
    'Villanueva',
    'Jr.',
    'Purok 6 - Riverside',
    '2004-03-08',
    'Single',
    'Male',
    '09395551234',
    'Scholarship Application (Bukidnon State University)',
    8,
    'CCI2026-112344',
    NULL,
    'Pending Review',
    'Newly submitted request. Awaiting staff review.',
    NOW() - INTERVAL 1 HOUR
),
(
    'BC-20261011-1B2C',
    'Barangay Clearance',
    'Ana Patricia',
    'Gomez',
    'Tan',
    '',
    'Purok 1 - Centro',
    '1992-09-02',
    'Married',
    'Female',
    '09183334455',
    'Philippine National Police (PNP) Clearance',
    15,
    'CCI2026-443211',
    NULL,
    'Released',
    'Document signed by Punong Barangay and officially released.',
    NOW() - INTERVAL 2 DAY
),
(
    'BC-20261010-9E55',
    'Certificate of Residency',
    'Roberto',
    'Alvarez',
    'Diaz',
    'III',
    'Purok 5 - San Isidro',
    '2001-01-30',
    'Single',
    'Male',
    '09276667788',
    'Bank Account Opening requirement',
    1,
    NULL,
    NULL,
    'Rejected',
    'Uploaded ID was blurry and could not verify Concepcion residence. Please visit Barangay Hall with your utility bill or barangay voter certification.',
    NOW() - INTERVAL 3 DAY
)
ON DUPLICATE KEY UPDATE control_number = VALUES(control_number);

-- --------------------------------------------------------------------
-- Seed Status Logs
-- --------------------------------------------------------------------
INSERT INTO status_logs (request_id, old_status, new_status, remarks, changed_by, created_at)
SELECT id, NULL, 'Pending Review', 'Initial online application submitted by resident.', 'System', created_at
FROM requests;

INSERT INTO status_logs (request_id, old_status, new_status, remarks, changed_by, created_at)
SELECT id, 'Pending Review', 'Processing', 'Documents checked and queued for certification.', 'Hon. Redin T. Butanas', created_at + INTERVAL 10 MINUTE
FROM requests WHERE status IN ('Processing', 'Ready for Pickup', 'Released');

INSERT INTO status_logs (request_id, old_status, new_status, remarks, changed_by, created_at)
SELECT id, 'Processing', 'Ready for Pickup', admin_remarks, 'Hon. Redin T. Butanas', created_at + INTERVAL 2 HOUR
FROM requests WHERE status IN ('Ready for Pickup', 'Released');

INSERT INTO status_logs (request_id, old_status, new_status, remarks, changed_by, created_at)
SELECT id, 'Ready for Pickup', 'Released', admin_remarks, 'Hon. Redin T. Butanas', created_at + INTERVAL 6 HOUR
FROM requests WHERE status = 'Released';

-- --------------------------------------------------------------------
-- Seed SMS Logs
-- --------------------------------------------------------------------
INSERT INTO sms_logs (request_id, recipient_number, message, api_response, status, created_at)
SELECT 
    id,
    contact_number,
    CONCAT('Maayong adlaw ', first_name, '! Nadawat ang imong request para sa ', cert_type, '. Imong Control No: ', control_number, '. I-track kini sa atong portal. Salamat! - Brgy. Concepcion'),
    '{"status":"success","mode":"simulation"}',
    'MOCK_SENT',
    created_at
FROM requests;

