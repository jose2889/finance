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
    amount: number,
    paymentDate: Date,
    notes?: string
  ): { success: boolean; paymentId?: string; message?: string } {
    try {
      const loan = this.loanService.getLoanById(loanId);
      if (!loan) {
        return { success: false, message: 'Préstamo no encontrado' };
      }

      const payment: Payment = {
        id: crypto.randomUUID(),
        loanId,
        clientId: loan.clientId,
        amountPaid: amount,
        paymentDate: paymentDate,
        notes: notes || '',
        appliedToInstallments: []
      };

      const payments = this.getPaymentsFromStorage();
      payments.push(payment);
      this.savePaymentsToStorage(payments);

      return { success: true, paymentId: payment.id };
    } catch (error) {
      console.error('Error adding payment:', error);
      return { success: false, message: 'Error al procesar el pago' };
    }
  }

  getPaymentsForLoan(loanId: string): Payment[] {
    const payments = this.getPaymentsFromStorage();
    return payments.filter(payment => payment.loanId === loanId);
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
    let filteredPayments = payments;

    if (startDate || endDate) {
      filteredPayments = payments.filter(payment => {
        const paymentDate = new Date(payment.paymentDate);
        if (startDate && endDate) {
          return paymentDate >= startDate && paymentDate <= endDate;
        } else if (startDate) {
          return paymentDate >= startDate;
        } else if (endDate) {
          return paymentDate <= endDate;
        }
        return true;
      });
    }

    return filteredPayments.reduce((total, payment) => total + payment.amountPaid, 0);
  }
}
