/**
 * Sidebar component
 * INTENTIONAL FLAW: mt-2 creates an 8px offset from the main content area
 * which has no margin-top — causes visual misalignment
 */
export default function Sidebar() {
  const categories = [
    { name: 'UI Design', count: 12 },
    { name: 'Branding', count: 8 },
    { name: 'Motion', count: 5 },
    { name: 'Development', count: 15 },
    { name: 'Case Studies', count: 7 },
  ];

  const recentPosts = [
    { title: 'Why Minimalism Still Wins in 2026', date: 'Mar 25, 2026' },
    { title: 'Color Theory for Dark Interfaces', date: 'Mar 20, 2026' },
    { title: 'Building Accessible Design Systems', date: 'Mar 14, 2026' },
  ];

  return (
    <aside
      data-component="sidebar"
      className="w-64 mt-2 bg-gray-900 rounded-2xl border border-gray-800 p-6 h-fit shrink-0"
    >
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Categories
        </h3>
        <ul className="space-y-2">
          {categories.map((cat) => (
            <li key={cat.name}>
              <a
                href="#"
                className="flex items-center justify-between py-2 px-3 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              >
                <span>{cat.name}</span>
                <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-full text-gray-500">
                  {cat.count}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Recent Posts
        </h3>
        <ul className="space-y-4">
          {recentPosts.map((post) => (
            <li key={post.title}>
              <a href="#" className="block group">
                <p className="text-sm font-medium text-gray-200 group-hover:text-violet-400 transition-colors leading-snug">
                  {post.title}
                </p>
                <p className="text-xs text-gray-500 mt-1">{post.date}</p>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 p-4 bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 rounded-xl border border-violet-500/20">
        <p className="text-sm font-semibold text-violet-300 mb-1">Newsletter</p>
        <p className="text-xs text-gray-400 mb-3">Get weekly design tips and resources.</p>
        <input
          type="email"
          placeholder="your@email.com"
          className="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 mb-2"
        />
        <button className="w-full px-3 py-2 text-sm font-medium bg-violet-600 rounded-lg hover:bg-violet-500 transition-colors">
          Subscribe
        </button>
      </div>
    </aside>
  );
}
