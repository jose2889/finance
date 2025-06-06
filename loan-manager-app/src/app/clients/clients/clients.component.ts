import { Component } from '@angular/core';

import { CommonModule } from '@angular/common'; // Import CommonModule
import { RouterModule } from '@angular/router'; // Import RouterModule

@Component({
  selector: 'app-clients',
  standalone: true, // Add standalone: true
  imports: [CommonModule, RouterModule], // Add necessary imports
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.css'
})
export class ClientsComponent {

}
