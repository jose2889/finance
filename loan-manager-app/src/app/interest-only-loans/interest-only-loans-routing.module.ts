import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InterestOnlyLoanFormComponent } from './components/interest-only-loan-form/interest-only-loan-form.component';
import { InterestOnlyLoanListComponent } from './components/interest-only-loan-list/interest-only-loan-list.component';
import { InterestOnlyLoanDetailComponent } from './components/interest-only-loan-detail/interest-only-loan-detail.component';
import { InterestOnlyLoanPaymentFormComponent } from './components/interest-only-loan-payment-form/interest-only-loan-payment-form.component';

const routes: Routes = [
  { path: '', component: InterestOnlyLoanListComponent },
  { path: 'new', component: InterestOnlyLoanFormComponent },
  { path: ':loanId/details', component: InterestOnlyLoanDetailComponent },
  { path: ':loanId/add-payment', component: InterestOnlyLoanPaymentFormComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InterestOnlyLoansRoutingModule { }
