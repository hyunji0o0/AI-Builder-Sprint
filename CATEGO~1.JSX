import { CATEGORIES } from "./communityMockData";

export default function CategoryTabs({ active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {CATEGORIES.map((cat) => {
        const isActive = active === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onChange(cat.id)}
            className={
              "px-4 py-2 rounded-full text-sm whitespace-nowrap border transition " +
              (isActive
                ? "font-medium bg-gradient-to-r from-orange-200 to-rose-200 text-orange-800 border-transparent"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300")
            }
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
