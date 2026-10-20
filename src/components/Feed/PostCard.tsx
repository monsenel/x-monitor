import React, { useState } from 'react';
import { Post } from '../../types.ts';
import { toRelativeTimeFa, toJalaliDate, toGregorianDate, formatNumberFa, toPersianDigits } from '../../utils/date.ts';
import {
  Heart,
  Repeat,
  MessageCircle,
  Eye,
  ExternalLink,
  Bookmark,
  CheckCircle,
  EyeOff,
  Share2,
  Sparkles,
  Languages,
} from 'lucide-react';

interface PostCardProps {
  post: Post;
  isSelected?: boolean;
  onToggleRead: (id: string, current: boolean) => void;
  onToggleBookmark: (id: string, current: boolean) => void;
  onHide: (id: string) => void;
  onRetryEnrichment?: (id: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  isSelected = false,
  onToggleRead,
  onToggleBookmark,
  onHide,
  onRetryEnrichment,
}) => {
  const [showOriginal, setShowOriginal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(post.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getImportanceBadge = (score?: number) => {
    if (score === undefined || score === null) return null;
    let color = 'bg-slate-800 text-slate-300 border-slate-700';
    if (score >= 8) color = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    else if (score >= 6) color = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    else if (score >= 4) color = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';

    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-xs font-bold ${color}`}
        title={post.importanceReason || 'امتیاز اهمیت بر اساس ارزیابی هوش مصنوعی'}
      >
        <Sparkles className="w-3 h-3" />
        <span>اهمیت: {toPersianDigits(score)}/۱۰</span>
      </div>
    );
  };

  const getSentimentBadge = (sentiment?: string) => {
    if (!sentiment) return null;
    if (sentiment === 'positive') {
      return <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">مثبت</span>;
    }
    if (sentiment === 'negative') {
      return <span className="px-2 py-0.5 rounded text-[11px] bg-rose-500/10 text-rose-400 border border-rose-500/20">منفی</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-400 border border-slate-700">خنثی</span>;
  };

  const hasTranslation = Boolean(post.translationFa);

  return (
    <article
      className={`rounded-2xl border transition-all duration-200 p-4 sm:p-5 relative ${
        isSelected ? 'ring-2 ring-cyan-500 border-cyan-500/50 bg-slate-900/90' : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
      } ${post.isRead ? 'opacity-85' : 'border-r-4 border-r-cyan-500'}`}
    >
      {/* Header: Author & Source Chips */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {post.authorAvatar ? (
              <img
                src={post.authorAvatar}
                alt={post.authorName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <span className="font-bold text-slate-400 text-sm">{post.authorUsername[0]?.toUpperCase()}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-100 text-sm hover:underline cursor-pointer">
                {post.authorName}
              </span>
              <span className="text-xs text-slate-400 font-mono" dir="ltr">
                @{post.authorUsername}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
              <span title={`تقویم میلادی: ${toGregorianDate(post.createdAt)}`}>
                {toRelativeTimeFa(post.createdAt)}
              </span>
              <span>•</span>
              <span className="text-[11px] text-slate-500" title={`تقویم میلادی: ${toGregorianDate(post.createdAt)}`}>
                {toJalaliDate(post.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Source tags */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {post.sources?.map((s) => (
            <span
              key={s.id}
              className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-slate-950/60 text-slate-300"
              style={{ borderColor: `${s.color || '#38bdf8'}40`, color: s.color || '#38bdf8' }}
            >
              {s.type === 'hashtag' ? `#${s.value}` : s.type === 'account' ? `@${s.value}` : s.value}
            </span>
          ))}
        </div>
      </div>

      {/* AI Intelligence Badges */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {getImportanceBadge(post.importance)}
        {getSentimentBadge(post.sentiment)}
        {post.topics?.map((topic, i) => (
          <span key={i} className="px-2 py-0.5 rounded text-[11px] bg-slate-950 text-slate-400 border border-slate-800">
            #{topic}
          </span>
        ))}
      </div>

      {/* Importance reason summary */}
      {post.importanceReason && (
        <div className="mb-3 px-3 py-1.5 rounded-xl bg-cyan-950/20 border border-cyan-800/30 text-xs text-cyan-300 flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-cyan-400" />
          <span>{post.importanceReason}</span>
        </div>
      )}

      {/* Text Content */}
      <div className="mb-3 text-slate-200 text-sm leading-relaxed whitespace-pre-line select-text" dir="auto">
        {hasTranslation && !showOriginal ? post.translationFa : post.text}
      </div>

      {/* Translation toggle button if post has translation */}
      {hasTranslation && (
        <button
          onClick={() => setShowOriginal(!showOriginal)}
          className="mb-3 text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
        >
          <Languages className="w-3.5 h-3.5" />
          <span>{showOriginal ? 'مشاهده ترجمه فارسی هوشمند' : 'مشاهده متن اصلی'}</span>
        </button>
      )}

      {/* Media Attachments */}
      {post.media && post.media.length > 0 && (
        <div className={`grid gap-2 mb-3 ${post.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {post.media.map((m, idx) => (
            <div key={idx} className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 max-h-80 flex items-center justify-center">
              <img
                src={m.url || m.previewUrl}
                alt="Media thumbnail"
                loading="lazy"
                className="w-full h-full object-cover max-h-80"
              />
            </div>
          ))}
        </div>
      )}

      {/* Metrics Bar */}
      <div className="flex items-center gap-4 sm:gap-6 pt-2 pb-3 text-xs text-slate-400 border-t border-slate-800/80">
        <span className="flex items-center gap-1.5" title="پسندها (Likes)">
          <Heart className="w-3.5 h-3.5 text-rose-400/80" />
          <span className="font-mono">{formatNumberFa(post.metrics.likes || 0)}</span>
        </span>
        <span className="flex items-center gap-1.5" title="بازتوییت‌ها (Retweets)">
          <Repeat className="w-3.5 h-3.5 text-emerald-400/80" />
          <span className="font-mono">{formatNumberFa(post.metrics.retweets || 0)}</span>
        </span>
        <span className="flex items-center gap-1.5" title="پاسخ‌ها (Replies)">
          <MessageCircle className="w-3.5 h-3.5 text-sky-400/80" />
          <span className="font-mono">{formatNumberFa(post.metrics.replies || 0)}</span>
        </span>
        {post.metrics.views !== undefined && (
          <span className="flex items-center gap-1.5" title="بازدیدها (Views)">
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-mono">{formatNumberFa(post.metrics.views)}</span>
          </span>
        )}
      </div>

      {/* Card Actions Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggleRead(post.id, post.isRead)}
            className={`p-1.5 rounded-lg flex items-center gap-1 transition-colors ${
              post.isRead
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                : 'text-cyan-400 hover:bg-cyan-500/10 font-medium'
            }`}
            title="علامت‌گذاری به عنوان خوانده‌شده/نشده (کلید m)"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{post.isRead ? 'خوانده‌شده' : 'جدید'}</span>
          </button>

          <button
            onClick={() => onToggleBookmark(post.id, post.isBookmarked)}
            className={`p-1.5 rounded-lg flex items-center gap-1 transition-colors ${
              post.isBookmarked ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="نشان‌کردن پست (کلید b)"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>{post.isBookmarked ? 'نشان‌شده' : 'نشان'}</span>
          </button>

          <button
            onClick={() => onHide(post.id)}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title="مخفی کردن پست"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1"
            title="کپی پیوند"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copied ? 'کپی شد!' : 'کپی'}</span>
          </button>

          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 font-medium transition-colors"
            title="مشاهده مستقیم در X (کلید o)"
          >
            <span>نمایش در X</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </article>
  );
};
