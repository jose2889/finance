import { Installment } from './installment.model';

export interface Loan {
  id: string; // Unique identifier (e.g., UUID)
  clientId: string; // Foreign key to Client
  loanAmount: number;
  interestRate: number; // Annual interest rate (e.g., 0.05 for 5%)
  termMonths: number; // Loan term in months
  startDate: Date;
  installments: Installment[];
  purpose?: string; // Optional: purpose of the loan
}
