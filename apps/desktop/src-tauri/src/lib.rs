mod db;
mod llm;

use db::{BudgetConfig, DbState, SavedAccount};
use llm::{ExtractedBudget, ExtractedFields, GpuStatus, LlmState, SetupStatus};
use std::sync::Mutex;
use tauri::Manager;

#[tauri::command]
async fn check_ai_setup(app: tauri::AppHandle) -> Result<SetupStatus, String> {
    let data_dir = llm::get_data_dir(&app);
    Ok(llm::check_setup(&data_dir))
}

#[tauri::command]
async fn setup_ai(app: tauri::AppHandle) -> Result<(), String> {
    let data_dir = llm::get_data_dir(&app);
    let status = llm::check_setup(&data_dir);

    if !status.server_ready {
        llm::download_server(&data_dir, &app).await?;
    }
    if !status.model_ready {
        llm::download_model(&data_dir, &app).await?;
    }

    Ok(())
}

#[tauri::command]
async fn extract_statement(
    text: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, LlmState>,
) -> Result<ExtractedFields, String> {
    let data_dir = llm::get_data_dir(&app);

    llm::start_server(&data_dir, &state)?;
    llm::wait_for_server().await?;

    llm::run_inference(&text).await
}

#[tauri::command]
async fn extract_bank_statement(
    text: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, LlmState>,
) -> Result<ExtractedBudget, String> {
    let data_dir = llm::get_data_dir(&app);

    llm::start_server(&data_dir, &state)?;
    llm::wait_for_server().await?;

    llm::run_budget_inference(&text).await
}

// --- GPU commands ---

#[tauri::command]
fn get_gpu_status(
    app: tauri::AppHandle,
    state: tauri::State<'_, LlmState>,
) -> GpuStatus {
    let data_dir = llm::get_data_dir(&app);
    llm::get_gpu_status(&data_dir, &state)
}

#[tauri::command]
fn set_gpu_enabled(
    enabled: bool,
    app: tauri::AppHandle,
    state: tauri::State<'_, LlmState>,
) -> Result<(), String> {
    llm::set_force_cpu(&state, !enabled);
    // Restart server with new setting
    llm::stop_server(&state);
    let data_dir = llm::get_data_dir(&app);
    llm::start_server(&data_dir, &state)
}

// --- Database commands ---

#[tauri::command]
fn db_get_accounts(state: tauri::State<'_, DbState>) -> Result<Vec<SavedAccount>, String> {
    let conn = state.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::get_accounts(&conn)
}

#[tauri::command]
fn db_save_account(account: SavedAccount, state: tauri::State<'_, DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::save_account(&conn, &account)
}

#[tauri::command]
fn db_delete_account(id: String, state: tauri::State<'_, DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::delete_account(&conn, &id)
}

#[tauri::command]
fn db_get_budget(state: tauri::State<'_, DbState>) -> Result<BudgetConfig, String> {
    let conn = state.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::get_budget(&conn)
}

#[tauri::command]
fn db_save_budget(config: BudgetConfig, state: tauri::State<'_, DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::save_budget(&conn, &config)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(LlmState {
            server_process: Mutex::new(None),
            force_cpu: Mutex::new(false),
        })
        .setup(|app| {
            let data_dir = llm::get_data_dir(app.handle());
            let conn = db::init_db(&data_dir)
                .expect("Failed to initialize database");
            app.manage(DbState {
                conn: Mutex::new(conn),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_ai_setup,
            setup_ai,
            extract_statement,
            extract_bank_statement,
            get_gpu_status,
            set_gpu_enabled,
            db_get_accounts,
            db_save_account,
            db_delete_account,
            db_get_budget,
            db_save_budget,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            let state = app_handle.state::<LlmState>();
            llm::stop_server(&state);
        }
    });
}
