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

    // Sort installments by due date, prioritizing Overdue then Pending
    const installmentsToPay = loan.installments
      .filter(inst => inst.status === InstallmentStatus.Overdue || inst.status === InstallmentStatus.Pending)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    for (const inst of installmentsToPay) {
      if (remainingPaymentAmount <= 0) break;

      const installmentDue = inst.amount; // Assuming inst.amount is the full amount due for that installment
                                        // More complex: inst.amount - (amountAlreadyPaidOnThisInstallment || 0)
      
      if (inst.status === InstallmentStatus.Paid) continue; // Should be filtered but double check

      const amountToApplyToThisInstallment = Math.min(remainingPaymentAmount, installmentDue);

      if (amountToApplyToThisInstallment > 0) {
        appliedToInstallments.push({
          installmentNumber: inst.installmentNumber,
          amountApplied: amountToApplyToThisInstallment
        });

        // For now, assume full payment of an installment changes status.
        // Partial payment logic on installment itself is not yet implemented.
        if (amountToApplyToThisInstallment >= installmentDue) { // Or very close, to handle floating point
          inst.status = InstallmentStatus.Paid;
          console.log(`[PaymentService] Installment ${inst.installmentNumber} for loan ${loanId} marked as Paid.`);
          loanUpdated = true;
        } else {
          // Installment partially paid. Current model doesn't track inst.amountPaid.
          // For now, it remains Pending/Overdue. The payment record shows what was applied.
          console.log(`[PaymentService] Installment ${inst.installmentNumber} for loan ${loanId} partially paid with ${amountToApplyToThisInstallment}. It remains ${inst.status}.`);
          // If we were to track partial payment on installment:
          // inst.amountPaid = (inst.amountPaid || 0) + amountToApplyToThisInstallment;
          // loanUpdated = true;
        }
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
