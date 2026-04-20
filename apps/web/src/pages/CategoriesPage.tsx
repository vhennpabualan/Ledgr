import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '../lib/api';
import type { Category, CreateCategoryDTO } from '@ledgr/types';
import BottomSheet from '../components/BottomSheet';
import { useAnimatedDelete } from '../hooks/useAnimatedDelete';

function extractError(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

const glass = 'rounded-2xl border border-white/70 bg-white/50 backdrop-blur-md shadow-sm shadow-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04]';

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({ category, onEdit, onArchive, onRestore, onDelete, archivePending }: {
  category: Category;
  onEdit: (c: Category) => void;
  onArchive: (c: Category) => void;
  onRestore: (c: Category) => void;
  onDelete: (c: Category) => void;
  archivePending: boolean;
}) {
  const isSystem = category.userId === null;
  const isArchived = category.isArchived;

  return (
    <div className={[
      'group relative rounded-2xl border p-4 transition-all duration-200 overflow-hidden',
      isArchived
        ? 'border-black/[0.05] bg-black/[0.02] dark:border-white/[0.06] dark:bg-white/[0.03] opacity-50'
        : 'border-white/70 dark:border-white/[0.10] bg-white/50 dark:bg-white/[0.08] backdrop-blur-md shadow-sm shadow-black/[0.06] hover:shadow-md hover:shadow-black/[0.08] hover:-translate-y-0.5',
    ].join(' ')}>
      {/* Color accent top bar */}
      <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl transition-all" style={{ backgroundColor: category.color }} />

      {/* Icon */}
      <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl mb-3 mt-1"
        style={{ backgroundColor: category.color + '22', color: category.color }}>
        {category.icon}
      </div>

      {/* Name */}
      <p className={`text-sm font-semibold truncate ${isArchived ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}>
        {category.name}
      </p>

      {/* Badges */}
      <div className="flex items-center gap-1.5 mt-1 flex-wrap min-h-[20px]">
        {isSystem && (
          <span className="text-[10px] font-medium text-indigo-500 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-900/20 border border-indigo-200/50 rounded-full px-2 py-0.5">
            System
          </span>
        )}
        {isArchived && (
          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-black/[0.04] dark:bg-white/[0.04] rounded-full px-2 py-0.5">
            Archived
          </span>
        )}
      </div>

      {/* Action row — slides up on hover, only for user-owned categories */}
      {!isSystem && (
        <div className="flex items-center gap-1.5 mt-2 translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-150">
          {isArchived ? (
            <>
              <button type="button" onClick={() => onRestore(category)} disabled={archivePending}
                className="flex-1 rounded-lg border border-emerald-200/60 bg-emerald-50/80 dark:bg-emerald-900/20 px-2 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/80 disabled:opacity-40 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                aria-label={`Restore ${category.name}`}>
                Restore
              </button>
              <button type="button" onClick={() => onDelete(category)}
                className="flex-1 rounded-lg border border-red-200/60 bg-red-50/80 dark:bg-red-900/20 px-2 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100/80 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                aria-label={`Delete ${category.name}`}>
                Delete
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => onEdit(category)}
                className="flex-1 rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.06] px-2 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-white/[0.10] transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label={`Edit ${category.name}`}>
                Edit
              </button>
              <button type="button" onClick={() => onArchive(category)} disabled={archivePending}
                className="flex-1 rounded-lg border border-amber-200/60 bg-amber-50/80 dark:bg-amber-900/20 px-2 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100/80 disabled:opacity-40 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                aria-label={`Archive ${category.name}`}>
                Archive
              </button>
              <button type="button" onClick={() => onDelete(category)}
                className="flex-1 rounded-lg border border-red-200/60 bg-red-50/80 dark:bg-red-900/20 px-2 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100/80 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                aria-label={`Delete ${category.name}`}>
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Category form ────────────────────────────────────────────────────────────

function CategoryForm({ categories, onSuccess, onCancel, editing }: {
  categories: Category[]; onSuccess: () => void; onCancel: () => void; editing?: Category;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(editing?.name ?? '');
  const [icon, setIcon] = useState(editing?.icon ?? '');
  const [color, setColor] = useState(editing?.color ?? '#6366f1');
  const [parentId, setParentId] = useState<string>(editing?.parentId ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const [parentOpen, setParentOpen] = useState(false);

  const parentOptions = categories.filter((c) => !c.isArchived && c.parentId === null && c.id !== editing?.id);
  const selectedParent = parentOptions.find((c) => c.id === parentId);

  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryDTO) => categoriesApi.create(data),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ['categories'] }); onSuccess(); },
    onError: (err) => setFormError(extractError(err)),
  });
  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateCategoryDTO>) => categoriesApi.patch(editing!.id, data),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ['categories'] }); onSuccess(); },
    onError: (err) => setFormError(extractError(err)),
  });
  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const trimmed = name.trim();
    if (!trimmed) return setFormError('Name is required.');
    if (trimmed.length > 50) return setFormError('Name must be 50 characters or fewer.');
    if (!icon.trim()) return setFormError('Icon is required.');
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return setFormError('Color must be a valid hex (e.g. #6366f1).');
    const payload: CreateCategoryDTO = { name: trimmed, icon: icon.trim(), color, ...(parentId ? { parentId } : {}) };
    editing ? updateMutation.mutate(payload) : createMutation.mutate(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2" noValidate>
      {formError && <p role="alert" className="rounded-xl bg-red-50/60 dark:bg-red-900/20 border border-red-200/60 px-3 py-2 text-sm text-red-600 dark:text-red-400">{formError}</p>}

      {/* Live preview card */}
      <div className="flex justify-center py-2">
        <div className="relative rounded-2xl border border-white/70 dark:border-white/[0.10] bg-white/60 dark:bg-white/[0.08] backdrop-blur-md shadow-sm p-4 w-32 text-center">
          <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl" style={{ backgroundColor: color || '#6366f1' }} />
          <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl mx-auto mb-2 mt-1"
            style={{ backgroundColor: (color || '#6366f1') + '22', color: color || '#6366f1' }}>
            {icon || '?'}
          </div>
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">{name || 'Category name'}</p>
        </div>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1">
        <label htmlFor="cat-name" className="text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wide">
          Name <span className="text-red-400">*</span>
        </label>
        <input id="cat-name" type="text" value={name} onChange={(e) => setName(e.target.value)}
          maxLength={50} placeholder="e.g. Groceries" required
          className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] dark:text-gray-100 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <span className="text-xs text-gray-400 dark:text-gray-500 text-right">{name.length}/50</span>
      </div>

      {/* Icon + Color row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="cat-icon" className="text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wide">
            Icon <span className="text-red-400">*</span>
          </label>
          <input id="cat-icon" type="text" value={icon} onChange={(e) => setIcon(e.target.value)}
            placeholder="🛒"
            className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] dark:text-gray-100 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 min-w-0" />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <label htmlFor="cat-color" className="text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wide">Color</label>
          <div className="flex items-center gap-1.5 min-w-0">
            <input id="cat-color" type="color" value={color} onChange={(e) => setColor(e.target.value)}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-black/10 dark:border-white/10 p-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <input type="text" value={color} onChange={(e) => setColor(e.target.value)}
              placeholder="#6366f1" maxLength={7}
              className="min-w-0 w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] dark:text-gray-100 px-2 py-2 text-sm font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              aria-label="Hex color value" />
          </div>
        </div>
      </div>

      {/* Parent */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wide">Parent category</label>
        <div className="relative">
          <button type="button" onClick={() => setParentOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={parentOpen}
            className={`w-full flex items-center justify-between rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors ${selectedParent ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
            <span>{selectedParent ? `${selectedParent.icon} ${selectedParent.name}` : 'None'}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform shrink-0 ${parentOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          {parentOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setParentOpen(false)} aria-hidden="true" />
              <ul role="listbox" className="absolute z-20 mt-1 w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/90 dark:bg-[#1a1a2e]/90 backdrop-blur-md shadow-lg max-h-48 overflow-y-auto py-1">
                <li role="option" aria-selected={parentId === ''} onClick={() => { setParentId(''); setParentOpen(false); }}
                  className={`px-3 py-2 text-sm cursor-pointer select-none transition-colors ${parentId === '' ? 'bg-indigo-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'}`}>
                  None
                </li>
                {parentOptions.map((c) => (
                  <li key={c.id} role="option" aria-selected={parentId === c.id}
                    onClick={() => { setParentId(c.id); setParentOpen(false); }}
                    className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none transition-colors ${parentId === c.id ? 'bg-indigo-600 text-white' : 'text-gray-700 dark:text-gray-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'}`}>
                    <span aria-hidden="true">{c.icon}</span>{c.name}{c.userId === null ? ' (system)' : ''}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">One level of nesting only.</p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={isPending}
          className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:opacity-40 transition-colors focus:outline-none">
          Cancel
        </button>
        <button type="submit" disabled={isPending}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors focus:outline-none shadow-sm shadow-indigo-500/20">
          {isPending ? 'Saving…' : editing ? 'Save changes' : 'Create category'}
        </button>
      </div>
    </form>
  );
}

// ─── Delete dialog ────────────────────────────────────────────────────────────

function DeleteDialog({ category, onCancel, onConfirm, isPending, error }: {
  category: Category; onCancel: () => void; onConfirm: () => void; isPending: boolean; error: string | null;
}) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="delete-cat-title" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className={`relative z-10 w-full max-w-sm ${glass} p-6`}>
        <h2 id="delete-cat-title" className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">Delete category?</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          <span className="mr-1.5" aria-hidden="true">{category.icon}</span>
          <strong>{category.name}</strong> will be permanently removed. Expenses won't be affected.
        </p>
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50/60 dark:bg-red-900/20 border border-red-200/60 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={isPending}
            className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:opacity-40 transition-colors focus:outline-none">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={isPending}
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-40 transition-colors focus:outline-none">
            {isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={`${glass} p-4 space-y-3`}>
          <div className="h-12 w-12 rounded-xl bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
          <div className="h-3.5 w-20 rounded-lg bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
          <div className="h-2.5 w-12 rounded-lg bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [archivePendingId, setArchivePendingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { exitingIds, triggerDelete } = useAnimatedDelete(['categories']);

  const { data: categories = [], isLoading, isError, refetch } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
  });

  const archiveMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (id: string) => categoriesApi.patch(id, { isArchived: true } as any),
    onMutate: (id) => setArchivePendingId(id),
    onSettled: () => setArchivePendingId(null),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['categories'] }),
  });

  const restoreMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (id: string) => categoriesApi.patch(id, { isArchived: false } as any),
    onMutate: (id) => setArchivePendingId(id),
    onSettled: () => setArchivePendingId(null),
    onSuccess: () => queryClient.refetchQueries({ queryKey: ['categories'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ['categories'] }); setDeletingCategory(null); setDeleteError(null); },
    onError: (err) => setDeleteError(extractError(err)),
  });
  const systemActive = categories.filter((c) => c.userId === null && !c.isArchived);
  const userActive = categories.filter((c) => c.userId !== null && !c.isArchived);
  const archived = categories.filter((c) => c.isArchived);

  function openEdit(c: Category) { setEditingCategory(c); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditingCategory(undefined); }
  function closeDelete() { if (deleteMutation.isPending) return; setDeletingCategory(null); setDeleteError(null); }

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Categories</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{userActive.length} custom · {systemActive.length} system</p>
        </div>
        <button type="button" onClick={() => { setEditingCategory(undefined); setShowForm(true); }}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors focus:outline-none shadow-sm shadow-indigo-500/20">
          + New category
        </button>
      </div>

      {isLoading ? <SkeletonGrid />
        : isError ? (
          <div className={`${glass} px-6 py-10 text-center`}>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Failed to load categories.</p>
            <button type="button" onClick={() => refetch()}
              className="rounded-xl border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors focus:outline-none">
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* My categories */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">My Categories</h2>
              {userActive.length === 0 ? (
                <div className={`${glass} px-6 py-10 text-center border-dashed`}>
                  <p className="text-sm text-gray-400 dark:text-gray-500">No custom categories yet.</p>
                  <button type="button" onClick={() => { setEditingCategory(undefined); setShowForm(true); }}
                    className="mt-2 text-sm text-indigo-500 dark:text-indigo-400 hover:underline focus:outline-none">
                    Create your first one
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {userActive.map((c) => (
                    <div key={c.id} className={exitingIds.has(c.id) ? 'item-exit' : 'item-enter'}>
                      <CategoryCard category={c}
                        onEdit={openEdit} onArchive={(cat) => archiveMutation.mutate(cat.id)}
                        onRestore={(cat) => restoreMutation.mutate(cat.id)}
                        onDelete={(cat) => triggerDelete(cat.id, () => categoriesApi.delete(cat.id))}
                        archivePending={archivePendingId === c.id} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* System categories */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">System Categories</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {systemActive.map((c) => (
                  <div key={c.id} className="item-enter">
                    <CategoryCard category={c}
                      onEdit={openEdit} onArchive={(cat) => archiveMutation.mutate(cat.id)}
                      onRestore={(cat) => restoreMutation.mutate(cat.id)}
                      onDelete={(cat) => triggerDelete(cat.id, () => categoriesApi.delete(cat.id))}
                      archivePending={archivePendingId === c.id} />
                  </div>
                ))}
              </div>
            </section>

            {/* Archived — collapsible */}
            {archived.length > 0 && (
              <section>
                <button type="button" onClick={() => setShowArchived((v) => !v)}
                  className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 transition-transform ${showArchived ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  Archived ({archived.length})
                </button>
                {showArchived && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {archived.map((c) => (
                      <div key={c.id} className={exitingIds.has(c.id) ? 'item-exit' : 'item-enter'}>
                        <CategoryCard category={c}
                          onEdit={openEdit} onArchive={(cat) => archiveMutation.mutate(cat.id)}
                          onRestore={(cat) => restoreMutation.mutate(cat.id)}
                          onDelete={(cat) => triggerDelete(cat.id, () => categoriesApi.delete(cat.id))}
                          archivePending={archivePendingId === c.id} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

      {/* Create / Edit modal */}
      <BottomSheet
        open={showForm}
        onClose={closeForm}
        title={editingCategory ? 'Edit category' : 'New category'}
      >
        <CategoryForm categories={categories} editing={editingCategory} onSuccess={closeForm} onCancel={closeForm} />
      </BottomSheet>

      {deletingCategory && (
        <DeleteDialog category={deletingCategory} onCancel={closeDelete}
          onConfirm={() => {
            triggerDelete(deletingCategory.id, () => categoriesApi.delete(deletingCategory.id));
            setDeletingCategory(null);
          }}
          isPending={deleteMutation.isPending} error={deleteError} />
      )}
    </div>
  );
}
