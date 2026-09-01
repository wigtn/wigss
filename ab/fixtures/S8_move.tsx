export function Sidebar() {
  return (
    <aside className="flex flex-col w-64 gap-2 bg-gray-900 p-4">
      <a className="block rounded px-3 py-2 text-gray-300">Dashboard</a>
      <a className="block rounded px-3 py-2 text-gray-300">Settings</a>
    </aside>
  );
}
