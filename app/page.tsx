"use client"

import React from "react"

import { useEffect, useMemo, useRef, useState, useImperativeHandle } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  Copy,
  Download,
  Edit,
  Filter,
  Folder,
  ListFilter,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  Tag,
  Trash,
  Upload,
  X,
  Eye,
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

type Prompt = {
  id: string
  title: string
  content: string
  category: string | null
  tags: string[]
  favorite: boolean
  uses: number
  createdAt: number
  updatedAt: number
}

type ExportFile = {
  version: number
  exportedAt: number
  prompts: Prompt[]
  categories: string[]
  tags: string[]
}

const STORAGE_KEYS = {
  prompts: "pm_prompts_v1",
  categories: "pm_categories_v1",
  tags: "pm_tags_v1",
} as const

function now() {
  return Date.now()
}

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2)
}

function normalizeTag(t: string) {
  return t.trim().replace(/\s+/g, " ")
}

function normalizeCategory(c: string) {
  return c.trim().replace(/\s+/g, " ")
}

function deriveUsedTags(prompts: Prompt[]) {
  const set = new Set<string>()
  for (const p of prompts) {
    for (const t of p.tags) {
      const n = normalizeTag(t)
      if (n) set.add(n)
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

function useLocalStore() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const loadedRef = useRef(false)

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(STORAGE_KEYS.prompts) || "[]") as Prompt[]
      const c = JSON.parse(localStorage.getItem(STORAGE_KEYS.categories) || "[]") as string[]
      const t = JSON.parse(localStorage.getItem(STORAGE_KEYS.tags) || "[]") as string[]

      if (Array.isArray(p)) setPrompts(p)
      if (Array.isArray(c)) setCategories(c)
      if (Array.isArray(t)) setTags(t)

      if ((!p || p.length === 0) && (!c || c.length === 0) && (!t || t.length === 0)) {
        const seedCats = ["Marketing", "Coding", "Research"]
        const seedTags = ["email", "seo", "typescript", "summarize", "brainstorm"]
        const seedPrompts: Prompt[] = [
          {
            id: uid(),
            title: "Cold Email Outreach",
            content:
              "Act as a sales rep. Write a concise, friendly cold email to introduce our product to SMB owners. Include a clear CTA and 2 subject line options.",
            category: "Marketing",
            tags: ["email", "seo"],
            favorite: true,
            uses: 0,
            createdAt: now(),
            updatedAt: now(),
          },
          {
            id: uid(),
            title: "TypeScript Refactor Plan",
            content:
              "Given a React component, list a step-by-step refactor plan to add strong TypeScript types and improve maintainability. Include code snippets.",
            category: "Coding",
            tags: ["typescript"],
            favorite: false,
            uses: 0,
            createdAt: now(),
            updatedAt: now(),
          },
          {
            id: uid(),
            title: "Paper Summary",
            content:
              "Summarize the following research paper in 5 bullet points, highlight key findings and limitations. Then propose a follow-up experiment.",
            category: "Research",
            tags: ["summarize"],
            favorite: false,
            uses: 0,
            createdAt: now(),
            updatedAt: now(),
          },
        ]
        setPrompts(seedPrompts)
        setCategories(seedCats)
        setTags(seedTags)
      }
    } catch {
      // ignore
    } finally {
      loadedRef.current = true
    }
  }, [])

  useEffect(() => {
    if (!loadedRef.current) return
    localStorage.setItem(STORAGE_KEYS.prompts, JSON.stringify(prompts))
  }, [prompts])

  useEffect(() => {
    if (!loadedRef.current) return
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories))
  }, [categories])

  useEffect(() => {
    if (!loadedRef.current) return
    localStorage.setItem(STORAGE_KEYS.tags, JSON.stringify(tags))
  }, [tags])

  return {
    prompts,
    setPrompts,
    categories,
    setCategories,
    tags,
    setTags,
  }
}

type PromptFormValues = {
  title: string
  content: string
  category: string
  tags: string[]
}

function useFilters() {
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string | "all">("all")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagMatch, setTagMatch] = useState<"any" | "all">("any")
  const [sort, setSort] = useState<"updated" | "created" | "title">("updated")

  return {
    search,
    setSearch,
    category,
    setCategory,
    selectedTags,
    setSelectedTags,
    tagMatch,
    setTagMatch,
    sort,
    setSort,
  }
}

function applyFilters(
  prompts: Prompt[],
  opts: {
    search: string
    category: string | "all"
    selectedTags: string[]
    tagMatch: "any" | "all"
    sort: "updated" | "created" | "title"
  },
) {
  const q = opts.search.trim().toLowerCase()
  let list = prompts.filter((p) => {
    if (opts.category !== "all") {
      if (opts.category === "uncategorized" && p.category) return false
      if (opts.category !== "uncategorized" && (p.category || "") !== opts.category) return false
    }
    if (q) {
      const hay = `${p.title} ${p.content} ${p.category || ""} ${p.tags.join(" ")}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (opts.selectedTags.length > 0) {
      if (opts.tagMatch === "any") {
        return p.tags.some((t) => opts.selectedTags.includes(t))
      } else {
        return opts.selectedTags.every((t) => p.tags.includes(t))
      }
    }
    return true
  })

  list = list.sort((a, b) => {
    if (opts.sort === "updated") return b.updatedAt - a.updatedAt
    if (opts.sort === "created") return b.createdAt - a.createdAt
    return a.title.localeCompare(b.title)
  })

  return list
}

type TagInputHandle = {
  getPending: () => string
  commit: () => void
  clear: () => void
}

const TagInput = React.forwardRef<
  TagInputHandle,
  {
    value: string[]
    onChange: (next: string[]) => void
    suggestions?: string[]
    placeholder?: string
    "aria-label"?: string
  }
>(function TagInput(
  { value, onChange, suggestions = [], placeholder = "Add tag and press Enter", "aria-label": ariaLabel },
  ref,
) {
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)
  const normalizedValue = value.map(normalizeTag)

  function addTag(raw: string) {
    const t = normalizeTag(raw)
    if (!t) return
    if (normalizedValue.includes(t)) {
      setInput("")
      return
    }
    onChange([...normalizedValue, t])
    setInput("")
  }

  function removeTag(t: string) {
    onChange(normalizedValue.filter((x) => x !== t))
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(input)
    } else if (e.key === "Backspace" && input === "" && normalizedValue.length > 0) {
      e.preventDefault()
      const last = normalizedValue[normalizedValue.length - 1]
      removeTag(last)
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      getPending: () => input.trim(),
      commit: () => {
        if (input.trim()) addTag(input)
      },
      clear: () => setInput(""),
    }),
    [input, normalizedValue],
  )

  const filteredSuggestions = useMemo(() => {
    const q = input.trim().toLowerCase()
    return suggestions
      .filter((s) => !normalizedValue.includes(s))
      .filter((s) => (q ? s.toLowerCase().includes(q) : true))
      .slice(0, 6)
  }, [suggestions, normalizedValue, input])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
        {normalizedValue.map((t) => (
          <Badge key={t} variant="secondary" className="flex items-center gap-1">
            <Tag className="h-3 w-3" />
            <span>{t}</span>
            <button aria-label={`Remove tag ${t}`} onClick={() => removeTag(t)}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          aria-label={ariaLabel || "Tag input"}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm px-2 py-1"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      {filteredSuggestions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              onClick={() => addTag(s)}
              className="text-xs rounded-full border px-2 py-1 hover:bg-muted"
              aria-label={`Add suggested tag ${s}`}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
})

/**
 * PromptForm
 * Fix: Footer actions never go out of view.
 * - DialogContent gets max-h and overflow-hidden
 * - Form uses flex col; fields live in a ScrollArea (flex-1)
 * - Footer is outside ScrollArea, always visible
 */
function PromptForm({
  open,
  setOpen,
  onSubmit,
  initial,
  allCategories,
  allTags,
}: {
  open: boolean
  setOpen: (v: boolean) => void
  onSubmit: (values: PromptFormValues) => void
  initial?: Partial<Prompt>
  allCategories: string[]
  allTags: string[]
}) {
  const [title, setTitle] = useState(initial?.title || "")
  const [content, setContent] = useState(initial?.content || "")
  const [category, setCategory] = useState(initial?.category || "")
  const [tags, setTags] = useState<string[]>(initial?.tags || [])
  const tagInputRef = useRef<TagInputHandle | null>(null)

  useEffect(() => {
    if (open) {
      setTitle(initial?.title || "")
      setContent(initial?.content || "")
      setCategory(initial?.category || "")
      setTags(initial?.tags || [])
    }
  }, [open, initial?.title, initial?.content, initial?.category, initial?.tags])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const pending = tagInputRef.current?.getPending() || ""
    const normalized = tags.map(normalizeTag)
    const finalTags = pending.trim()
      ? normalized.includes(normalizeTag(pending))
        ? normalized
        : [...normalized, normalizeTag(pending)]
      : normalized

    onSubmit({
      title: title.trim(),
      content: content.trim(),
      category: normalizeCategory(category),
      tags: finalTags,
    })
    setOpen(false)
  }

  const categorySuggestions = useMemo(() => {
    const q = category.trim().toLowerCase()
    return allCategories.filter((c) => (q ? c.toLowerCase().includes(q) : true)).slice(0, 6)
  }, [allCategories, category])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* p-0 to control internal spacing; grid keeps header/footer fixed, body scrollable */}
      <DialogContent className="sm:max-w-2xl p-0">
        <form onSubmit={handleSubmit} className="grid max-h-[85vh] grid-rows-[auto,1fr,auto]">
          {/* Sticky header */}
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>{initial?.id ? "Edit prompt" : "New prompt"}</DialogTitle>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="overflow-y-auto px-6 pb-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Blog Outline Generator"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="content">Prompt</Label>
                <Textarea
                  id="content"
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your prompt here..."
                  rows={12}
                  required
                  className="font-mono"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Select or type a new category"
                  list="category-suggestions"
                />
                <datalist id="category-suggestions">
                  {allCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                {categorySuggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {categorySuggestions.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setCategory(c)}
                        className="text-xs rounded-full border px-2 py-1 hover:bg-muted"
                        aria-label={`Use category ${c}`}
                      >
                        <Folder className="mr-1 inline h-3 w-3" />
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Tags</Label>
                <TagInput ref={tagInputRef} value={tags} onChange={setTags} suggestions={allTags} aria-label="Tags" />
              </div>
            </div>
          </div>

          {/* Sticky footer with actions always visible */}
          <DialogFooter className="gap-2 border-t px-6 py-4">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{initial?.id ? "Save changes" : "Create prompt"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PromptCard({
  prompt,
  onEdit,
  onDelete,
  onToggleFavorite,
  onCopy,
  onView,
}: {
  prompt: Prompt
  onEdit: () => void
  onDelete: () => void
  onToggleFavorite: () => void
  onCopy: () => void
  onView: () => void
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{prompt.title}</CardTitle>
          <div className="flex items-center gap-1">
            <button
              className={cn(
                "rounded p-1",
                prompt.favorite ? "text-yellow-500" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={onToggleFavorite}
              aria-label={prompt.favorite ? "Unfavorite" : "Favorite"}
              title={prompt.favorite ? "Unfavorite" : "Favorite"}
            >
              <Star className={cn("h-4 w-4", prompt.favorite ? "fill-yellow-400" : "")} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onView}>
                  <Eye className="mr-2 h-4 w-4" /> View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onCopy}>
                  <Copy className="mr-2 h-4 w-4" /> Copy
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-red-600">
                  <Trash className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {prompt.category ? (
            <Badge variant="outline" className="flex items-center gap-1">
              <Folder className="h-3 w-3" />
              {prompt.category}
            </Badge>
          ) : null}
          {prompt.tags.map((t) => (
            <Badge key={t} variant="secondary" className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {t}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <div
          role="button"
          tabIndex={0}
          onClick={onView}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onView()}
          className="rounded-md border bg-muted/30 p-3 text-sm font-mono leading-relaxed max-h-40 overflow-hidden cursor-pointer hover:bg-muted/50"
          title="Click to view full prompt"
          aria-label="Open prompt viewer"
        >
          {prompt.content}
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {"Uses: "}
          {prompt.uses}
          {" • Updated: "}
          {new Date(prompt.updatedAt).toLocaleDateString()}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onView}>
            <Eye className="mr-2 h-4 w-4" />
            View
          </Button>
          <Button variant="outline" size="sm" onClick={onCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

export default function Page() {
  const { toast } = useToast()
  const { prompts, setPrompts, categories, setCategories, tags, setTags } = useLocalStore()

  const usedTags = useMemo(() => deriveUsedTags(prompts), [prompts])

  useEffect(() => {
    setTags(usedTags)
    filters.setSelectedTags((prev) => prev.filter((t) => usedTags.includes(t)))
  }, [usedTags]) // eslint-disable-line react-hooks/exhaustive-deps

  const filters = useFilters()

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Prompt | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewing, setViewing] = useState<Prompt | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const filtered = useMemo(
    () =>
      applyFilters(prompts, {
        search: filters.search,
        category: filters.category,
        selectedTags: filters.selectedTags,
        tagMatch: filters.tagMatch,
        sort: filters.sort,
      }),
    [prompts, filters.search, filters.category, filters.selectedTags, filters.tagMatch, filters.sort],
  )

  const favoriteFirst = useMemo(() => [...filtered].sort((a, b) => Number(b.favorite) - Number(a.favorite)), [filtered])

  function upsertCategoriesAndTags(category: string, tgs: string[]) {
    if (category) {
      const c = normalizeCategory(category)
      if (c && !categories.includes(c)) setCategories([...categories, c])
    }
    if (tgs.length) {
      const unique = Array.from(new Set([...tags, ...tgs.map(normalizeTag)]))
      setTags(unique)
    }
  }

  function handleCreate(values: PromptFormValues) {
    const p: Prompt = {
      id: uid(),
      title: values.title,
      content: values.content,
      category: values.category || null,
      tags: values.tags,
      favorite: false,
      uses: 0,
      createdAt: now(),
      updatedAt: now(),
    }
    setPrompts([p, ...prompts])
    upsertCategoriesAndTags(values.category, values.tags)
    toast({ title: "Prompt created" })
  }

  function handleEdit(values: PromptFormValues) {
    if (!editing) return
    const next = prompts.map((p) =>
      p.id === editing.id
        ? {
            ...p,
            title: values.title,
            content: values.content,
            category: values.category || null,
            tags: values.tags,
            updatedAt: now(),
          }
        : p,
    )
    setPrompts(next)
    upsertCategoriesAndTags(values.category, values.tags)
    setEditing(null)
    toast({ title: "Changes saved" })
  }

  function handleDelete(id: string) {
    setPrompts(prompts.filter((p) => p.id !== id))
    toast({ title: "Prompt deleted" })
  }

  async function handleCopy(prompt: Prompt) {
    try {
      await navigator.clipboard.writeText(prompt.content)
      setPrompts(prompts.map((p) => (p.id === prompt.id ? { ...p, uses: p.uses + 1, updatedAt: now() } : p)))
      toast({ title: "Copied to clipboard" })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  function handleToggleFavorite(id: string) {
    setPrompts(prompts.map((p) => (p.id === id ? { ...p, favorite: !p.favorite, updatedAt: now() } : p)))
  }

  function handleExport() {
    const payload: ExportFile = {
      version: 1,
      exportedAt: now(),
      prompts,
      categories,
      tags,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `prompts-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as Partial<ExportFile>
        if (!data || !Array.isArray(data.prompts)) throw new Error("Invalid file")
        const map = new Map(prompts.map((p) => [p.id, p]))
        for (const p of data.prompts as Prompt[]) {
          if (!map.has(p.id)) map.set(p.id, p)
        }
        setPrompts(Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt))
        if (Array.isArray(data.categories)) {
          setCategories(Array.from(new Set([...categories, ...data.categories.map(normalizeCategory)])))
        }
        if (Array.isArray(data.tags)) {
          setTags(Array.from(new Set([...tags, ...data.tags.map(normalizeTag)])))
        }
        toast({ title: "Import completed" })
      } catch {
        toast({ title: "Import failed", variant: "destructive" })
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    }
    reader.readAsText(file)
  }

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of prompts) {
      const key = p.category || "Uncategorized"
      map.set(key, (map.get(key) || 0) + 1)
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [prompts])

  function openViewer(p: Prompt) {
    setViewing(p)
    setViewOpen(true)
  }

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-8">
      <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Prompt Manager</h1>
          <p className="text-sm text-muted-foreground">
            Organize prompts by categories and tags. Search, filter, and export your library.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle />
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportFile}
            aria-label="Import JSON"
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Prompt
              </Button>
            </DialogTrigger>
            <PromptForm
              open={createOpen}
              setOpen={setCreateOpen}
              onSubmit={handleCreate}
              allCategories={categories}
              allTags={usedTags}
            />
          </Dialog>
        </div>
      </header>

      <section className="mb-6 rounded-lg border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search title, content, tags..."
              value={filters.search}
              onChange={(e) => filters.setSearch(e.target.value)}
              aria-label="Search"
            />
          </div>
          <div className="flex items-center gap-2">
            <ListFilter className="h-4 w-4 text-muted-foreground" />
            <Select value={filters.category} onValueChange={(v) => filters.setCategory(v as any)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
                {prompts.some((p) => !p.category) ? <SelectItem value="uncategorized">Uncategorized</SelectItem> : null}
              </SelectContent>
            </Select>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Select value={filters.sort} onValueChange={(v) => filters.setSort(v as any)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Recently updated</SelectItem>
                <SelectItem value="created">Recently created</SelectItem>
                <SelectItem value="title">Title (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Button
              variant={filters.tagMatch === "any" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => filters.setTagMatch("any")}
              aria-pressed={filters.tagMatch === "any"}
            >
              Any tag
            </Button>
            <Button
              variant={filters.tagMatch === "all" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => filters.setTagMatch("all")}
              aria-pressed={filters.tagMatch === "all"}
            >
              All tags
            </Button>
          </div>
        </div>
        {usedTags.length > 0 ? (
          <>
            <Separator className="my-3" />
            <ScrollArea className="h-[86px]">
              <div className="flex flex-wrap gap-2">
                {usedTags.map((t) => {
                  const active = filters.selectedTags.includes(t)
                  return (
                    <button
                      key={t}
                      onClick={() =>
                        filters.setSelectedTags(
                          active ? filters.selectedTags.filter((x) => x !== t) : [...filters.selectedTags, t],
                        )
                      }
                      className={cn(
                        "rounded-full border px-2 py-1 text-xs",
                        active ? "bg-foreground text-background" : "hover:bg-muted",
                      )}
                      aria-pressed={active}
                      aria-label={`Filter by tag ${t}`}
                    >
                      <Tag className="mr-1 inline h-3 w-3" />
                      {t}
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {favoriteFirst.map((p) => (
          <PromptCard
            key={p.id}
            prompt={p}
            onEdit={() => {
              setEditing(p)
              setEditOpen(true)
            }}
            onDelete={() => {
              if (confirm("Delete this prompt? This cannot be undone.")) {
                handleDelete(p.id)
              }
            }}
            onToggleFavorite={() => handleToggleFavorite(p.id)}
            onCopy={() => handleCopy(p)}
            onView={() => openViewer(p)}
          />
        ))}
      </section>

      <aside className="mt-8">
        <h2 className="mb-2 text-sm font-medium">Categories</h2>
        <div className="flex flex-wrap gap-2">
          {categoryCounts.map(([name, count]) => (
            <button
              key={name}
              onClick={() => filters.setCategory(name === "Uncategorized" ? "uncategorized" : (name as any))}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs",
                filters.category === name || (name === "Uncategorized" && filters.category === "uncategorized")
                  ? "bg-foreground text-background"
                  : "hover:bg-muted",
              )}
              aria-pressed={filters.category === name}
            >
              <Folder className="mr-1 inline h-3 w-3" />
              {name} ({count})
            </button>
          ))}
        </div>
      </aside>

      {/* Edit Dialog */}
      <PromptForm
        open={editOpen}
        setOpen={(v) => {
          if (!v) setEditing(null)
          setEditOpen(v)
        }}
        onSubmit={handleEdit}
        initial={editing || undefined}
        allCategories={categories}
        allTags={usedTags}
      />

      {/* View Dialog (read-only, for long prompts) */}
      <Dialog
        open={viewOpen}
        onOpenChange={(v) => {
          if (!v) setViewing(null)
          setViewOpen(v)
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-start justify-between gap-2">
              <span className="text-base">{viewing?.title || "Prompt"}</span>
            </DialogTitle>
          </DialogHeader>
          {viewing ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {viewing.category ? (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Folder className="h-3 w-3" />
                    {viewing.category}
                  </Badge>
                ) : null}
                {viewing.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    {t}
                  </Badge>
                ))}
              </div>
              <div className="rounded-md border bg-muted/30 p-3 font-mono text-sm leading-relaxed max-h-[50vh] overflow-auto whitespace-pre-wrap">
                {viewing.content}
              </div>
              <div className="text-xs text-muted-foreground">
                {"Uses: "}
                {viewing.uses} {" • Created: "}
                {new Date(viewing.createdAt).toLocaleString()} {" • Updated: "}
                {new Date(viewing.updatedAt).toLocaleString()}
              </div>
            </div>
          ) : null}
          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (viewing) {
                  navigator.clipboard.writeText(viewing.content).then(() => {
                    setPrompts((prev) =>
                      prev.map((p) => (p.id === viewing.id ? { ...p, uses: p.uses + 1, updatedAt: now() } : p)),
                    )
                  })
                }
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (!viewing) return
                setEditing(viewing)
                setEditOpen(true)
                setViewOpen(false)
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!viewing) return
                if (confirm("Delete this prompt? This cannot be undone.")) {
                  handleDelete(viewing.id)
                  setViewOpen(false)
                }
              }}
            >
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </Button>
            <Button onClick={() => setViewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
