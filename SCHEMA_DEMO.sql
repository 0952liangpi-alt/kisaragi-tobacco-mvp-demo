-- KISARAGI demo schema. Use only after legal/compliance review for a real deployment.
CREATE TABLE products (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('cigarette', 'cigar', 'ryo', 'iqos', 'pipe')),
  tar_mg INT NOT NULL DEFAULT 0,
  nicotine_mg DECIMAL(3,2),
  flavor VARCHAR(50) CHECK (flavor IN ('regular', 'menthol', 'capsule', 'flavored')),
  origin VARCHAR(50),
  stock_status VARCHAR(20) NOT NULL CHECK (stock_status IN ('in_stock', 'pre_order', 'out_of_stock')),
  price INT NOT NULL,
  flavor_profile JSON NOT NULL
);

CREATE TABLE product_reviews (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id),
  user_nickname VARCHAR(50) NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  smoothness_rating INT CHECK (smoothness_rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  helpful_count INT NOT NULL DEFAULT 0
);

-- Require moderation and abuse controls before exposing user-generated reviews.
