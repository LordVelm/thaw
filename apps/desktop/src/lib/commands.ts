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

export interface FieldMeta {
  confidence: "high" | "medium" | "low" | null;
  source: string | null;
}

export interface FieldMetaMap {
  cardName?: FieldMeta;
  statementBalance?: FieldMeta;
  minimumPayment?: FieldMeta;
  apr?: FieldMeta;
  dueDate?: FieldMeta;
  interestCharged?: FieldMeta;
  deferredInterestApr?: FieldMeta;
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
  fieldMeta?: FieldMetaMap | null;
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

// --- Bank statement extraction ---

export interface ExtractedBudget {
  income: number | null;
  rent: number | null;
  utilities: number | null;
  groceries: number | null;
  transportation: number | null;
  insurance: number | null;
  subscriptions: number | null;
  other: number | null;
}

export async function extractBankStatement(
  text: string
): Promise<ExtractedBudget> {
  return invoke("extract_bank_statement", { text });
}

// --- GPU types ---

export interface GpuStatus {
  gpuDetected: boolean;
  cudaBuild: boolean;
  usingGpu: boolean;
}

export async function getGpuStatus(): Promise<GpuStatus> {
  return invoke("get_gpu_status");
}

export async function setGpuEnabled(enabled: boolean): Promise<void> {
  return invoke("set_gpu_enabled", { enabled });
}

// --- Database types ---

export interface SavedTier {
  id: string;
  label?: string | null;
  balance: number;
  apr: number;
  promoExpirationDate?: string | null;
  postPromoApr?: number | null;
}

export interface SavedAccount {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  tiers: SavedTier[];
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
