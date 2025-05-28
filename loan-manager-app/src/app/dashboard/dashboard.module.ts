import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardComponent } from './dashboard/dashboard.component'; // Corrected path
import { DashboardViewComponent } from './components/dashboard-view/dashboard-view.component';


@NgModule({
  declarations: [
    // Components are now standalone and should not be declared here.
  ],
  imports: [
    CommonModule, // Keep for any pipes or directives used by the module itself or its routing
    DashboardRoutingModule
  ],
  providers: [
    provideCharts(withDefaultRegisterables()) // Chart providers remain here
  ]
})
export class DashboardModule { }
