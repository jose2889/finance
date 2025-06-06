import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

import { ClientService } from '../../../services/client.service';
import { LoanService } from '../../../services/loan.service';
import { Client, LoanType } from '../../../models';

@Component({
  selector: 'app-interest-only-loan-form',
  standalone: true, // Making it a standalone component
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './interest-only-loan-form.component.html',
  styleUrls: ['./interest-only-loan-form.component.scss']
})
export class InterestOnlyLoanFormComponent implements OnInit {
  loanForm!: FormGroup;
  clients: Client[] = [];

  constructor(
    private fb: FormBuilder,
    private loanService: LoanService,
    private clientService: ClientService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.clients = this.clientService.getClients();
    this.initForm();
  }

  initForm(): void {
    this.loanForm = this.fb.group({
      clientId: ['', Validators.required],
      loanAmount: ['', [Validators.required, Validators.min(1)]],
      monthlyInterestRate: ['', [Validators.required, Validators.min(0.01), Validators.max(50)]], // User enters e.g. 2 for 2% monthly
      termMonths: ['', [Validators.required, Validators.min(1)]], // For initial schedule generation
      startDate: ['', Validators.required],
      purpose: [''] // Optional
    });
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
    const decimalMonthlyRate = parseFloat(loanFormData.monthlyInterestRate) / 100;

    // Prepare the data structure expected by addInterestOnlyDailyAccrualLoan
    // Ensure all required fields from the Omit<> type and the additional ones are present
    const dataToSave = {
      clientId: loanFormData.clientId,
      loanAmount: parseFloat(loanFormData.loanAmount),
      monthlyInterestRate: decimalMonthlyRate, // Pass the converted decimal rate
      termMonths: parseInt(loanFormData.termMonths, 10),
      startDate: new Date(loanFormData.startDate), // Ensure it's a Date object
      purpose: loanFormData.purpose
      // loanType is set by the service method
    };

    this.loanService.addInterestOnlyDailyAccrualLoan(dataToSave);
    this.router.navigate(['/interest-only-loans']); // Navigate to a list view (to be created)
  }

  cancel(): void {
    // Navigate back to a relevant list or dashboard
    this.router.navigate(['/interest-only-loans']);
  }
}
