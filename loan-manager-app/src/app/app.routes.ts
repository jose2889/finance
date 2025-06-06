import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'dashboard', loadChildren: () => import('./dashboard/dashboard.module').then(m => m.DashboardModule) },
  { path: 'clients', loadChildren: () => import('./clients/clients.module').then(m => m.ClientsModule) },
  { path: 'loans', loadChildren: () => import('./loans/loans.module').then(m => m.LoansModule) },
  {
    path: 'interest-only-loans',
    loadChildren: () => import('./interest-only-loans/interest-only-loans.module').then(m => m.InterestOnlyLoansModule)
  },
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' }
];
