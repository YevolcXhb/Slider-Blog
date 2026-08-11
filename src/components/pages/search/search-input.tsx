"use client"

import { useState } from "react"
import { Search } from "lucide-react"

interface SearchInputProps {
  initialValue?: string
  placeholder?: string
  action: string
}

export function SearchInput({ initialValue = "", placeholder = "Search...", action }: SearchInputProps) {
  const [value, setValue] = useState(initialValue)

  return (
    <form action={action} method="GET" className="relative flex">
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="text-2xl text-50 size-5" />
        </div>
        <input
          type="text"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="block w-full p-4 pl-10 text-sm bg-transparent border border-black/10 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-(--primary) focus:border-(--primary) hover:border-black/20 dark:hover:border-white/20 text-75 placeholder:opacity-50 transition-colors outline-hidden"
          placeholder={placeholder}
        />
      </div>
    </form>
  )
}
