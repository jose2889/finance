import { Injectable } from '@angular/core';
import { Loan, Installment, InstallmentStatus, LoanType } from '../models'; // Adjust path, Import LoanType
import { LocalStorageService } from './local-storage.service';

// Interface for creating standard amortized loans
interface AmortizedLoanCreationData {
  clientId: string;
  loanAmount: number;
  interestRate: number; // Decimal form, e.g., 0.05 for 5% annual
  termMonths: number;   // Required for amortized loans
  startDate: Date | string;
  purpose?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LoanService {
  private readonly STORAGE_KEY = 'loans';

  constructor(private storage: LocalStorageService) { }

  private getLoansFromStorage(): Loan[] {
    const loans = this.storage.getItem(this.STORAGE_KEY);
    if (!loans || typeof loans !== 'string') return [];
    
    try {
      const parsedLoans = JSON.parse(loans) as Loan[];
      if (!Array.isArray(parsedLoans)) return [];

      return parsedLoans.map((loan: Loan) => ({
        ...loan,
        startDate: new Date(loan.startDate),
        installments: loan.installments.map((inst: Installment) => ({
          ...inst,
          dueDate: new Date(inst.dueDate)
        }))
      }));
    } catch (error) {
      console.error('Error parsing loans from storage:', error);
      return [];
    }
  }

  private saveLoansToStorage(loans: Loan[]): void {
    console.log('[LoanService] saveLoansToStorage called.');
    console.log('[LoanService] Saving loans (structure of first loan if exists):', loans.length > 0 ? JSON.parse(JSON.stringify(loans[0])) : 'empty array');
    console.log('[LoanService] Total loans to save:', loans.length);
    this.storage.setItem(this.STORAGE_KEY, JSON.stringify(loans));
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

  addLoan(loanData: AmortizedLoanCreationData): Loan {
    const loans = this.getLoansFromStorage();
    const newLoan: Loan = {
      ...loanData,
      id: crypto.randomUUID(),
      loanType: LoanType.AMORTIZED,
      startDate: new Date(loanData.startDate),
      installments: this.calculateInstallments(
        loanData.loanAmount,
        loanData.interestRate,
        loanData.termMonths,
        new Date(loanData.startDate)
      )
    };

    loans.push(newLoan);
    this.saveLoansToStorage(loans);
    return newLoan;
  }

  updateLoan(updatedLoan: Loan): boolean {
    const loans = this.getLoansFromStorage();
    const index = loans.findIndex(loan => loan.id === updatedLoan.id);
    
    if (index === -1) {
      return false;
    }

    // Store the original loan for comparison
    const originalLoan = loans[index];

    if (updatedLoan.loanType === LoanType.AMORTIZED) {
      // Check if key parameters changed
      if (
        originalLoan.loanAmount !== updatedLoan.loanAmount ||
        originalLoan.interestRate !== updatedLoan.interestRate ||
        (updatedLoan.termMonths !== undefined && originalLoan.termMonths !== updatedLoan.termMonths) ||
        new Date(originalLoan.startDate).getTime() !== new Date(updatedLoan.startDate).getTime()
      ) {
        // Ensure termMonths is valid for AMORTIZED loan recalculation
        if (typeof updatedLoan.termMonths === 'number' && updatedLoan.termMonths > 0) {
          updatedLoan.installments = this.calculateInstallments(
            updatedLoan.loanAmount,
            updatedLoan.interestRate,
            updatedLoan.termMonths,
            new Date(updatedLoan.startDate)
          );
        } else {
          console.error('Cannot update amortized loan with invalid termMonths');
          return false;
        }
      }
    } else if (updatedLoan.loanType === LoanType.INTEREST_ONLY_DAILY_ACCRUAL) {
      if (originalLoan.loanAmount !== updatedLoan.loanAmount) {
        updatedLoan.installments = [];
      }
    }

    loans[index] = updatedLoan;
    this.saveLoansToStorage(loans);
    return true;
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
      if (i === termMonths && remainingBalance !== 0 && Math.abs(remainingBalance) < 1) {
        monthlyPayment += remainingBalance;
        remainingBalance = 0;
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

  public getProjectedInterestInstallments(loan: Loan): Installment[] {
    if (loan.loanType !== LoanType.INTEREST_ONLY_DAILY_ACCRUAL) {
      console.warn(`getProjectedInterestInstallments called for non-interest-only loan: ${loan.id}`);
      return [];
    }

    const projectedInstallments: Installment[] = [];
    const currentDate = new Date();
    // Do not include time in currentDate for month/year comparisons to avoid off-by-one issues with dueDate.
    currentDate.setHours(0, 0, 0, 0);

    const loanStartDate = new Date(loan.startDate);
    loanStartDate.setHours(0, 0, 0, 0); // Normalize start date as well

    // Calculate how many full months have passed since the loan started.
    // If a loan starts Jan 15th, and today is Feb 14th, 0 full months for due dates (1st due date is Feb 15th).
    // If today is Feb 15th, 1 full month for due dates (1st due date is Feb 15th).
    // If today is Mar 14th, 1 full month for due dates (1st due date Feb 15th is past, 2nd Mar 15th is current).

    let monthsPassed = (currentDate.getFullYear() - loanStartDate.getFullYear()) * 12;
    monthsPassed += currentDate.getMonth() - loanStartDate.getMonth();
    // If the current day of the month is less than the start day of the month,
    // it means the full month period for the current month hasn't completed yet relative to the start day.
    // However, the due date is typically loanStartDate.getDate() of each following month.
    // Example: Loan starts Jan 15.
    // Due Feb 15, Mar 15, etc.
    // If today is Feb 10, monthsPassed = 1. We should show Feb 15 (Pending).
    // If today is Feb 15, monthsPassed = 1. We should show Feb 15 (Pending/Overdue).
    // If today is Feb 16, monthsPassed = 1. We should show Feb 15 (Overdue), Mar 15 (Pending).

    const loanStartDay = loanStartDate.getDate();

    // Iterate for each period that has a due date up to the current month, or slightly beyond.
    // Let's project for monthsPassed + 1 (to show current/next) and potentially one more.
    // Loop for a fixed number of past/current/near-future installments, e.g., monthsPassed + 2.
    // Max 12 projections for sanity.
    const maxProjections = Math.min(monthsPassed + 2, 12);


    for (let periodIndex = 0; periodIndex <= monthsPassed +1 ; periodIndex++) { // Iterate up to one month beyond "monthsPassed"
      if (projectedInstallments.length >= 12 && periodIndex > 0) break; // Limit to 12 projections total

      const installmentNumber = periodIndex + 1;
      const dueDate = new Date(loanStartDate);
      dueDate.setMonth(loanStartDate.getMonth() + installmentNumber);
      dueDate.setHours(0,0,0,0); // Normalize due date

      // If loan started late in month (e.g. 31st) and next month is shorter, date can roll over.
      // Correct if dueDate's month rolled over beyond the intended month.
      // Example: Loan start Jan 31. dueDate for Feb should be Feb 28/29, not Mar 2/3.
      // A simple way to keep due day consistent is to set day to loanStartDay,
      // but this needs careful handling if loanStartDay > days in current due month.
      // For now, direct month addition is used. Standard new Date().setMonth() handles rollover.

      const interestAmount = this.calculateAccruedInterestForOneMonth(loan.loanAmount, loan.interestRate);

      let status = InstallmentStatus.Pending;
      if (dueDate < currentDate) {
        status = InstallmentStatus.Overdue;
      } else if (dueDate.getFullYear() === currentDate.getFullYear() &&
                 dueDate.getMonth() === currentDate.getMonth() &&
                 dueDate.getDate() <= currentDate.getDate()) {
        // If due date is today or earlier in the current month (but not strictly < currentDate due to time normalization)
        // This can be tricky. A simpler rule: if dueDate is not in the future, it's potentially Overdue.
        // Let's refine: if dueDate is today or in the past, it's Overdue. Otherwise, Pending.
        // The previous check `dueDate < currentDate` already covers past days.
        // If dueDate is today, it's effectively 'due now', so Overdue if not paid. For projection, let's call it Pending.
        // The current logic: if dueDate is strictly before today -> Overdue. Otherwise -> Pending.
        // This means a due date of "today" will show as Pending. This is acceptable for projection.
      }


      projectedInstallments.push({
        installmentNumber: installmentNumber,
        dueDate: dueDate,
        amount: interestAmount,
        principal: 0,
        interest: interestAmount,
        remainingBalance: loan.loanAmount,
        status: status,
        paidAmount: 0 // This is a projection, so paidAmount is assumed 0.
      });
    }

    // Ensure there's always at least one future/current pending installment if the loop didn't add one far enough.
    // This is somewhat covered by monthsPassed + 1, but let's double check.
    const lastProjectedInstallment = projectedInstallments[projectedInstallments.length -1];
    if (projectedInstallments.length > 0 && lastProjectedInstallment.status === InstallmentStatus.Overdue && projectedInstallments.length < 12) {
        const nextInstallmentNumber = lastProjectedInstallment.installmentNumber + 1;
        const nextDueDate = new Date(loanStartDate);
        nextDueDate.setMonth(loanStartDate.getMonth() + nextInstallmentNumber);
        nextDueDate.setHours(0,0,0,0);
        const nextInterestAmount = this.calculateAccruedInterestForOneMonth(loan.loanAmount, loan.interestRate);
        projectedInstallments.push({
            installmentNumber: nextInstallmentNumber,
            dueDate: nextDueDate,
            amount: nextInterestAmount,
            principal: 0,
            interest: nextInterestAmount,
            remainingBalance: loan.loanAmount,
            status: InstallmentStatus.Pending,
            paidAmount: 0
        });
    }

    if (projectedInstallments.length === 0 && loan.loanAmount > 0) { // Loan just started, project first interest payment
        const firstDueDate = new Date(loanStartDate);
        firstDueDate.setMonth(loanStartDate.getMonth() + 1);
        firstDueDate.setHours(0,0,0,0);
        const firstInterestAmount = this.calculateAccruedInterestForOneMonth(loan.loanAmount, loan.interestRate);
         projectedInstallments.push({
            installmentNumber: 1,
            dueDate: firstDueDate,
            amount: firstInterestAmount,
            principal: 0,
            interest: firstInterestAmount,
            remainingBalance: loan.loanAmount,
            status: InstallmentStatus.Pending,
            paidAmount: 0
        });
    }

    return projectedInstallments;
  }

  public addInterestOnlyDailyAccrualLoan(
    loanData: Omit<Loan, 'id' | 'installments' | 'loanType' | 'interestRate' | 'termMonths'> &
              { monthlyInterestRate: number; startDate: string | Date; clientId: string; loanAmount: number; purpose?: string }
  ): Loan {
    const loans = this.getLoansFromStorage();

    // Ensure startDate is a Date object
    const processedStartDate = typeof loanData.startDate === 'string' ? new Date(loanData.startDate) : loanData.startDate;

    const newLoan: Loan = {
      id: crypto.randomUUID(),
      clientId: loanData.clientId,
      loanAmount: loanData.loanAmount,
      interestRate: loanData.monthlyInterestRate, // Storing monthly rate directly
      // termMonths is now optional and not set here for interest-only loans.
      startDate: processedStartDate,
      loanType: LoanType.INTEREST_ONLY_DAILY_ACCRUAL,
      purpose: loanData.purpose,
      installments: [] // Installments will be dynamically projected, not stored as a fixed schedule initially.
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
