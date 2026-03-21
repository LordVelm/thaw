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
