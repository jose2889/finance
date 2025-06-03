import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Loan, Client } from '../../../models'; // Adjusted path
import { LoanService } from '../../../services/loan.service'; // Adjusted path
import { ClientService } from '../../../services/client.service'; // Adjusted path

interface LoanDisplay extends Loan {
  clientName?: string;
}
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-loan-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './loan-list.component.html',
  styleUrls: ['./loan-list.component.scss']
})
export class LoanListComponent implements OnInit {
  loans: LoanDisplay[] = [];
  clients: Client[] = [];

  constructor(
    private loanService: LoanService,
    private clientService: ClientService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.clients = this.clientService.getClients();
    this.loadLoans();
  }

  loadLoans(): void {
    this.loans = this.loanService.getLoans().map(loan => {
      const client = this.clients.find(c => c.id === loan.clientId);
      return { ...loan, clientName: client ? `${client.firstName} ${client.lastName}` : 'Cliente Desconocido' };
    });
  }

  deleteLoan(id: string): void {
    if (confirm('¿Estás seguro de que quieres eliminar este préstamo?')) {
      this.loanService.deleteLoan(id);
      this.loadLoans(); // Refresh list
    }
  }

  navigateToAddLoan(): void {
    this.router.navigate(['/loans/new']);
  }

  viewInstallments(loanId: string): void {
    this.router.navigate(['/loans', loanId, 'installments']);
  }

  navigateToAddPayment(loanId: string): void {
    this.router.navigate(['/loans', loanId, 'add-payment']);
  }
  
  formatCurrency(amount: number): string {
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString();
  }
}
