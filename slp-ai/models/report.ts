export interface Report {
  userId: string;
  template: string;
  inputData: string;
  generatedReport: string;
  createdAt: Date;
}

export type ReportCreate = Omit<Report, 'createdAt'>; 