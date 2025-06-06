import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // DatePipe for formatting
import { RouterModule, Router } from '@angular/router';

import { LoanService } from '../../../services/loan.service';
import { ClientService } from '../../../services/client.service';
import { Loan, Client, LoanType } from '../../../models';

export interface InterestOnlyLoanDisplay extends Loan {
  clientName?: string;
}

@Component({
  selector: 'app-interest-only-loan-list',
  standalone: true,
  imports: [CommonModule, RouterModule], // DatePipe for formatting in template if needed, or use component methods
  templateUrl: './interest-only-loan-list.component.html',
  styleUrls: ['./interest-only-loan-list.component.css']
})
export class InterestOnlyLoanListComponent implements OnInit {
  interestOnlyLoans: InterestOnlyLoanDisplay[] = [];

  constructor(
    private loanService: LoanService,
    private clientService: ClientService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadInterestOnlyLoans();
  }

  loadInterestOnlyLoans(): void {
    const allLoans = this.loanService.getLoans(); // Assuming getLoans() can be called without params to get all
    const clients = this.clientService.getClients();

    const clientMap = new Map<string, string>();
    clients.forEach(client => clientMap.set(client.id, `${client.firstName} ${client.lastName}`));

    this.interestOnlyLoans = allLoans
      .filter(loan => loan.loanType === LoanType.INTEREST_ONLY_DAILY_ACCRUAL)
      .map(loan => ({
        ...loan,
        clientName: clientMap.get(loan.clientId) || 'Cliente Desconocido'
      }));
  }

  navigateToAddLoan(): void {
    this.router.navigate(['/interest-only-loans/new']);
  }

  viewLoanDetails(loanId: string): void {
    // Route for interest-only loan details will need to be defined.
    // For now, let's assume a path like '/interest-only-loans/:id/details'
    // Or, it could reuse the existing installment schedule view if that's made generic enough.
    // The prompt mentions '/interest-only-loans/:loanId/details'
    this.router.navigate(['/interest-only-loans', loanId, 'details']);
    // Placeholder: A specific details component for interest-only loans might be needed.
    // For now, this navigation implies a route for it.
    // Or, could navigate to a generic loan detail component that handles different loan types.
    // As a quick solution if the existing schedule view is suitable:
    // this.router.navigate(['/loans', loanId, 'installments']);
  }

  formatCurrency(amount: number): string {
    if (amount === null || amount === undefined) return '';
    return amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    // Basic date format, can be customized further e.g. using DatePipe or toLocaleDateString options
    return dateObj.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatInterestRate(rate: number): string {
    // Assuming 'rate' is stored as a decimal (e.g., 0.02 for 2% monthly)
    // and needs to be displayed as a percentage.
    return `${(rate * 100).toFixed(2)}% mensual`;
  }
}
