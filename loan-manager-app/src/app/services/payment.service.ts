import { Injectable } from '@angular/core';
import { LocalStorageService } from './local-storage.service';
import { LoanService } from './loan.service'; // To get/update loan data
import { ClientService } from './client.service'; // To get client data if needed for surplus context
import { Payment, Loan, Installment, InstallmentStatus, ClientSurplus, Client } from '../models';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private readonly paymentsStorageKey = 'payments';
  private readonly clientSurplusStorageKey = 'clientSurpluses';

  constructor(
    private localStorageService: LocalStorageService,
    private loanService: LoanService,
    private clientService: ClientService // Added ClientService
  ) { }

  private getPaymentsFromStorage(): Payment[] {
    const payments = this.localStorageService.getItem<Payment[]>(this.paymentsStorageKey) || [];
    return payments.map(p => ({ ...p, paymentDate: new Date(p.paymentDate) }));
  }

  private savePaymentsToStorage(payments: Payment[]): void {
    this.localStorageService.setItem(this.paymentsStorageKey, payments);
  }

  private getClientSurplusesFromStorage(): ClientSurplus[] {
    const surpluses = this.localStorageService.getItem<ClientSurplus[]>(this.clientSurplusStorageKey) || [];
    return surpluses.map(s => ({ ...s, lastUpdated: new Date(s.lastUpdated) }));
  }

  private saveClientSurplusesToStorage(surpluses: ClientSurplus[]): void {
    this.localStorageService.setItem(this.clientSurplusStorageKey, surpluses);
  }

  addPayment(
    loanId: string,
    paymentAmount: number,
    paymentDate: Date,
    paymentMethod?: string,
    notes?: string
  ): { success: boolean; paymentId?: string; message?: string } {
    console.log(`[PaymentService] addPayment called for loanId: ${loanId}, amount: ${paymentAmount}`);
    if (paymentAmount <= 0) {
      return { success: false, message: 'Payment amount must be positive.' };
    }

    const loan = this.loanService.getLoanById(loanId);
    if (!loan) {
      return { success: false, message: `Loan with ID ${loanId} not found.` };
    }
    
    const client = this.clientService.getClientById(loan.clientId);
     if (!client) {
         // This should ideally not happen if loan.clientId is valid
         return { success: false, message: `Client with ID ${loan.clientId} not found for the loan.`};
     }

    let remainingPaymentAmount = paymentAmount;
    const appliedToInstallments: Payment['appliedToInstallments'] = [];
    let loanUpdated = false;

    // Get all installments sorted by their number (or due date)
    const allInstallmentsSorted = [...loan.installments].sort((a, b) => a.installmentNumber - b.installmentNumber);

    for (const inst of allInstallmentsSorted) {
      if (remainingPaymentAmount <= 0) {
        break; // No more payment amount to apply
      }

      if (inst.status === InstallmentStatus.Paid) {
        // Typically skip fully paid installments.
        // Business rule: Can we overpay a paid installment to create surplus from it? Not for now.
        continue;
      }

      const amountAlreadyPaid = inst.paidAmount || 0;
      const amountActuallyDueForInstallment = inst.amount - amountAlreadyPaid;

      if (amountActuallyDueForInstallment <= 0) {
        // This installment is already effectively paid off or was mis-statused.
        // We know inst.status was not 'Paid' when the loop iteration began (due to the check at loop start).
        // So, if it's now determined to be fully covered by its paidAmount, update status.
        inst.status = InstallmentStatus.Paid;
        loanUpdated = true; // Status is changing from non-Paid to Paid.
        continue;
      }

      const amountToApplyToThisInstallment = Math.min(remainingPaymentAmount, amountActuallyDueForInstallment);

      if (amountToApplyToThisInstallment > 0) {
        inst.paidAmount = amountAlreadyPaid + amountToApplyToThisInstallment;
        loanUpdated = true;

        appliedToInstallments.push({
          installmentNumber: inst.installmentNumber,
          amountApplied: amountToApplyToThisInstallment
        });

        console.log(`[PaymentService] Applied ${amountToApplyToThisInstallment} to inst #${inst.installmentNumber}. New paidAmount: ${inst.paidAmount}`);

        if (inst.paidAmount >= inst.amount) {
          // The installment is now fully paid (or overpaid by this payment).
          // We know inst.status was not 'Paid' when the loop iteration began.
          inst.status = InstallmentStatus.Paid;
          // loanUpdated is already true because inst.paidAmount was just changed.
          console.log(`[PaymentService] Installment ${inst.installmentNumber} for loan ${loanId} marked as Paid.`);
        }
        // Note: Overdue status would need to be checked/updated based on paymentDate vs dueDate
        // if an overdue installment becomes partially or fully paid.
        // For now, only Paid status is set. If it was Overdue and now partially paid, it remains Overdue.
        // A separate process or rule might be needed to change Overdue to Pending if partially paid on time.

        remainingPaymentAmount -= amountToApplyToThisInstallment;
      }
    }

    // Handle surplus if any
    if (remainingPaymentAmount > 0) {
      let surpluses = this.getClientSurplusesFromStorage();
      let clientSurplus = surpluses.find(s => s.clientId === loan.clientId);
      if (clientSurplus) {
        clientSurplus.surplusAmount += remainingPaymentAmount;
        clientSurplus.lastUpdated = new Date();
      } else {
        clientSurplus = {
          clientId: loan.clientId,
          surplusAmount: remainingPaymentAmount,
          lastUpdated: new Date()
        };
        surpluses.push(clientSurplus);
      }
      this.saveClientSurplusesToStorage(surpluses);
      console.log(`[PaymentService] Client ${loan.clientId} surplus updated by ${remainingPaymentAmount}. New total surplus: ${clientSurplus.surplusAmount}`);
    }

    // Save the payment record
    const newPayment: Payment = {
      id: crypto.randomUUID(),
      loanId,
      clientId: loan.clientId,
      paymentDate,
      amountPaid: paymentAmount, // Original total payment amount
      appliedToInstallments,
      paymentMethod,
      notes
    };
    const allPayments = this.getPaymentsFromStorage();
    allPayments.push(newPayment);
    this.savePaymentsToStorage(allPayments);
    console.log(`[PaymentService] Payment ${newPayment.id} created.`);

    // If installment statuses changed, save the updated loan
    if (loanUpdated) {
      this.loanService.updateLoan(loan); // updateLoan should internally call saveLoansToStorage
      console.log(`[PaymentService] Loan ${loanId} updated due to status changes.`);
    }
    
    return { success: true, paymentId: newPayment.id, message: 'Payment processed.' };
  }

  getPaymentsForLoan(loanId: string): Payment[] {
    const allPayments = this.getPaymentsFromStorage();
    return allPayments.filter(p => p.loanId === loanId);
  }

  getSurplusForClient(clientId: string): number {
    const surpluses = this.getClientSurplusesFromStorage();
    const clientSurplus = surpluses.find(s => s.clientId === clientId);
    return clientSurplus ? clientSurplus.surplusAmount : 0;
  }

  // Method to apply surplus to a new loan for a client (Conceptual - can be added later)
  // applySurplusToLoan(clientId: string, loanToApplyToId: string): boolean { ... }

  public getTotalPaymentsReceived(startDate?: Date, endDate?: Date): number {
    let payments = this.getPaymentsFromStorage();

    if (startDate && endDate) {
      // Ensure endDate is inclusive by setting time to end of day
      const inclusiveEndDate = new Date(endDate);
      inclusiveEndDate.setHours(23, 59, 59, 999);

      payments = payments.filter(payment => {
        const paymentDate = new Date(payment.paymentDate); // Ensure it's a Date object
        return paymentDate >= startDate && paymentDate <= inclusiveEndDate;
      });
    } else if (startDate) {
      payments = payments.filter(payment => {
        const paymentDate = new Date(payment.paymentDate);
        return paymentDate >= startDate;
      });
    } else if (endDate) {
      const inclusiveEndDate = new Date(endDate);
      inclusiveEndDate.setHours(23, 59, 59, 999);
      payments = payments.filter(payment => {
        const paymentDate = new Date(payment.paymentDate);
        return paymentDate <= inclusiveEndDate;
      });
    }

    return payments.reduce((total, payment) => total + payment.amountPaid, 0);
  }
}
