import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

import { ClientService } from '../../../services/client.service';
import { LoanService } from '../../../services/loan.service';
import { Client, LoanType } from '../../../models';

@Component({
  selector: 'app-interest-only-loan-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule
  ],
  templateUrl: './interest-only-loan-form.component.html',
  styleUrls: ['./interest-only-loan-form.component.scss']
})
export class InterestOnlyLoanFormComponent implements OnInit {
  loanForm!: FormGroup;
  clients: Client[] = [];
  errorMessage: string = '';

  constructor(
    private fb: FormBuilder,
    private loanService: LoanService,
    private clientService: ClientService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadClients();
    this.loanForm = this.fb.group({
      clientId: ['', Validators.required],
      loanAmount: ['', [Validators.required, Validators.min(0.01)]],
      interestRate: ['', [Validators.required, Validators.min(0.01)]],
      startDate: [new Date().toISOString().substring(0, 10), Validators.required],
      purpose: ['']
    });
  }

  loadClients(): void {
    this.clients = this.clientService.getClients();
  }

  get formControls() {
    return this.loanForm.controls;
  }

  onSubmit(): void {
    if (this.loanForm.invalid) {
      this.loanForm.markAllAsTouched();
      return;
    }

    const loanFormData = this.loanForm.value;
    const decimalMonthlyRate = parseFloat(loanFormData.interestRate) / 100;

    // Prepare the data structure expected by addInterestOnlyDailyAccrualLoan
    const loanData = {
      clientId: loanFormData.clientId,
      loanAmount: parseFloat(loanFormData.loanAmount),
      currentBalance: parseFloat(loanFormData.loanAmount), // Inicializar el saldo actual igual al monto original
      monthlyInterestRate: decimalMonthlyRate,
      startDate: new Date(loanFormData.startDate),
      purpose: loanFormData.purpose
    };

    try {
      this.loanService.addInterestOnlyDailyAccrualLoan(loanData);
      this.router.navigate(['/interest-only-loans']);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Error al crear el préstamo';
    }
  }

  cancel(): void {
    this.router.navigate(['/interest-only-loans']);
  }
}
