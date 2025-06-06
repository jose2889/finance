import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InterestOnlyLoanFormComponent } from './components/interest-only-loan-form/interest-only-loan-form.component';
import { InterestOnlyLoanListComponent } from './components/interest-only-loan-list/interest-only-loan-list.component';
import { InterestOnlyLoanDetailComponent } from './components/interest-only-loan-detail/interest-only-loan-detail.component';


const routes: Routes = [
  { path: '', component: InterestOnlyLoanListComponent, pathMatch: 'full' },
  { path: 'new', component: InterestOnlyLoanFormComponent },
  { path: ':loanId/details', component: InterestOnlyLoanDetailComponent },
  { path: ':loanId/add-payment', component: InterestOnlyLoanFormComponent } // Assuming same form for adding payments, or create a new one
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InterestOnlyLoansRoutingModule { }
