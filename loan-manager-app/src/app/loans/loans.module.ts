import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { LoansRoutingModule } from './loans-routing.module';
import { LoansComponent } from './loans/loans.component'; // Corrected path
import { LoanListComponent } from './components/loan-list/loan-list.component';
import { LoanFormComponent } from './components/loan-form/loan-form.component';
import { InstallmentScheduleComponent } from './components/installment-schedule/installment-schedule.component';

@NgModule({
  declarations: [
    // Components are now standalone and should not be declared here.
  ],
  imports: [
    CommonModule, // Keep for any pipes or directives used by the module itself or its routing
    LoansRoutingModule,
    ReactiveFormsModule // Keep for any services or if the module itself provides form-related things
    // Standalone components used in routes will be loaded by the router.
  ]
})
export class LoansModule { }
