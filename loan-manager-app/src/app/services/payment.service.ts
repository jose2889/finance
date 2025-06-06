import { Injectable } from '@angular/core';
import { LocalStorageService } from './local-storage.service';
import { LoanService } from './loan.service'; // To get/update loan data
import { ClientService } from './client.service'; // To get client data if needed for surplus context
import { Loan, Installment, InstallmentStatus, ClientSurplus, Client, LoanType } from '../models'; // Import LoanType

interface Payment {
  id: string;
  loanId: string;
  amount: number;
  paymentDate: Date;
  notes?: string;
  appliedToInstallments: { installmentNumber: number; amountApplied: number }[];
  excessAmount: number;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private readonly STORAGE_KEY = 'payments';
  private readonly CLIENT_SURPLUS_KEY = 'clientSurpluses';
  private payments: Payment[] = [];

  constructor(
    private localStorageService: LocalStorageService,
    private loanService: LoanService,
    private clientService: ClientService // Added ClientService
  ) {
    this.payments = this.getPaymentsFromStorage();
  }

  private getPaymentsFromStorage(): Payment[] {
    const payments = localStorage.getItem(this.STORAGE_KEY);
    if (!payments) return [];
    
    try {
      const parsedPayments = JSON.parse(payments) as Payment[];
      return parsedPayments.map(payment => ({
        ...payment,
        paymentDate: new Date(payment.paymentDate)
      }));
    } catch (error) {
      console.error('Error parsing payments from storage:', error);
      return [];
    }
  }

  private savePaymentsToStorage(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.payments));
  }

  private getClientSurplusesFromStorage(): ClientSurplus[] {
    const surpluses = this.localStorageService.getItem<ClientSurplus[]>(this.CLIENT_SURPLUS_KEY) || [];
    return surpluses.map(s => ({ ...s, lastUpdated: new Date(s.lastUpdated) }));
  }

  private saveClientSurplusesToStorage(surpluses: ClientSurplus[]): void {
    this.localStorageService.setItem(this.CLIENT_SURPLUS_KEY, surpluses);
  }

  addPayment(loanId: string, amount: number, paymentDate: Date, notes?: string): Payment {
    const loan = this.loanService.getLoanById(loanId);
    if (!loan) {
      throw new Error('Préstamo no encontrado');
    }

    // Obtener cuotas pendientes y vencidas ordenadas por fecha
    const pendingAndOverdueInstallments = loan.installments
      .filter(inst => inst.status === InstallmentStatus.Pending || inst.status === InstallmentStatus.Overdue)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    let remainingPaymentAmount = amount;
    const appliedToInstallments: { installmentNumber: number; amountApplied: number }[] = [];
    let excessAmount = 0;

    // Aplicar el pago a las cuotas pendientes y vencidas
    for (const installment of pendingAndOverdueInstallments) {
      if (remainingPaymentAmount <= 0) break;

      const pendingAmount = installment.amount - (installment.paidAmount || 0);
      const amountToApply = Math.min(remainingPaymentAmount, pendingAmount);
      
      installment.paidAmount = (installment.paidAmount || 0) + amountToApply;
      remainingPaymentAmount -= amountToApply;

      if (installment.paidAmount >= installment.amount) {
        installment.status = InstallmentStatus.Paid;
      }

      appliedToInstallments.push({
        installmentNumber: installment.installmentNumber,
        amountApplied: amountToApply
      });
    }

    // Si queda un excedente, aplicarlo al saldo capital
    if (remainingPaymentAmount > 0) {
      excessAmount = remainingPaymentAmount;
      loan.currentBalance = Math.max(0, loan.currentBalance - excessAmount);
      
      // Actualizar el saldo capital en todas las cuotas pendientes
      loan.installments
        .filter(inst => inst.status === InstallmentStatus.Pending)
        .forEach(inst => {
          inst.remainingBalance = loan.currentBalance;
          // Recalcular el monto de interés basado en el nuevo saldo
          inst.amount = this.loanService.calculateAccruedInterestForOneMonth(
            loan.currentBalance,
            loan.interestRate
          );
        });
    }

    const payment: Payment = {
      id: crypto.randomUUID(),
      loanId,
      amount,
      paymentDate,
      notes,
      appliedToInstallments,
      excessAmount
    };

    this.payments.push(payment);
    this.savePaymentsToStorage();
    
    // Actualizar el préstamo con las cuotas modificadas
    this.loanService.updateLoan(loan);

    return payment;
  }

  getPaymentsByLoanId(loanId: string): Payment[] {
    return this.payments.filter(payment => payment.loanId === loanId);
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

    return filteredPayments.reduce((total, payment) => total + payment.amount, 0);
  }
}
