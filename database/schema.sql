-- Study Abroad Platform Database Schema
-- Run this in cPanel > phpMyAdmin to create all tables

-- Entity Types: University, Language School, Foundation Provider, etc.
CREATE TABLE entities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type ENUM('university','language_school','foundation_provider','summer_camp_provider','certificate_provider','diploma_provider','high_school') NOT NULL,
  website_url VARCHAR(500),
  logo_url VARCHAR(500),
  description_en TEXT,
  description_json JSON COMMENT 'Multi-language: {"en":"...","tr":"...","ar":"..."}',
  status ENUM('active','inactive','pending') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- One entity can have multiple campus locations
CREATE TABLE entity_locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_id INT NOT NULL,
  campus_name VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL,
  continent ENUM('Europe','Asia','North America','South America','Africa','Oceania','Middle East') NOT NULL,
  address TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  closest_airport_name VARCHAR(255),
  closest_airport_code CHAR(3),
  flight_duration_from_ist_min INT COMMENT 'Minutes from Istanbul Airport',
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

-- Orbit camera config per location (for 3D campus tour)
CREATE TABLE orbit_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_location_id INT NOT NULL,
  orbit_center_lat DECIMAL(10,7),
  orbit_center_lng DECIMAL(10,7),
  orbit_altitude INT DEFAULT 400 COMMENT 'Camera height in meters',
  orbit_pitch DECIMAL(5,2) DEFAULT -22.00 COMMENT 'Camera tilt degrees',
  orbit_initial_heading DECIMAL(5,2) DEFAULT 0,
  orbit_range INT DEFAULT 400 COMMENT 'Distance from center in meters',
  orbit_rotation_type ENUM('360','180') DEFAULT '360',
  orbit_rotation_speed DECIMAL(4,2) DEFAULT 0.12,
  scan_target_lat DECIMAL(10,7) COMMENT 'Building to highlight',
  scan_target_lng DECIMAL(10,7),
  scan_effect_enabled BOOLEAN DEFAULT FALSE,
  camera_v_offset DECIMAL(5,2) DEFAULT 0,
  camera_h_offset DECIMAL(5,2) DEFAULT 0,
  FOREIGN KEY (entity_location_id) REFERENCES entity_locations(id) ON DELETE CASCADE
);

-- Program type categories
CREATE TABLE program_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category ENUM('undergraduate','postgraduate','preparation','other') NOT NULL,
  sort_order INT DEFAULT 0
);

-- Insert default program types
INSERT INTO program_types (name, category, sort_order) VALUES
('Bachelor Programs', 'undergraduate', 1),
('Master Programs', 'postgraduate', 2),
('Language Programs', 'preparation', 3),
('Language Summer Camp for Juniors', 'other', 4),
('Certificate Programs', 'other', 5),
('Diploma Programs', 'other', 6),
('Language Preparatory Programs', 'preparation', 7),
('Foundation Programs', 'preparation', 8),
('Pathway Programs', 'preparation', 9),
('Pre-Master Programs', 'preparation', 10),
('High School Programs', 'other', 11),
('High School Exchange Programs', 'other', 12);

-- Programs offered at specific locations
CREATE TABLE programs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_location_id INT NOT NULL,
  program_type_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  language_of_instruction VARCHAR(50) DEFAULT 'English',
  duration VARCHAR(100) COMMENT 'e.g. 4 years, 2 semesters',
  tuition_fee DECIMAL(10,2),
  tuition_currency CHAR(3) DEFAULT 'EUR',
  intake_months VARCHAR(100) COMMENT 'e.g. September,January',
  english_req_type ENUM('IELTS','TOEFL','Duolingo','PTE','Cambridge','None') DEFAULT 'None',
  english_req_score VARCHAR(20),
  gpa_requirement VARCHAR(50),
  scholarship_available BOOLEAN DEFAULT FALSE,
  description_en TEXT,
  description_json JSON,
  requirements_json JSON COMMENT 'Additional requirements',
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_location_id) REFERENCES entity_locations(id) ON DELETE CASCADE,
  FOREIGN KEY (program_type_id) REFERENCES program_types(id)
);

-- Media files per location
CREATE TABLE media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_location_id INT NOT NULL,
  type ENUM('photo','video','virtual_tour') NOT NULL,
  url VARCHAR(500) NOT NULL,
  caption VARCHAR(255),
  sort_order INT DEFAULT 0,
  FOREIGN KEY (entity_location_id) REFERENCES entity_locations(id) ON DELETE CASCADE
);

-- Subscription tiers
CREATE TABLE subscription_tiers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  level INT NOT NULL COMMENT '1=free, 2=pro, 3=business, 4=enterprise',
  price_monthly DECIMAL(8,2) DEFAULT 0,
  price_currency CHAR(3) DEFAULT 'USD',
  description TEXT
);

INSERT INTO subscription_tiers (name, level, price_monthly) VALUES
('Free', 1, 0),
('Pro', 2, 0),
('Business', 3, 0),
('Enterprise', 4, 0);

-- Content access rules
CREATE TABLE content_access (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscription_tier_id INT NOT NULL,
  resource_type ENUM('entity','program','media','contact','api') NOT NULL,
  access_level ENUM('view','limited','full') DEFAULT 'view',
  FOREIGN KEY (subscription_tier_id) REFERENCES subscription_tiers(id)
);

-- System languages
CREATE TABLE languages (
  code CHAR(5) PRIMARY KEY COMMENT 'e.g. en, tr, ar',
  name VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT FALSE
);

INSERT INTO languages (code, name, is_active) VALUES
('en', 'English', TRUE),
('tr', 'Turkish', FALSE),
('ar', 'Arabic', FALSE),
('de', 'German', FALSE),
('es', 'Spanish', FALSE),
('fr', 'French', FALSE);
