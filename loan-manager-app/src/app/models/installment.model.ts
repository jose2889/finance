export enum InstallmentStatus {
  Pending = 'Pending',
  Paid = 'Paid',
  Overdue = 'Overdue'
}

export interface Installment {
  installmentNumber: number;
  dueDate: Date;
  amount: number;
  principal: number;
  interest: number;
  remainingBalance: number; // Scheduled remaining loan balance after this installment
  status: InstallmentStatus;
  paidAmount?: number; // Amount actually paid towards this specific installment
}
