import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

import { LoanService } from '../../../services/loan.service';
import { PaymentService } from '../../../services/payment.service';
import { Loan } from '../../../models/loan.model';

@Component({
  selector: 'app-interest-only-loan-payment-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule
  ],
  templateUrl: './interest-only-loan-payment-form.component.html',
  styleUrls: ['./interest-only-loan-payment-form.component.scss']
})
export class InterestOnlyLoanPaymentFormComponent implements OnInit {
  paymentForm!: FormGroup;
  loanId: string = '';
  loan: Loan | undefined;
  errorMessage: string = '';

  constructor(
    private fb: FormBuilder,
    private loanService: LoanService,
    private paymentService: PaymentService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.loanId = this.route.snapshot.params['loanId'];
    this.loadLoan();
    this.paymentForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(0.01)]],
      paymentDate: [new Date().toISOString().substring(0, 10), Validators.required],
      notes: ['']
    });
  }

  loadLoan(): void {
    this.loan = this.loanService.getLoanById(this.loanId);
    if (!this.loan) {
      this.errorMessage = 'Préstamo no encontrado';
      this.router.navigate(['/interest-only-loans']);
    }
  }

  get formControls() {
    return this.paymentForm.controls;
  }

  onSubmit(): void {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const paymentData = this.paymentForm.value;
    const numericPaymentAmount = parseFloat(paymentData.amount);

    try {
      this.paymentService.addPayment(
        this.loanId,
        numericPaymentAmount,
        new Date(paymentData.paymentDate),
        paymentData.notes
      );
      this.router.navigate(['/interest-only-loans', this.loanId, 'details']);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Error al registrar el pago';
    }
  }

  cancel(): void {
    this.router.navigate(['/interest-only-loans', this.loanId, 'details']);
  }
} 