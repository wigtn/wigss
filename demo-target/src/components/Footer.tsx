/**
 * Footer component
 * INTENTIONAL FLAW: h-[200px] is excessively tall for the minimal content it contains
 */
export default function Footer() {
  return (
    <footer
      data-component="footer"
      className="h-[200px] bg-gray-900 border-t border-gray-800 px-8 flex items-center justify-between"
    >
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold">
            P
          </div>
          <span className="text-sm font-semibold">PixelCraft</span>
        </div>
        <p className="text-xs text-gray-500">
          &copy; 2026 PixelCraft Design Studio. All rights reserved.
        </p>
      </div>

      <ul className="flex items-center gap-6 text-sm text-gray-400">
        <li>
          <a href="#" className="hover:text-white transition-colors">
            Privacy
          </a>
        </li>
        <li>
          <a href="#" className="hover:text-white transition-colors">
            Terms
          </a>
        </li>
        <li>
          <a href="#" className="hover:text-white transition-colors">
            Twitter
          </a>
        </li>
        <li>
          <a href="#" className="hover:text-white transition-colors">
            GitHub
          </a>
        </li>
      </ul>
    </footer>
  );
}
