import { Component } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router'; // Ensure RouterModule is imported

@Component({
  selector: 'app-root',
  standalone: true, // Add this
  imports: [RouterOutlet, RouterModule], // Add RouterModule
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'loan-manager-app';
}
