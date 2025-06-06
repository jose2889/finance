export interface Payment {
  id: string; // Unique identifier for the payment (e.g., UUID)
  loanId: string; // ID of the loan this payment is for
  clientId: string; // ID of the client making the payment
  paymentDate: Date; // Date the payment was made
  amountPaid: number; // The amount paid in this transaction
  paymentMethod?: string; // Optional: e.g., 'Cash', 'Bank Transfer'
  notes?: string; // Optional: Any notes for this payment

  // Details how this payment was allocated to installments
  // This is important if a single payment covers multiple installments
  // or partially pays one.
  appliedToInstallments: Array<{
    installmentNumber: number; // The installment number this portion applies to
    amountApplied: number;     // How much of this payment was applied to that installment
    notes?: string;           // Optional notes for this specific installment application
  }>;
}
