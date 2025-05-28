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
  remainingBalance: number;
  status: InstallmentStatus;
}
