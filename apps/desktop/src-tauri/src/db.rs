use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

pub struct DbState {
    pub conn: Mutex<Connection>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SavedTier {
    pub id: String,
    pub label: Option<String>,
    pub balance: f64,
    pub apr: f64,
    pub promo_expiration_date: Option<String>,
    pub post_promo_apr: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SavedAccount {
    pub id: String,
    pub name: String,
    pub balance: f64,
    pub apr: f64,
    pub minimum_payment: f64,
    pub tiers: Vec<SavedTier>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BudgetConfig {
    pub income: f64,
    pub expenses: Vec<ExpenseEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExpenseEntry {
    pub category: String,
    pub amount: f64,
}

pub fn init_db(data_dir: &Path) -> Result<Connection, String> {
    std::fs::create_dir_all(data_dir).map_err(|e| format!("Failed to create data dir: {e}"))?;

    let db_path = data_dir.join("thaw.db");
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {e}"))?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            balance REAL NOT NULL,
            apr REAL NOT NULL,
            minimum_payment REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS account_tiers (
            id TEXT NOT NULL,
            account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            label TEXT,
            balance REAL NOT NULL,
            apr REAL NOT NULL,
            promo_expiration_date TEXT,
            post_promo_apr REAL,
            PRIMARY KEY (id, account_id)
        );

        CREATE TABLE IF NOT EXISTS budget_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            income REAL NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS budget_expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL UNIQUE,
            amount REAL NOT NULL DEFAULT 0
        );

        INSERT OR IGNORE INTO budget_config (id, income) VALUES (1, 0);
        "
    ).map_err(|e| format!("Failed to create tables: {e}"))?;

    // Migrate legacy accounts: if accounts exist but have no tiers, create single-tier entries
    conn.execute_batch(
        "
        INSERT OR IGNORE INTO account_tiers (id, account_id, label, balance, apr)
        SELECT 'tier-1', id, NULL, balance, apr FROM accounts
        WHERE id NOT IN (SELECT DISTINCT account_id FROM account_tiers);
        "
    ).map_err(|e| format!("Failed to migrate account tiers: {e}"))?;

    Ok(conn)
}

// --- Account CRUD ---

pub fn save_account(conn: &Connection, account: &SavedAccount) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO accounts (id, name, balance, apr, minimum_payment) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![account.id, account.name, account.balance, account.apr, account.minimum_payment],
    ).map_err(|e| format!("Failed to save account: {e}"))?;

    // Replace tiers
    conn.execute(
        "DELETE FROM account_tiers WHERE account_id = ?1",
        params![account.id],
    ).map_err(|e| format!("Failed to clear tiers: {e}"))?;

    for tier in &account.tiers {
        conn.execute(
            "INSERT INTO account_tiers (id, account_id, label, balance, apr, promo_expiration_date, post_promo_apr) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![tier.id, account.id, tier.label, tier.balance, tier.apr, tier.promo_expiration_date, tier.post_promo_apr],
        ).map_err(|e| format!("Failed to save tier: {e}"))?;
    }

    Ok(())
}

pub fn get_accounts(conn: &Connection) -> Result<Vec<SavedAccount>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, balance, apr, minimum_payment FROM accounts")
        .map_err(|e| format!("Failed to prepare query: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, f64>(4)?,
            ))
        })
        .map_err(|e| format!("Failed to query accounts: {e}"))?;

    let mut accounts = Vec::new();
    for row in rows {
        let (id, name, balance, apr, minimum_payment) = row.map_err(|e| format!("Failed to read row: {e}"))?;

        // Load tiers for this account
        let mut tier_stmt = conn
            .prepare("SELECT id, label, balance, apr, promo_expiration_date, post_promo_apr FROM account_tiers WHERE account_id = ?1")
            .map_err(|e| format!("Failed to prepare tier query: {e}"))?;

        let tier_rows = tier_stmt
            .query_map(params![&id], |row| {
                Ok(SavedTier {
                    id: row.get(0)?,
                    label: row.get(1)?,
                    balance: row.get(2)?,
                    apr: row.get(3)?,
                    promo_expiration_date: row.get(4)?,
                    post_promo_apr: row.get(5)?,
                })
            })
            .map_err(|e| format!("Failed to query tiers: {e}"))?;

        let mut tiers = Vec::new();
        for tier_row in tier_rows {
            tiers.push(tier_row.map_err(|e| format!("Failed to read tier: {e}"))?);
        }

        // Fallback: if no tiers exist, create one from account-level data
        if tiers.is_empty() {
            tiers.push(SavedTier {
                id: "tier-1".to_string(),
                label: None,
                balance,
                apr,
                promo_expiration_date: None,
                post_promo_apr: None,
            });
        }

        accounts.push(SavedAccount {
            id,
            name,
            balance,
            apr,
            minimum_payment,
            tiers,
        });
    }
    Ok(accounts)
}

pub fn delete_account(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM account_tiers WHERE account_id = ?1", params![id])
        .map_err(|e| format!("Failed to delete tiers: {e}"))?;
    conn.execute("DELETE FROM accounts WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete account: {e}"))?;
    Ok(())
}

// --- Budget CRUD ---

pub fn save_budget(conn: &Connection, config: &BudgetConfig) -> Result<(), String> {
    conn.execute(
        "UPDATE budget_config SET income = ?1 WHERE id = 1",
        params![config.income],
    ).map_err(|e| format!("Failed to save income: {e}"))?;

    conn.execute("DELETE FROM budget_expenses", [])
        .map_err(|e| format!("Failed to clear expenses: {e}"))?;

    for entry in &config.expenses {
        if entry.amount > 0.0 {
            conn.execute(
                "INSERT INTO budget_expenses (category, amount) VALUES (?1, ?2)",
                params![entry.category, entry.amount],
            ).map_err(|e| format!("Failed to save expense: {e}"))?;
        }
    }

    Ok(())
}

pub fn get_budget(conn: &Connection) -> Result<BudgetConfig, String> {
    let income: f64 = conn
        .query_row("SELECT income FROM budget_config WHERE id = 1", [], |row| row.get(0))
        .unwrap_or(0.0);

    let mut stmt = conn
        .prepare("SELECT category, amount FROM budget_expenses")
        .map_err(|e| format!("Failed to prepare query: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ExpenseEntry {
                category: row.get(0)?,
                amount: row.get(1)?,
            })
        })
        .map_err(|e| format!("Failed to query expenses: {e}"))?;

    let mut expenses = Vec::new();
    for row in rows {
        expenses.push(row.map_err(|e| format!("Failed to read row: {e}"))?);
    }

    Ok(BudgetConfig { income, expenses })
}
