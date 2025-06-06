import { Injectable } from '@angular/core';
import { LocalStorageService } from './local-storage.service';
import { LoanService } from './loan.service'; // To get/update loan data
import { ClientService } from './client.service'; // To get client data if needed for surplus context
import { Payment, Loan, Installment, InstallmentStatus, ClientSurplus, Client, LoanType } from '../models'; // Import LoanType

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

    // Initialize common variables for payment record
    const appliedToInstallmentsForPaymentRecord: Payment['appliedToInstallments'] = [];
    let loanUpdated = false;
    let remainingPaymentAmount = paymentAmount; // Renamed from paymentAmount for clarity in scope

    if (loan.loanType === LoanType.INTEREST_ONLY_DAILY_ACCRUAL) {
      // Logic for INTEREST_ONLY_DAILY_ACCRUAL loans
      let loanPrincipalReduced = false;

      // 1. Pay Accrued Interest (targeting oldest pending interest installment)
      const sortedInstallments = [...loan.installments].sort((a, b) => a.installmentNumber - b.installmentNumber);
      const firstPendingInstallment = sortedInstallments.find(inst => inst.status === InstallmentStatus.Pending || inst.status === InstallmentStatus.Overdue);

      if (firstPendingInstallment) {
        const interestDueForThisInstallment = firstPendingInstallment.amount - (firstPendingInstallment.paidAmount || 0);
        const amountToApplyToInterest = Math.min(remainingPaymentAmount, interestDueForThisInstallment);

        if (amountToApplyToInterest > 0) {
          firstPendingInstallment.paidAmount = (firstPendingInstallment.paidAmount || 0) + amountToApplyToInterest;
          remainingPaymentAmount -= amountToApplyToInterest;

          appliedToInstallmentsForPaymentRecord.push({
            installmentNumber: firstPendingInstallment.installmentNumber,
            amountApplied: amountToApplyToInterest
          });

          if (firstPendingInstallment.paidAmount >= firstPendingInstallment.amount) {
            firstPendingInstallment.status = InstallmentStatus.Paid;
          }
          loanUpdated = true;
        }
      }

      // 2. Apply Surplus to Principal
      if (remainingPaymentAmount > 0) {
        const amountToApplyToPrincipal = remainingPaymentAmount;
        loan.loanAmount -= amountToApplyToPrincipal; // Reduce principal
        loanPrincipalReduced = true;
        loanUpdated = true;

        appliedToInstallmentsForPaymentRecord.push({
          installmentNumber: -1, // Special indicator for principal reduction
          amountApplied: amountToApplyToPrincipal
        });
        remainingPaymentAmount = 0; // Payment fully exhausted
      }

      // 3. Regenerate/Update Future Installments (if principal was reduced)
      if (loanPrincipalReduced) {
        const monthlyInterestRate = loan.interestRate;

        for (const inst of loan.installments) {
          if (inst.status === InstallmentStatus.Pending || (inst === firstPendingInstallment && inst.status !== InstallmentStatus.Paid)) {
            if (inst.status === InstallmentStatus.Pending) {
              const newEstimatedInterest = this.loanService.calculateAccruedInterestForOneMonth(loan.loanAmount, monthlyInterestRate);
              inst.amount = newEstimatedInterest;
              inst.interest = newEstimatedInterest;
              inst.principal = 0;
              inst.remainingBalance = loan.loanAmount;
              inst.paidAmount = 0; // Reset paid amount as the installment amount itself changed
            }
          }
        }
      }
    } else {
      // Existing AMORTIZED loan logic
      const allInstallmentsSorted = [...loan.installments].sort((a, b) => a.installmentNumber - b.installmentNumber);

      for (const inst of allInstallmentsSorted) {
        if (remainingPaymentAmount <= 0) {
          break; // No more payment amount to apply
        }

        if (inst.status === InstallmentStatus.Paid) {
          continue;
        }

        const amountAlreadyPaid = inst.paidAmount || 0;
        const amountActuallyDueForInstallment = inst.amount - amountAlreadyPaid;

        if (amountActuallyDueForInstallment <= 0) {
          inst.status = InstallmentStatus.Paid;
          loanUpdated = true;
          continue;
        }

        const amountToApplyToThisInstallment = Math.min(remainingPaymentAmount, amountActuallyDueForInstallment);

        if (amountToApplyToThisInstallment > 0) {
          inst.paidAmount = amountAlreadyPaid + amountToApplyToThisInstallment;
          loanUpdated = true;

          appliedToInstallmentsForPaymentRecord.push({
            installmentNumber: inst.installmentNumber,
            amountApplied: amountToApplyToThisInstallment
          });

          console.log(`[PaymentService] Applied ${amountToApplyToThisInstallment} to inst #${inst.installmentNumber}. New paidAmount: ${inst.paidAmount}`);

          if (inst.paidAmount >= inst.amount) {
            inst.status = InstallmentStatus.Paid;
            console.log(`[PaymentService] Installment ${inst.installmentNumber} for loan ${loanId} marked as Paid.`);
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
        console.log(`[PaymentService] Client ${loan.clientId} surplus updated for AMORTIZED by ${remainingPaymentAmount}. New total surplus: ${clientSurplus.surplusAmount}`);
      }
    }

    // Common logic for saving payment record, loan updates, and returning success
    const newPayment: Payment = {
      id: crypto.randomUUID(),
      loanId,
      clientId: loan.clientId,
      paymentDate,
      amountPaid: paymentAmount,
      appliedToInstallments: appliedToInstallmentsForPaymentRecord,
      paymentMethod,
      notes
    };

    const allPayments = this.getPaymentsFromStorage();
    allPayments.push(newPayment);
    this.savePaymentsToStorage(allPayments);
    console.log(`[PaymentService] Payment ${newPayment.id} created.`);

    // If installment statuses changed, save the updated loan
    if (loanUpdated) {
      this.loanService.updateLoan(loan);
      console.log(`[PaymentService] Loan ${loanId} updated due to status changes.`);
    }

    return { success: true, paymentId: newPayment.id, message: 'Payment processed.' };
  }

  public getPaymentsForLoan(loanId: string): Payment[] {
    const payments = this.getPaymentsFromStorage();
    return payments.filter(payment => payment.loanId === loanId);
  }

  public getSurplusForClient(clientId: string): number {
    const surpluses = this.getClientSurplusesFromStorage();
    const clientSurplus = surpluses.find(s => s.clientId === clientId);
    return clientSurplus ? clientSurplus.surplusAmount : 0;
  }

  public getTotalPaymentsReceived(startDate?: Date, endDate?: Date): number {
    let payments = this.getPaymentsFromStorage();

    if (startDate && endDate) {
      const inclusiveEndDate = new Date(endDate);
      inclusiveEndDate.setHours(23, 59, 59, 999);

      payments = payments.filter(payment => {
        const paymentDate = new Date(payment.paymentDate);
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
