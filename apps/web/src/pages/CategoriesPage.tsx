import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '../lib/api';
import type { Category, CreateCategoryDTO } from '@ledgr/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

// ─── Category form ────────────────────────────────────────────────────────────

interface CategoryFormProps {
  categories: Category[];
  onSuccess: () => void;
  onCancel: () => void;
  /** When provided, the form is in edit mode */
  editing?: Category;
}

function CategoryForm({ categories, onSuccess, onCancel, editing }: CategoryFormProps) {
  const queryClient = useQueryClient();

  const [name, setName] = useState(editing?.name ?? '');
  const [icon, setIcon] = useState(editing?.icon ?? '');
  const [color, setColor] = useState(editing?.color ?? '#6366f1');
  const [parentId, setParentId] = useState<string>(editing?.parentId ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const [parentOpen, setParentOpen] = useState(false);

  // Only non-archived user + system categories with no parent (max depth 1)
  const parentOptions = categories.filter(
    (c) => !c.isArchived && c.parentId === null && c.id !== editing?.id,
  );

  const selectedParent = parentOptions.find((c) => c.id === parentId);

  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryDTO) => categoriesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onSuccess();
    },
    onError: (err) => setFormError(extractError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateCategoryDTO>) =>
      categoriesApi.patch(editing!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onSuccess();
    },
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
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return setFormError('Color must be a valid hex code (e.g. #6366f1).');

    const payload: CreateCategoryDTO = {
      name: trimmed,
      icon: icon.trim(),
      color,
      ...(parentId ? { parentId } : {}),
    };

    if (editing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {formError && (
        <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      )}

      {/* Name */}
      <div className="flex flex-col gap-1">
        <label htmlFor="cat-name" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Name <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <input
          id="cat-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          placeholder="e.g. Groceries"
          required
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
        <span className="text-xs text-gray-400 text-right">{name.length}/50</span>
      </div>

      {/* Icon */}
      <div className="flex flex-col gap-1">
        <label htmlFor="cat-icon" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Icon <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            id="cat-icon"
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="🛒"
            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          {icon && (
            <span className="text-2xl" role="img" aria-label="Icon preview">
              {icon}
            </span>
          )}
        </div>
      </div>

      {/* Color */}
      <div className="flex flex-col gap-1">
        <label htmlFor="cat-color" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Color
        </label>
        <div className="flex items-center gap-3">
          <input
            id="cat-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-14 cursor-pointer rounded-lg border border-gray-300 p-0.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#6366f1"
            maxLength={7}
            className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            aria-label="Hex color value"
          />
        </div>
      </div>

      {/* Parent category */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Parent category
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setParentOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={parentOpen}
            className="w-full flex items-center justify-between rounded-lg border border-gray-300 px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors"
          >
            <span className={selectedParent ? 'text-gray-900' : 'text-gray-400'}>
              {selectedParent
                ? `${selectedParent.icon} ${selectedParent.name}${selectedParent.userId === null ? ' (system)' : ''}`
                : 'None'}
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-400 transition-transform shrink-0 ${parentOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          {parentOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setParentOpen(false)} aria-hidden="true" />
              <ul role="listbox" aria-label="Parent category" className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto py-1">
                <li
                  role="option"
                  aria-selected={parentId === ''}
                  onClick={() => { setParentId(''); setParentOpen(false); }}
                  className={`px-3 py-2 text-sm cursor-pointer select-none transition-colors ${parentId === '' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  None
                </li>
                {parentOptions.map((c) => (
                  <li
                    key={c.id}
                    role="option"
                    aria-selected={parentId === c.id}
                    onClick={() => { setParentId(c.id); setParentOpen(false); }}
                    className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none transition-colors ${parentId === c.id ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <span aria-hidden="true">{c.icon}</span>
                    {c.name}{c.userId === null ? ' (system)' : ''}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <p className="text-xs text-gray-400">One level of nesting only.</p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
        >
          {isPending ? 'Saving…' : editing ? 'Save changes' : 'Create category'}
        </button>
      </div>
    </form>
  );
}

// ─── Delete confirmation dialog ───────────────────────────────────────────────

interface DeleteDialogProps {
  category: Category;
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
  error: string | null;
}

function DeleteDialog({ category, onCancel, onConfirm, isPending, error }: DeleteDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-cat-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl p-6">
        <h2 id="delete-cat-title" className="text-lg font-semibold text-gray-900 mb-2">
          Delete category?
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          <span className="mr-1.5" role="img" aria-hidden="true">{category.icon}</span>
          <strong>{category.name}</strong> will be permanently removed. Expenses using this category will be unaffected.
        </p>

        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Category row ─────────────────────────────────────────────────────────────

interface CategoryRowProps {
  category: Category;
  parentName: string | undefined;
  onEdit: (c: Category) => void;
  onArchive: (c: Category) => void;
  onDelete: (c: Category) => void;
  archivePending: boolean;
}

function CategoryRow({ category, parentName, onEdit, onArchive, onDelete, archivePending }: CategoryRowProps) {
  const isSystem = category.userId === null;

  return (
    <div
      className={[
        'flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
        category.isArchived
          ? 'border-gray-100 bg-gray-50 opacity-60'
          : 'border-gray-200 bg-white hover:border-gray-300',
      ].join(' ')}
    >
      {/* Color swatch + icon */}
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-lg"
        style={{ backgroundColor: category.color + '22', color: category.color }}
        aria-hidden="true"
      >
        {category.icon}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={['text-sm font-medium', category.isArchived ? 'text-gray-400' : 'text-gray-900'].join(' ')}>
            {category.name}
          </span>
          {/* Color swatch */}
          <span
            className="inline-block h-3 w-3 rounded-full border border-white shadow-sm flex-shrink-0"
            style={{ backgroundColor: category.color }}
            title={category.color}
            aria-label={`Color: ${category.color}`}
          />
          {category.isArchived && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              Archived
            </span>
          )}
          {isSystem && (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
              System
            </span>
          )}
        </div>
        {parentName && (
          <p className="text-xs text-gray-400 mt-0.5">Under {parentName}</p>
        )}
      </div>

      {/* Actions — system categories are read-only */}
      {!isSystem && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {!category.isArchived && (
            <>
              <button
                type="button"
                onClick={() => onEdit(category)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
                aria-label={`Edit ${category.name}`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onArchive(category)}
                disabled={archivePending}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
                aria-label={`Archive ${category.name}`}
              >
                Archive
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onDelete(category)}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label={`Delete ${category.name}`}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  categories: Category[];
  allCategories: Category[];
  onEdit: (c: Category) => void;
  onArchive: (c: Category) => void;
  onDelete: (c: Category) => void;
  archivePendingId: string | null;
  emptyMessage?: string;
}

function Section({ title, categories, allCategories, onEdit, onArchive, onDelete, archivePendingId, emptyMessage }: SectionProps) {
  const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

  return (
    <section aria-labelledby={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <h2
        id={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
        className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400"
      >
        {title}
      </h2>
      {categories.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">{emptyMessage ?? 'None.'}</p>
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              parentName={c.parentId ? categoryMap.get(c.parentId)?.name : undefined}
              onEdit={onEdit}
              onArchive={onArchive}
              onDelete={onDelete}
              archivePending={archivePendingId === c.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3">
          <div className="h-9 w-9 rounded-lg bg-gray-200 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-20 rounded bg-gray-100 animate-pulse" />
          </div>
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

  // ── Data ───────────────────────────────────────────────────────────────────

  const {
    data: categories = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const archiveMutation = useMutation({
    // categoriesApi.patch is typed as Partial<CreateCategoryDTO> but the backend
    // also accepts isArchived — cast to any to send the archive flag.
    // TODO: tighten type by adding isArchived to UpdateCategoryDTO in @ledgr/types
    mutationFn: (id: string) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      categoriesApi.patch(id, { isArchived: true } as any),
    onMutate: (id) => setArchivePendingId(id),
    onSettled: () => setArchivePendingId(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDeletingCategory(null);
      setDeleteError(null);
    },
    onError: (err) => setDeleteError(extractError(err)),
  });

  // ── Derived lists ──────────────────────────────────────────────────────────

  const systemActive = categories.filter((c) => c.userId === null && !c.isArchived);
  const userActive = categories.filter((c) => c.userId !== null && !c.isArchived);
  const archived = categories.filter((c) => c.isArchived);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingCategory(undefined);
    setShowForm(true);
  }

  function openEdit(c: Category) {
    setEditingCategory(c);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingCategory(undefined);
  }

  function handleArchive(c: Category) {
    archiveMutation.mutate(c.id);
  }

  function openDelete(c: Category) {
    setDeleteError(null);
    setDeletingCategory(c);
  }

  function closeDelete() {
    if (deleteMutation.isPending) return;
    setDeletingCategory(null);
    setDeleteError(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Categories</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
        >
          + New category
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonRows />
      ) : isError ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-6 py-8 text-center">
          <p className="text-sm text-red-600 mb-3">Failed to load categories.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          <Section
            title="System Categories"
            categories={systemActive}
            allCategories={categories}
            onEdit={openEdit}
            onArchive={handleArchive}
            onDelete={openDelete}
            archivePendingId={archivePendingId}
            emptyMessage="No system categories."
          />

          <Section
            title="My Categories"
            categories={userActive}
            allCategories={categories}
            onEdit={openEdit}
            onArchive={handleArchive}
            onDelete={openDelete}
            archivePendingId={archivePendingId}
            emptyMessage="No custom categories yet. Create one above."
          />

          {archived.length > 0 && (
            <Section
              title="Archived"
              categories={archived}
              allCategories={categories}
              onEdit={openEdit}
              onArchive={handleArchive}
              onDelete={openDelete}
              archivePendingId={archivePendingId}
            />
          )}
        </div>
      )}

      {/* Create / Edit modal */}
      {showForm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingCategory ? 'Edit category' : 'New category'}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeForm} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCategory ? 'Edit category' : 'New category'}
              </h2>
            </div>
            <div className="overflow-y-auto px-6 pb-6">
              <CategoryForm
                categories={categories}
                editing={editingCategory}
                onSuccess={closeForm}
                onCancel={closeForm}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingCategory && (
        <DeleteDialog
          category={deletingCategory}
          onCancel={closeDelete}
          onConfirm={() => deleteMutation.mutate(deletingCategory.id)}
          isPending={deleteMutation.isPending}
          error={deleteError}
        />
      )}
    </div>
  );
}
