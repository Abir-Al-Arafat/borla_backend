export interface IZoneRiderLoyaltyCardsQuery {
  zoneId?: string;
  zoneName?: string;
  limit?: number | string;
}

export interface IRiderLoyaltyCard {
  name: string;
  initials: string;
  rideCount: number;
  rating: number;
  todayRides: number;
  totalRides: number;
  extraRidesCompleted: number;
  status: 'bonus-eligible' | 'daily-target-achieved' | 'in-progress';
}
