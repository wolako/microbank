-- =====================================================================
-- Initialisation de la base de données (UTF8 obligatoire)
-- =====================================================================

-- Se connecter à la base :
-- \c microbank_7m3i;

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- Fonction générique pour mise à jour automatique de updated_at
-- =====================================================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 1️⃣ Table des utilisateurs
-- =====================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  firstname VARCHAR(100) NOT NULL,
  lastname VARCHAR(100) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  kyc_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_verified BOOLEAN DEFAULT FALSE,
  email_verification_token TEXT,
  email_notifications_enabled BOOLEAN DEFAULT TRUE,
  sms_notifications_enabled BOOLEAN DEFAULT FALSE,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  username VARCHAR(100) UNIQUE,
  reset_password_token TEXT,
  reset_password_expires TIMESTAMP,
  is_approved BOOLEAN DEFAULT FALSE,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret TEXT,
  two_factor_temp_secret TEXT,
  two_factor_validated_at TIMESTAMP WITH TIME ZONE,
  password_updated_at TIMESTAMP WITH TIME ZONE,
  main_account_id UUID REFERENCES accounts(id)
);

-- =====================================================================
-- 2️⃣ Table des comptes bancaires
-- =====================================================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accountNumber VARCHAR(50) UNIQUE NOT NULL,
  balance DECIMAL(15,2) DEFAULT 0.00 CHECK (balance >= 0),
  currency VARCHAR(3) DEFAULT 'XOF',
  status VARCHAR(20) DEFAULT 'active',
  iban VARCHAR(34),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================================
-- 3️⃣ Tables Prêts
-- =====================================================================
CREATE TABLE IF NOT EXISTS loan_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  interest_rate DECIMAL(5,2) NOT NULL,
  min_amount DECIMAL(15,2) NOT NULL,
  max_amount DECIMAL(15,2) NOT NULL,
  min_term_months INTEGER NOT NULL,
  max_term_months INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES loan_products(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL,
  term_months INTEGER NOT NULL,
  paid_amount DECIMAL(15,2) DEFAULT 0.00 CHECK (paid_amount <= amount),
  status VARCHAR(20) DEFAULT 'pending',
  disbursement_date TIMESTAMP WITH TIME ZONE,
  next_payment_date TIMESTAMP WITH TIME ZONE,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  monthly_payment DECIMAL(15,2),
  activated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  principal_amount DECIMAL(15,2) NOT NULL,
  interest_amount DECIMAL(15,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  paid_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  installment_id UUID REFERENCES loan_installments(id) ON DELETE SET NULL,
  transaction_id UUID NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  reference VARCHAR(100),
  is_recurring BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================================
-- 4️⃣ Transactions et Bills
-- =====================================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  description TEXT,
  reference VARCHAR(100),
  metadata JSONB,
  balance_after DECIMAL(15,2) CHECK (balance_after >= 0),
  channel VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  reference VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  reference VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================================
-- 5️⃣ Achats / Produits / Commandes
-- =====================================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(15,2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url TEXT,
  provider VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  merchant_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  total_amount DECIMAL(15,2) NOT NULL CHECK (total_amount >= 0),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
  status VARCHAR(20) DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================================
-- 6️⃣ Documents
-- =====================================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================================
-- 7️⃣ ATM Withdrawals
-- =====================================================================
CREATE TABLE IF NOT EXISTS atm_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  user_id UUID NOT NULL REFERENCES users(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  code_hash TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS atm_withdrawal_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atm_withdrawal_id UUID NOT NULL REFERENCES atm_withdrawals(id) ON DELETE CASCADE,
  attempted_code TEXT NOT NULL,
  is_valid BOOLEAN NOT NULL,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- 8️⃣ User Sessions
-- =====================================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  revoked BOOLEAN DEFAULT FALSE,
  user_agent TEXT,
  ip INET
);

-- =====================================================================
-- 9️⃣ Notifications & Scheduler
-- =====================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduler_jobs (
  name VARCHAR(100) PRIMARY KEY,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE
);

-- =====================================================================
-- 10️⃣ Table contacts (Formulaire contact)
-- =====================================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================================
-- 11️⃣ Triggers pour updated_at
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_timestamp') THEN
    CREATE TRIGGER update_users_timestamp BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_accounts_timestamp') THEN
    CREATE TRIGGER update_accounts_timestamp BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_loans_timestamp') THEN
    CREATE TRIGGER update_loans_timestamp BEFORE UPDATE ON loans
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bills_timestamp') THEN
    CREATE TRIGGER update_bills_timestamp BEFORE UPDATE ON bills
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_products_timestamp') THEN
    CREATE TRIGGER update_products_timestamp BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_orders_timestamp') THEN
    CREATE TRIGGER update_orders_timestamp BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;
END $$;

-- =====================================================================
-- 12️⃣ Données de base pour les produits de prêt (idempotent)
-- =====================================================================
INSERT INTO loan_products (name, description, interest_rate, min_amount, max_amount, min_term_months, max_term_months)
VALUES
  ('Prêt Personnel', 'Prêt à consommation standard', 12.5, 50000, 500000, 3, 24),
  ('Prêt Immobilier', 'Financement de vos projets immobiliers', 8.0, 100000, 2000000, 6, 36),
  ('Prêt PME', 'Financement des petites entreprises', 10.0, 200000, 5000000, 12, 60)
ON CONFLICT (name) DO NOTHING;

-- =====================================================================
-- 13️⃣ Index pour performance et sécurité
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_accounts_accountNumber ON accounts(accountNumber);
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- =====================================================================
-- 14️⃣ Vues pour reporting
-- =====================================================================
CREATE OR REPLACE VIEW financial_report AS
SELECT 
  u.id AS user_id,
  u.firstname || ' ' || u.lastname AS client_name,
  COUNT(l.id) FILTER (WHERE l.status = 'active') AS active_loans,
  COUNT(l.id) FILTER (WHERE l.status = 'paid') AS paid_loans,
  SUM(l.amount) FILTER (WHERE l.status = 'active') AS active_loans_amount,
  SUM(t.amount) FILTER (WHERE t.type = 'deposit' AND t.status = 'completed') AS total_deposits,
  SUM(t.amount) FILTER (WHERE t.type = 'withdrawal' AND t.status = 'completed') AS total_withdrawals
FROM users u
LEFT JOIN accounts a ON u.id = a.user_id
LEFT JOIN loans l ON u.id = l.user_id
LEFT JOIN transactions t ON a.id = t.account_id
GROUP BY u.id;

CREATE OR REPLACE VIEW loan_statistics AS
SELECT 
  COUNT(*) FILTER (WHERE status = 'approved' AND end_date > CURRENT_DATE) AS active_loans,
  COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) AS total_approved_amount,
  COUNT(*) FILTER (
    WHERE status = 'approved' AND start_date < CURRENT_DATE
      AND (EXTRACT(MONTH FROM AGE(CURRENT_DATE, start_date)) * monthly_payment > paid_amount)
  ) AS estimated_unpaid_installments
FROM loans;

CREATE OR REPLACE VIEW user_loan_statistics AS
SELECT 
  u.id AS user_id,
  COALESCE(SUM(l.amount) FILTER (WHERE l.status IN ('approved','completed')), 0) AS total_borrowed,
  COALESCE(SUM(l.paid_amount) FILTER (WHERE l.status IN ('approved','completed')), 0) AS total_repaid,
  COUNT(*) FILTER (WHERE l.status = 'approved') AS active_loans,
  COUNT(*) FILTER (WHERE l.status = 'completed') AS completed_loans,
  COALESCE(SUM(i.amount) FILTER (WHERE l.status='approved' AND i.status='pending'),0) AS total_due,
  COALESCE(SUM(i.amount) FILTER (WHERE i.status='paid'),0) AS total_paid_installments,
  (
    SELECT l5.id
    FROM loans l5
    WHERE l5.user_id = u.id AND l5.status = 'active'
    ORDER BY l5.created_at DESC
    LIMIT 1
  ) AS current_loan_id
FROM users u
LEFT JOIN loans l ON u.id = l.user_id
LEFT JOIN loan_installments i ON l.id = i.loan_id
GROUP BY u.id;
