export interface SalaryHistoryEntry {
  oldSalary: number | null;
  newSalary: number;
  changedAt: string;
  reason: string;
  observations?: string | null;
}
