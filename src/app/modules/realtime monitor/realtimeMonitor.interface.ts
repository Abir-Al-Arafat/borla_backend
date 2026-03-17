// Realtime Monitor
export interface IRealtimeMonitorStats {
  ongoingRides: number;
  availableRiders: number;
  completedToday: number;
  avgWaitTimeMinutes: number;
}

export interface IRealtimeRiderItem {
  id: string;
  name: string;
  avatar: string | null;
  status: 'Busy' | 'Available' | 'Offline';
  mapStatus: 'active' | 'available' | 'pending';
  latitude: number | null;
  longitude: number | null;
}

export interface IRealtimeRiderListResponse {
  riders: IRealtimeRiderItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
  };
}

export interface IRealtimeActivityItem {
  id: string;
  status: 'In Progress' | 'Pickup' | 'Assigned' | 'Pending';
  assignee: string;
  time: string;
  rider: string;
  location: string;
  type: string;
  weight: string;
  progress?: number;
}

export interface IRealtimeActivityResponse {
  activities: IRealtimeActivityItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
  };
}
