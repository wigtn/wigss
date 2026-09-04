export function CardPair() {
  return (
    <div className="flex gap-5">
      <div className="flex flex-col h-48 w-64 rounded-lg bg-gray-800 p-5">
        <h3 className="text-lg font-bold text-white">First</h3>
      </div>
      <div className="flex flex-col h-48 w-64 rounded-lg bg-gray-800 p-5">
        <h3 className="text-lg font-bold text-white">Second</h3>
      </div>
    </div>
  );
}
