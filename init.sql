-- Cheetah Security Platform — Database Init
-- Enables RLS isolation between tenants

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- RLS setup after tables are created by SQLAlchemy ORM
-- This script is run after initial table creation

DO $$
BEGIN
    -- Enable RLS on tenant-scoped tables
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE users ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_isolation ON users;
        CREATE POLICY tenant_isolation ON users
            USING (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''));
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dns_policies') THEN
        ALTER TABLE dns_policies ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_isolation ON dns_policies;
        CREATE POLICY tenant_isolation ON dns_policies
            USING (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''));
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_log') THEN
        ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;
