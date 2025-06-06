export interface Payment {
  id: string; // Unique identifier for the payment (e.g., UUID)
  loanId: string; // ID of the loan this payment is for
  amount: number;
  paymentDate: Date; // Date the payment was made
  notes?: string; // Optional: Any notes for this payment

  // Details how this payment was allocated to installments
  // This is important if a single payment covers multiple installments
  // or partially pays one.
  appliedToInstallments: { installmentNumber: number; amountApplied: number }[];

  excessAmount: number;
}
