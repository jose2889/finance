import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
    PaymentListComponent,
    TranslateInstallmentStatusPipe
  ],
  templateUrl: './interest-only-loan-detail.component.html',
  styleUrls: ['./interest-only-loan-detail.component.scss']
})
export class InterestOnlyLoanDetailComponent implements OnInit {
  loan: Loan | undefined;
  client: Client | undefined;
  loanId: string = '';
  errorMessage: string | null = null;
  overdueInterest: number = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private loanService: LoanService,
    private clientService: ClientService
  ) { }

  ngOnInit(): void {
    this.loanId = this.route.snapshot.paramMap.get('loanId') || '';
    if (this.loanId) {
      const fetchedLoan = this.loanService.getLoanById(this.loanId);
      if (fetchedLoan && fetchedLoan.loanType === LoanType.INTEREST_ONLY_DAILY_ACCRUAL) {
        this.loan = fetchedLoan;
        this.client = this.clientService.getClientById(this.loan.clientId);
        this.overdueInterest = this.loanService.getOverdueInterest(this.loan);
      } else if (fetchedLoan) {
        this.errorMessage = 'Este préstamo no es del tipo "Interés Simple con Devengo Diario".';
        console.error('Error: Loan type is not INTEREST_ONLY_DAILY_ACCRUAL. Loan ID:', this.loanId);
      } else {
        this.errorMessage = 'Préstamo no encontrado.';
        console.error('Error: Loan not found. Loan ID:', this.loanId);
      }
    } else {
      this.errorMessage = 'ID de préstamo no proporcionado en la ruta.';
      console.error('Error: No loanId in route.');
    }
  }

  navigateToAddPayment(): void {
    if (this.loanId) {
      this.router.navigate(['/interest-only-loans', this.loanId, 'add-payment']);
    } else {
      console.error('Error: loanId no está disponible.');
    }
  }

  goBack(): void {
    this.router.navigate(['/interest-only-loans']);
  }

  addPayment(): void {
    if (this.loanId) {
      this.router.navigate(['/loans', this.loanId, 'add-payment']);
    }
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
    return `${(rate * 100).toFixed(2)}% mensual`;
  }
}
