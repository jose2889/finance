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
    } else {
      this.errorMessage = 'ID de préstamo no encontrado en la ruta.';
    }

    this.paymentForm = this.fb.group({
      paymentAmount: ['', [Validators.required, Validators.min(0.01)]],
      paymentDate: [new Date().toISOString().substring(0, 10), Validators.required],
      notes: ['']
    });
  }

  get formControls() { return this.paymentForm.controls; }

  onSubmit(): void {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    if (!this.loanId) {
      this.errorMessage = 'Error: ID de préstamo faltante. No se puede registrar el pago.';
      return;
    }

    const { amount, paymentDate, notes } = this.paymentForm.value;
    const numericPaymentAmount = parseFloat(amount);

    try {
      this.paymentService.addPayment(
        this.loanId,
        numericPaymentAmount,
        new Date(paymentDate),
        notes
      );
      this.router.navigate(['/loans', this.loanId]);
    } catch (error) {
      this.errorMessage = `Error al registrar el pago: ${error instanceof Error ? error.message : 'Error desconocido.'}`;
    }
  }

  cancel(): void {
    if (this.loanId) {
      this.router.navigate(['/loans', this.loanId, 'installments']);
    } else {
      this.router.navigate(['/loans']);
    }
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
  
  formatCurrency(amount: number | undefined | null): string { // Allow undefined or null
     if (amount === null || amount === undefined) return '';
     // Using 'es-CO' (Colombia) for COP example, adjust as needed for general Spanish or specific currency
     return amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
}
