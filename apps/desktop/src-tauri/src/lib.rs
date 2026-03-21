mod llm;

use llm::{ExtractedFields, LlmState, SetupStatus};
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

    // Start server if not running
    llm::start_server(&data_dir, &state)?;
    llm::wait_for_server().await?;

    // Run inference
    llm::run_inference(&text).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(LlmState {
            server_process: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            check_ai_setup,
            setup_ai,
            extract_statement,
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
