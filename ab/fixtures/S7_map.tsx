type Item = { id: string; title: string };

export function CardList({ items }: { items: Item[] }) {
  return (
    <div className="grid grid-cols-3 gap-6">
      {items.map((item) => (
        <div key={item.id} className="flex flex-col h-48 w-64 rounded-lg bg-gray-800 p-6">
          <h3 className="text-lg font-bold text-white">{item.title}</h3>
        </div>
      ))}
    </div>
  );
}
