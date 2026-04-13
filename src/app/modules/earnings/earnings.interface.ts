export interface IEarningsListQuery {
  search?: string;
  page?: number | string;
  limit?: number | string;
}

export interface IEarningRow {
  key?: string;
  serial: number;
  passengerName: string;
  riderName: string;
  passengerEmail: string;
  riderEmail: string;
  date: string;
  amount: string;
  commission: string;
  riderEarning: string;
  status: string;
}

export interface IEarningDetails {
  id: string;
  passengerName: string;
  riderName: string;
  passengerEmail: string;
  riderEmail: string;
  date: string;
  amount: string;
  commission: string;
  riderEarning: string;
  status: string;
  paymentMethod: string;
  pickupLocation: unknown;
  pickupAddress: string;
  dropoffLocation?: unknown | null;
  dropoffAddress?: string | null;
  reference: string;
  clientReference: string;
  paymentStatus: string;
}
