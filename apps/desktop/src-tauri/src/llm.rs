use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

const MODEL_URL: &str = "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf";
const MODEL_FILENAME: &str = "qwen2.5-3b-instruct-q4_k_m.gguf";
pub const LLAMA_SERVER_PORT: u16 = 39281;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SetupStatus {
    pub model_ready: bool,
    pub server_ready: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub stage: String,
    pub downloaded: u64,
    pub total: u64,
    pub percent: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FieldMeta {
    pub confidence: Option<String>,  // "high", "medium", "low"
    pub source: Option<String>,      // snippet from statement text
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedFields {
    pub card_name: Option<String>,
    pub last_four: Option<String>,
    pub statement_balance: Option<f64>,
    pub minimum_payment: Option<f64>,
    pub apr: Option<f64>,
    pub due_date: Option<String>,
    pub interest_charged: Option<f64>,
    pub is_deferred_interest: Option<bool>,
    pub deferred_interest_apr: Option<f64>,
    pub deferred_interest_end_date: Option<String>,
    #[serde(default)]
    pub field_meta: Option<FieldMetaMap>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FieldMetaMap {
    pub card_name: Option<FieldMeta>,
    pub statement_balance: Option<FieldMeta>,
    pub minimum_payment: Option<FieldMeta>,
    pub apr: Option<FieldMeta>,
    pub due_date: Option<FieldMeta>,
    pub interest_charged: Option<FieldMeta>,
    pub deferred_interest_apr: Option<FieldMeta>,
}

pub struct LlmState {
    pub server_process: Mutex<Option<Child>>,
    pub force_cpu: Mutex<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedBudget {
    pub income: Option<f64>,
    pub rent: Option<f64>,
    pub utilities: Option<f64>,
    pub groceries: Option<f64>,
    pub transportation: Option<f64>,
    pub insurance: Option<f64>,
    pub subscriptions: Option<f64>,
    pub other: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GpuStatus {
    pub gpu_detected: bool,
    pub cuda_build: bool,
    pub using_gpu: bool,
}

pub fn get_data_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("failed to get app data dir")
}

pub fn get_model_path(data_dir: &Path) -> PathBuf {
    data_dir.join("models").join(MODEL_FILENAME)
}

pub fn get_server_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("bin")
}

pub fn get_server_path(data_dir: &Path) -> PathBuf {
    let name = if cfg!(windows) {
        "llama-server.exe"
    } else {
        "llama-server"
    };
    get_server_dir(data_dir).join(name)
}

/// Detect whether an NVIDIA GPU is available by running nvidia-smi
pub fn has_nvidia_gpu() -> bool {
    let mut cmd = Command::new("nvidia-smi");
    cmd.stdout(Stdio::null()).stderr(Stdio::null());

    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    cmd.status().map(|s| s.success()).unwrap_or(false)
}

/// Check if we downloaded the CUDA build (marker file)
pub fn has_cuda_build(data_dir: &Path) -> bool {
    get_server_dir(data_dir).join(".cuda").exists()
}

pub fn check_setup(data_dir: &Path) -> SetupStatus {
    SetupStatus {
        model_ready: get_model_path(data_dir).exists(),
        server_ready: get_server_path(data_dir).exists(),
    }
}

async fn download_to_file(
    url: &str,
    dest: &Path,
    app: &AppHandle,
    stage: &str,
) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let tmp_path = dest.with_extension("tmp");

    let client = reqwest::Client::builder()
        .user_agent("debt-planner/0.1")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download returned status {}", response.status()));
    }

    let total = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    let mut file = std::fs::File::create(&tmp_path).map_err(|e| e.to_string())?;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        let percent = if total > 0 {
            (downloaded as f64 / total as f64) * 100.0
        } else {
            0.0
        };
        let _ = app.emit(
            "download-progress",
            DownloadProgress {
                stage: stage.to_string(),
                downloaded,
                total,
                percent,
            },
        );
    }

    drop(file);
    std::fs::rename(&tmp_path, dest).map_err(|e| e.to_string())?;

    Ok(())
}

fn extract_zip_binaries(zip_path: &Path, bin_dir: &Path) -> Result<(), String> {
    let file = std::fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    let server_exe = if cfg!(windows) {
        "llama-server.exe"
    } else {
        "llama-server"
    };

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let entry_name = entry.name().to_string();

        let should_extract = entry_name.ends_with(server_exe)
            || entry_name.ends_with(".dll")
            || entry_name.ends_with(".so")
            || entry_name.ends_with(".dylib");

        if should_extract {
            let filename = Path::new(&entry_name)
                .file_name()
                .unwrap()
                .to_string_lossy()
                .to_string();
            let dest = bin_dir.join(&filename);
            let mut outfile = std::fs::File::create(&dest).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut outfile).map_err(|e| e.to_string())?;
        }
    }

    let _ = std::fs::remove_file(zip_path);
    Ok(())
}

pub async fn download_server(data_dir: &Path, app: &AppHandle) -> Result<(), String> {
    let gpu_available = has_nvidia_gpu();
    let use_cuda = gpu_available && cfg!(target_os = "windows");

    let client = reqwest::Client::builder()
        .user_agent("debt-planner/0.1")
        .build()
        .map_err(|e| e.to_string())?;

    let release: serde_json::Value = client
        .get("https://api.github.com/repos/ggml-org/llama.cpp/releases/latest")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch release info: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse release info: {}", e))?;

    let assets = release["assets"]
        .as_array()
        .ok_or("No assets in release")?;

    let bin_dir = get_server_dir(data_dir);
    std::fs::create_dir_all(&bin_dir).map_err(|e| e.to_string())?;

    if use_cuda {
        // Find the highest CUDA version available (prefer newest)
        // Assets look like: llama-b8467-bin-win-cuda-12.4-x64.zip
        let cuda_asset = assets
            .iter()
            .filter(|a| {
                let name = a["name"].as_str().unwrap_or("").to_lowercase();
                name.contains("win")
                    && name.contains("x64")
                    && name.contains("cuda")
                    && name.ends_with(".zip")
                    && !name.starts_with("cudart")
            })
            .last() // last = highest version since assets are sorted
            .ok_or("Could not find CUDA build of llama.cpp")?;

        let cuda_asset_name = cuda_asset["name"].as_str().unwrap_or("");
        let cuda_url = cuda_asset["browser_download_url"]
            .as_str()
            .ok_or("No download URL for CUDA asset")?;

        // Extract the CUDA version string (e.g., "cuda-12.4") to match cudart
        let cuda_ver_tag: String = cuda_asset_name
            .to_lowercase()
            .split("cuda-")
            .nth(1)
            .unwrap_or("12")
            .split('-')
            .next()
            .unwrap_or("12")
            .to_string();

        let zip_path = bin_dir.join("llama-server.zip");
        download_to_file(cuda_url, &zip_path, app, "Downloading AI engine (GPU)").await?;
        extract_zip_binaries(&zip_path, &bin_dir)?;

        // Download matching CUDA runtime DLLs (cudart with same version)
        let cudart_asset = assets.iter().find(|a| {
            let name = a["name"].as_str().unwrap_or("").to_lowercase();
            name.starts_with("cudart")
                && name.contains("win")
                && name.contains(&format!("cuda-{}", cuda_ver_tag))
                && name.contains("x64")
                && name.ends_with(".zip")
        });

        if let Some(cudart) = cudart_asset {
            if let Some(cudart_url) = cudart["browser_download_url"].as_str() {
                let cudart_zip = bin_dir.join("cudart.zip");
                download_to_file(cudart_url, &cudart_zip, app, "Downloading CUDA runtime")
                    .await?;
                extract_zip_binaries(&cudart_zip, &bin_dir)?;
            }
        }

        // Write marker file so we know this is a CUDA build
        let _ = std::fs::File::create(bin_dir.join(".cuda"));
    } else {
        // Download CPU build
        let cpu_asset = assets
            .iter()
            .find(|a| {
                let name = a["name"].as_str().unwrap_or("").to_lowercase();
                if cfg!(target_os = "windows") {
                    name.contains("win")
                        && name.contains("x64")
                        && (name.contains("cpu") || name.contains("avx2"))
                        && name.ends_with(".zip")
                        && !name.starts_with("cudart")
                } else if cfg!(target_os = "macos") {
                    name.contains("macos") && name.ends_with(".zip")
                } else {
                    name.contains("linux")
                        && name.contains("x64")
                        && name.contains("cpu")
                        && name.ends_with(".zip")
                }
            })
            .ok_or("Could not find a compatible llama.cpp release for this platform")?;

        let cpu_url = cpu_asset["browser_download_url"]
            .as_str()
            .ok_or("No download URL for CPU asset")?;

        let zip_path = bin_dir.join("llama-server.zip");
        download_to_file(cpu_url, &zip_path, app, "Downloading AI engine (CPU)").await?;
        extract_zip_binaries(&zip_path, &bin_dir)?;
    }

    if !get_server_path(data_dir).exists() {
        return Err("llama-server not found in downloaded archive".to_string());
    }

    Ok(())
}

pub async fn download_model(data_dir: &Path, app: &AppHandle) -> Result<(), String> {
    let model_path = get_model_path(data_dir);
    download_to_file(MODEL_URL, &model_path, app, "Downloading AI model").await
}

pub fn start_server(data_dir: &Path, state: &LlmState) -> Result<(), String> {
    let mut process_guard = state.server_process.lock().map_err(|e| e.to_string())?;

    // Check if already running
    if let Some(ref mut child) = *process_guard {
        match child.try_wait() {
            Ok(None) => return Ok(()), // still running
            _ => {}                    // exited, will restart
        }
    }

    let server_path = get_server_path(data_dir);
    let model_path = get_model_path(data_dir);
    let bin_dir = get_server_dir(data_dir);

    // Use GPU if we downloaded the CUDA build and not forced to CPU
    let force_cpu = state.force_cpu.lock().map_err(|e| e.to_string())?;
    let gpu_layers = if has_cuda_build(data_dir) && !*force_cpu { "99" } else { "0" };
    drop(force_cpu);

    let mut cmd = Command::new(&server_path);
    cmd.current_dir(&bin_dir)
        .arg("-m")
        .arg(&model_path)
        .arg("--port")
        .arg(LLAMA_SERVER_PORT.to_string())
        .arg("--host")
        .arg("127.0.0.1")
        .arg("-ngl")
        .arg(gpu_layers)
        .arg("--ctx-size")
        .arg("8192")
        .arg("--cont-batching")
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let child = cmd.spawn()
        .map_err(|e| format!("Failed to start llama-server: {}", e))?;

    *process_guard = Some(child);

    Ok(())
}

pub async fn wait_for_server() -> Result<(), String> {
    let client = reqwest::Client::new();
    let url = format!("http://127.0.0.1:{}/health", LLAMA_SERVER_PORT);

    for _ in 0..60 {
        if let Ok(resp) = client.get(&url).send().await {
            if resp.status().is_success() {
                return Ok(());
            }
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    }

    Err("AI engine took too long to start. This may happen on first run while the model loads — try again.".to_string())
}

pub async fn run_inference(text: &str) -> Result<ExtractedFields, String> {
    // Truncate very long text to fit within context window (~3000 tokens for prompt, ~500 for response)
    let truncated = if text.len() > 8000 {
        &text[..8000]
    } else {
        text
    };

    let prompt = format!(
        r#"You are a data extraction assistant. Extract credit card statement information from the text below.

Return ONLY a valid JSON object with these exact fields:
- "cardName": Name of the credit card or store card, e.g. "Best Buy Visa", "Chase Sapphire" (string or null)
- "lastFour": Last 4 digits of card number (string or null)
- "statementBalance": Total new balance or statement balance as a number (number or null)
- "minimumPayment": Minimum payment due as a number (number or null)
- "apr": The APR currently being charged on the balance as a percentage. If the entire balance is under a deferred interest promotion or 0% introductory rate and no interest is currently being charged, set this to 0. Do NOT set this to null just because interest is deferred — use 0 instead. Only use null if you truly cannot find any APR information at all. (number or null)
- "dueDate": Payment due date in YYYY-MM-DD format (string or null)
- "interestCharged": Interest charged this statement period as a number (number or null)
- "isDeferredInterest": Set to true if you see ANY of these indicators: "deferred interest", "no interest if paid in full", "promotional financing", "special financing", "equal pay", or if the statement shows a promotional balance with a future expiration date. Set to false otherwise. (boolean)
- "deferredInterestApr": If isDeferredInterest is true, the APR that will apply AFTER the promotional period ends. Look for labels like "Standard APR", "Purchase APR", "Variable APR", "Deferred Interest Rate", "Regular APR", or "Penalty APR". For store cards like Best Buy, Synchrony, Care Credit etc. this is usually 25-30%. (number or null)
- "deferredInterestEndDate": The date by which the promotional balance must be paid in full to avoid deferred interest charges, in YYYY-MM-DD format (string or null)
- "fieldMeta": An object with provenance for each extracted field. For each field you extracted (cardName, statementBalance, minimumPayment, apr, dueDate, interestCharged, deferredInterestApr), include:
  - "confidence": "high" if the value was clearly labeled, "medium" if inferred from context, "low" if guessed
  - "source": the exact short snippet (max 60 chars) from the statement text where you found this value

Example fieldMeta:
"fieldMeta": {{
  "statementBalance": {{"confidence": "high", "source": "New Balance $3,918.16"}},
  "apr": {{"confidence": "high", "source": "Annual Percentage Rate 22.74%"}}
}}

Do not include any text outside the JSON object.

Statement text:
---
{}
---"#,
        truncated
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "http://127.0.0.1:{}/v1/chat/completions",
        LLAMA_SERVER_PORT
    );

    let body = serde_json::json!({
        "model": "local",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 512,
        "response_format": {"type": "json_object"}
    });

    // Wait for server to be idle (not processing another request)
    let health_url = format!("http://127.0.0.1:{}/health", LLAMA_SERVER_PORT);
    for _ in 0..30 {
        if let Ok(resp) = client.get(&health_url).send().await {
            if let Ok(health) = resp.json::<serde_json::Value>().await {
                let status = health["status"].as_str().unwrap_or("");
                if status == "ok" || status == "no slot available" {
                    break;
                }
            }
        }
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }

    let http_response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Inference request failed: {}", e))?;

    let response_text = http_response
        .text()
        .await
        .map_err(|e| format!("Failed to read inference response: {}", e))?;

    let response: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse inference response: {}. Raw: {}", e, response_text))?;

    // Check for API-level errors
    if let Some(err) = response.get("error") {
        return Err(format!("AI server error: {}", err));
    }

    // Extract content - handle both string and null
    let content = match &response["choices"][0]["message"]["content"] {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Null => {
            return Err(format!(
                "AI returned empty response. The statement may be too long or unclear. Full response: {}",
                response_text
            ));
        }
        _ => {
            return Err(format!(
                "Unexpected AI response format: {}",
                response_text
            ));
        }
    };

    // Try to parse the JSON - the model might wrap it in markdown code blocks
    let cleaned = content
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let mut fields: ExtractedFields = serde_json::from_str(cleaned).map_err(|e| {
        format!(
            "Failed to parse AI output as JSON: {}. Raw output: {}",
            e, content
        )
    })?;

    // Post-processing: normalize deferred interest cases
    // If deferred interest is detected but apr is null, set it to 0
    if fields.is_deferred_interest == Some(true) && fields.apr.is_none() {
        fields.apr = Some(0.0);
    }
    // If we have a deferred interest APR but isDeferredInterest wasn't set, fix it
    if fields.deferred_interest_apr.is_some() && fields.is_deferred_interest != Some(true) {
        fields.is_deferred_interest = Some(true);
    }

    Ok(fields)
}

pub async fn run_budget_inference(text: &str) -> Result<ExtractedBudget, String> {
    let truncated = if text.len() > 10000 {
        &text[..10000]
    } else {
        text
    };

    let prompt = format!(
        r#"You are a financial data extraction assistant. Analyze this bank statement (checking or savings account) and extract monthly income and recurring expenses.

Return ONLY a valid JSON object with these fields:
- "income": Total monthly income — sum of direct deposits, payroll, and regular incoming transfers. If the statement covers multiple months, estimate the monthly average. (number or null)
- "rent": Monthly rent or mortgage payment (number or null)
- "utilities": Monthly utilities — electric, water, gas, internet, phone bills (number or null)
- "groceries": Monthly grocery spending — supermarkets, food stores (number or null)
- "transportation": Monthly transportation — gas stations, parking, tolls, public transit, ride shares (number or null)
- "insurance": Monthly insurance payments — health, auto, life, renter's (number or null)
- "subscriptions": Monthly subscriptions — streaming services, gym, software, memberships (number or null)
- "other": Other significant recurring monthly expenses not in the above categories (number or null)

Instructions:
- Look at DEPOSITS/CREDITS for income, and DEBITS/WITHDRAWALS for expenses.
- Only include recurring or regular transactions, not one-time purchases.
- If the statement covers a partial month or multiple months, normalize to a monthly amount.
- Round to the nearest dollar.
- Do NOT include credit card payments as expenses (those are debt payments, not living expenses).
- If you cannot determine a category, use null rather than guessing 0.

Do not include any text outside the JSON object.

Bank statement text:
---
{}
---"#,
        truncated
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "http://127.0.0.1:{}/v1/chat/completions",
        LLAMA_SERVER_PORT
    );

    let body = serde_json::json!({
        "model": "local",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 512,
        "response_format": {"type": "json_object"}
    });

    let health_url = format!("http://127.0.0.1:{}/health", LLAMA_SERVER_PORT);
    for _ in 0..30 {
        if let Ok(resp) = client.get(&health_url).send().await {
            if let Ok(health) = resp.json::<serde_json::Value>().await {
                let status = health["status"].as_str().unwrap_or("");
                if status == "ok" || status == "no slot available" {
                    break;
                }
            }
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    }

    let http_response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Inference request failed: {}", e))?;

    let response_text = http_response
        .text()
        .await
        .map_err(|e| format!("Failed to read inference response: {}", e))?;

    let response: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse inference response: {}. Raw: {}", e, response_text))?;

    if let Some(err) = response.get("error") {
        return Err(format!("AI server error: {}", err));
    }

    let content = match &response["choices"][0]["message"]["content"] {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Null => {
            return Err("AI returned empty response. The statement may be too long or unclear.".to_string());
        }
        _ => {
            return Err(format!("Unexpected AI response format: {}", response_text));
        }
    };

    let cleaned = content
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let budget: ExtractedBudget = serde_json::from_str(cleaned).map_err(|e| {
        format!(
            "Failed to parse AI output as JSON: {}. Raw output: {}",
            e, content
        )
    })?;

    Ok(budget)
}

pub fn get_gpu_status(data_dir: &Path, state: &LlmState) -> GpuStatus {
    let gpu_detected = has_nvidia_gpu();
    let cuda_build = has_cuda_build(data_dir);
    let force_cpu = state.force_cpu.lock().map(|v| *v).unwrap_or(false);
    GpuStatus {
        gpu_detected,
        cuda_build,
        using_gpu: cuda_build && !force_cpu,
    }
}

pub fn set_force_cpu(state: &LlmState, force: bool) {
    if let Ok(mut guard) = state.force_cpu.lock() {
        *guard = force;
    }
}

pub fn stop_server(state: &LlmState) {
    if let Ok(mut guard) = state.server_process.lock() {
        if let Some(ref mut child) = *guard {
            let _ = child.kill();
            let _ = child.wait();
        }
        *guard = None;
    }
}
