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
      // let interestPaidThisTransaction = 0; // Not strictly needed for logic if not reported

      // 1. Pay Accrued Interest (targeting oldest pending interest installment)
      // Ensure installments are sorted by due date or number
      const sortedInstallments = [...loan.installments].sort((a, b) => a.installmentNumber - b.installmentNumber);
      const firstPendingInstallment = sortedInstallments.find(inst => inst.status === InstallmentStatus.Pending || inst.status === InstallmentStatus.Overdue);

      if (firstPendingInstallment) {
        const interestDueForThisInstallment = firstPendingInstallment.amount - (firstPendingInstallment.paidAmount || 0);
        const amountToApplyToInterest = Math.min(remainingPaymentAmount, interestDueForThisInstallment);

        if (amountToApplyToInterest > 0) {
          firstPendingInstallment.paidAmount = (firstPendingInstallment.paidAmount || 0) + amountToApplyToInterest;
          // interestPaidThisTransaction += amountToApplyToInterest;
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
          // 'notes' field was removed as it's not part of the
          // 'appliedToInstallments' item type in Payment model.
          // Main payment notes can be used for this.
        });
        remainingPaymentAmount = 0; // Payment fully exhausted
      }

      // 3. Regenerate/Update Future Installments (if principal was reduced)
      if (loanPrincipalReduced) {
        // loan.interestRate here is the monthly rate for this loan type
        const monthlyInterestRate = loan.interestRate;

        for (const inst of loan.installments) {
          // Update all pending installments based on new loan.loanAmount (principal)
          // Or only those after the current payment date / firstPendingInstallment.dueDate
          // For simplicity, let's update all pending ones.
          if (inst.status === InstallmentStatus.Pending || (inst === firstPendingInstallment && inst.status !== InstallmentStatus.Paid)) {
            // If firstPendingInstallment was targeted and not fully paid, it might also need recalc if that's the rule.
            // However, typically, its original interest amount would stand, and only future ones recalc.
            // Let's assume only installments strictly after the 'firstPendingInstallment' (if it was paid) or all pending ones if principal reduction happened without touching an installment.
            // For now, regenerate all pending installments if principal changed.
            if (inst.status === InstallmentStatus.Pending) { // Only regenerate pending ones not yet touched by this payment
                const newEstimatedInterest = this.loanService.calculateAccruedInterestForOneMonth(loan.loanAmount, monthlyInterestRate);
                inst.amount = newEstimatedInterest;
                inst.interest = newEstimatedInterest;
                inst.principal = 0;
                inst.remainingBalance = loan.loanAmount;
                inst.paidAmount = 0; // Reset paid amount as the installment amount itself changed
                // inst.status remains Pending
            }
          }
        }
        // loanUpdated is already true
      }
      // End of INTEREST_ONLY_DAILY_ACCRUAL logic block

    } else {
      // Existing AMORTIZED loan logic
      // Note: 'remainingPaymentAmount' and 'appliedToInstallments' are now named
      // 'remainingPaymentAmount' and 'appliedToInstallmentsForPaymentRecord' respectively.
      // The original logic used 'appliedToInstallments', so we'll map back or use the new name.
      // For consistency, let's ensure the variable names match inside this block or map them.
      // The original code's variable names are fine to reuse here, shadowed by the outer scope.
      // Let's use the new 'appliedToInstallmentsForPaymentRecord' for consistency with the new block.

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

        appliedToInstallmentsForPaymentRecord.push({
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

    // Handle surplus if any (This logic is now common to both loan types)
    // For AMORTIZED loans (since this is in the 'else' block for non-INTEREST_ONLY_DAILY_ACCRUAL)
    if (remainingPaymentAmount > 0) {
      // Surplus goes to client surplus account.
      // For INTEREST_ONLY, surplus was already applied to principal.
      // If remainingPaymentAmount > 0 for INTEREST_ONLY, it means an overpayment beyond principal, which is an edge case not handled yet (e.g. negative loan.loanAmount).
      // For now, only apply to client surplus for AMORTIZED.
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
    // Closing brace for the AMORTIZED loan 'if (remainingPaymentAmount > 0)' block is implicitly above.
    // The 'else' block for AMORTIZED loans (started on line 140) closes here.
    } // This closes the 'else' block for AMORTIZED loan logic.

    // Common logic for saving payment record, loan updates, and returning success,
    // now correctly outside the loan type specific if/else.

    // Save the payment record
    const newPayment: Payment = {
      id: crypto.randomUUID(),
      loanId,
      clientId: loan.clientId,
      paymentDate,
      amountPaid: paymentAmount, // Original total payment amount
      appliedToInstallments: appliedToInstallmentsForPaymentRecord, // Use the consistently named variable
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
    return { success: true, paymentId: newPayment.id, message: 'Payment processed.' }; // Final return for addPayment
} // End of addPayment method. MUST be on its own line.

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
