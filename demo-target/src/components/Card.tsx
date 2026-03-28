/**
 * Card component
 * INTENTIONAL FLAW: spacing is controlled via individual margin props
 * rather than consistent grid gap — Card 2 has different margin than Card 1 & 3
 */

interface CardProps {
  title: string;
  description: string;
  imageUrl?: string;
  marginRight?: string;
  tag?: string;
}

export default function Card({
  title,
  description,
  imageUrl,
  marginRight = '16px',
  tag = 'Design',
}: CardProps) {
  return (
    <article
      data-component="card"
      className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-colors group w-[300px] ml-[32px]"
      style={{ marginRight }}
    >
      {imageUrl ? (
        <div className="aspect-video bg-gray-800 overflow-hidden">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      ) : (
        <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        </div>
      )}

      <div className="p-5 h-96">
        <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-violet-500/10 text-violet-400 mb-3">
          {tag}
        </span>
        <h3 className="text-lg font-semibold mb-2 group-hover:text-violet-400 transition-colors">
          {title}
        </h3>
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
        <div className="mt-4 flex items-center text-sm text-violet-400 font-medium">
          Read more
          <svg
            className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </article>
  );
}
