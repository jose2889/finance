import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js'; // For chart types
import { BaseChartDirective } from 'ng2-charts'; // Actual directive
import { NoopAnimationsModule } from '@angular/platform-browser/animations';


import { DashboardViewComponent } from './dashboard-view.component';
import { PaymentService } from '../../../services/payment.service';
import { LoanService } from '../../../services/loan.service';
import { ClientService } from '../../../services/client.service';
import { Client, Loan } from '../../../models';

// Mocks for services
class MockPaymentService {
  getTotalPaymentsReceived(startDate?: Date, endDate?: Date): number {
    // Default mock behavior, can be spied on or overridden
    if (startDate && endDate) { // Simulate some filtering
        if (startDate.getFullYear() === 2023 && endDate.getFullYear() === 2023) return 500;
        return 1000; // Default for any other range or no range
    }
    return 12345; // Default total if no dates
  }
}

class MockLoanService {
  getLoans(startDate?: Date, endDate?: Date): Loan[] {
    // Return a few mock loans
    const mockLoan: Loan = {
      id: 'l1', clientId: 'c1', loanAmount: 1000, interestRate: 0.1, termMonths: 12, startDate: new Date('2023-01-01'), installments: []
    };
    if (startDate && endDate) { // Simulate some filtering
         if (startDate.getFullYear() === 2023 && endDate.getFullYear() === 2023) return [mockLoan];
         return [];
    }
    return [mockLoan, { ...mockLoan, id: 'l2', startDate: new Date('2024-01-01') }]; // Default loans
  }
}

class MockClientService {
  getClients(): Client[] {
    return [{ id: 'c1', firstName: 'Test', lastName: 'Client', email: '', phone: '' }];
  }
}

describe('DashboardViewComponent', () => {
  let component: DashboardViewComponent;
  let fixture: ComponentFixture<DashboardViewComponent>;
  let paymentService: MockPaymentService;
  let loanService: MockLoanService;
  let clientService: MockClientService;
  let loadDashboardDataSpy: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        FormsModule,
        NoopAnimationsModule, // For ng2-charts if it uses animations
        DashboardViewComponent, // Import standalone component
        // BaseChartDirective might need to be declared if not already handled by standalone
      ],
      providers: [
        { provide: PaymentService, useClass: MockPaymentService },
        { provide: LoanService, useClass: MockLoanService },
        { provide: ClientService, useClass: MockClientService },
        DatePipe // DatePipe is used by the template for [value] binding
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardViewComponent);
    component = fixture.componentInstance;
    paymentService = TestBed.inject(PaymentService) as unknown as MockPaymentService;
    loanService = TestBed.inject(LoanService) as unknown as MockLoanService;
    clientService = TestBed.inject(ClientService) as unknown as MockClientService;

    // Spy on loadDashboardData before ngOnInit is called by first detectChanges
    loadDashboardDataSpy = spyOn(component, 'loadDashboardData').and.callThrough(); // Call through to execute original
  });

  it('should create', () => {
    fixture.detectChanges(); // Trigger ngOnInit
    expect(component).toBeTruthy();
  });

  describe('Initialization (ngOnInit)', () => {
    it('should initialize filterStartDate to one year ago and filterEndDate to today', () => {
      fixture.detectChanges(); // ngOnInit
      const today = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(today.getFullYear() - 1);

      // Compare date parts as time might be slightly different
      expect(component.filterEndDate.getFullYear()).toEqual(today.getFullYear());
      expect(component.filterEndDate.getMonth()).toEqual(today.getMonth());
      expect(component.filterEndDate.getDate()).toEqual(today.getDate());

      expect(component.filterStartDate.getFullYear()).toEqual(oneYearAgo.getFullYear());
      expect(component.filterStartDate.getMonth()).toEqual(oneYearAgo.getMonth());
      expect(component.filterStartDate.getDate()).toEqual(oneYearAgo.getDate());
    });

    it('should call loadDashboardData on ngOnInit', () => {
      fixture.detectChanges(); // ngOnInit
      expect(loadDashboardDataSpy).toHaveBeenCalled();
    });
  });

  describe('Date Filter UI Interaction', () => {
    beforeEach(() => {
        fixture.detectChanges(); // Initial ngOnInit and loadDashboardData call
        loadDashboardDataSpy.calls.reset(); // Reset spy for specific tests below
    });

    it('should update filterStartDate on input change', () => {
      const newDate = '2023-05-10';
      const dateInput = fixture.debugElement.query(By.css('#filterStartDate')).nativeElement;
      dateInput.value = newDate;
      dateInput.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      const expectedDate = new Date(newDate + 'T00:00:00');
      expect(component.filterStartDate.getFullYear()).toEqual(expectedDate.getFullYear());
      expect(component.filterStartDate.getMonth()).toEqual(expectedDate.getMonth());
      expect(component.filterStartDate.getDate()).toEqual(expectedDate.getDate());
    });

    it('should update filterEndDate on input change', () => {
      const newDate = '2023-11-20';
      const dateInput = fixture.debugElement.query(By.css('#filterEndDate')).nativeElement;
      dateInput.value = newDate;
      dateInput.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      const expectedDate = new Date(newDate + 'T00:00:00');
      expect(component.filterEndDate.getFullYear()).toEqual(expectedDate.getFullYear());
      expect(component.filterEndDate.getMonth()).toEqual(expectedDate.getMonth());
      expect(component.filterEndDate.getDate()).toEqual(expectedDate.getDate());
    });

    it('should call loadDashboardData when "Aplicar Filtro" button is clicked', () => {
      const applyButton = fixture.debugElement.queryAll(By.css('button.button-primary'))
                             .find(btn => btn.nativeElement.textContent.includes('Aplicar Filtro'));
      expect(applyButton).toBeTruthy();
      applyButton!.nativeElement.click();
      expect(loadDashboardDataSpy).toHaveBeenCalled();
    });

    it('should reset dates and call loadDashboardData when "Restablecer Filtro" button is clicked', () => {
      // Modify dates first
      component.filterStartDate = new Date('2022-01-01T00:00:00');
      component.filterEndDate = new Date('2022-12-31T00:00:00');
      fixture.detectChanges();

      const resetButton = fixture.debugElement.queryAll(By.css('button.button-secondary'))
                              .find(btn => btn.nativeElement.textContent.includes('Restablecer'));
      expect(resetButton).toBeTruthy();
      resetButton!.nativeElement.click();

      const today = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(today.getFullYear() - 1);

      expect(component.filterEndDate.getFullYear()).toEqual(today.getFullYear());
      expect(component.filterEndDate.getMonth()).toEqual(today.getMonth());
      expect(component.filterEndDate.getDate()).toEqual(today.getDate());
      expect(component.filterStartDate.getFullYear()).toEqual(oneYearAgo.getFullYear());
      expect(component.filterStartDate.getMonth()).toEqual(oneYearAgo.getMonth());
      expect(component.filterStartDate.getDate()).toEqual(oneYearAgo.getDate());
      expect(loadDashboardDataSpy).toHaveBeenCalled();
    });
  });

  describe('Data Loading and Display', () => {
    let getTotalPaymentsSpy: jasmine.Spy;
    let getLoansSpy: jasmine.Spy;

    beforeEach(() => {
      // Reset spies for services for specific calls within loadMetrics
      getTotalPaymentsSpy = spyOn(paymentService, 'getTotalPaymentsReceived').and.callThrough();
      getLoansSpy = spyOn(loanService, 'getLoans').and.callThrough();
      fixture.detectChanges(); // ngOnInit
    });

    it('loadMetrics should call paymentService.getTotalPaymentsReceived with filter dates', () => {
      component.loadMetrics(); // Called directly for this test
      expect(getTotalPaymentsSpy).toHaveBeenCalledWith(component.filterStartDate, component.filterEndDate);
    });

    it('loadMetrics should call loanService.getLoans with filter dates', () => {
      component.loadMetrics(); // Called directly
      expect(getLoansSpy).toHaveBeenCalledWith(component.filterStartDate, component.filterEndDate);
    });

    it('totalPaymentsReceived property should be updated after loadMetrics', () => {
      // Default mock returns 12345 if no dates, or specific values if dates match mock logic
      // ngOnInit sets dates that won't match the specific 500, so should be 1000 for the default mock range
      const initialStartDate = component.filterStartDate;
      const initialEndDate = component.filterEndDate;

      // Re-run with specific dates that the mock can return a unique value for
      component.filterStartDate = new Date("2023-01-01");
      component.filterEndDate = new Date("2023-12-31");
      getTotalPaymentsSpy.and.returnValue(500); // Ensure spy returns this for this specific call

      component.loadMetrics();
      expect(component.totalPaymentsReceived).toBe(500);
    });

    it('should display formatted totalPaymentsReceived in the template', fakeAsync(() => {
        getTotalPaymentsSpy.and.returnValue(7890);
        component.loadDashboardData(); // This will call loadMetrics
        tick(); // Allow async operations and view updates
        fixture.detectChanges(); // Ensure view is updated with new value

        const cards = fixture.debugElement.queryAll(By.css('.metric-card'));
        const paymentsCard = cards.find(card => card.nativeElement.querySelector('h3').textContent === 'Total Pagos Recibidos');
        expect(paymentsCard).toBeTruthy();
        const valueElement = paymentsCard!.nativeElement.querySelector('p');
        // The formatCurrency method in component uses 'en-US' and 'USD'
        expect(valueElement.textContent).toBe('$7,890.00'); // Based on component's formatCurrency
    }));

    it('prepareBarChartData and preparePieChartData should be called by loadDashboardData and use filtered loan data', () => {
      const prepareBarSpy = spyOn(component, 'prepareBarChartData').and.callThrough();
      const preparePieSpy = spyOn(component, 'preparePieChartData').and.callThrough();

      component.loadDashboardData();

      expect(prepareBarSpy).toHaveBeenCalled();
      expect(preparePieSpy).toHaveBeenCalled();
      // Verify getLoans was called with filter dates (already spied on as getLoansSpy)
      // The spies are on the service methods, prepareBarChartData calls loanService.getLoans() again
      // So getLoansSpy would be called multiple times: once in loadMetrics, once in prepareBarChartData, once in preparePieChartData
      expect(getLoansSpy).toHaveBeenCalledWith(component.filterStartDate, component.filterEndDate);
      // Check it was called multiple times (at least 3 from one loadDashboardData cycle)
      expect(getLoansSpy.calls.count()).toBeGreaterThanOrEqual(3);
    });
  });
});
