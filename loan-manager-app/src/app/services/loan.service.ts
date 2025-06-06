import { Injectable } from '@angular/core';
import { Loan, Installment, InstallmentStatus, LoanType } from '../models'; // Adjust path, Import LoanType
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

  // PaymentService is NOT injected here to avoid circular dependency for now.
  // The payment check logic will be handled externally or in a future refactor.

  getLoans(startDate?: Date, endDate?: Date): Loan[] {
    let loans = this.getLoansFromStorage();

    if (startDate && endDate) {
      const inclusiveEndDate = new Date(endDate);
      inclusiveEndDate.setHours(23, 59, 59, 999); // Make endDate inclusive

      loans = loans.filter(loan => {
        const loanStartDate = new Date(loan.startDate);
        return loanStartDate >= startDate && loanStartDate <= inclusiveEndDate;
      });
    } else if (startDate) {
      loans = loans.filter(loan => new Date(loan.startDate) >= startDate);
    } else if (endDate) {
      const inclusiveEndDate = new Date(endDate);
      inclusiveEndDate.setHours(23, 59, 59, 999);
      loans = loans.filter(loan => new Date(loan.startDate) <= inclusiveEndDate);
    }
    // If neither startDate nor endDate is provided, all loans are returned.
    return loans;
  }

  getLoanById(id: string): Loan | undefined {
    const loans = this.getLoansFromStorage();
    return loans.find(loan => loan.id === id);
  }

  getLoansByClientId(clientId: string): Loan[] {
    const loans = this.getLoansFromStorage();
    return loans.filter(loan => loan.clientId === clientId);
  }

  addLoan(loanData: Omit<Loan, 'id' | 'installments' | 'loanType'> & { loanType?: LoanType }): Loan { // Adjust parameter if loanType is passed, or handle as default
    const loans = this.getLoansFromStorage();
    const newLoan: Loan = {
      ...loanData,
      id: crypto.randomUUID(),
      loanType: loanData.loanType || LoanType.AMORTIZED, // Default to AMORTIZED if not provided
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
        status: InstallmentStatus.Pending,
        paidAmount: 0 // Initialize paidAmount
      });
    }
    return installments;
  }

// Removed updateInstallmentStatus method as per instructions

  // New methods for Interest-Only Daily Accrual Loans

  public calculateDailyInterestRate(monthlyInterestRate: number): number { // Made public
    if (monthlyInterestRate < 0) return 0; // Or throw error
    return monthlyInterestRate / 30; // Simplified: assumes 30 days per month
  }

  public calculateAccruedInterestForOneMonth(principal: number, monthlyInterestRate: number): number { // Made public
    if (principal < 0 || monthlyInterestRate < 0) return 0; // Or throw error
    const dailyRate = this.calculateDailyInterestRate(monthlyInterestRate);
    // Using 30 days for an estimated monthly interest. Actual daily accrual might vary.
    return parseFloat((principal * dailyRate * 30).toFixed(2));
  }

  private generateInitialInterestOnlyInstallmentSchedule(
    principal: number,
    monthlyInterestRate: number,
    termMonths: number,
    startDate: Date,
    // loanType: LoanType // loanType param might not be needed if method is specific
  ): Installment[] {
    const installments: Installment[] = [];
    if (termMonths <= 0) return installments;

    const estimatedMonthlyInterest = this.calculateAccruedInterestForOneMonth(principal, monthlyInterestRate);

    for (let i = 1; i <= termMonths; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(startDate.getMonth() + i);

      installments.push({
        installmentNumber: i,
        dueDate: dueDate,
        amount: estimatedMonthlyInterest,
        principal: 0, // Interest-only
        interest: estimatedMonthlyInterest,
        remainingBalance: principal, // Principal remains unchanged by these scheduled payments
        status: InstallmentStatus.Pending,
        paidAmount: 0,
      });
    }
    return installments;
  }

  public addInterestOnlyDailyAccrualLoan(
    loanData: Omit<Loan, 'id' | 'installments' | 'loanType' | 'interestRate'> &
              { monthlyInterestRate: number; startDate: string | Date; clientId: string; loanAmount: number; termMonths: number; purpose?: string }
  ): Loan {
    const loans = this.getLoansFromStorage();

    // Ensure startDate is a Date object
    const processedStartDate = typeof loanData.startDate === 'string' ? new Date(loanData.startDate) : loanData.startDate;

    const newLoan: Loan = {
      id: crypto.randomUUID(),
      clientId: loanData.clientId,
      loanAmount: loanData.loanAmount,
      interestRate: loanData.monthlyInterestRate, // Storing monthly rate directly
      termMonths: loanData.termMonths,
      startDate: processedStartDate,
      loanType: LoanType.INTEREST_ONLY_DAILY_ACCRUAL,
      purpose: loanData.purpose,
      installments: this.generateInitialInterestOnlyInstallmentSchedule(
        loanData.loanAmount, // principal for schedule generation
        loanData.monthlyInterestRate,
        loanData.termMonths,
        processedStartDate
        // LoanType.INTEREST_ONLY_DAILY_ACCRUAL // Not strictly needed by generateInitialInterestOnlyInstallmentSchedule
      ),
    };
    loans.push(newLoan);
    this.saveLoansToStorage(loans);
    return newLoan;
  }

  public deleteInterestOnlyLoan(loanId: string): { success: boolean; message?: string } {
    const loans = this.getLoansFromStorage();
    const loanToDelete = loans.find(loan => loan.id === loanId);

    if (!loanToDelete) {
      return { success: false, message: 'Préstamo no encontrado.' };
    }

    if (loanToDelete.loanType !== LoanType.INTEREST_ONLY_DAILY_ACCRUAL) {
      return { success: false, message: 'Este método solo puede eliminar préstamos de interés simple.' };
    }

    // Payment check is skipped for this subtask to avoid circular dependency.
    // This will be addressed later.

    const updatedLoans = loans.filter(loan => loan.id !== loanId);

    if (updatedLoans.length < loans.length) {
      this.saveLoansToStorage(updatedLoans);
      return { success: true, message: 'Préstamo de interés simple eliminado exitosamente.' };
    } else {
      // This case should ideally not be reached if find succeeded.
      return { success: false, message: 'Préstamo no encontrado o ya eliminado durante la operación de filtrado.' };
    }
  }
}
