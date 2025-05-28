import { Injectable } from '@angular/core';
import { Loan, Installment, InstallmentStatus } from '../models'; // Adjust path
import { LocalStorageService } from './local-storage.service';

@Injectable({
  providedIn: 'root'
})
export class LoanService {
  private readonly storageKey = 'loans';

  constructor(private localStorageService: LocalStorageService) { }

  private getLoansFromStorage(): Loan[] {
    // Dates are stored as strings in JSON, so we need to parse them back to Date objects
    const loans = this.localStorageService.getItem<Loan[]>(this.storageKey) || [];
    return loans.map(loan => ({
      ...loan,
      startDate: new Date(loan.startDate),
      installments: loan.installments.map(inst => ({
        ...inst,
        dueDate: new Date(inst.dueDate)
      }))
    }));
  }

  private saveLoansToStorage(loans: Loan[]): void {
    this.localStorageService.setItem(this.storageKey, loans);
  }

  getLoans(): Loan[] {
    return this.getLoansFromStorage();
  }

  getLoanById(id: string): Loan | undefined {
    const loans = this.getLoansFromStorage();
    return loans.find(loan => loan.id === id);
  }

  getLoansByClientId(clientId: string): Loan[] {
    const loans = this.getLoansFromStorage();
    return loans.filter(loan => loan.clientId === clientId);
  }

  addLoan(loanData: Omit<Loan, 'id' | 'installments'>): Loan {
    const loans = this.getLoansFromStorage();
    const newLoan: Loan = {
      ...loanData,
      id: crypto.randomUUID(),
      installments: this.calculateInstallments(
        loanData.loanAmount,
        loanData.interestRate,
        loanData.termMonths,
        new Date(loanData.startDate) // Ensure startDate is a Date object
      )
    };
    loans.push(newLoan);
    this.saveLoansToStorage(loans);
    return newLoan;
  }

  updateLoan(updatedLoan: Loan): boolean {
    let loans = this.getLoansFromStorage();
    const index = loans.findIndex(loan => loan.id === updatedLoan.id);
    if (index > -1) {
      // Recalculate installments if key parameters change
      if (
        loans[index].loanAmount !== updatedLoan.loanAmount ||
        loans[index].interestRate !== updatedLoan.interestRate ||
        loans[index].termMonths !== updatedLoan.termMonths ||
        new Date(loans[index].startDate).getTime() !== new Date(updatedLoan.startDate).getTime()
      ) {
        updatedLoan.installments = this.calculateInstallments(
          updatedLoan.loanAmount,
          updatedLoan.interestRate,
          updatedLoan.termMonths,
          new Date(updatedLoan.startDate)
        );
      }
      loans[index] = updatedLoan;
      this.saveLoansToStorage(loans);
      return true;
    }
    return false;
  }

  deleteLoan(id: string): boolean {
    let loans = this.getLoansFromStorage();
    const initialLength = loans.length;
    loans = loans.filter(loan => loan.id !== id);
    if (loans.length < initialLength) {
      this.saveLoansToStorage(loans);
      return true;
    }
    return false;
  }

  private calculateInstallments(
    principal: number,
    annualInterestRate: number,
    termMonths: number,
    startDate: Date
  ): Installment[] {
    const installments: Installment[] = [];
    if (termMonths <= 0) return installments;

    const monthlyInterestRate = annualInterestRate / 12;
    let remainingBalance = principal;

    // Calculate monthly payment (EMI) using the formula:
    // EMI = P * r * (1+r)^n / ((1+r)^n - 1)
    // Where P = Principal, r = monthly interest rate, n = term in months
    let monthlyPayment: number;
    if (monthlyInterestRate > 0) {
       monthlyPayment =
       principal *
       monthlyInterestRate *
       Math.pow(1 + monthlyInterestRate, termMonths) /
       (Math.pow(1 + monthlyInterestRate, termMonths) - 1);
    } else {
       // If interest rate is 0, monthly payment is just principal / term
       monthlyPayment = principal / termMonths;
    }


    for (let i = 1; i <= termMonths; i++) {
      const interestPayment = monthlyInterestRate > 0 ? remainingBalance * monthlyInterestRate : 0;
      const principalPayment = monthlyPayment - interestPayment;
      remainingBalance -= principalPayment;

      // Handle potential floating point inaccuracies for the last payment
      if (i === termMonths) {
       if (remainingBalance !== 0 && remainingBalance < 1 && remainingBalance > -1) { // Small discrepancy
           monthlyPayment += remainingBalance; // Adjust last payment
           remainingBalance = 0;
       }
      }


      const dueDate = new Date(startDate);
      dueDate.setMonth(startDate.getMonth() + i);

      installments.push({
        installmentNumber: i,
        dueDate: dueDate,
        amount: parseFloat(monthlyPayment.toFixed(2)),
        principal: parseFloat(principalPayment.toFixed(2)),
        interest: parseFloat(interestPayment.toFixed(2)),
        remainingBalance: parseFloat(remainingBalance.toFixed(2)),
        status: InstallmentStatus.Pending
      });
    }
    return installments;
  }

   updateInstallmentStatus(loanId: string, installmentNumber: number, status: InstallmentStatus): boolean {
       const loans = this.getLoansFromStorage();
       const loan = loans.find(l => l.id === loanId);
       if (loan) {
           const installment = loan.installments.find(i => i.installmentNumber === installmentNumber);
           if (installment) {
               installment.status = status;
               this.saveLoansToStorage(loans);
               return true;
           }
       }
       return false;
   }
}
