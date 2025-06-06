import { Installment } from './installment.model';
import { LoanType } from './loan-type.enum';

export interface Loan {
  id: string; // Unique identifier (e.g., UUID)
  clientId: string; // Foreign key to Client
  loanAmount: number;
  // For AMORTIZED, this is annual (e.g., 0.05 for 5%).
  // For INTEREST_ONLY_DAILY_ACCRUAL, interpretation may vary (e.g., could be monthly or annual, context is key).
  interestRate: number;
  termMonths?: number; // Loan term in months (optional for some loan types)
  startDate: Date;
  // For AMORTIZED loans, this is the pre-calculated amortization schedule.
  // For INTEREST_ONLY_DAILY_ACCRUAL loans, this may represent dynamically projected interest dues or a log of interest-related transactions rather than a fixed future schedule.
  installments: Installment[];
  loanType: LoanType; // Type of loan
  purpose?: string; // Optional: purpose of the loan
}
