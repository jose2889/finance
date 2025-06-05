import { TranslateInstallmentStatusPipe } from './translate-installment-status.pipe';
import { InstallmentStatus } from '../models/installment.model';

describe('TranslateInstallmentStatusPipe', () => {
  let pipe: TranslateInstallmentStatusPipe;

  beforeEach(() => {
    pipe = new TranslateInstallmentStatusPipe();
  });

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should translate InstallmentStatus.Pending to "Pendiente"', () => {
    expect(pipe.transform(InstallmentStatus.Pending)).toBe('Pendiente');
  });

  it('should translate "Pending" string to "Pendiente"', () => {
    expect(pipe.transform('Pending')).toBe('Pendiente');
  });

  it('should translate InstallmentStatus.Paid to "Pagado"', () => {
    expect(pipe.transform(InstallmentStatus.Paid)).toBe('Pagado');
  });

  it('should translate "Paid" string to "Pagado"', () => {
    expect(pipe.transform('Paid')).toBe('Pagado');
  });

  it('should translate InstallmentStatus.Overdue to "Vencido"', () => {
    expect(pipe.transform(InstallmentStatus.Overdue)).toBe('Vencido');
  });

  it('should translate "Overdue" string to "Vencido"', () => {
    expect(pipe.transform('Overdue')).toBe('Vencido');
  });

  it('should return the original value for an unknown status string', () => {
    const unknownStatus = 'UnknownStatus';
    expect(pipe.transform(unknownStatus)).toBe(unknownStatus);
  });

  it('should return an empty string for undefined input', () => {
    expect(pipe.transform(undefined)).toBe('');
  });

  it('should be case-insensitive for known status strings (e.g., "pending")', () => {
    expect(pipe.transform('pending')).toBe('Pendiente');
    expect(pipe.transform('paid')).toBe('Pagado');
    expect(pipe.transform('overdue')).toBe('Vencido');
  });

  it('should return the original value if it is a known status but in mixed/wrong case that default logic does not catch', () => {
    // This test depends on the exact implementation of the default case
    // The current pipe's default case handles lowercase, so "PeNdInG" would pass through
    expect(pipe.transform('PeNdInG')).toBe('PeNdInG');
  });
});
