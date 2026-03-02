'use client'

import type { PostItem } from '@/lib/chat/types'

interface Props {
  data: PostItem[]
  title?: string
}

export default function InlinePostsList({ data, title }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="mt-3 bg-gray-50 rounded-lg p-4 border text-center text-sm text-gray-500">
        No results found.
      </div>
    )
  }

  return (
    <div className="mt-3">
      {title && <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{title}</p>}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {data.map((post) => (
          <div key={post.id} className="bg-gray-50 rounded-lg p-3 border hover:bg-gray-100 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{post.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {post.drug && (
                    <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                      {post.drug}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 capitalize">{post.platform}</span>
                  {post.date && <span className="text-xs text-gray-400">{post.date}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                {post.confidence != null && (
                  <span className={`text-xs font-medium ${post.confidence >= 0.8 ? 'text-green-600' : post.confidence >= 0.6 ? 'text-yellow-600' : 'text-red-500'}`}>
                    {(post.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              {post.score != null && <span>Score: {post.score.toLocaleString()}</span>}
              {post.views != null && <span>Views: {post.views.toLocaleString()}</span>}
              {post.likes != null && <span>Likes: {post.likes.toLocaleString()}</span>}
              {post.comments != null && <span>Comments: {post.comments.toLocaleString()}</span>}
              {post.url && (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:underline ml-auto"
                >
                  View &rarr;
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
