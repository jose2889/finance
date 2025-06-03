import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoanListComponent } from './components/loan-list/loan-list.component';
import { LoanFormComponent } from './components/loan-form/loan-form.component';
import { InstallmentScheduleComponent } from './components/installment-schedule/installment-schedule.component';

import { PaymentFormComponent } from './components/payment-form/payment-form.component';

const routes: Routes = [
  { path: '', component: LoanListComponent },
  { path: 'new', component: LoanFormComponent },
  // { path: 'edit/:id', component: LoanFormComponent }, // Future: for editing loans
  { path: ':loanId/installments', component: InstallmentScheduleComponent },
  { path: ':loanId/add-payment', component: PaymentFormComponent } // New route
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LoansRoutingModule { }
