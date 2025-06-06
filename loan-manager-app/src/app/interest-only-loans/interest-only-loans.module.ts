import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InterestOnlyLoansRoutingModule } from './interest-only-loans-routing.module';
import { InterestOnlyLoanFormComponent } from './components/interest-only-loan-form/interest-only-loan-form.component';
import { InterestOnlyLoanListComponent } from './components/interest-only-loan-list/interest-only-loan-list.component';
import { InterestOnlyLoanDetailComponent } from './components/interest-only-loan-detail/interest-only-loan-detail.component';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
  imports: [
    CommonModule,
    InterestOnlyLoansRoutingModule,
    ReactiveFormsModule,
    InterestOnlyLoanFormComponent,
    InterestOnlyLoanListComponent,
    InterestOnlyLoanDetailComponent
  ]
})
export class InterestOnlyLoansModule { }
