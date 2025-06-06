import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common'; // Import CommonModule

import { PaymentService } from '../../../services/payment.service';
import { Payment } from '../../../models';

@Component({
  selector: 'app-payment-list',
  standalone: true, // Made standalone
  imports: [CommonModule], // Added CommonModule
  templateUrl: './payment-list.component.html',
  styleUrls: ['./payment-list.component.css']
})
export class PaymentListComponent implements OnInit, OnChanges {
  @Input() loanId: string | null = null;
  payments: Payment[] = [];
  isLoading = false;
  errorMessage: string | null = null;

  constructor(private paymentService: PaymentService) { }

  ngOnInit(): void {
    this.loadPayments();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['loanId'] && !changes['loanId'].firstChange) {
      this.loadPayments();
    }
  }

  loadPayments(): void {
    if (!this.loanId) {
      this.payments = [];
      // console.log('[PaymentList] Loan ID is null, clearing payments.'); // Optional: if you want to log this case
      return;
    }
    this.isLoading = true;
    this.errorMessage = null;
    console.log(`[PaymentList] Attempting to load payments for loanId: ${this.loanId}`);
    try {
      this.payments = this.paymentService.getPaymentsForLoan(this.loanId);
      console.log(`[PaymentList] Loaded ${this.payments.length} payments for loan ${this.loanId}:`, this.payments);
    } catch (error) {
      console.error(`[PaymentList] Error loading payments for loan ${this.loanId}:`, error);
      this.errorMessage = 'Error al cargar los pagos.';
    } finally {
      this.isLoading = false;
    }
  }
  
  formatDate(date: Date | string): string {
     if (!date) return '';
     const dateObj = typeof date === 'string' ? new Date(date) : date;
     // Using a generic Spanish locale format, can be adjusted
     return dateObj.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  formatCurrency(amount: number | undefined | null): string {
     if (amount === null || amount === undefined) return 'N/A'; // Or some placeholder like '0'
     // Using COP as per previous context, adjust if a general 'es-ES' with EUR or other is preferred
     return amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
}
