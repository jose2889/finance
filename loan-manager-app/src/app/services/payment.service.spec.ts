import { TestBed } from '@angular/core/testing';
import { PaymentService } from './payment.service';
import { LocalStorageService } from './local-storage.service';
import { LoanService } from './loan.service';
import { ClientService } from './client.service';
import { Payment, Loan, InstallmentStatus, Client, LoanType, ClientSurplus, Installment } from '../models'; // Import LoanType, ClientSurplus, Installment

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

  // Mock for the method that will be called by PaymentService
  calculateAccruedInterestForOneMonth(principal: number, monthlyInterestRate: number): number {
    // This will be spied upon and can return test-specific values
    return parseFloat((principal * monthlyInterestRate * 30 / 30).toFixed(2)); // Simplified, actual logic in LoanService
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
  let calculateAccruedInterestSpy: jasmine.Spy;

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
    calculateAccruedInterestSpy = spyOn(loanServiceMock, 'calculateAccruedInterestForOneMonth').and.callThrough();
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

  describe('addPayment rollover logic', () => { // This suite tests AMORTIZED loans
    const testLoanId = 'loanAmortized1';
    const testClientId = 'clientAmortized1';

    // Helper for creating AMORTIZED mock loans for existing tests
    function createMockAmortizedLoan(
        id: string,
        clientId: string,
        loanAmount: number,
        annualInterestRate: number, // For amortized, this is annual
        termMonths: number,
        installmentsSetup: Array<{amount: number, status?: InstallmentStatus, paidAmount?: number}>
    ): Loan {
      return {
        id,
        clientId,
        loanAmount,
        interestRate: annualInterestRate, // Storing annual rate
        termMonths,
        startDate: new Date('2023-01-01'),
        loanType: LoanType.AMORTIZED, // Explicitly AMORTIZED
        installments: installmentsSetup.map((inst, i) => ({
          installmentNumber: i + 1,
          dueDate: new Date(2023, i, 15),
          amount: inst.amount,
          // For amortized, principal & interest would typically be calculated by LoanService.calculateInstallments
          // For these tests, we are mocking the installment structure directly for simplicity.
          principal: inst.amount * 0.8, // Placeholder
          interest: inst.amount * 0.2,  // Placeholder
          remainingBalance: loanAmount - (inst.paidAmount || 0), // Simplified placeholder
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
      const loan = createMockAmortizedLoan(testLoanId, testClientId, 200, 0.1, 2, [{ amount: 100 }, { amount: 100 }]);
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
      const loan = createMockAmortizedLoan(testLoanId, testClientId, 300, 0.1, 3, [{ amount: 100 }, { amount: 100 }, { amount: 100 }]);
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
      const loan = createMockAmortizedLoan(testLoanId, testClientId, 200, 0.1, 2, [{ amount: 100 }, { amount: 100 }]);
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
        const loan = createMockAmortizedLoan(testLoanId, testClientId, 300, 0.1, 4, [{amount: 50}, {amount: 70}, {amount: 80}, {amount: 100}]);
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
      const loan = createMockAmortizedLoan(testLoanId, testClientId, 200, 0.1, 2, [{ amount: 100 }, { amount: 100 }]);
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
        const loan = createMockAmortizedLoan(testLoanId, testClientId, 200, 0.1, 2, [{amount: 100}, {amount:100}]);
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
      const loan = createMockAmortizedLoan(testLoanId, testClientId, 400, 0.1, 4, [
        { amount: 100, status: InstallmentStatus.Paid, paidAmount: 100 },
        { amount: 100, status: InstallmentStatus.Pending, paidAmount: 30 },
        { amount: 100, status: InstallmentStatus.Pending, paidAmount: 0 },
        { amount: 100, status: InstallmentStatus.Pending, paidAmount: 0 }
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

  describe('addPayment - INTEREST_ONLY_DAILY_ACCRUAL loans', () => {
    const testInterestOnlyLoanId = 'loanIO1';
    const testInterestOnlyClientId = 'clientIO1';
    const defaultMonthlyRate = 0.02; // 2% monthly

    // Helper for creating INTEREST_ONLY mock loans
    function createMockInterestOnlyLoan(
        id: string,
        clientId: string,
        principal: number,
        monthlyInterestRate: number,
        termMonths: number,
        installmentsSetup: Array<{amount: number, status?: InstallmentStatus, paidAmount?: number}>
    ): Loan {
      return {
        id,
        clientId,
        loanAmount: principal, // Current principal
        interestRate: monthlyInterestRate, // Storing monthly rate
        termMonths,
        startDate: new Date('2023-01-01'),
        loanType: LoanType.INTEREST_ONLY_DAILY_ACCRUAL,
        installments: installmentsSetup.map((inst, i) => ({
          installmentNumber: i + 1,
          dueDate: new Date(2023, i, 15), // Simplified due dates
          amount: inst.amount, // This is the expected interest payment
          principal: 0, // For interest-only, scheduled principal is 0
          interest: inst.amount, // Scheduled interest is the full amount
          remainingBalance: principal, // Principal does not decrease with these scheduled payments
          status: inst.status || InstallmentStatus.Pending,
          paidAmount: inst.paidAmount || 0,
        })),
      };
    }

    beforeEach(() => {
      clientServiceMock.setClient({id: testInterestOnlyClientId, firstName: 'IO Test', lastName: 'User', email: '', phone: ''});
      // Default spy behavior for interest calculation for this suite
      calculateAccruedInterestSpy.and.callFake((principal, monthlyRate) => {
          return parseFloat((principal * monthlyRate).toFixed(2)); // Simplified: monthlyRate * principal for "one month"
      });
    });

    it('Scenario 1 (IO): Payment only covers part of accrued interest', () => {
      const loan = createMockInterestOnlyLoan(testInterestOnlyLoanId, testInterestOnlyClientId, 1000, defaultMonthlyRate, 2,
        [{ amount: 20 }, { amount: 20 }] // Expected interest = 1000 * 0.02 = 20
      );
      loanServiceMock.setLoan(loan);

      const result = service.addPayment(testInterestOnlyLoanId, 10, new Date()); // Pay 10 of 20 interest
      expect(result.success).toBeTrue();
      expect(updateLoanSpy).toHaveBeenCalled();

      const updatedLoan = loanServiceMock.getStoredLoan(testInterestOnlyLoanId);
      expect(updatedLoan!.installments[0].paidAmount).toBe(10);
      expect(updatedLoan!.installments[0].status).toBe(InstallmentStatus.Pending);
      expect(updatedLoan!.loanAmount).toBe(1000); // Principal unchanged
      expect(result.appliedToInstallments).toEqual([{ installmentNumber: 1, amountApplied: 10 }]);
    });

    it('Scenario 2 (IO): Payment exactly covers accrued interest', () => {
      const loan = createMockInterestOnlyLoan(testInterestOnlyLoanId, testInterestOnlyClientId, 1000, defaultMonthlyRate, 2,
        [{ amount: 20 }, { amount: 20 }]
      );
      loanServiceMock.setLoan(loan);

      const result = service.addPayment(testInterestOnlyLoanId, 20, new Date());
      expect(result.success).toBeTrue();
      expect(updateLoanSpy).toHaveBeenCalled();

      const updatedLoan = loanServiceMock.getStoredLoan(testInterestOnlyLoanId);
      expect(updatedLoan!.installments[0].paidAmount).toBe(20);
      expect(updatedLoan!.installments[0].status).toBe(InstallmentStatus.Paid);
      expect(updatedLoan!.loanAmount).toBe(1000); // Principal unchanged
      expect(result.appliedToInstallments).toEqual([{ installmentNumber: 1, amountApplied: 20 }]);
    });

    it('Scenario 3 (IO): Payment covers accrued interest and partially reduces principal; future installments recalculated', () => {
      const initialPrincipal = 1000;
      const monthlyRate = 0.02; // 2%
      const initialInterestInstallment = initialPrincipal * monthlyRate; // 20

      const loan = createMockInterestOnlyLoan(testInterestOnlyLoanId, testInterestOnlyClientId, initialPrincipal, monthlyRate, 3,
        [
          { amount: initialInterestInstallment, status: InstallmentStatus.Pending, paidAmount: 0 }, // Inst 1
          { amount: initialInterestInstallment, status: InstallmentStatus.Pending, paidAmount: 0 }, // Inst 2
          { amount: initialInterestInstallment, status: InstallmentStatus.Pending, paidAmount: 0 }  // Inst 3
        ]
      );
      loanServiceMock.setLoan(loan);

      // Configure spy for recalculation: new principal will be 1000 - 50 = 950. New interest = 950 * 0.02 = 19
      calculateAccruedInterestSpy.and.callFake((principal, rate) => {
          if (principal === 950) return 19;
          return parseFloat((principal * rate).toFixed(2)); // Default fallback
      });

      const paymentAmount = 150; // 100 for interest (assuming one installment is $100, but it's $20), 50 for principal
                                // Correcting: pay $20 for interest, $130 for principal
      const result = service.addPayment(testInterestOnlyLoanId, initialInterestInstallment + 130, new Date()); // Pay $20 (interest) + $130 (principal) = $150

      expect(result.success).toBeTrue();
      expect(updateLoanSpy).toHaveBeenCalled();

      const updatedLoan = loanServiceMock.getStoredLoan(testInterestOnlyLoanId)!;
      expect(updatedLoan.installments[0].paidAmount).toBe(initialInterestInstallment);
      expect(updatedLoan.installments[0].status).toBe(InstallmentStatus.Paid);
      expect(updatedLoan.loanAmount).toBe(initialPrincipal - 130); // 1000 - 130 = 870

      expect(result.appliedToInstallments).toContain(jasmine.objectContaining({ installmentNumber: 1, amountApplied: initialInterestInstallment }));
      expect(result.appliedToInstallments).toContain(jasmine.objectContaining({ installmentNumber: -1, amountApplied: 130, notes: 'Principal Reduction' }));

      // Check future installments (Inst 2 and 3) are regenerated
      // Assuming the spy was set up for newPrincipal * monthlyRate = 870 * 0.02 = 17.4
      calculateAccruedInterestSpy.and.callFake((principal, rate) => parseFloat((principal * rate).toFixed(2))); // Reset to general calc for assertion check

      const newExpectedInterest = loanServiceMock.calculateAccruedInterestForOneMonth(updatedLoan.loanAmount, monthlyRate); // 870 * 0.02 = 17.4

      expect(updatedLoan.installments[1].status).toBe(InstallmentStatus.Pending);
      expect(updatedLoan.installments[1].amount).toBe(newExpectedInterest);
      expect(updatedLoan.installments[1].interest).toBe(newExpectedInterest);
      expect(updatedLoan.installments[1].paidAmount).toBe(0);
      expect(updatedLoan.installments[1].remainingBalance).toBe(updatedLoan.loanAmount);

      expect(updatedLoan.installments[2].status).toBe(InstallmentStatus.Pending);
      expect(updatedLoan.installments[2].amount).toBe(newExpectedInterest);
      expect(updatedLoan.installments[2].interest).toBe(newExpectedInterest);
      expect(updatedLoan.installments[2].paidAmount).toBe(0);
      expect(updatedLoan.installments[2].remainingBalance).toBe(updatedLoan.loanAmount);
    });

    it('Scenario 4 (IO): Payment fully pays off a small principal after covering interest', () => {
      const initialPrincipal = 50;
      const monthlyRate = 0.10; // 10% -> $5 interest
      const initialInterestInstallment = initialPrincipal * monthlyRate; // 5
      const loan = createMockInterestOnlyLoan(testInterestOnlyLoanId, testInterestOnlyClientId, initialPrincipal, monthlyRate, 2,
        [{ amount: initialInterestInstallment }, { amount: initialInterestInstallment }]
      );
      loanServiceMock.setLoan(loan);
      calculateAccruedInterestSpy.and.returnValue(0); // After principal is 0, interest is 0

      const result = service.addPayment(testInterestOnlyLoanId, initialInterestInstallment + initialPrincipal, new Date()); // Pay 5 interest + 50 principal = 55
      expect(result.success).toBeTrue();
      expect(updateLoanSpy).toHaveBeenCalled();

      const updatedLoan = loanServiceMock.getStoredLoan(testInterestOnlyLoanId)!;
      expect(updatedLoan.installments[0].paidAmount).toBe(initialInterestInstallment);
      expect(updatedLoan.installments[0].status).toBe(InstallmentStatus.Paid);
      expect(updatedLoan.loanAmount).toBe(0); // Principal fully paid

      expect(result.appliedToInstallments).toContain(jasmine.objectContaining({ installmentNumber: 1, amountApplied: initialInterestInstallment }));
      expect(result.appliedToInstallments).toContain(jasmine.objectContaining({ installmentNumber: -1, amountApplied: initialPrincipal, notes: 'Principal Reduction' }));

      // Future installments should be 0 or handled as per business rules (e.g., removed or marked paid)
      expect(updatedLoan.installments[1].amount).toBe(0); // Due to recalculation with 0 principal
      expect(updatedLoan.installments[1].interest).toBe(0);
      // Status of future installments might remain Pending but with 0 amount, or become Paid.
      // Current logic recalculates them to 0 and keeps them Pending.
    });

    it('Scenario 5 (IO): Payment on a loan with already reduced principal', () => {
        const originalPrincipal = 1000;
        const currentPrincipal = 900; // Already reduced
        const monthlyRate = 0.02; // 2%
        const currentInterestInstallment = currentPrincipal * monthlyRate; // 18

        const loan = createMockInterestOnlyLoan(testInterestOnlyLoanId, testInterestOnlyClientId, currentPrincipal, monthlyRate, 3,
            [ // Installments reflect current principal for their amounts
                { amount: currentInterestInstallment, status: InstallmentStatus.Pending, paidAmount: 0 },
                { amount: currentInterestInstallment, status: InstallmentStatus.Pending, paidAmount: 0 },
                { amount: currentInterestInstallment, status: InstallmentStatus.Pending, paidAmount: 0 }
            ]
        );
        loanServiceMock.setLoan(loan);

        // Payment of 28: 18 for current interest, 10 for principal reduction
        const paymentAmount = currentInterestInstallment + 10;
        const newPrincipalAfterPayment = currentPrincipal - 10; // 890
        calculateAccruedInterestSpy.and.callFake((principal, rate) => {
            if (principal === newPrincipalAfterPayment) return parseFloat((newPrincipalAfterPayment * rate).toFixed(2)); // e.g. 890 * 0.02 = 17.80
            return parseFloat((principal * rate).toFixed(2));
        });

        const result = service.addPayment(testInterestOnlyLoanId, paymentAmount, new Date());
        expect(result.success).toBeTrue();
        expect(updateLoanSpy).toHaveBeenCalled();

        const updatedLoan = loanServiceMock.getStoredLoan(testInterestOnlyLoanId)!;
        expect(updatedLoan.installments[0].paidAmount).toBe(currentInterestInstallment);
        expect(updatedLoan.installments[0].status).toBe(InstallmentStatus.Paid);
        expect(updatedLoan.loanAmount).toBe(newPrincipalAfterPayment);

        expect(result.appliedToInstallments).toContain(jasmine.objectContaining({ installmentNumber: 1, amountApplied: currentInterestInstallment }));
        expect(result.appliedToInstallments).toContain(jasmine.objectContaining({ installmentNumber: -1, amountApplied: 10, notes: 'Principal Reduction' }));

        const newExpectedFutureInterest = loanServiceMock.calculateAccruedInterestForOneMonth(updatedLoan.loanAmount, monthlyRate);
        expect(updatedLoan.installments[1].amount).toBe(newExpectedFutureInterest);
        expect(updatedLoan.installments[1].interest).toBe(newExpectedFutureInterest);
    });
  });
});
