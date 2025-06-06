import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // DatePipe for formatting
import { RouterModule, Router } from '@angular/router';

import { LoanService } from '../../../services/loan.service';
import { ClientService } from '../../../services/client.service';
import { PaymentService } from '../../../services/payment.service'; // Added PaymentService
import { Loan, Client, LoanType } from '../../../models';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2'; // Added SweetAlert2Module
import Swal from 'sweetalert2'; // Import Swal

export interface InterestOnlyLoanDisplay extends Loan {
  clientName?: string;
}

@Component({
  selector: 'app-interest-only-loan-list',
  standalone: true,
  imports: [CommonModule, RouterModule, SweetAlert2Module], // Added SweetAlert2Module
  templateUrl: './interest-only-loan-list.component.html',
  styleUrls: ['./interest-only-loan-list.component.scss']
})
export class InterestOnlyLoanListComponent implements OnInit {
  interestOnlyLoans: InterestOnlyLoanDisplay[] = [];

  constructor(
    private loanService: LoanService,
    private clientService: ClientService,
    private paymentService: PaymentService, // Injected PaymentService
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

  viewInstallments(loanId: string): void { // Renamed from viewLoanDetails
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

  navigateToAddPayment(loanId: string): void {
    this.router.navigate(['/interest-only-loans', loanId, 'add-payment']);
    // Consider if a specific route/component for interest-only payment is needed,
    // or if the generic one can handle it.
  }

  public confirmDeleteLoan(loanId: string): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: "¡No podrás revertir esto!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6', // Or your app's primary color
      cancelButtonColor: '#d33',    // Or your app's danger/secondary color
      confirmButtonText: 'Sí, ¡eliminar!',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        // User confirmed. Proceed with payment check and deletion logic.
        const payments = this.paymentService.getPaymentsForLoan(loanId);
        if (payments && payments.length > 0) {
          Swal.fire(
            'Bloqueado',
            'Este préstamo tiene pagos asociados y no puede ser eliminado.',
            'error' // 'error' icon
          );
          console.warn(`Deletion blocked for loan ID: ${loanId} due to existing payments.`);
          return; // Exit if payments exist
        }

        const deleteOpResult = this.loanService.deleteInterestOnlyLoan(loanId);
        if (deleteOpResult.success) {
          Swal.fire(
            '¡Eliminado!',
            deleteOpResult.message || 'El préstamo ha sido eliminado.',
            'success' // 'success' icon
          );
          this.loadInterestOnlyLoans(); // Refresh the list
        } else {
          Swal.fire(
            'Error',
            deleteOpResult.message || 'No se pudo eliminar el préstamo.',
            'error' // 'error' icon
          );
          console.error(deleteOpResult.message);
        }
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        // User cancelled
        Swal.fire(
          'Cancelado',
          'La eliminación del préstamo ha sido cancelada.',
          'info' // 'info' icon
        );
        console.log('User cancelled deletion.');
      }
    });
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
