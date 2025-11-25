import { Router } from 'express';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { sql } from '../db/index.js';

const analyticsRoutes = Router();

// Admin-only analytics endpoint with real data
analyticsRoutes.get('/metrics', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { timeRange = '30d' } = req.query as { timeRange?: string };
    
    // Calculate date range
    const now = new Date();
    const daysBack = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysBack);

    // Get real search metrics
    const searchStats = await sql`
      SELECT 
        COUNT(*) as total_searches,
        COUNT(DISTINCT user_id) as unique_users,
        SUM(results_count) as total_results,
        AVG(results_count) as avg_results_per_search
      FROM search_history
      WHERE created_at >= ${startDate.toISOString()}
    `;

    const totalSearches = Number(searchStats[0]?.total_searches || 0);
    const uniqueUsers = Number(searchStats[0]?.unique_users || 0);

    // Get geographic demand
    const geographicData = await sql`
      SELECT 
        location,
        COUNT(*) as count
      FROM search_history
      WHERE created_at >= ${startDate.toISOString()}
        AND location IS NOT NULL
        AND location != ''
      GROUP BY location
      ORDER BY count DESC
      LIMIT 10
    `;

    // Get appointment bookings (if appointments table exists)
    let appointmentBookings = 0;
    try {
      const appointmentStats = await sql`
        SELECT COUNT(*) as total_bookings
        FROM appointments
        WHERE created_at >= ${startDate.toISOString()}
      `;
      appointmentBookings = Number(appointmentStats[0]?.total_bookings || 0);
    } catch {
      // Appointments table might not exist yet
    }

    // Calculate conversion rate (searches with results > 0)
    const searchesWithResults = await sql`
      SELECT COUNT(*) as count
      FROM search_history
      WHERE created_at >= ${startDate.toISOString()}
        AND results_count > 0
    `;
    const searchesWithResultsCount = Number(searchesWithResults[0]?.count || 0);
    const searchConversionRate = totalSearches > 0 
      ? (searchesWithResultsCount / totalSearches) * 100 
      : 0;

    // Get user retention (users with multiple searches)
    const retentionData = await sql`
      SELECT 
        user_id,
        COUNT(*) as search_count
      FROM search_history
      WHERE created_at >= ${startDate.toISOString()}
      GROUP BY user_id
      HAVING COUNT(*) > 1
    `;
    const retainedUsers = retentionData.length;
    const patientRetentionRate = uniqueUsers > 0 
      ? (retainedUsers / uniqueUsers) * 100 
      : 0;

    // Get top searched specialties
    const topSpecialties = await sql`
      SELECT 
        specialty,
        COUNT(*) as count
      FROM search_history
      WHERE created_at >= ${startDate.toISOString()}
        AND specialty IS NOT NULL
        AND specialty != ''
      GROUP BY specialty
      ORDER BY count DESC
      LIMIT 5
    `;

    const analyticsData = {
      patientMetrics: {
        totalSearches,
        searchConversionRate: Math.round(searchConversionRate * 10) / 10,
        appointmentBookings,
        patientRetentionRate: Math.round(patientRetentionRate * 10) / 10,
        uniqueUsers,
        geographicDemand: geographicData.map((row: { location: string; count: number }) => ({
          location: row.location,
          count: Number(row.count),
        })),
      },
      doctorMetrics: {
        profileCompletions: 0, // TODO: Implement when doctor profiles are added
        patientAcquisitionCost: 0, // TODO: Calculate from marketing spend
        averageSatisfactionScore: 0, // TODO: Calculate from reviews
        bookingUtilization: appointmentBookings > 0 ? Math.round((appointmentBookings / totalSearches) * 100 * 10) / 10 : 0,
        topDoctors: [], // TODO: Implement when doctor view tracking is added
        topSpecialties: topSpecialties.map((row: { specialty: string; count: number }) => ({
          specialty: row.specialty,
          searches: Number(row.count),
        })),
      },
      revenueMetrics: {
        totalRevenue: 0, // TODO: Calculate from subscriptions
        monthlyRecurringRevenue: 0, // TODO: Calculate from active subscriptions
        averageRevenuePerUser: 0, // TODO: Calculate from revenue/users
        revenueGrowth: 0, // TODO: Calculate month-over-month
      },
    };

    res.json(analyticsData);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

export { analyticsRoutes };

