import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // DatePipe for formatting
import { RouterModule, Router } from '@angular/router';

import { LoanService } from '../../../services/loan.service';
import { ClientService } from '../../../services/client.service';
import { PaymentService } from '../../../services/payment.service'; // Added PaymentService
import { Loan } from '../../../models/loan.model';
import { LoanType } from '../../../models/loan-type.enum';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2'; // Added SweetAlert2Module
import Swal from 'sweetalert2'; // Import Swal

interface InterestOnlyLoanDisplay extends Loan {
  clientName: string;
  monthlyInterestRate: number;
  status: string;
}

@Component({
  selector: 'app-interest-only-loan-list',
  standalone: true,
  imports: [CommonModule, RouterModule, SweetAlert2Module], // Added SweetAlert2Module
  templateUrl: './interest-only-loan-list.component.html',
  styleUrls: ['./interest-only-loan-list.component.scss']
})
export class InterestOnlyLoanListComponent implements OnInit {
  loans: InterestOnlyLoanDisplay[] = [];

  constructor(
    private loanService: LoanService,
    private clientService: ClientService,
    private paymentService: PaymentService, // Injected PaymentService
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadLoans();
  }

  loadLoans(): void {
    const allLoans = this.loanService.getLoans();
    const clients = this.clientService.getClients();

    const clientMap = new Map<string, string>();
    clients.forEach(client => clientMap.set(client.id, `${client.firstName} ${client.lastName}`));

    this.loans = allLoans
      .filter(loan => loan.loanType === LoanType.INTEREST_ONLY_DAILY_ACCRUAL)
      .map(loan => ({
        ...loan,
        clientName: clientMap.get(loan.clientId) || 'Cliente Desconocido',
        monthlyInterestRate: loan.interestRate, // La tasa ya es mensual, no necesitamos dividir
        status: 'ACTIVE' // Por defecto, todos los préstamos están activos
      }));
  }

  navigateToAddLoan(): void {
    this.router.navigate(['/interest-only-loans/new']);
  }

  viewDetails(loanId: string): void {
    this.router.navigate(['/interest-only-loans', loanId, 'details']);
  }

  makePayment(loanId: string): void {
    this.router.navigate(['/interest-only-loans', loanId, 'add-payment']);
  }

  public confirmDeleteLoan(loanId: string): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: "Esta acción no se puede deshacer",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.loanService.deleteInterestOnlyLoan(loanId);
        this.loadLoans(); // Recargar la lista
        Swal.fire(
          '¡Eliminado!',
          'El préstamo ha sido eliminado.',
          'success'
        );
      }
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(amount);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('es-DO');
  }

  formatInterestRate(rate: number): string {
    // Assuming 'rate' is stored as a decimal (e.g., 0.02 for 2% monthly)
    // and needs to be displayed as a percentage.
    return `${(rate * 100).toFixed(2)}% mensual`;
  }
}
