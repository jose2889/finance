import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoanListComponent } from './components/loan-list/loan-list.component';
import { LoanFormComponent } from './components/loan-form/loan-form.component';
import { InstallmentScheduleComponent } from './components/installment-schedule/installment-schedule.component';

const routes: Routes = [
  { path: '', component: LoanListComponent },
  { path: 'new', component: LoanFormComponent },
  // { path: 'edit/:id', component: LoanFormComponent }, // Future: for editing loans
  { path: ':loanId/installments', component: InstallmentScheduleComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LoansRoutingModule { }
