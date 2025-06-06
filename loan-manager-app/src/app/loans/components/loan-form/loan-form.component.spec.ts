import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { LoanFormComponent } from './loan-form.component';
import { LoanService } from '../../../services/loan.service';
import { ClientService } from '../../../services/client.service';
import { Client } from '../../../models';

// Mocks
class MockLoanService {
  addLoan = jasmine.createSpy('addLoan');
}

class MockClientService {
  getClients(): Client[] {
    return [
      { id: 'c1', firstName: 'Test', lastName: 'Client1', email: 'tc1@mail.com', phone: '123' },
      { id: 'c2', firstName: 'Test', lastName: 'Client2', email: 'tc2@mail.com', phone: '456' }
    ];
  }
}

class MockRouter {
  navigate = jasmine.createSpy('navigate');
}

describe('LoanFormComponent', () => {
  let component: LoanFormComponent;
  let fixture: ComponentFixture<LoanFormComponent>;
  let loanService: MockLoanService;
  let clientService: MockClientService;
  let router: MockRouter;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        ReactiveFormsModule,
        NoopAnimationsModule,
        LoanFormComponent // Standalone component
      ],
      providers: [
        FormBuilder, // LoanFormComponent uses FormBuilder directly
        { provide: LoanService, useClass: MockLoanService },
        { provide: ClientService, useClass: MockClientService },
        { provide: Router, useClass: MockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoanFormComponent);
    component = fixture.componentInstance;
    loanService = TestBed.inject(LoanService) as unknown as MockLoanService;
    clientService = TestBed.inject(ClientService) as unknown as MockClientService;
    router = TestBed.inject(Router) as unknown as MockRouter;

    // ngOnInit is called by detectChanges
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Form Initialization and Validation', () => {
    it('should initialize interestRate with required, min(0) and max(500) validators', () => {
      const control = component.loanForm.get('interestRate');
      expect(control).toBeTruthy();

      // Check for required
      control!.setValue('');
      expect(control!.hasError('required')).toBeTrue();

      // Check for min(0)
      control!.setValue(-1);
      expect(control!.hasError('min')).toBeTrue();
      control!.setValue(0);
      expect(control!.hasError('min')).toBeFalse();

      // Check for max(500)
      control!.setValue(501);
      expect(control!.hasError('max')).toBeTrue();
      control!.setValue(500);
      expect(control!.hasError('max')).toBeFalse();
    });

    it('interestRate control should be valid for typical percentage inputs', () => {
      const control = component.loanForm.get('interestRate');
      control!.setValue(5); // 5%
      expect(control!.valid).toBeTrue();
      control!.setValue(100); // 100%
      expect(control!.valid).toBeTrue();
    });
  });

  describe('Form Submission Logic', () => {
    beforeEach(() => {
      // Set up a valid form state for submission tests
      component.loanForm.setValue({
        clientId: 'c1',
        loanAmount: 10000,
        interestRate: 10, // User inputs 10 for 10%
        termMonths: 12,
        startDate: '2024-01-15',
        purpose: 'Test loan'
      });
    });

    it('should call loanService.addLoan on valid submission', () => {
      component.onSubmit();
      expect(loanService.addLoan).toHaveBeenCalled();
    });

    it('should convert interestRate to decimal when calling loanService.addLoan', () => {
      component.onSubmit();

      expect(loanService.addLoan).toHaveBeenCalled();
      const submittedLoanData = loanService.addLoan.calls.mostRecent().args[0];
      expect(submittedLoanData.interestRate).toBe(0.10); // 10% should be 0.10
    });

    it('should navigate to /loans after successful submission', () => {
      component.onSubmit();
      expect(router.navigate).toHaveBeenCalledWith(['/loans']);
    });

    it('should not call loanService.addLoan if form is invalid', () => {
      component.loanForm.get('loanAmount')!.setValue(''); // Make form invalid
      component.onSubmit();
      expect(loanService.addLoan).not.toHaveBeenCalled();
    });
  });
});
