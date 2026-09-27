/*
# Create daily product list tables (single-tenant, no auth)

1. New Tables
- `daily_pages`: one row per day. Columns:
  - `id` (uuid, primary key)
  - `page_date` (date, unique, not null) — the calendar day this page represents
  - `note` (text, nullable) — optional note for the day
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
- `products`: one row per product line item on a daily page. Columns:
  - `id` (uuid, primary key)
  - `page_id` (uuid, FK → daily_pages.id ON DELETE CASCADE)
  - `seq_no` (integer, not null) — row number within the page (the "No." column)
  - `product_name` (text, not null)
  - `quantity` (numeric(12,2), not null, default 1)
  - `unit_price` (numeric(12,2), not null, default 0)
  - `created_at` (timestamptz)

2. Indexes
- Unique index on `daily_pages.page_date` so each day has exactly one page.
- Index on `products.page_id` for fast lookup of items on a page.
- Index on `products.product_name` to support the search function.

3. Security
- RLS enabled on both tables.
- Policies allow anon + authenticated full CRUD because this is a single-tenant app with no sign-in screen; the data is intentionally shared/local.

4. Notes
- `quantity` and `unit_price` use numeric(12,2) for exact decimal arithmetic (money).
- Total price is computed as `quantity * unit_price` in the application layer (and in export queries) rather than stored, so it always reflects current values.
- `seq_no` is managed by the application to keep the "No." column sequential after deletes/inserts.
*/

CREATE TABLE IF NOT EXISTS daily_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_date date UNIQUE NOT NULL,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE daily_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_daily_pages" ON daily_pages;
CREATE POLICY "anon_select_daily_pages" ON daily_pages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_daily_pages" ON daily_pages;
CREATE POLICY "anon_insert_daily_pages" ON daily_pages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_daily_pages" ON daily_pages;
CREATE POLICY "anon_update_daily_pages" ON daily_pages FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_daily_pages" ON daily_pages;
CREATE POLICY "anon_delete_daily_pages" ON daily_pages FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES daily_pages(id) ON DELETE CASCADE,
  seq_no integer NOT NULL DEFAULT 1,
  product_name text NOT NULL DEFAULT '',
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_products_page_id ON products(page_id);
CREATE INDEX IF NOT EXISTS idx_products_product_name ON products(product_name);
