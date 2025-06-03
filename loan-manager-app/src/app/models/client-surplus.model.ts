export interface ClientSurplus {
  clientId: string;       // Unique identifier of the client (matches Client['id'])
  surplusAmount: number;  // The current total surplus amount for this client
  lastUpdated: Date;      // Timestamp of when this surplus was last updated
}
