export enum InstallmentStatus {
  Pending = 'Pending',
  Paid = 'Paid',
  Overdue = 'Overdue'
}

export interface Installment {
  installmentNumber: number;
  dueDate: Date;
  amount: number; // Total amount due for this installment.
                  // For AMORTIZED: principal + interest.
                  // For INTEREST_ONLY: typically just interest, unless it's a final balloon or mixed.
  principal: number; // Principal portion of the installment.
                     // For INTEREST_ONLY: 0 for regular installments, or full principal on balloon payment.
  interest: number;  // Interest portion of the installment.
                     // For INTEREST_ONLY: usually equals `amount` for regular installments.
  remainingBalance: number; // Scheduled remaining loan balance after this installment is applied as per schedule.
  status: InstallmentStatus;
  paidAmount?: number; // Amount actually paid towards this specific installment.
}
