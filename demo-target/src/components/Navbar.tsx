/**
 * Navbar component
 * INTENTIONAL FLAW: h-16 with excessive internal padding (py-6)
 * makes the navbar taller than the declared h-16 — overflow/inconsistency issue
 */
export default function Navbar() {
  return (
    <nav
      data-component="navbar"
      className="h-[151px] bg-gray-900 py-[77px] px-8 flex items-center justify-between border-b border-gray-800 h-[327px]"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-sm font-bold">
          P
        </div>
        <span className="text-xl font-bold tracking-tight">
          Pixel<span className="text-violet-400">Craft</span>
        </span>
      </div>

      <ul className="flex items-center gap-8 text-sm font-medium text-gray-300">
        <li>
          <a href="#" className="hover:text-white transition-colors">
            Home
          </a>
        </li>
        <li>
          <a href="#" className="hover:text-white transition-colors">
            About
          </a>
        </li>
        <li>
          <a href="#" className="hover:text-white transition-colors">
            Projects
          </a>
        </li>
        <li>
          <a
            href="#"
            className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors"
          >
            Contact
          </a>
        </li>
      </ul>
    </nav>
  );
}
