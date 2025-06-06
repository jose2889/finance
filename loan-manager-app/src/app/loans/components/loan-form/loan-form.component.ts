import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoanService } from '../../../services/loan.service'; // Adjusted path
import { ClientService } from '../../../services/client.service'; // Adjusted path
import { Client } from '../../../models'; // Adjusted path
// import { ActivatedRoute } from '@angular/router'; // Future: for editing loans
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-loan-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './loan-form.component.html',
  styleUrls: ['./loan-form.component.scss']
})
export class LoanFormComponent implements OnInit {
  loanForm!: FormGroup;
  clients: Client[] = [];
  // isEditMode = false; // Future: for editing loans
  // loanId: string | null = null; // Future: for editing loans

  constructor(
    private fb: FormBuilder,
    private loanService: LoanService,
    private clientService: ClientService,
    private router: Router
    // private route: ActivatedRoute // Future: for editing loans
  ) { }

  ngOnInit(): void {
    this.clients = this.clientService.getClients();
    this.initForm();
    // Logic for edit mode would go here
  }

  initForm(): void {
    const today = new Date();
    const year = today.getFullYear();
    const month = ('0' + (today.getMonth() + 1)).slice(-2); // Months are 0-indexed
    const day = ('0' + today.getDate()).slice(-2);
    const formattedDate = `${year}-${month}-${day}`;

    this.loanForm = this.fb.group({
      clientId: ['', Validators.required],
      loanAmount: ['', [Validators.required, Validators.min(1)]],
      interestRate: ['', [Validators.required, Validators.min(0), Validators.max(500)]], // User inputs percentage e.g. 5 for 5%
      termMonths: ['', [Validators.required, Validators.min(1)]],
      startDate: [formattedDate, Validators.required], // Set default value
      purpose: ['']
    });
  }

  get formControls() { return this.loanForm.controls; }

  onSubmit(): void {
    if (this.loanForm.invalid) {
      this.loanForm.markAllAsTouched();
      return;
    }

    const loanData = this.loanForm.value;
    // Ensure date is correctly formatted or handled if needed before saving
    // The service expects a Date object for startDate if not already
    const dataToSave = {
       ...loanData,
       loanAmount: parseFloat(loanData.loanAmount), // Ensure loanAmount is a number
       interestRate: parseFloat(loanData.interestRate) / 100,
       termMonths: parseInt(loanData.termMonths, 10), // Ensure termMonths is a number
       startDate: new Date(loanData.startDate) // Convert string date from input to Date obj
    };

    this.loanService.addLoan(dataToSave);
    this.router.navigate(['/loans']);
  }

  cancel(): void {
    this.router.navigate(['/loans']);
  }
}
