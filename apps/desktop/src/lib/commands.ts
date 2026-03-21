import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface SetupStatus {
  modelReady: boolean;
  serverReady: boolean;
}

export interface DownloadProgress {
  stage: string;
  downloaded: number;
  total: number;
  percent: number;
}

export interface ExtractedFields {
  cardName: string | null;
  lastFour: string | null;
  statementBalance: number | null;
  minimumPayment: number | null;
  apr: number | null;
  dueDate: string | null;
  interestCharged: number | null;
  isDeferredInterest: boolean | null;
  deferredInterestApr: number | null;
  deferredInterestEndDate: string | null;
}

export async function checkAiSetup(): Promise<SetupStatus> {
  return invoke("check_ai_setup");
}

export async function setupAi(): Promise<void> {
  return invoke("setup_ai");
}

export async function extractStatement(
  text: string
): Promise<ExtractedFields> {
  return invoke("extract_statement", { text });
}

export function onDownloadProgress(
  callback: (progress: DownloadProgress) => void
): Promise<UnlistenFn> {
  return listen<DownloadProgress>("download-progress", (event) => {
    callback(event.payload);
  });
}

// --- Database types ---

export interface SavedAccount {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
}

export interface BudgetConfig {
  income: number;
  expenses: ExpenseEntry[];
}

export interface ExpenseEntry {
  category: string;
  amount: number;
}

// --- Database commands ---

export async function dbGetAccounts(): Promise<SavedAccount[]> {
  return invoke("db_get_accounts");
}

export async function dbSaveAccount(account: SavedAccount): Promise<void> {
  return invoke("db_save_account", { account });
}

export async function dbDeleteAccount(id: string): Promise<void> {
  return invoke("db_delete_account", { id });
}

export async function dbGetBudget(): Promise<BudgetConfig> {
  return invoke("db_get_budget");
}

export async function dbSaveBudget(config: BudgetConfig): Promise<void> {
  return invoke("db_save_budget", { config });
}
