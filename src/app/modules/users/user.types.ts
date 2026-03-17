export interface RiderComplaintItem {
  date: string;
  time: string;
  description: string;
  status: 'resolved' | 'investigating' | 'reported';
}

export interface RiderMetricItem {
  label: string;
  value: string;
}

export interface RiderWorkHistoryItem {
  date: string;
  location: string;
  jobs: number;
  ghs: string;
}

export interface RiderZoneWorkedItem {
  name: string;
  jobs: number;
}

export interface RiderDetailsPayload {
  header: {
    name: string;
    status: 'Active' | 'Inactive';
    riskLevel: 'LOW RISK' | 'MEDIUM RISK' | 'HIGH RISK';
  };
  metrics: RiderMetricItem[];
  recentWorkHistory: RiderWorkHistoryItem[];
//   complaintsTimeline: RiderComplaintItem[];
  zonesWorked: RiderZoneWorkedItem[];
}
