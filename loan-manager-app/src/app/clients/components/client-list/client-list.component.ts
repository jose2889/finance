import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Client } from '../../../models'; // Adjust path
import { ClientService } from '../../../services/client.service'; // Adjust path
import { CommonModule } from '@angular/common'; // Import CommonModule
import { RouterModule } from '@angular/router'; // Import RouterModule


@Component({
  selector: 'app-client-list',
  standalone: true, // Add standalone: true
  imports: [CommonModule, RouterModule], // Add necessary imports
  templateUrl: './client-list.component.html',
  styleUrls: ['./client-list.component.scss']
})
export class ClientListComponent implements OnInit {
  clients: Client[] = [];

  constructor(private clientService: ClientService, private router: Router) { }

  ngOnInit(): void {
    this.loadClients();
  }

  loadClients(): void {
    this.clients = this.clientService.getClients();
  }

  editClient(id: string): void {
    this.router.navigate(['/clients/edit', id]);
  }

  deleteClient(id: string): void {
    if (confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
      this.clientService.deleteClient(id);
      this.loadClients(); // Refresh list
    }
  }

  navigateToAddClient(): void {
    this.router.navigate(['/clients/new']);
  }
}
