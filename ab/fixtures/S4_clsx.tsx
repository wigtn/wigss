const cn = (...a: unknown[]) => a.filter(Boolean).join(' ');

export function ActiveCard({ isActive }: { isActive: boolean }) {
  return (
    <div className={cn('flex flex-col h-48 w-64 rounded-lg p-8', isActive && 'ring-2 ring-blue-500')}>
      <h3 className="text-lg font-bold text-white">Active</h3>
    </div>
  );
}
