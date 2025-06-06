import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { LoanService } from '../../../services/loan.service';
import { ClientService } from '../../../services/client.service';
import { Loan, Client, Installment, LoanType, InstallmentStatus } from '../../../models';

// Import standalone dependencies
import { PaymentListComponent } from '../../../loans/components/payment-list/payment-list.component';
import { TranslateInstallmentStatusPipe } from '../../../pipes/translate-installment-status.pipe';

@Component({
  selector: 'app-interest-only-loan-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PaymentListComponent,       // Standalone component
    TranslateInstallmentStatusPipe, // Standalone pipe
    DatePipe                  // Pipe for formatting dates in template if needed directly
  ],
  templateUrl: './interest-only-loan-detail.component.html',
  styleUrls: ['./interest-only-loan-detail.component.scss']
})
export class InterestOnlyLoanDetailComponent implements OnInit {
  loan: Loan | undefined;
  client: Client | undefined;
  loanId: string | null = null;
  nextExpectedInterestPaymentAmount: number = 0;
  errorMessage: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private loanService: LoanService,
    private clientService: ClientService
  ) { }

  ngOnInit(): void {
    this.loanId = this.route.snapshot.paramMap.get('loanId');
    if (this.loanId) {
      const fetchedLoan = this.loanService.getLoanById(this.loanId);
      if (fetchedLoan && fetchedLoan.loanType === LoanType.INTEREST_ONLY_DAILY_ACCRUAL) {
        this.loan = fetchedLoan;
        this.client = this.clientService.getClientById(this.loan.clientId);
        this.calculateNextExpectedInterest();
      } else if (fetchedLoan) {
        this.errorMessage = 'Este préstamo no es del tipo "Interés Simple con Devengo Diario".';
        console.error('Error: Loan type is not INTEREST_ONLY_DAILY_ACCRUAL. Loan ID:', this.loanId);
      } else {
        this.errorMessage = 'Préstamo no encontrado.';
        console.error('Error: Loan not found. Loan ID:', this.loanId);
        // Optionally navigate away: this.router.navigate(['/interest-only-loans']);
      }
    } else {
      this.errorMessage = 'ID de préstamo no proporcionado en la ruta.';
      console.error('Error: No loanId in route.');
      // Optionally navigate away: this.router.navigate(['/interest-only-loans']);
    }
  }

  calculateNextExpectedInterest(): void {
    if (this.loan && this.loan.loanAmount > 0) {
      // Find the first pending installment from the schedule
      const firstPending = this.loan.installments
        .filter(inst => inst.status === InstallmentStatus.Pending)
        .sort((a,b) => a.installmentNumber - b.installmentNumber)[0];

      if (firstPending) {
        // If there's a pending installment, its amount is the next expected interest
        // (assuming it was correctly calculated/recalculated after any principal paydown)
        this.nextExpectedInterestPaymentAmount = firstPending.amount;
      } else if (this.loan.installments.every(inst => inst.status === InstallmentStatus.Paid) && this.loan.loanAmount > 0) {
        // All scheduled installments paid, but principal remains. Calculate one month's interest on current principal.
        // This assumes loan.interestRate stores the monthly rate for this loan type.
        this.nextExpectedInterestPaymentAmount = this.loanService.calculateAccruedInterestForOneMonth(this.loan.loanAmount, this.loan.interestRate);
      } else {
        // No pending installments and principal might be zero or loan ended.
        this.nextExpectedInterestPaymentAmount = 0;
      }
    } else {
      this.nextExpectedInterestPaymentAmount = 0;
    }
  }

  navigateToAddPayment(): void {
    if (this.loanId) {
      // Using a specific route for adding payments to interest-only loans, if different from standard loans.
      // Or, if PaymentFormComponent can handle both, it could be a shared route.
      // For now, assuming a distinct path or a smart form.
      this.router.navigate(['/interest-only-loans', this.loanId, 'add-payment']);
    } else {
      console.error('Error: loanId no está disponible.');
    }
  }

  goBack(): void {
    this.router.navigate(['/interest-only-loans']); // Navigate back to the list of interest-only loans
  }

  formatCurrency(amount: number | undefined | null): string {
    if (amount === null || amount === undefined) return 'N/A';
    return amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatInterestRate(rate: number | undefined): string {
    if (rate === undefined) return 'N/A';
    // Assuming 'rate' is stored as a decimal (e.g., 0.02 for 2% monthly)
    return `${(rate * 100).toFixed(2)}% mensual`;
  }
}
