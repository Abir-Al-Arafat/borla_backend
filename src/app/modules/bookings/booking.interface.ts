export interface ICreateBooking {
  wasteCategory: 'organic' | 'metal' | 'plastic' | 'general' | 'paper';
  wasteImages: string[];
  binSize: string;
  binQuantity: number;
  wasteSize: number;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress: string;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  dropoffAddress?: string;
  vehicleType?: string;
  estimatedDistance?: number;
  estimatedTime?: string;
  paymentMethod: 'momo' | 'cash';
  price: number;
}

export interface IUpdateBookingStatus {
  status: 'accepted' | 'in_progress' | 'completed' | 'cancelled';
}

export interface IGetBookingsQuery {
  status?: string;
  page?: number;
  limit?: number;
  latitude?: number;
  longitude?: number;
  radius?: number; // in km
}
