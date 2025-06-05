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
  private loans: { [id: string]: Loan } = {};

  getLoanById(id: string): Loan | undefined {
    // Return a deep copy to prevent modification by service from affecting original test data
    return this.loans[id] ? JSON.parse(JSON.stringify(this.loans[id])) : undefined;
  }

  updateLoan(loan: Loan): void {
    // Store the updated loan so it can be inspected
    this.loans[loan.id] = JSON.parse(JSON.stringify(loan));
  }

  // Helper for tests to set up a loan
  setLoan(loan: Loan): void {
    this.loans[loan.id] = JSON.parse(JSON.stringify(loan));
  }

  // Helper to retrieve the stored loan for assertions
  getStoredLoan(id: string): Loan | undefined {
      return this.loans[id];
  }

  clearLoans(): void {
      this.loans = {};
  }
}

class MockClientService {
  private clients: { [id: string]: Client } = {};
  // Surplus is handled by PaymentService's localStorage for clientSurpluses,
  // so ClientService mock primarily needs getClientById.

  getClientById(id: string): Client | undefined {
    return this.clients[id] ? JSON.parse(JSON.stringify(this.clients[id])) : {id: id, firstName: 'Test', lastName: 'User', email:'test@test.com', phone:'123'} as Client;
  }

  setClient(client: Client): void {
      this.clients[client.id] = JSON.parse(JSON.stringify(client));
  }

  clearClients(): void {
      this.clients = {};
  }
}

describe('PaymentService', () => {
  let service: PaymentService;
  let localStorageServiceMock: MockLocalStorageService;
  let loanServiceMock: MockLoanService;
  let clientServiceMock: MockClientService;
  let updateLoanSpy: jasmine.Spy;

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
    loanServiceMock = TestBed.inject(LoanService) as unknown as MockLoanService;
    clientServiceMock = TestBed.inject(ClientService) as unknown as MockClientService;

    // Clear stores before each test
    localStorageServiceMock.clearStore();
    loanServiceMock.clearLoans(); // Ensure fresh loan state for each test
    clientServiceMock.clearClients(); // Ensure fresh client state

    // Spy on updateLoan after loanServiceMock is initialized
    updateLoanSpy = spyOn(loanServiceMock, 'updateLoan').and.callThrough();
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

  describe('addPayment rollover logic', () => {
    const testLoanId = 'loan1';
    const testClientId = 'client1';

    function createMockLoan(installmentsSetup: Array<{amount: number, status?: InstallmentStatus, paidAmount?: number}>): Loan {
      return {
        id: testLoanId,
        clientId: testClientId,
        loanAmount: installmentsSetup.reduce((sum, inst) => sum + inst.amount, 0), // Approx
        interestRate: 0.1,
        termMonths: installmentsSetup.length,
        startDate: new Date('2023-01-01'),
        installments: installmentsSetup.map((inst, i) => ({
          installmentNumber: i + 1,
          dueDate: new Date(2023, i, 15), // Month is 0-indexed
          amount: inst.amount,
          principal: inst.amount * 0.8, // Dummy
          interest: inst.amount * 0.2,  // Dummy
          remainingBalance: 0, // Dummy
          status: inst.status || InstallmentStatus.Pending,
          paidAmount: inst.paidAmount || 0,
        })),
      };
    }

    beforeEach(() => {
        // Setup a default client for surplus tests if needed
        clientServiceMock.setClient({id: testClientId, firstName: 'Surplus', lastName: 'Test', email: '', phone: ''});
    });

    it('Scenario 1: Payment exactly covers one installment', () => {
      const loan = createMockLoan([{ amount: 100 }, { amount: 100 }]);
      loanServiceMock.setLoan(loan);

      const result = service.addPayment(testLoanId, 100, new Date());
      expect(result.success).toBeTrue();
      expect(updateLoanSpy).toHaveBeenCalled();

      const updatedLoan = loanServiceMock.getStoredLoan(testLoanId);
      expect(updatedLoan!.installments[0].paidAmount).toBe(100);
      expect(updatedLoan!.installments[0].status).toBe(InstallmentStatus.Paid);
      expect(updatedLoan!.installments[1].paidAmount).toBe(0); // Second installment untouched
      expect(updatedLoan!.installments[1].status).toBe(InstallmentStatus.Pending);

      expect(result.appliedToInstallments?.length).toBe(1);
      expect(result.appliedToInstallments).toContain(jasmine.objectContaining({ installmentNumber: 1, amountApplied: 100 }));

      // Check surplus (should be 0)
      const surplus = localStorageServiceMock.getItem<any[]>(`clientSurpluses`)?.find(s => s.clientId === testClientId);
      expect(surplus?.surplusAmount || 0).toBe(0);
    });

    it('Scenario 2: Payment covers one installment with exact surplus to fully cover the next', () => {
      const loan = createMockLoan([{ amount: 100 }, { amount: 100 }, { amount: 100 }]);
      loanServiceMock.setLoan(loan);

      const result = service.addPayment(testLoanId, 200, new Date());
      expect(result.success).toBeTrue();
      expect(updateLoanSpy).toHaveBeenCalled();

      const updatedLoan = loanServiceMock.getStoredLoan(testLoanId);
      expect(updatedLoan!.installments[0].paidAmount).toBe(100);
      expect(updatedLoan!.installments[0].status).toBe(InstallmentStatus.Paid);
      expect(updatedLoan!.installments[1].paidAmount).toBe(100);
      expect(updatedLoan!.installments[1].status).toBe(InstallmentStatus.Paid);
      expect(updatedLoan!.installments[2].paidAmount).toBe(0); // Third untouched

      expect(result.appliedToInstallments?.length).toBe(2);
      expect(result.appliedToInstallments).toContain(jasmine.objectContaining({ installmentNumber: 1, amountApplied: 100 }));
      expect(result.appliedToInstallments).toContain(jasmine.objectContaining({ installmentNumber: 2, amountApplied: 100 }));
    });

    it('Scenario 3: Payment covers one installment with surplus that partially pays the next', () => {
      const loan = createMockLoan([{ amount: 100 }, { amount: 100 }]);
      loanServiceMock.setLoan(loan);

      const result = service.addPayment(testLoanId, 150, new Date());
      expect(result.success).toBeTrue();
      expect(updateLoanSpy).toHaveBeenCalled();

      const updatedLoan = loanServiceMock.getStoredLoan(testLoanId);
      expect(updatedLoan!.installments[0].paidAmount).toBe(100);
      expect(updatedLoan!.installments[0].status).toBe(InstallmentStatus.Paid);
      expect(updatedLoan!.installments[1].paidAmount).toBe(50);
      expect(updatedLoan!.installments[1].status).toBe(InstallmentStatus.Pending); // Not fully paid

      expect(result.appliedToInstallments?.length).toBe(2);
      expect(result.appliedToInstallments).toContain(jasmine.objectContaining({ installmentNumber: 1, amountApplied: 100 }));
      expect(result.appliedToInstallments).toContain(jasmine.objectContaining({ installmentNumber: 2, amountApplied: 50 }));
    });

    it('Scenario 4: Payment covers multiple (e.g., three) installments fully', () => {
        const loan = createMockLoan([{amount: 50}, {amount: 70}, {amount: 80}, {amount: 100}]);
        loanServiceMock.setLoan(loan);

        const result = service.addPayment(testLoanId, 200, new Date()); // 50 + 70 + 80 = 200
        expect(result.success).toBeTrue();
        expect(updateLoanSpy).toHaveBeenCalled();

        const updatedLoan = loanServiceMock.getStoredLoan(testLoanId);
        expect(updatedLoan!.installments[0].status).toBe(InstallmentStatus.Paid);
        expect(updatedLoan!.installments[0].paidAmount).toBe(50);
        expect(updatedLoan!.installments[1].status).toBe(InstallmentStatus.Paid);
        expect(updatedLoan!.installments[1].paidAmount).toBe(70);
        expect(updatedLoan!.installments[2].status).toBe(InstallmentStatus.Paid);
        expect(updatedLoan!.installments[2].paidAmount).toBe(80);
        expect(updatedLoan!.installments[3].status).toBe(InstallmentStatus.Pending);
        expect(updatedLoan!.installments[3].paidAmount).toBe(0);

        expect(result.appliedToInstallments?.length).toBe(3);
    });

    it('Scenario 5: Payment covers all installments and generates client surplus', () => {
      const loan = createMockLoan([{ amount: 100 }, { amount: 100 }]);
      loanServiceMock.setLoan(loan);

      const result = service.addPayment(testLoanId, 250, new Date()); // 200 for loan, 50 surplus
      expect(result.success).toBeTrue();
      expect(updateLoanSpy).toHaveBeenCalled();

      const updatedLoan = loanServiceMock.getStoredLoan(testLoanId);
      expect(updatedLoan!.installments[0].status).toBe(InstallmentStatus.Paid);
      expect(updatedLoan!.installments[0].paidAmount).toBe(100);
      expect(updatedLoan!.installments[1].status).toBe(InstallmentStatus.Paid);
      expect(updatedLoan!.installments[1].paidAmount).toBe(100);

      expect(result.appliedToInstallments?.length).toBe(2); // Applied to 2 installments

      const clientSurpluses = localStorageServiceMock.getItem<ClientSurplus[]>('clientSurpluses') || [];
      const clientSurplus = clientSurpluses.find(cs => cs.clientId === testClientId);
      expect(clientSurplus).toBeTruthy();
      expect(clientSurplus?.surplusAmount).toBe(50);
    });

    it('Scenario 6: Payment is less than the first installment amount', () => {
        const loan = createMockLoan([{amount: 100}, {amount:100}]);
        loanServiceMock.setLoan(loan);

        const result = service.addPayment(testLoanId, 70, new Date());
        expect(result.success).toBeTrue();
        expect(updateLoanSpy).toHaveBeenCalled();

        const updatedLoan = loanServiceMock.getStoredLoan(testLoanId);
        expect(updatedLoan!.installments[0].paidAmount).toBe(70);
        expect(updatedLoan!.installments[0].status).toBe(InstallmentStatus.Pending);
        expect(updatedLoan!.installments[1].paidAmount).toBe(0);

        expect(result.appliedToInstallments?.length).toBe(1);
        expect(result.appliedToInstallments).toContain(jasmine.objectContaining({ installmentNumber: 1, amountApplied: 70 }));
    });

    it('Scenario 7: Loan has installments partially/fully paid, new payment applies correctly', () => {
      const loan = createMockLoan([
        { amount: 100, status: InstallmentStatus.Paid, paidAmount: 100 }, // Already Paid
        { amount: 100, status: InstallmentStatus.Pending, paidAmount: 30 },  // Partially Paid
        { amount: 100, status: InstallmentStatus.Pending, paidAmount: 0 },   // Unpaid
        { amount: 100, status: InstallmentStatus.Pending, paidAmount: 0 }    // Unpaid
      ]);
      loanServiceMock.setLoan(loan);

      // Payment of 150.
      // Expected:
      // Inst 2: needs 70. 150 - 70 = 80 remaining. Inst 2 becomes Paid.
      // Inst 3: needs 100. Takes 80. Inst 3 becomes partially paid (80). 0 remaining.
      const result = service.addPayment(testLoanId, 150, new Date());
      expect(result.success).toBeTrue();
      expect(updateLoanSpy).toHaveBeenCalled();

      const updatedLoan = loanServiceMock.getStoredLoan(testLoanId);
      // Inst 1 (already paid)
      expect(updatedLoan!.installments[0].paidAmount).toBe(100);
      expect(updatedLoan!.installments[0].status).toBe(InstallmentStatus.Paid);
      // Inst 2 (was partially paid, now fully)
      expect(updatedLoan!.installments[1].paidAmount).toBe(100); // 30 + 70
      expect(updatedLoan!.installments[1].status).toBe(InstallmentStatus.Paid);
      // Inst 3 (was unpaid, now partially)
      expect(updatedLoan!.installments[2].paidAmount).toBe(80);
      expect(updatedLoan!.installments[2].status).toBe(InstallmentStatus.Pending);
      // Inst 4 (untouched)
      expect(updatedLoan!.installments[3].paidAmount).toBe(0);
      expect(updatedLoan!.installments[3].status).toBe(InstallmentStatus.Pending);

      expect(result.appliedToInstallments?.length).toBe(2);
      expect(result.appliedToInstallments).toContain(jasmine.objectContaining({ installmentNumber: 2, amountApplied: 70 }));
      expect(result.appliedToInstallments).toContain(jasmine.objectContaining({ installmentNumber: 3, amountApplied: 80 }));
    });
  });
});
