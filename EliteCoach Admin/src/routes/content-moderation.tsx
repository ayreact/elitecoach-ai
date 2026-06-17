import { createFileRoute } from '@tanstack/react-router';
import { ReviewQueueTable } from '../components/content/ReviewQueueTable';

export const Route = createFileRoute('/content-moderation')({
  component: ContentModerationPage,
});

function ContentModerationPage() {
  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Content Moderation</h1>
          <p className="text-slate-500 mt-1">Review, approve, or reject draft courses and lessons.</p>
        </div>
      </div>

      <div className="card p-6">
        <ReviewQueueTable />
      </div>
    </div>
  );
}
