import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms'; // Import this

import { ClientsRoutingModule } from './clients-routing.module';
import { ClientsComponent } from './clients/clients.component'; // Corrected path
import { ClientListComponent } from './components/client-list/client-list.component';
import { ClientFormComponent } from './components/client-form/client-form.component';

@NgModule({
  declarations: [
    // Components are now standalone and should not be declared here.
  ],
  imports: [
    CommonModule, // Keep for any pipes or directives used by the module itself or its routing
    ClientsRoutingModule,
    ReactiveFormsModule // Keep for any services or if the module itself provides form-related things
    // Standalone components used in routes will be loaded by the router.
  ]
})
export class ClientsModule { }
