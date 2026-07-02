# Supabase PostgreSQL Database Schema Setup

Paste and execute the following SQL script in your Supabase **SQL Editor** to set up all tables, indexes, Row Level Security (RLS) policies, and atomic transaction RPC functions for NexusERP.

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. TABLES SETUP
-- =========================================================================

-- Profiles (Users) Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    price NUMERIC NOT NULL CHECK (price >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0), -- Constraint preventing negative stock
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Suppliers Table
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Purchases Table
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT NOT NULL,
    total_amount NUMERIC NOT NULL CHECK (total_amount >= 0),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Purchase Items Table
CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC NOT NULL CHECK (unit_cost >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Sales Table
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT NOT NULL,
    total_amount NUMERIC NOT NULL CHECK (total_amount >= 0),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Sale Items Table
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =========================================================================
-- 2. INDEXES SETUP (Performance Optimization)
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON public.purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON public.purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);

-- =========================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full read/write access (Modify as needed for specific roles)
CREATE POLICY "Allow authenticated full profiles access" ON public.profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full products access" ON public.products FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full customers access" ON public.customers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full suppliers access" ON public.suppliers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full purchases access" ON public.purchases FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full purchase_items access" ON public.purchase_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full sales access" ON public.sales FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full sale_items access" ON public.sale_items FOR ALL TO authenticated USING (true);

-- =========================================================================
-- 4. ATOMIC TRANSACTIONAL RPC FUNCTIONS (Anti-Negative Stock Control)
-- =========================================================================

-- RPC for atomic sale creation & stock auto-deduction
CREATE OR REPLACE FUNCTION public.create_sale_with_items(
  p_customer_id UUID,
  p_total_amount NUMERIC,
  p_notes TEXT,
  p_items JSONB -- Array of {product_id, quantity, unit_price}
) RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_item RECORD;
  v_current_stock INT;
BEGIN
  -- Insert parent Sales record
  INSERT INTO public.sales (customer_id, total_amount, status, notes)
  VALUES (p_customer_id, p_total_amount, 'completed', p_notes)
  RETURNING id INTO v_sale_id;

  -- Iterate through items, lock stock rows, and deduct quantities
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INT, unit_price NUMERIC)
  LOOP
    -- Lock product row to prevent concurrency issues (double-booking race conditions)
    SELECT stock INTO v_current_stock
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Product with ID % not found', v_item.product_id;
    END IF;

    IF v_current_stock < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock. Product ID: %, Available: %, Requested: %',
        v_item.product_id, v_current_stock, v_item.quantity;
    END IF;

    -- Insert sale item line
    INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price)
    VALUES (v_sale_id, v_item.product_id, v_item.quantity, v_item.unit_price);

    -- Deduct stock directly
    UPDATE public.products
    SET stock = stock - v_item.quantity,
        updated_at = NOW()
    WHERE id = v_item.product_id;
  END LOOP;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC for atomic purchase creation & stock auto-update
CREATE OR REPLACE FUNCTION public.create_purchase_with_items(
  p_supplier_id UUID,
  p_total_amount NUMERIC,
  p_notes TEXT,
  p_items JSONB -- Array of {product_id, quantity, unit_cost}
) RETURNS UUID AS $$
DECLARE
  v_purchase_id UUID;
  v_item RECORD;
BEGIN
  -- Insert parent Purchase record
  INSERT INTO public.purchases (supplier_id, total_amount, notes)
  VALUES (p_supplier_id, p_total_amount, p_notes)
  RETURNING id INTO v_purchase_id;

  -- Iterate through items and add quantities to stock
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INT, unit_cost NUMERIC)
  LOOP
    -- Insert purchase item line
    INSERT INTO public.purchase_items (purchase_id, product_id, quantity, unit_cost)
    VALUES (v_purchase_id, v_item.product_id, v_item.quantity, v_item.unit_cost);

    -- Add stock
    UPDATE public.products
    SET stock = stock + v_item.quantity,
        updated_at = NOW()
    WHERE id = v_item.product_id;
  END LOOP;

  RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
