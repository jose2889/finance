import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { By } from '@angular/platform-browser';
import { CommonModule } from '@angular/common'; // CommonModule for pipes like 'date'
import { NoopAnimationsModule } from '@angular/platform-browser/animations'; // For smoother testing if animations were involved

import { InstallmentScheduleComponent } from './installment-schedule.component';
import { LoanService } from '../../../services/loan.service';
import { ClientService } from '../../../services/client.service';
import { Loan, Client, InstallmentStatus } from '../../../models';
import { TranslateInstallmentStatusPipe } from '../../../pipes/translate-installment-status.pipe';
import { PaymentListComponent } from '../payment-list/payment-list.component'; // Actual component

// Mock dependencies
class MockLoanService {
  getLoanById(id: string): Loan | undefined {
    if (id === 'test-loan-id') {
      return {
        id: 'test-loan-id',
        clientId: 'c1',
        loanAmount: 1000,
        interestRate: 0.05,
        termMonths: 12,
        startDate: new Date(),
        installments: [
          { installmentNumber: 1, dueDate: new Date(), amount: 100, principal: 80, interest: 20, remainingBalance: 920, status: InstallmentStatus.Pending, paidAmount: 0 }
        ]
      };
    }
    return undefined;
  }
}

class MockClientService {
  getClientById(id: string): Client | undefined {
    if (id === 'c1') {
      return { id: 'c1', firstName: 'Test', lastName: 'Client', email: '', phone: '' };
    }
    return undefined;
  }
}

class MockRouter {
  navigate = jasmine.createSpy('navigate');
}

// ActivatedRoute mock
const mockActivatedRoute = {
  snapshot: {
    paramMap: {
      get: (key: string) => 'test-loan-id' // Default mock loanId for ngOnInit
    }
  }
};

// Basic stub for PaymentListComponent as its full functionality is not under test here.
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-payment-list',
  template: '<div>Mock Payment List</div>',
  standalone: true
})
class MockPaymentListComponent {
  @Input() loanId: string | null = null;
}


describe('InstallmentScheduleComponent', () => {
  let component: InstallmentScheduleComponent;
  let fixture: ComponentFixture<InstallmentScheduleComponent>;
  let router: MockRouter;
  let loanService: MockLoanService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        NoopAnimationsModule,
        InstallmentScheduleComponent, // The standalone component itself
        // TranslateInstallmentStatusPipe is already imported by InstallmentScheduleComponent
        // PaymentListComponent is imported by InstallmentScheduleComponent, so we use a mock/stub for testing simplicity
      ],
      providers: [
        { provide: LoanService, useClass: MockLoanService },
        { provide: ClientService, useClass: MockClientService },
        { provide: Router, useClass: MockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    })
    // Override the imported PaymentListComponent with a mock for this testing module
    .overrideComponent(InstallmentScheduleComponent, {
        remove: { imports: [PaymentListComponent] },
        add: { imports: [MockPaymentListComponent] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstallmentScheduleComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router) as unknown as MockRouter;
    loanService = TestBed.inject(LoanService) as unknown as MockLoanService;
    // fixture.detectChanges(); // Call in individual tests after further setup or spying
  });

  it('should create', () => {
    fixture.detectChanges(); // ngOnInit will be called
    expect(component).toBeTruthy();
  });

  describe('"Registrar Nuevo Pago" button', () => {
    beforeEach(() => {
      // Ensure loan data is loaded for button to be potentially visible
      component.loanId = 'test-loan-id'; // Simulate loanId being set
      component.loan = loanService.getLoanById('test-loan-id'); // Load mock loan
      fixture.detectChanges(); // Render template with loan data
    });

    it('should exist in the template when a loan is present', () => {
      const button = fixture.debugElement.query(By.css('button.button-primary'));
      // Find the specific button by text content or a more unique selector if needed
      const registerPaymentButton = fixture.debugElement.queryAll(By.css('button'))
        .find(btn => btn.nativeElement.textContent.includes('Registrar Nuevo Pago'));
      expect(registerPaymentButton).toBeTruthy();
    });

    it('should call navigateToAddPayment method when clicked', () => {
      spyOn(component, 'navigateToAddPayment');
      const registerPaymentButton = fixture.debugElement.queryAll(By.css('button'))
        .find(btn => btn.nativeElement.textContent.includes('Registrar Nuevo Pago'));

      expect(registerPaymentButton).toBeTruthy('Register Payment button should be found');
      registerPaymentButton!.nativeElement.click();
      expect(component.navigateToAddPayment).toHaveBeenCalled();
    });
  });

  describe('navigateToAddPayment method logic', () => {
    beforeEach(() => {
        fixture.detectChanges(); // Calls ngOnInit which sets up loanId from mockActivatedRoute
    });

    it('should navigate to add-payment route if loanId exists', () => {
      component.navigateToAddPayment();
      expect(router.navigate).toHaveBeenCalledWith(['/loans', 'test-loan-id', 'add-payment']);
    });

    it('should log an error and not navigate if loanId is null', () => {
      spyOn(console, 'error');
      component.loanId = null; // Simulate loanId not being available
      component.navigateToAddPayment();

      expect(router.navigate).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Error: loanId no está disponible para navegar a registrar pago.');
    });
  });
});
