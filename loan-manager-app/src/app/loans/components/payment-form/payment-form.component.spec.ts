import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { By } from '@angular/platform-browser';

import { PaymentFormComponent } from './payment-form.component';
import { LoanService } from '../../../services/loan.service';
import { PaymentService } from '../../../services/payment.service';
import { Loan } from '../../../models';

// Mock services
class MockLoanService {
  getLoanById(id: string): Loan | undefined {
    if (id === 'test-loan-id') {
      return {
        id: 'test-loan-id',
        clientId: 'client1',
        loanAmount: 1000,
        interestRate: 0.05,
        termMonths: 12,
        startDate: new Date(),
        installments: []
      } as Loan;
    }
    return undefined;
  }
}

class MockPaymentService {
  addPayment(loanId: string, amount: number, date: Date, method?: string, notes?: string) {
    // Simulate successful payment
    return { success: true, paymentId: 'payment-123', message: 'Payment processed' };
  }
}

class MockRouter {
  navigate = jasmine.createSpy('navigate');
}

class MockActivatedRoute {
  snapshot = {
    paramMap: {
      get: (key: string) => 'test-loan-id' // Default mock loanId
    }
  };
}

describe('PaymentFormComponent', () => {
  let component: PaymentFormComponent;
  let fixture: ComponentFixture<PaymentFormComponent>;
  let router: Router;
  let paymentService: PaymentService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        CommonModule,
        PaymentFormComponent // Import the standalone component
      ],
      providers: [
        { provide: LoanService, useClass: MockLoanService },
        { provide: PaymentService, useClass: MockPaymentService },
        { provide: Router, useClass: MockRouter },
        { provide: ActivatedRoute, useClass: MockActivatedRoute }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentFormComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router); // Get the injected router spy
    paymentService = TestBed.inject(PaymentService); // Get the injected service
    fixture.detectChanges(); // Initial data binding and ngOnInit call
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Back to Main Menu button', () => {
    const getMainMenuButton = () => {
      const buttonDebugElement = fixture.debugElement.query(By.css('button.button-secondary'));
      if (buttonDebugElement) {
        // Check if this is indeed the "Volver al Menú Principal" button
        const buttonElement = buttonDebugElement.nativeElement as HTMLButtonElement;
        if (buttonElement.textContent?.includes('Volver al Menú Principal')) {
          return buttonElement;
        }
      }
      // Try to find it more specifically if multiple secondary buttons exist
      const allButtons = fixture.debugElement.queryAll(By.css('button'));
      const mainMenuButton = allButtons.find(btn => btn.nativeElement.textContent?.includes('Volver al Menú Principal'));
      return mainMenuButton ? mainMenuButton.nativeElement : null;
    };

    it('should not be visible when successMessage is null', () => {
      component.successMessage = null;
      fixture.detectChanges();
      const button = getMainMenuButton();
      expect(button).toBeFalsy();
    });

    it('should not be visible when successMessage is empty', () => {
      component.successMessage = '';
      fixture.detectChanges();
      const button = getMainMenuButton();
      // Depending on how *ngIf handles empty string, it might render the div but button logic might differ
      // For safety, let's assume empty string means no success, thus no button.
      // The current template is: <div *ngIf="successMessage" ...> <button ...> </button> </div>
      // So if successMessage is empty, the div itself won't be there.
      expect(button).toBeFalsy();
    });

    it('should be visible when successMessage is populated', () => {
      component.successMessage = 'Payment successful!';
      fixture.detectChanges();
      const button = getMainMenuButton();
      expect(button).toBeTruthy();
      if (button) {
         expect(button.textContent).toContain('Volver al Menú Principal');
      }
    });

    it('should navigate to /dashboard when "Volver al Menú Principal" button is clicked', fakeAsync(() => {
      // Simulate a successful payment to make the button appear
      component.paymentForm.setValue({
        paymentAmount: 100,
        paymentDate: '2024-01-01',
        paymentMethod: 'Efectivo',
        notes: 'Test payment'
      });
      component.onSubmit(); // This sets successMessage
      fixture.detectChanges(); // Update view with success message and button

      const button = getMainMenuButton();
      expect(button).toBeTruthy('Button should be visible after successful submission');

      if (button) {
        button.click();
        tick(); // Process async operations like navigation
        expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
      } else {
        fail('Main menu button not found after setting success message');
      }
    }));
  });
});
