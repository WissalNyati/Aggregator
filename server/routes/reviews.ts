import { Router } from 'express';
import { randomUUID } from 'crypto';

interface DoctorReview {
  id: string;
  doctorNpi: string;
  rating: number;
  waitTime: number;
  bedsideManner: number;
  staffFriendliness: number;
  comments: string;
  reviewerName: string;
  createdAt: string;
}

const reviewsRoutes = Router();

const reviewsStore: DoctorReview[] = [
  {
    id: randomUUID(),
    doctorNpi: '1578567890',
    rating: 4.8,
    waitTime: 4.5,
    bedsideManner: 4.9,
    staffFriendliness: 4.6,
    comments: 'Explained every step clearly and made me feel comfortable.',
    reviewerName: 'Verified Retina Patient',
    createdAt: new Date().toISOString(),
  },
  {
    id: randomUUID(),
    doctorNpi: '1578567890',
    rating: 4.6,
    waitTime: 4.0,
    bedsideManner: 4.7,
    staffFriendliness: 4.5,
    comments: 'Staff was kind and the doctor was extremely thorough.',
    reviewerName: 'Post-op Cataract Patient',
    createdAt: new Date().toISOString(),
  },
];

reviewsRoutes.get('/:doctorNpi', (req, res) => {
  const { doctorNpi } = req.params;
  const doctorReviews = reviewsStore.filter(review => review.doctorNpi === doctorNpi);

  const aggregate = doctorReviews.reduce(
    (acc, review) => {
      acc.rating += review.rating;
      acc.waitTime += review.waitTime;
      acc.bedsideManner += review.bedsideManner;
      acc.staffFriendliness += review.staffFriendliness;
      return acc;
    },
    { rating: 0, waitTime: 0, bedsideManner: 0, staffFriendliness: 0 }
  );

  const count = doctorReviews.length || 1;
  const summary = {
    averageRating: Number((aggregate.rating / count).toFixed(1)),
    waitTime: Number((aggregate.waitTime / count).toFixed(1)),
    bedsideManner: Number((aggregate.bedsideManner / count).toFixed(1)),
    staffFriendliness: Number((aggregate.staffFriendliness / count).toFixed(1)),
    totalReviews: doctorReviews.length,
  };

  res.json({
    doctorNpi,
    summary,
    reviews: doctorReviews,
  });
});

reviewsRoutes.post('/', (req, res) => {
  const { doctorNpi, rating, waitTime, bedsideManner, staffFriendliness, comments, reviewerName } = req.body;

  if (!doctorNpi || !rating || !comments) {
    return res.status(400).json({ error: 'doctorNpi, rating, and comments are required' });
  }

  const newReview: DoctorReview = {
    id: randomUUID(),
    doctorNpi,
    rating,
    waitTime: waitTime ?? rating,
    bedsideManner: bedsideManner ?? rating,
    staffFriendliness: staffFriendliness ?? rating,
    comments,
    reviewerName: reviewerName || 'Verified patient',
    createdAt: new Date().toISOString(),
  };

  reviewsStore.push(newReview);

  res.json({
    message: 'Review submitted successfully',
    review: newReview,
  });
});

export { reviewsRoutes };

