import prisma from 'app/shared/prisma';
import {
  IDashboardStats,
  IUserOverviewQuery,
  IUserOverviewData,
  IRevenueChartQuery,
  IRevenueChartData,
  IWasteDistributionQuery,
  IWasteTypeData,
  IRecentAccountsQuery,
  IRecentAccount,
} from './dashboard.interface';
import { bookingStatus } from '@prisma/client';

// Get dashboard statistics (all 8 cards)
const getDashboardStats = async (): Promise<IDashboardStats> => {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  // Total Users
  const totalUsers = await prisma.user.count({
    where: { role: 'user', isDeleted: false },
  });

  const usersYesterday = await prisma.user.count({
    where: {
      role: 'user',
      isDeleted: false,
      createdAt: { lt: startOfToday },
    },
  });

  // Total Riders
  const totalRiders = await prisma.user.count({
    where: { role: 'rider', riderVerified: true, isDeleted: false },
  });

  const ridersYesterday = await prisma.user.count({
    where: {
      role: 'rider',
      riderVerified: true,
      isDeleted: false,
      createdAt: { lt: startOfToday },
    },
  });

  // Total Revenue
  const revenueResult = await prisma.booking.aggregate({
    where: {
      status: bookingStatus.completed,
    },
    _sum: { price: true },
  });
  const totalRevenue = revenueResult._sum.price || 0;

  const revenueYesterday = await prisma.booking.aggregate({
    where: {
      status: bookingStatus.completed,
      completedAt: { lt: startOfToday },
    },
    _sum: { price: true },
  });
  const totalRevenueYesterday = revenueYesterday._sum.price || 0;

  // Completion Rate
  const totalBookings = await prisma.booking.count();
  const completedBookings = await prisma.booking.count({
    where: { status: bookingStatus.completed },
  });
  const completionRate =
    totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;

  const totalBookingsYesterday = await prisma.booking.count({
    where: { createdAt: { lt: startOfToday } },
  });
  const completedBookingsYesterday = await prisma.booking.count({
    where: {
      status: bookingStatus.completed,
      createdAt: { lt: startOfToday },
    },
  });
  const completionRateYesterday =
    totalBookingsYesterday > 0
      ? (completedBookingsYesterday / totalBookingsYesterday) * 100
      : 0;

  // Today's Revenue
  const todayRevenueResult = await prisma.booking.aggregate({
    where: {
      status: bookingStatus.completed,
      completedAt: { gte: startOfToday },
    },
    _sum: { price: true },
  });
  const todayRevenue = todayRevenueResult._sum.price || 0;

  const yesterdayRevenueResult = await prisma.booking.aggregate({
    where: {
      status: bookingStatus.completed,
      completedAt: { gte: startOfYesterday, lt: startOfToday },
    },
    _sum: { price: true },
  });
  const yesterdayRevenue = yesterdayRevenueResult._sum.price || 0;

  // Today's Waste Collections
  const todayWasteResult = await prisma.booking.aggregate({
    where: {
      status: bookingStatus.completed,
      completedAt: { gte: startOfToday },
    },
    _sum: { wasteSize: true },
  });
  const todayWasteCollections = todayWasteResult._sum.wasteSize || 0;

  const yesterdayWasteResult = await prisma.booking.aggregate({
    where: {
      status: bookingStatus.completed,
      completedAt: { gte: startOfYesterday, lt: startOfToday },
    },
    _sum: { wasteSize: true },
  });
  const yesterdayWasteCollections = yesterdayWasteResult._sum.wasteSize || 0;

  // Active Riders
  const activeRiders = await prisma.user.count({
    where: {
      role: 'rider',
      riderVerified: true,
      onlineStatus: 'online',
      isDeleted: false,
    },
  });

  const activeRidersYesterday = await prisma.user.count({
    where: {
      role: 'rider',
      riderVerified: true,
      onlineStatus: 'online',
      isDeleted: false,
      updatedAt: { lt: startOfToday },
    },
  });

  // Complete Rides Today
  const completedRidesToday = await prisma.booking.count({
    where: {
      status: bookingStatus.completed,
      completedAt: { gte: startOfToday },
    },
  });

  const completedRidesYesterday = await prisma.booking.count({
    where: {
      status: bookingStatus.completed,
      completedAt: { gte: startOfYesterday, lt: startOfToday },
    },
  });

  // Calculate growth percentages
  const calculateGrowth = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  };

  return {
    totalUsers,
    totalRiders,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    completionRate: Number(completionRate.toFixed(1)),
    todayRevenue: Number(todayRevenue.toFixed(2)),
    todayWasteCollections: Number(todayWasteCollections.toFixed(2)),
    activeRiders,
    completedRidesToday,
    stats: {
      usersGrowth: calculateGrowth(totalUsers, usersYesterday),
      ridersGrowth: calculateGrowth(totalRiders, ridersYesterday),
      revenueGrowth: calculateGrowth(totalRevenue, totalRevenueYesterday),
      completionRateChange: Number(
        (completionRate - completionRateYesterday).toFixed(1),
      ),
      todayRevenueGrowth: calculateGrowth(todayRevenue, yesterdayRevenue),
      wasteCollectionsGrowth: calculateGrowth(
        todayWasteCollections,
        yesterdayWasteCollections,
      ),
      activeRidersGrowth: calculateGrowth(activeRiders, activeRidersYesterday),
      completedRidesTodayChange: completedRidesToday - completedRidesYesterday,
    },
  };
};

// Get user overview chart data
const getUserOverview = async (
  query: IUserOverviewQuery,
): Promise<IUserOverviewData[]> => {
  const { year = new Date().getFullYear().toString(), userType = 'User' } =
    query;

  const startOfYear = new Date(`${year}-01-01`);
  const endOfYear = new Date(`${year}-12-31T23:59:59`);

  const role = userType === 'User' ? 'user' : 'rider';

  // Get all users created in the specified year
  const users = await prisma.user.findMany({
    where: {
      role,
      isDeleted: false,
      createdAt: {
        gte: startOfYear,
        lte: endOfYear,
      },
    },
    select: {
      createdAt: true,
    },
  });

  // Group by month
  const monthCounts: { [key: string]: number } = {
    Jan: 0,
    Feb: 0,
    Mar: 0,
    Apr: 0,
    May: 0,
    Jun: 0,
    Jul: 0,
    Aug: 0,
    Sep: 0,
    Oct: 0,
    Nov: 0,
    Dec: 0,
  };

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  users.forEach(user => {
    const month = monthNames[user.createdAt.getMonth()];
    monthCounts[month]++;
  });

  return Object.entries(monthCounts).map(([month, count]) => ({
    month,
    count,
  }));
};

// Get revenue chart data
const getRevenueChart = async (
  query: IRevenueChartQuery,
): Promise<IRevenueChartData[]> => {
  const { period } = query;
  const now = new Date();

  let startDate: Date;
  let labels: string[];

  if (period === 'weekly') {
    // Last 7 days
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 6);
    labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  } else {
    // Last 12 months
    startDate = new Date(now.getFullYear(), 0, 1);
    labels = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
  }

  const bookings = await prisma.booking.findMany({
    where: {
      status: bookingStatus.completed,
      completedAt: {
        gte: startDate,
      },
    },
    select: {
      price: true,
      completedAt: true,
    },
  });

  if (period === 'weekly') {
    const dailyRevenue: { [key: number]: number } = {};
    for (let i = 0; i < 7; i++) {
      dailyRevenue[i] = 0;
    }

    bookings.forEach(booking => {
      if (booking.completedAt) {
        const daysDiff = Math.floor(
          (now.getTime() - booking.completedAt.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (daysDiff >= 0 && daysDiff < 7) {
          const dayIndex = 6 - daysDiff;
          dailyRevenue[dayIndex] += booking.price;
        }
      }
    });

    return labels.map((label, index) => ({
      label,
      value: Number((dailyRevenue[index] || 0).toFixed(2)),
    }));
  } else {
    const monthlyRevenue: { [key: number]: number } = {};
    for (let i = 0; i < 12; i++) {
      monthlyRevenue[i] = 0;
    }

    bookings.forEach(booking => {
      if (booking.completedAt) {
        const month = booking.completedAt.getMonth();
        monthlyRevenue[month] += booking.price;
      }
    });

    return labels.map((label, index) => ({
      label,
      value: Number((monthlyRevenue[index] || 0).toFixed(2)),
    }));
  }
};

// Get waste type distribution
const getWasteDistribution = async (
  query: IWasteDistributionQuery,
): Promise<IWasteTypeData[]> => {
  const { period } = query;
  const now = new Date();

  let startDate: Date;

  if (period === 'weekly') {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 7);
  } else {
    startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 1);
  }

  // Group bookings by waste category
  const bookings = await prisma.booking.groupBy({
    by: ['wasteCategory'],
    where: {
      status: bookingStatus.completed,
      completedAt: {
        gte: startDate,
      },
    },
    _count: {
      id: true,
    },
  });

  const total = bookings.reduce((sum, item) => sum + item._count.id, 0);

  const wasteCategoryMap: { [key: string]: string } = {
    organic: 'Organic',
    metal: 'Metal',
    plastic: 'Plastic',
    general: 'General',
    paper: 'Paper',
  };

  return bookings.map(item => ({
    name: wasteCategoryMap[item.wasteCategory] || item.wasteCategory,
    value: item._count.id,
    percentage:
      total > 0 ? Number(((item._count.id / total) * 100).toFixed(0)) : 0,
  }));
};

// Get recent accounts list
const getRecentAccounts = async (query: IRecentAccountsQuery) => {
  const {
    accountType,
    status,
    page: pageParam = 1,
    limit: limitParam = 5,
  } = query;

  const page =
    typeof pageParam === 'string' ? parseInt(pageParam, 10) : pageParam;
  const limit =
    typeof limitParam === 'string' ? parseInt(limitParam, 10) : limitParam;
  const skip = (page - 1) * limit;

  const whereConditions: any = {
    isDeleted: false,
  };

  if (accountType) {
    whereConditions.role = accountType === 'User' ? 'user' : 'rider';
  } else {
    whereConditions.role = { in: ['user', 'rider'] };
  }

  if (status) {
    whereConditions.status = status === 'Active' ? 'active' : 'blocked';
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereConditions,
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.user.count({ where: whereConditions }),
  ]);

  const accounts: IRecentAccount[] = users.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber || 'N/A',
    type: user.role === 'user' ? 'User' : 'Rider',
    registrationDate: user.createdAt,
    status: user.status === 'active' ? 'Active' : 'Inactive',
  }));

  return {
    data: accounts,
    meta: {
      total,
      page,
      limit,
      totalPage: Math.ceil(total / limit),
    },
  };
};

export const dashboardServices = {
  getDashboardStats,
  getUserOverview,
  getRevenueChart,
  getWasteDistribution,
  getRecentAccounts,
};
