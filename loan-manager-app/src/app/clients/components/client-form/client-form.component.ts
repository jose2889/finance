import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientService } from '../../../services/client.service'; // Adjusted path
import { Client } from '../../../models'; // Adjusted path
import { CommonModule } from '@angular/common'; // Import CommonModule
import { ReactiveFormsModule } from '@angular/forms'; // Import ReactiveFormsModule
import { RouterModule } from '@angular/router'; // Import RouterModule

@Component({
  selector: 'app-client-form',
  standalone: true, // Add standalone: true
  imports: [CommonModule, ReactiveFormsModule, RouterModule], // Add necessary imports
  templateUrl: './client-form.component.html',
  styleUrls: ['./client-form.component.css']
})
export class ClientFormComponent implements OnInit {
  clientForm!: FormGroup; // Definite assignment assertion
  isEditMode = false;
  clientId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private clientService: ClientService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.clientId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.clientId;
    this.initForm();

    if (this.isEditMode && this.clientId) {
      const client = this.clientService.getClientById(this.clientId);
      if (client) {
        this.clientForm.patchValue(client);
      } else {
        // Handle client not found, maybe navigate back or show error
        console.error('Cliente no encontrado para editar');
        this.router.navigate(['/clients']);
      }
    }
  }

  initForm(): void {
    this.clientForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.email]],
      phone: [''],
      address: ['']
    });
  }

  get formControls() { return this.clientForm.controls; }

  onSubmit(): void {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched(); // Mark fields as touched to show errors
      return;
    }

    const clientData = this.clientForm.value;

    if (this.isEditMode && this.clientId) {
      this.clientService.updateClient({ ...clientData, id: this.clientId });
    } else {
      this.clientService.addClient(clientData);
    }
    this.router.navigate(['/clients']);
  }

  cancel(): void {
    this.router.navigate(['/clients']);
  }
}
