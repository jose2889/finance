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
      return { success: false, message: `Client with ID ${loan.clientId} not found for the loan.`};
    }

    const appliedToInstallmentsForPaymentRecord: Payment['appliedToInstallments'] = [];
    let loanUpdated = false;
    let remainingPaymentAmount = paymentAmount;

    if (loan.loanType === LoanType.INTEREST_ONLY_DAILY_ACCRUAL) {
      let loanPrincipalReduced = false;
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

      if (remainingPaymentAmount > 0) {
        const amountToApplyToPrincipal = remainingPaymentAmount;
        loan.loanAmount -= amountToApplyToPrincipal;
        loanPrincipalReduced = true;
        loanUpdated = true;

        appliedToInstallmentsForPaymentRecord.push({
          installmentNumber: -1,
          amountApplied: amountToApplyToPrincipal
        });
        remainingPaymentAmount = 0;
      }

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
              inst.paidAmount = 0;
            }
          }
        }
      }
    } else {
      const allInstallmentsSorted = [...loan.installments].sort((a, b) => a.installmentNumber - b.installmentNumber);

      for (const inst of allInstallmentsSorted) {
        if (remainingPaymentAmount <= 0) {
          break;
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

          if (inst.paidAmount >= inst.amount) {
            inst.status = InstallmentStatus.Paid;
          }

          remainingPaymentAmount -= amountToApplyToThisInstallment;
        }
      }
    }

    if (remainingPaymentAmount > 0) {
      if (loan.loanType === LoanType.AMORTIZED) {
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
      } else if (loan.loanType === LoanType.INTEREST_ONLY_DAILY_ACCRUAL) {
        console.warn(`[PaymentService] INTEREST_ONLY loan ${loanId} had ${remainingPaymentAmount} remaining after principal reduction.`);
      }
    }

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

    if (loanUpdated) {
      this.loanService.updateLoan(loan);
    }

    return { success: true, paymentId: newPayment.id, message: 'Payment processed.' };
  }

  public getPaymentsForLoan(loanId: string): Payment[] { // Start of next method.
    const allPayments = this.getPaymentsFromStorage();
    return allPayments.filter(p => p.loanId === loanId);
  }

  public getSurplusForClient(clientId: string): number {
    const surpluses = this.getClientSurplusesFromStorage();
    const clientSurplus = surpluses.find(s => s.clientId === clientId);
    // Address TS18048: 'clientSurplus' is possibly 'undefined'
    return clientSurplus ? clientSurplus.surplusAmount : 0;
  }

  // Method to apply surplus to a new loan for a client (Conceptual - can be added later)
  // public applySurplusToLoan(clientId: string, loanToApplyToId: string): boolean { ... }

  public getTotalPaymentsReceived(startDate?: Date, endDate?: Date): number {
    const payments = this.getPaymentsFromStorage();
    
    if (startDate && endDate) {
      const inclusiveEndDate = new Date(endDate);
      inclusiveEndDate.setHours(23, 59, 59, 999); // Make endDate inclusive
      
      return payments
        .filter(payment => {
          const paymentDate = new Date(payment.paymentDate);
          return paymentDate >= startDate && paymentDate <= inclusiveEndDate;
        })
        .reduce((total, payment) => total + payment.amountPaid, 0);
    } else if (startDate) {
      return payments
        .filter(payment => new Date(payment.paymentDate) >= startDate)
        .reduce((total, payment) => total + payment.amountPaid, 0);
    } else if (endDate) {
      const inclusiveEndDate = new Date(endDate);
      inclusiveEndDate.setHours(23, 59, 59, 999);
      return payments
        .filter(payment => new Date(payment.paymentDate) <= inclusiveEndDate)
        .reduce((total, payment) => total + payment.amountPaid, 0);
    }
    
    // If no dates provided, return total of all payments
    return payments.reduce((total, payment) => total + payment.amountPaid, 0);
  }
}
