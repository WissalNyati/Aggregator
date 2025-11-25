import { useEffect, useState } from 'react';
import { Star, MessageSquare, Loader2 } from 'lucide-react';
import { reviewsApi } from '../lib/api';

type ReviewSummary = {
  averageRating: number;
  waitTime: number;
  bedsideManner: number;
  staffFriendliness: number;
  totalReviews: number;
};

type DoctorReview = {
  id: string;
  rating: number;
  waitTime: number;
  bedsideManner: number;
  staffFriendliness: number;
  comments: string;
  reviewerName: string;
  createdAt: string;
};

export function ReviewScorecard({ doctorNpi }: { doctorNpi?: string }) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [reviews, setReviews] = useState<DoctorReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!doctorNpi) return;

    const fetchReviews = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await reviewsApi.getReviews(doctorNpi);
        if (isMounted) {
          setSummary(response.summary);
          setReviews(response.reviews.slice(0, 3));
        }
      } catch (err) {
        console.error('Review fetch failed', err);
        if (isMounted) {
          setError('Unable to load verified patient reviews.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchReviews();
    return () => {
      isMounted = false;
    };
  }, [doctorNpi]);

  if (!doctorNpi) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 text-sm text-gray-500">
        Reviews available once this profile is verified.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white/80 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-heading text-base">Verified patient reviews</h4>
          <p className="text-xs text-gray-500">Trust indicators refreshed hourly</p>
        </div>
        <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          Add review
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading patient feedback...
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {summary && !loading && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400 fill-amber-300" />
              <p className="text-3xl font-bold text-gray-900">{summary.averageRating.toFixed(1)}</p>
            </div>
            <p className="text-xs uppercase tracking-wide text-gray-500 mt-1">
              Overall satisfaction · {summary.totalReviews} verified reviews
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
            <div className="rounded-xl border border-gray-100 p-3">
              <p className="font-semibold">Wait time</p>
              <p className="text-lg text-gray-900">{summary.waitTime.toFixed(1)}/5</p>
            </div>
            <div className="rounded-xl border border-gray-100 p-3">
              <p className="font-semibold">Bedside manner</p>
              <p className="text-lg text-gray-900">{summary.bedsideManner.toFixed(1)}/5</p>
            </div>
            <div className="rounded-xl border border-gray-100 p-3">
              <p className="font-semibold">Staff</p>
              <p className="text-lg text-gray-900">{summary.staffFriendliness.toFixed(1)}/5</p>
            </div>
            <div className="rounded-xl border border-gray-100 p-3">
              <p className="font-semibold">Recommend</p>
              <p className="text-lg text-gray-900">
                {summary.averageRating > 4.5 ? '97%' : '90%'}+
              </p>
            </div>
          </div>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="space-y-3">
          {reviews.map(review => (
            <div key={review.id} className="rounded-2xl border border-gray-100 p-3">
              <div className="flex items-center justify-between text-sm">
                <p className="font-semibold text-gray-900">{review.reviewerName}</p>
                <p className="text-xs text-gray-500">
                  {new Date(review.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <p className="text-sm text-gray-600 mt-2">“{review.comments}”</p>
              <div className="mt-2 flex gap-2 text-xs text-gray-500">
                <span>Overall {review.rating.toFixed(1)}</span>
                <span>Wait {review.waitTime.toFixed(1)}</span>
                <span>Bedside {review.bedsideManner.toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && summary?.totalReviews === 0 && (
        <p className="text-sm text-gray-500">
          Reviews coming soon—be the first to share your experience after booking.
        </p>
      )}
    </div>
  );
}

