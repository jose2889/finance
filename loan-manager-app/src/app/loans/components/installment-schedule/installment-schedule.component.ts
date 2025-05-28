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
        console.error('Loan not found');
        this.router.navigate(['/loans']);
      }
    } else {
       console.error('Loan ID not provided');
       this.router.navigate(['/loans']);
    }
  }

  updateStatus(installmentNumber: number, event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const newStatus = selectElement.value as InstallmentStatus;
    if (this.loanId && this.loan) {
      this.loanService.updateInstallmentStatus(this.loanId, installmentNumber, newStatus);
      // Optionally, refresh loan data to reflect changes if not automatically updated
      const updatedLoan = this.loanService.getLoanById(this.loanId);
      if (updatedLoan) {
          this.loan = updatedLoan;
      }
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
