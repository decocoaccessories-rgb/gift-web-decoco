-- ============================================================
-- DECOCO Gift Packaging Website — Initial Schema Migration
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  images JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Frames
CREATE TABLE IF NOT EXISTS frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  thumbnail_url TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  product_id UUID REFERENCES products(id),
  frame_id UUID REFERENCES frames(id),
  design_data JSONB,
  design_image_url TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  province TEXT NOT NULL,
  address TEXT NOT NULL,
  note TEXT,
  status TEXT DEFAULT 'new'
    CHECK (status IN ('new', 'confirmed', 'shipping', 'done', 'cancelled')),
  price_at_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Site Content (CMS)
CREATE TABLE IF NOT EXISTS site_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  type TEXT DEFAULT 'text'
    CHECK (type IN ('text', 'image', 'richtext', 'url')),
  section TEXT,
  label TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FAQ
CREATE TABLE IF NOT EXISTS faq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback carousel images
CREATE TABLE IF NOT EXISTS feedback_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Icons for design tool
CREATE TABLE IF NOT EXISTS icons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  svg_url TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_visible ON products(is_visible);
CREATE INDEX IF NOT EXISTS idx_products_sort ON products(sort_order);
CREATE INDEX IF NOT EXISTS idx_frames_product ON frames(product_id);

-- ============================================================
-- AUTO-UPDATE updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER site_content_updated_at
  BEFORE UPDATE ON site_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE icons ENABLE ROW LEVEL SECURITY;

-- Public read: products (visible only), faq, feedback, site_content, frames, icons
CREATE POLICY "Public read visible products"
  ON products FOR SELECT USING (is_visible = true);

CREATE POLICY "Public read faq"
  ON faq_items FOR SELECT USING (is_visible = true);

CREATE POLICY "Public read feedback"
  ON feedback_items FOR SELECT USING (is_visible = true);

CREATE POLICY "Public read site_content"
  ON site_content FOR SELECT USING (true);

CREATE POLICY "Public read frames"
  ON frames FOR SELECT USING (true);

CREATE POLICY "Public read icons"
  ON icons FOR SELECT USING (true);

-- Public insert orders (no login required to place an order)
CREATE POLICY "Public insert orders"
  ON orders FOR INSERT WITH CHECK (true);

-- NOTE: Admin operations use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
-- No additional policies needed for admin reads/writes.
