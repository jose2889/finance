import { Pipe, PipeTransform } from '@angular/core';
import { InstallmentStatus } from '../models/installment.model'; // Assuming InstallmentStatus is exported from this model

@Pipe({
  name: 'translateInstallmentStatus',
  standalone: true // For Angular 14+ standalone components
})
export class TranslateInstallmentStatusPipe implements PipeTransform {

  transform(value: InstallmentStatus | string | undefined): string {
    if (!value) {
      return '';
    }
    switch (value) {
      case InstallmentStatus.Pending:
        return 'Pendiente';
      case InstallmentStatus.Paid:
        return 'Pagado';
      case InstallmentStatus.Overdue:
        return 'Vencido';
      default:
        // Handle potential string values if they don't match enum members
        // Or if the status comes as a plain string not matching an enum key
        const lowerValue = typeof value === 'string' ? value.toLowerCase() : '';
        if (lowerValue === 'pending') return 'Pendiente';
        if (lowerValue === 'paid') return 'Pagado';
        if (lowerValue === 'overdue') return 'Vencido';
        return value as string; // Return original value if no match
    }
  }
}
