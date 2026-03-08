export interface IPickupsPerHour {
  hour: string;
  pickups: number;
}

export interface IAvgPickupTimeByDay {
  day: string;
  mins: number;
}

export interface ICompletionRate {
  completionRate: number;
  totalBookings: number;
  completedBookings: number;
}

export interface IZoneHealth {
  zone: string;
  zoneId: string;
  requests: number;
  completed: number;
  riders: number;
  avgWaitTime: string;
  completionRate: number;
  status: 'Healthy' | 'Watch' | 'Action Needed';
}

export interface IOperationsDashboard {
  pickupsPerHour: IPickupsPerHour[];
  avgPickupTimeByDay: IAvgPickupTimeByDay[];
  overallCompletionRate: ICompletionRate;
  zoneHealth: IZoneHealth[];
}

export interface IDashboardQuery {
  period?: 'daily' | 'weekly' | 'monthly';
  startDate?: string;
  endDate?: string;
  zoneId?: string;
}
