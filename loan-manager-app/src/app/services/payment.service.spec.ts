import { TestBed } from '@angular/core/testing';
import { PaymentService } from './payment.service';
import { LocalStorageService } from './local-storage.service';
import { LoanService } from './loan.service';
import { ClientService } from './client.service';
import { Payment, Loan, InstallmentStatus, Client } from '../models';

// Mocks
class MockLocalStorageService {
  private store: { [key: string]: any } = {};

  getItem<T>(key: string): T | null {
    return this.store[key] ? JSON.parse(this.store[key]) as T : null;
  }

  setItem<T>(key: string, value: T): void {
    this.store[key] = JSON.stringify(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  // Helper to directly set store for tests
  setStore(store: { [key: string]: any }): void {
    this.store = store;
  }

  clearStore(): void {
    this.store = {};
  }
}

class MockLoanService {
  getLoanById(id: string): Loan | undefined {
    // Basic mock, can be expanded if needed for other tests
    return undefined;
  }
  updateLoan(loan: Loan): void {}
}

class MockClientService {
  getClientById(id: string): Client | undefined {
    return undefined;
  }
}

describe('PaymentService', () => {
  let service: PaymentService;
  let localStorageServiceMock: MockLocalStorageService;

  const samplePayments: Payment[] = [
    { id: 'p1', loanId: 'l1', clientId: 'c1', paymentDate: new Date('2023-01-15'), amountPaid: 100, appliedToInstallments: [] },
    { id: 'p2', loanId: 'l2', clientId: 'c2', paymentDate: new Date('2023-02-15'), amountPaid: 200, appliedToInstallments: [] },
    { id: 'p3', loanId: 'l1', clientId: 'c1', paymentDate: new Date('2023-03-15'), amountPaid: 150, appliedToInstallments: [] },
    { id: 'p4', loanId: 'l3', clientId: 'c3', paymentDate: new Date('2024-01-15'), amountPaid: 300, appliedToInstallments: [] },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PaymentService,
        { provide: LocalStorageService, useClass: MockLocalStorageService },
        { provide: LoanService, useClass: MockLoanService },
        { provide: ClientService, useClass: MockClientService },
      ],
    });
    service = TestBed.inject(PaymentService);
    localStorageServiceMock = TestBed.inject(LocalStorageService) as unknown as MockLocalStorageService;
    // Clear store before each test
    localStorageServiceMock.clearStore();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getTotalPaymentsReceived', () => {
    it('should return 0 if there are no payments', () => {
      localStorageServiceMock.setItem('payments', []);
      expect(service.getTotalPaymentsReceived()).toBe(0);
    });

    it('should return 0 if payments key is not in storage', () => {
      // No payments set in localStorageServiceMock
      expect(service.getTotalPaymentsReceived()).toBe(0);
    });

    it('should sum all payments if no date filter is provided', () => {
      localStorageServiceMock.setItem('payments', samplePayments);
      const total = samplePayments.reduce((sum, p) => sum + p.amountPaid, 0);
      expect(service.getTotalPaymentsReceived()).toBe(total);
    });

    it('should filter payments by startDate and endDate', () => {
      localStorageServiceMock.setItem('payments', samplePayments);
      const startDate = new Date('2023-02-01');
      const endDate = new Date('2023-03-31');
      // Expected: p2 (200) + p3 (150) = 350
      expect(service.getTotalPaymentsReceived(startDate, endDate)).toBe(350);
    });

    it('should return 0 if date filter includes no payments', () => {
      localStorageServiceMock.setItem('payments', samplePayments);
      const startDate = new Date('2022-01-01');
      const endDate = new Date('2022-12-31');
      expect(service.getTotalPaymentsReceived(startDate, endDate)).toBe(0);
    });

    it('should include payments on the exact startDate', () => {
      localStorageServiceMock.setItem('payments', samplePayments);
      const startDate = new Date('2023-02-15'); // Matches p2's date
      const endDate = new Date('2023-02-28');
      // Expected: p2 (200)
      expect(service.getTotalPaymentsReceived(startDate, endDate)).toBe(200);
    });

    it('should include payments on the exact endDate', () => {
      localStorageServiceMock.setItem('payments', samplePayments);
      const startDate = new Date('2023-03-01');
      const endDate = new Date('2023-03-15'); // Matches p3's date
      // Expected: p3 (150)
      expect(service.getTotalPaymentsReceived(startDate, endDate)).toBe(150);
    });

    it('should handle only startDate provided', () => {
      localStorageServiceMock.setItem('payments', samplePayments);
      const startDate = new Date('2023-03-01');
      // Expected: p3 (150) + p4 (300) = 450
      expect(service.getTotalPaymentsReceived(startDate)).toBe(450);
    });

    it('should handle only endDate provided', () => {
      localStorageServiceMock.setItem('payments', samplePayments);
      const endDate = new Date('2023-02-28');
      // Expected: p1 (100) + p2 (200) = 300
      expect(service.getTotalPaymentsReceived(undefined, endDate)).toBe(300);
    });

    it('should handle dates that span across years correctly', () => {
      localStorageServiceMock.setItem('payments', samplePayments);
      const startDate = new Date('2023-03-01');
      const endDate = new Date('2024-01-31');
      // Expected: p3 (150) + p4 (300) = 450
      expect(service.getTotalPaymentsReceived(startDate, endDate)).toBe(450);
    });
  });
});
