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
    console.log('[LoanService] getLoansFromStorage called.');
    // Attempt to get the raw string to see what's actually in localStorage before LocalStorageService parses it.
    // Note: LocalStorageService.getItem<T> already does JSON.parse.
    // To get the raw string, we might need a different method in LocalStorageService or use localStorage directly here for logging.
    // For now, let's assume LocalStorageService.getItem returns the parsed object or null.
    const loansFromStorage = this.localStorageService.getItem<Loan[]>(this.storageKey) || [];
    
    // Log what LocalStorageService returned (which should be an array of objects, possibly with string dates)
    console.log('[LoanService] Data from LocalStorageService (before date parsing):', JSON.parse(JSON.stringify(loansFromStorage)));

    if (!loansFromStorage || loansFromStorage.length === 0) {
      console.log('[LoanService] No loans found in storage or empty array after initial retrieval.');
      return [];
    }
    
    console.log('[LoanService] Mapping over loans to parse dates...');
    const parsedLoans = loansFromStorage.map((loan, index) => {
      console.log(`[LoanService] Processing loan index ${index} (ID: ${loan.id}) for date parsing (original from storage):`, JSON.parse(JSON.stringify(loan)));
      
      let parsedStartDate = new Date(loan.startDate);
      if (isNaN(parsedStartDate.getTime())) {
        console.error(`[LoanService] Loan index ${index} (ID: ${loan.id}) has an invalid startDate string: ${loan.startDate}. Resulted in Invalid Date.`);
        // parsedStartDate will remain an Invalid Date object
      }

      const parsedInstallments = loan.installments.map((inst, instIndex) => {
        let parsedDueDate = new Date(inst.dueDate);
        if (isNaN(parsedDueDate.getTime())) {
          console.error(`[LoanService] Loan index ${index} (ID: ${loan.id}), Installment index ${instIndex} (Number: ${inst.installmentNumber}) has an invalid dueDate string: ${inst.dueDate}. Resulted in Invalid Date.`);
          // parsedDueDate will remain an Invalid Date object
        }
        return {
          ...inst,
          dueDate: parsedDueDate
        };
      });

      const parsedLoan = {
        ...loan,
        startDate: parsedStartDate,
        installments: parsedInstallments
      };
      console.log(`[LoanService] Loan index ${index} (ID: ${loan.id}) after date parsing:`, JSON.parse(JSON.stringify(parsedLoan)));
      return parsedLoan;
    });
    console.log('[LoanService] Fully parsed loans:', JSON.parse(JSON.stringify(parsedLoans)));
    return parsedLoans;
  }

  private saveLoansToStorage(loans: Loan[]): void {
    console.log('[LoanService] saveLoansToStorage called.');
    console.log('[LoanService] Saving loans (structure of first loan if exists):', loans.length > 0 ? JSON.parse(JSON.stringify(loans[0])) : 'empty array');
    console.log('[LoanService] Total loans to save:', loans.length);
    this.localStorageService.setItem(this.storageKey, loans);
    console.log('[LoanService] Data supposedly saved by LocalStorageService.');
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
    console.log('[LoanService] updateInstallmentStatus called.');
    console.log('[LoanService] Initial params - loanId:', loanId, 'installmentNumber:', installmentNumber, 'newStatus:', status);

    // Input Validation
    if (!loanId || typeof loanId !== 'string' || loanId.trim() === '') {
      console.error('[LoanService] Invalid loanId provided:', loanId);
      return false;
    }
    if (installmentNumber == null || typeof installmentNumber !== 'number' || installmentNumber <= 0) { // Using == null to catch undefined too
      console.error('[LoanService] Invalid installmentNumber provided:', installmentNumber);
      return false;
    }
    if (!status || !Object.values(InstallmentStatus).includes(status)) {
      console.error('[LoanService] Invalid status provided:', status);
      return false;
    }

    const loans = this.getLoansFromStorage();
    const loan = loans.find(l => l.id === loanId);

    if (loan) {
      console.log('[LoanService] Loan found:', loan);
      const installment = loan.installments.find(i => i.installmentNumber === installmentNumber);
      if (installment) {
        console.log('[LoanService] Installment found:', installment);
        installment.status = status;
        console.log('[LoanService] Installment status updated. Saving loans...');
        this.saveLoansToStorage(loans);
        console.log('[LoanService] Loans saved.');
        return true;
      } else {
        console.error('[LoanService] Installment not found for number:', installmentNumber);
      }
    } else {
      console.error('[LoanService] Loan not found for id:', loanId);
    }
    return false;
  }
}
