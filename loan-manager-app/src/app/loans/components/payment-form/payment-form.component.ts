import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms'; // Added ReactiveFormsModule here
import { ActivatedRoute, Router, RouterModule } from '@angular/router'; // Added RouterModule here
import { CommonModule } from '@angular/common'; // Added CommonModule here

import { PaymentService } from '../../../services/payment.service';
import { LoanService } from '../../../services/loan.service';
import { Loan } from '../../../models';

@Component({
  selector: 'app-payment-form',
  standalone: true, // Made standalone
  imports: [CommonModule, ReactiveFormsModule, RouterModule], // Added imports
  templateUrl: './payment-form.component.html',
  styleUrls: ['./payment-form.component.scss']
})
export class PaymentFormComponent implements OnInit {
  paymentForm!: FormGroup;
  loanId: string | null = null;
  loan: Loan | undefined;
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  paymentMethods: string[] = ['Efectivo', 'Transferencia Bancaria', 'Tarjeta de Crédito', 'Tarjeta de Débito', 'Otro'];

  constructor(
    private fb: FormBuilder,
    private paymentService: PaymentService,
    private loanService: LoanService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.loanId = this.route.snapshot.paramMap.get('loanId');
    if (this.loanId) {
      this.loan = this.loanService.getLoanById(this.loanId);
      // Note: this.loan.clientName might not be populated here if getLoanById doesn't join it.
      // The HTML template has a fallback for loan.clientName.
    } else {
      this.errorMessage = 'ID de préstamo no encontrado en la ruta.';
    }

    this.paymentForm = this.fb.group({
      paymentAmount: ['', [Validators.required, Validators.min(0.01)]],
      paymentDate: [new Date().toISOString().substring(0, 10), Validators.required],
      paymentMethod: [''],
      notes: ['']
    });
  }

  get formControls() { return this.paymentForm.controls; }

  onSubmit(): void {
    this.errorMessage = null;
    this.successMessage = null;
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }
    if (!this.loanId) {
      this.errorMessage = 'Error: ID de préstamo faltante. No se puede registrar el pago.';
      return;
    }

    this.isLoading = true;
    const { paymentAmount, paymentDate, paymentMethod, notes } = this.paymentForm.value;

    // Ensure paymentAmount is treated as a number
    const numericPaymentAmount = typeof paymentAmount === 'string' ? parseFloat(paymentAmount) : paymentAmount;

    const result = this.paymentService.addPayment(
      this.loanId,
      numericPaymentAmount,
      new Date(paymentDate),
      paymentMethod,
      notes
    );

    this.isLoading = false;
    if (result.success) {
      this.successMessage = `Pago registrado exitosamente con ID: ${result.paymentId}. ${result.message || ''}`;
      this.paymentForm.reset({ paymentDate: new Date().toISOString().substring(0, 10), paymentAmount: '', paymentMethod: '', notes: '' });
      // Refresh loan data in case amounts or statuses changed on it (though PaymentService handles this)
      if(this.loanId) {
        this.loan = this.loanService.getLoanById(this.loanId);
      }
    } else {
      this.errorMessage = `Error al registrar el pago: ${result.message || 'Error desconocido.'}`;
    }
  }

  cancel(): void {
    if (this.loanId) {
      this.router.navigate(['/loans', this.loanId, 'installments']);
    } else {
      this.router.navigate(['/loans']);
    }
  }
  
  formatCurrency(amount: number | undefined | null): string { // Allow undefined or null
     if (amount === null || amount === undefined) return '';
     // Using 'es-CO' (Colombia) for COP example, adjust as needed for general Spanish or specific currency
     return amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
}
