export function VariantCard({ variant }: { variant: string }) {
  return (
    <div className={`flex flex-col h-48 w-64 rounded-lg p-4 ${variant}`}>
      <h3 className="text-lg font-bold text-white">Variant</h3>
    </div>
  );
}
