import { Injectable } from '@angular/core';
import { Client } from '../models'; // Adjust path if necessary
import { LocalStorageService } from './local-storage.service';

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private readonly storageKey = 'clients';

  constructor(private localStorageService: LocalStorageService) { }

  private getClientsFromStorage(): Client[] {
    return this.localStorageService.getItem<Client[]>(this.storageKey) || [];
  }

  private saveClientsToStorage(clients: Client[]): void {
    this.localStorageService.setItem(this.storageKey, clients);
  }

  getClients(): Client[] {
    return this.getClientsFromStorage();
  }

  getClientById(id: string): Client | undefined {
    const clients = this.getClientsFromStorage();
    return clients.find(client => client.id === id);
  }

  addClient(clientData: Omit<Client, 'id'>): Client {
    const clients = this.getClientsFromStorage();
    const newClient: Client = { ...clientData, id: crypto.randomUUID() };
    clients.push(newClient);
    this.saveClientsToStorage(clients);
    return newClient;
  }

  updateClient(updatedClient: Client): boolean {
    let clients = this.getClientsFromStorage();
    const index = clients.findIndex(client => client.id === updatedClient.id);
    if (index > -1) {
      clients[index] = updatedClient;
      this.saveClientsToStorage(clients);
      return true;
    }
    return false;
  }

  deleteClient(id: string): boolean {
    let clients = this.getClientsFromStorage();
    const initialLength = clients.length;
    clients = clients.filter(client => client.id !== id);
    if (clients.length < initialLength) {
      this.saveClientsToStorage(clients);
      return true;
    }
    return false;
  }
}
