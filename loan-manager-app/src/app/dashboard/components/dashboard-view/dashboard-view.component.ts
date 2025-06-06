import { Component, OnInit, ViewChild } from '@angular/core';
import { ChartConfiguration, ChartData, ChartEvent, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts'; // if needed for direct manipulation

import { ClientService } from '../../../services/client.service'; // Adjusted path
import { LoanService } from '../../../services/loan.service';   // Adjusted path
import { PaymentService } from '../../../services/payment.service'; // Import PaymentService
import { Client, Loan } from '../../../models';         // Adjusted path
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Import FormsModule for ngModel (or event binding)
import { RouterModule } from '@angular/router';
// BaseChartDirective is already imported earlier in the file, ensure it's used in imports array
// import { BaseChartDirective } from 'ng2-charts';


@Component({
  selector: 'app-dashboard-view',
  standalone: true,
  imports: [CommonModule, RouterModule, BaseChartDirective, FormsModule], // Add FormsModule
  templateUrl: './dashboard-view.component.html',
  styleUrls: ['./dashboard-view.component.scss']
})
export class DashboardViewComponent implements OnInit {
  // General Metrics
  totalClients: number = 0;
  totalLoans: number = 0;
  totalLoanedAmount: number = 0;
  totalPaymentsReceived: number = 0;

  // Date Filter Properties
  filterStartDate!: Date;
  filterEndDate!: Date;

  // Bar Chart: Loans per Client
  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    scales: { x: {}, y: { min: 0, ticks: { stepSize: 1 } } },
    plugins: { legend: { display: true, position: 'top' } }
  };
  public barChartType: ChartType = 'bar';
  public barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      { data: [], label: 'Número de Préstamos', backgroundColor: 'rgba(54, 162, 235, 0.5)', borderColor: 'rgb(54, 162, 235)', borderWidth: 1 }
    ]
  };

  // Pie Chart: Loan Amount Distribution (showing each loan as a segment)
  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: { legend: { display: true, position: 'top' } }
  };
  public pieChartType: ChartType = 'pie';
  public pieChartData: ChartData<'pie'> = {
    labels: [], // e.g., ['Loan 1 (Client X)', 'Loan 2 (Client Y)']
    datasets: [{
      data: [],
      backgroundColor: [ // Add more colors for more loans
           'rgba(255, 99, 132, 0.5)', 'rgba(54, 162, 235, 0.5)',
           'rgba(255, 206, 86, 0.5)', 'rgba(75, 192, 192, 0.5)',
           'rgba(153, 102, 255, 0.5)', 'rgba(255, 159, 64, 0.5)'
       ],
       borderColor: [
           'rgb(255, 99, 132)', 'rgb(54, 162, 235)',
           'rgb(255, 206, 86)', 'rgb(75, 192, 192)',
           'rgb(153, 102, 255)', 'rgb(255, 159, 64)'
       ],
       borderWidth: 1
    }]
  };

  // Use ViewChild to get a reference to the chart instance if needed for API calls
  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;

  constructor(
    private clientService: ClientService,
    private loanService: LoanService,
    private paymentService: PaymentService // Inject PaymentService
  ) { }

  ngOnInit(): void {
    const today = new Date();
    this.filterEndDate = new Date(today);
    this.filterStartDate = new Date(today);
    this.filterStartDate.setFullYear(today.getFullYear() - 1);

    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loadMetrics();
    this.prepareBarChartData(); // Will use unfiltered data for now
    this.preparePieChartData();   // Will use unfiltered data for now
  }

  loadMetrics(): void {
    const clients = this.clientService.getClients(); // Unfiltered for now
    console.log('[DashboardView] Fetched Clients:', clients);
    const loans = this.loanService.getLoans(this.filterStartDate, this.filterEndDate);
    console.log('[DashboardView] Filter Dates:', { start: this.filterStartDate, end: this.filterEndDate });
    console.log('[DashboardView] Fetched Loans (filtered):', loans);

    this.totalClients = clients.length; // Remains based on all clients, not date filtered
    this.totalLoans = loans.length;
    this.totalLoanedAmount = loans.reduce((sum, loan) => sum + loan.loanAmount, 0);

    const rawTotalPayments = this.paymentService.getTotalPaymentsReceived(this.filterStartDate, this.filterEndDate);
    console.log('[DashboardView] Raw Total Payments Received (filtered):', rawTotalPayments);
    this.totalPaymentsReceived = rawTotalPayments;
  }

  prepareBarChartData(): void {
    const clients = this.clientService.getClients(); // clientService.getClients() is not date filtered
    const loans = this.loanService.getLoans(this.filterStartDate, this.filterEndDate);
    const clientLoanCounts: { [key: string]: number } = {};

    clients.forEach(client => {
      clientLoanCounts[client.id] = 0;
    });
    loans.forEach(loan => {
      if (clientLoanCounts[loan.clientId] !== undefined) {
        clientLoanCounts[loan.clientId]++;
      }
    });

    this.barChartData.labels = clients.map(c => `${c.firstName} ${c.lastName}`);
    this.barChartData.datasets[0].data = clients.map(c => clientLoanCounts[c.id]);
    this.chart?.update(); // Update chart if already rendered
  }

  preparePieChartData(): void {
    const loans = this.loanService.getLoans(this.filterStartDate, this.filterEndDate);
    const clients = this.clientService.getClients(); // clientService.getClients() is not date filtered
    
    const pieLabels: string[] = [];
    const pieData: number[] = [];

    loans.forEach((loan, index) => {
      const client = clients.find(c => c.id === loan.clientId);
      const clientName = client ? `${client.firstName} ${client.lastName}` : 'Cliente Desconocido'; // Also translate fallback
      pieLabels.push(`Préstamo #${index + 1} (${clientName}) - ${this.formatCurrency(loan.loanAmount)}`);
      pieData.push(loan.loanAmount);
    });

    this.pieChartData.labels = pieLabels;
    this.pieChartData.datasets[0].data = pieData;
    this.chart?.update(); // Update chart if already rendered
  }
  
  formatCurrency(amount: number): string {
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  // Event handlers for date changes
  onStartDateChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    // HTML date input value is 'yyyy-MM-dd'. Adding 'T00:00:00' to ensure it's parsed in local timezone.
    this.filterStartDate = new Date(inputElement.value + 'T00:00:00');
  }

  onEndDateChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    // HTML date input value is 'yyyy-MM-dd'. Adding 'T00:00:00' to ensure it's parsed in local timezone.
    this.filterEndDate = new Date(inputElement.value + 'T00:00:00');
  }

  // Method for the "Apply Filter" button
  applyFiltersAndReloadData(): void {
    // Ensure endDate is set to the end of the day for full inclusivity if needed by backend logic
    // (already handled in services, but good to be mindful)
    // For example: this.filterEndDate.setHours(23, 59, 59, 999);
    this.loadDashboardData();
  }

  // Method for the "Reset Filter" button
  resetFiltersAndReloadData(): void {
    const today = new Date();
    this.filterEndDate = new Date(today);
    this.filterStartDate = new Date(today);
    this.filterStartDate.setFullYear(today.getFullYear() - 1);
    this.loadDashboardData();
  }
}
