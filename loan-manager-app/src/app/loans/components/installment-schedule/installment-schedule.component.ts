import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Loan, Installment, InstallmentStatus, Client } from '../../../models'; // Adjusted path
import { LoanService } from '../../../services/loan.service'; // Adjusted path
import { ClientService } from '../../../services/client.service'; // Adjusted path
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-installment-schedule',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './installment-schedule.component.html',
  styleUrls: ['./installment-schedule.component.scss']
})
export class InstallmentScheduleComponent implements OnInit {
  loan: Loan | undefined;
  client: Client | undefined;
  loanId: string | null = null;
  InstallmentStatusEnum = InstallmentStatus; // To use enum in template

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private loanService: LoanService,
    private clientService: ClientService
  ) { }

  ngOnInit(): void {
    this.loanId = this.route.snapshot.paramMap.get('loanId');
    if (this.loanId) {
      this.loan = this.loanService.getLoanById(this.loanId);
      if (this.loan) {
        this.client = this.clientService.getClientById(this.loan.clientId);
      } else {
        console.error('Préstamo no encontrado');
        this.router.navigate(['/loans']);
      }
    } else {
       console.error('ID de préstamo no proporcionado');
       this.router.navigate(['/loans']);
    }
  }

  updateStatus(installmentNumber: number, event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const newStatus = selectElement.value as InstallmentStatus;

    console.log('[InstallmentSchedule] updateStatus called.');
    console.log('[InstallmentSchedule] loanId:', this.loanId);
    console.log('[InstallmentSchedule] installmentNumber:', installmentNumber);
    console.log('[InstallmentSchedule] newStatus:', newStatus);

    if (this.loanId && this.loan) { // Ensure loanId is not null/undefined
      const success = this.loanService.updateInstallmentStatus(this.loanId, installmentNumber, newStatus);
      console.log('[InstallmentSchedule] Service call returned:', success);
      if (success) {
        // Optionally, refresh loan data to reflect changes if not automatically updated by service's internal state management
        const updatedLoan = this.loanService.getLoanById(this.loanId);
        if (updatedLoan) {
            this.loan = updatedLoan; // This ensures the template updates if the service returns a new object or mutates
            console.log('[InstallmentSchedule] Loan data refreshed in component.');
        }
      } else {
        console.error('[InstallmentSchedule] Failed to update status via service.');
      }
    } else {
      console.error('[InstallmentSchedule] loanId is missing. Cannot update status.');
    }
  }
  
  formatCurrency(amount: number): string {
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString();
  }

  goBack(): void {
   this.router.navigate(['/loans']);
  }
}
