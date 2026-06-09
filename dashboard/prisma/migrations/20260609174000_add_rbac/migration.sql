-- CreateTable: roles
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateTable: permissions
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateTable: implicit M:N join table (Prisma convention)
CREATE TABLE "_PermissionToRole" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_PermissionToRole_AB_unique" ON "_PermissionToRole"("A", "B");
CREATE INDEX "_PermissionToRole_B_index" ON "_PermissionToRole"("B");

-- Seed system roles
INSERT INTO "roles" ("id", "name", "description", "is_system", "updated_at")
VALUES
  ('role_admin_sys', 'ADMIN',  'Full system access — can manage users, roles, and all bot settings', true, CURRENT_TIMESTAMP),
  ('role_trader_sys','TRADER', 'Standard trader — can view dashboard and manage trades',              false, CURRENT_TIMESTAMP);

-- Seed permissions
INSERT INTO "permissions" ("id", "code", "description", "category") VALUES
  -- Dashboard
  ('perm_dashboard_view',      'dashboard.view',      'View the main dashboard',              'dashboard'),
  -- Trades
  ('perm_trades_view',         'trades.view',         'View trades list and history',         'trades'),
  ('perm_trades_close',        'trades.close',        'Manually close open trades',           'trades'),
  -- Bot
  ('perm_bot_view',            'bot.view',            'View bot status and logs',             'bot'),
  ('perm_bot_control',         'bot.control',         'Start, stop, and pause the bot',       'bot'),
  -- Configuration
  ('perm_config_view',         'config.view',         'View bot configuration',               'config'),
  ('perm_config_edit',         'config.edit',         'Edit bot configuration and strategy',  'config'),
  -- Risk
  ('perm_risk_view',           'risk.view',           'View risk rules',                      'risk'),
  ('perm_risk_edit',           'risk.edit',           'Edit risk rules',                      'risk'),
  -- Users
  ('perm_users_view',          'users.view',          'View user list',                       'users'),
  ('perm_users_create',        'users.create',        'Create new users',                     'users'),
  ('perm_users_edit',          'users.edit',          'Edit existing users',                  'users'),
  ('perm_users_delete',        'users.delete',        'Delete users',                         'users'),
  -- Roles
  ('perm_roles_view',          'roles.view',          'View roles and permissions',           'roles'),
  ('perm_roles_manage',        'roles.manage',        'Create, edit, and delete roles',       'roles');

-- Assign ALL permissions to ADMIN role
INSERT INTO "_PermissionToRole" ("A", "B") VALUES
  ('perm_dashboard_view',  'role_admin_sys'),
  ('perm_trades_view',     'role_admin_sys'),
  ('perm_trades_close',    'role_admin_sys'),
  ('perm_bot_view',        'role_admin_sys'),
  ('perm_bot_control',     'role_admin_sys'),
  ('perm_config_view',     'role_admin_sys'),
  ('perm_config_edit',     'role_admin_sys'),
  ('perm_risk_view',       'role_admin_sys'),
  ('perm_risk_edit',       'role_admin_sys'),
  ('perm_users_view',      'role_admin_sys'),
  ('perm_users_create',    'role_admin_sys'),
  ('perm_users_edit',      'role_admin_sys'),
  ('perm_users_delete',    'role_admin_sys'),
  ('perm_roles_view',      'role_admin_sys'),
  ('perm_roles_manage',    'role_admin_sys');

-- Assign TRADER permissions (no user/role management, no config/risk edit)
INSERT INTO "_PermissionToRole" ("A", "B") VALUES
  ('perm_dashboard_view',  'role_trader_sys'),
  ('perm_trades_view',     'role_trader_sys'),
  ('perm_trades_close',    'role_trader_sys'),
  ('perm_bot_view',        'role_trader_sys'),
  ('perm_config_view',     'role_trader_sys'),
  ('perm_risk_view',       'role_trader_sys');

-- Add new columns to users
ALTER TABLE "users"
  ADD COLUMN "role_id" TEXT,
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "password_change_required" BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing role enum values → role_id FK
UPDATE "users" SET "role_id" = 'role_admin_sys'  WHERE "role" = 'ADMIN';
UPDATE "users" SET "role_id" = 'role_trader_sys' WHERE "role" = 'TRADER';

-- Make role_id NOT NULL now that it's populated
ALTER TABLE "users" ALTER COLUMN "role_id" SET NOT NULL;

-- Drop old role column
ALTER TABLE "users" DROP COLUMN "role";

-- Drop the enum type
DROP TYPE IF EXISTS "Role";

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_A_fkey"
  FOREIGN KEY ("A") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_B_fkey"
  FOREIGN KEY ("B") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
