"use client";

import { useState } from "react";
import { Search } from "lucide-react";

interface SearchInputProps {
  initialValue?: string;
  placeholder?: string;
  action: string;
}

export function SearchInput({
  initialValue = "",
  placeholder = "Search...",
  action,
}: SearchInputProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <form action={action} method="GET" className="relative flex">
      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="text-50 size-5 text-2xl" />
        </div>
        <input
          type="text"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="text-75 block w-full rounded-lg border border-black/10 bg-transparent p-4 pl-10 text-sm outline-hidden transition-colors placeholder:opacity-50 hover:border-black/20 focus:border-(--primary) focus:ring-2 focus:ring-(--primary) dark:border-white/10 dark:hover:border-white/20"
          placeholder={placeholder}
        />
      </div>
    </form>
  );
}
