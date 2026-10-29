"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";

const NEW = "__new__";

/**
 * The category of a stock item, chosen from the ones already in use (like the status). A category that does not exist yet is added with the last
 * choice, "Add a new category…", which opens a box for its name. The form receives the chosen or typed name as `category`.
 */
export function CategorySelect({ categories, defaultValue }: { categories: string[]; defaultValue?: string | null }) {
  const options = React.useMemo(() => (defaultValue && !categories.includes(defaultValue) ? [...categories, defaultValue].sort() : categories), [categories, defaultValue]);
  const [choice, setChoice] = React.useState<string>(defaultValue ?? "");
  const [created, setCreated] = React.useState("");
  const adding = choice === NEW;
  const value = adding ? created.trim() : choice;

  return (
    <div className="grid gap-2">
      <Label>
        Category<span className="text-destructive"> *</span>
      </Label>
      <input type="hidden" name="category" value={value} />
      <Select value={choice} onValueChange={setChoice}>
        <SelectTrigger className="w-full" aria-label="Category">
          <SelectValue placeholder="Choose a category" />
        </SelectTrigger>
        <SelectContent>
          {options.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
          {options.length > 0 ? <SelectSeparator /> : null}
          <SelectItem value={NEW}>Add a new category…</SelectItem>
        </SelectContent>
      </Select>
      {adding ? <Input value={created} onChange={(e) => setCreated(e.target.value)} placeholder="Name of the new category" autoFocus required aria-label="New category name" /> : null}
    </div>
  );
}
