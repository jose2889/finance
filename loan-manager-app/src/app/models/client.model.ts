export interface Client {
  id: string; // Unique identifier (e.g., UUID)
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
}
