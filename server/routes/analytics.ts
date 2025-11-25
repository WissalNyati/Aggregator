import { Router } from 'express';

const analyticsRoutes = Router();

// Mock analytics data - in production, query from database
analyticsRoutes.get('/metrics', (req, res) => {
  // const { timeRange = '30d' } = req.query; // TODO: Use timeRange for filtering

  // In production, this would query your database for real metrics
  const mockData = {
    patientMetrics: {
      totalSearches: 1247,
      searchConversionRate: 23.5,
      appointmentBookings: 293,
      patientRetentionRate: 67.8,
      geographicDemand: [
        { location: 'Seattle, WA', count: 342 },
        { location: 'Tacoma, WA', count: 198 },
        { location: 'Bellevue, WA', count: 156 },
      ],
    },
    doctorMetrics: {
      profileCompletions: 89,
      patientAcquisitionCost: 45.50,
      averageSatisfactionScore: 4.6,
      bookingUtilization: 72.3,
      topDoctors: [
        { name: 'Dr. Mark L. Nelson', views: 234, bookings: 18 },
        { name: 'Dr. Sarah Chen', views: 189, bookings: 15 },
        { name: 'Dr. James Wilson', views: 167, bookings: 12 },
      ],
    },
    revenueMetrics: {
      totalRevenue: 12500,
      monthlyRecurringRevenue: 8500,
      averageRevenuePerUser: 42.50,
      revenueGrowth: 15.3,
    },
  };

  res.json(mockData);
});

export { analyticsRoutes };

