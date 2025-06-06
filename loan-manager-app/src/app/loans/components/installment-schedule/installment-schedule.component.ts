import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Loan, Installment, InstallmentStatus, Client } from '../../../models'; // Adjusted path
import { LoanService } from '../../../services/loan.service'; // Adjusted path
import { ClientService } from '../../../services/client.service'; // Adjusted path
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PaymentListComponent } from '../payment-list/payment-list.component'; // Import PaymentListComponent
import { TranslateInstallmentStatusPipe } from '../../../pipes/translate-installment-status.pipe'; // Import the new pipe

@Component({
  selector: 'app-installment-schedule',
  standalone: true,
  imports: [CommonModule, RouterModule, PaymentListComponent, TranslateInstallmentStatusPipe], // Add the new pipe to imports
  templateUrl: './installment-schedule.component.html',
  styleUrls: ['./installment-schedule.component.css']
})
export class InstallmentScheduleComponent implements OnInit {
  loan: Loan | undefined;
  client: Client | undefined;
  loanId: string | null = null;
  // InstallmentStatusEnum removed as it's no longer used in the template

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

  // updateStatus method removed
  
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

  navigateToAddPayment(): void {
    if (this.loanId) {
      this.router.navigate(['/loans', this.loanId, 'add-payment']);
    } else {
      console.error('Error: loanId no está disponible para navegar a registrar pago.');
      // Optionally, navigate to an error page or back to loans list as a fallback
      // this.router.navigate(['/loans']);
    }
  }
}
