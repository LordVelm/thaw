use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

pub struct DbState {
    pub conn: Mutex<Connection>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SavedAccount {
    pub id: String,
    pub name: String,
    pub balance: f64,
    pub apr: f64,
    pub minimum_payment: f64,
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

    Ok(conn)
}

// --- Account CRUD ---

pub fn save_account(conn: &Connection, account: &SavedAccount) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO accounts (id, name, balance, apr, minimum_payment) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![account.id, account.name, account.balance, account.apr, account.minimum_payment],
    ).map_err(|e| format!("Failed to save account: {e}"))?;
    Ok(())
}

pub fn get_accounts(conn: &Connection) -> Result<Vec<SavedAccount>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, balance, apr, minimum_payment FROM accounts")
        .map_err(|e| format!("Failed to prepare query: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(SavedAccount {
                id: row.get(0)?,
                name: row.get(1)?,
                balance: row.get(2)?,
                apr: row.get(3)?,
                minimum_payment: row.get(4)?,
            })
        })
        .map_err(|e| format!("Failed to query accounts: {e}"))?;

    let mut accounts = Vec::new();
    for row in rows {
        accounts.push(row.map_err(|e| format!("Failed to read row: {e}"))?);
    }
    Ok(accounts)
}

pub fn delete_account(conn: &Connection, id: &str) -> Result<(), String> {
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
