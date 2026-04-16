import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi, categoriesApi } from '../lib/api';
import type { Expense, Category, CreateExpenseDTO } from '@ledgr/types';
import DatePicker, { todayISO } from './DatePicker';

interface ExpenseFormProps {
  expense?: Expense; // if provided, form is in edit mode
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormState {
  amount: string;
  currency: string;
  date: string;
  categoryId: string;
  description: string;
  receiptFile: File | null;
}

interface FormErrors {
  amount?: string;
  date?: string;
  categoryId?: string;
  submit?: string;
  receipt?: string;
}

function maxDateISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ExpenseForm({ expense, onSuccess, onCancel }: ExpenseFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!expense;

  const [form, setForm] = useState<FormState>({
    amount: expense ? String(expense.amount / 100) : '',
    currency: expense?.currency ?? 'PHP',
    date: expense?.date ?? todayISO(),
    categoryId: expense?.categoryId ?? '',
    description: expense?.description ?? '',
    receiptFile: null,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [receiptDeleted, setReceiptDeleted] = useState(false);
  const [deletingReceipt, setDeletingReceipt] = useState(false);

  // Re-populate when expense prop changes (e.g. switching between edit targets)
  useEffect(() => {
    if (expense) {
      setForm({
        amount: String(expense.amount / 100),
        currency: expense.currency,
        date: expense.date,
        categoryId: expense.categoryId,
        description: expense.description ?? '',
        receiptFile: null,
      });
      setReceiptDeleted(false);
    }
  }, [expense?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
    // Categories rarely change — keep fresh for 30 minutes
    staleTime: 30 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (payload: CreateExpenseDTO) =>
      isEdit
        ? expensesApi.update(expense!.id, payload).then((r) => r.data)
        : expensesApi.create(payload).then((r) => r.data),
    onSuccess: async (savedExpense) => {
      // Upload receipt if a file was selected
      if (form.receiptFile) {
        setUploadingReceipt(true);
        try {
          const { data: { uploadUrl, receiptUrl } } = await expensesApi.getReceiptUrl(
            savedExpense.id,
            form.receiptFile.name,
          );

          await fetch(uploadUrl, {
            method: 'PUT',
            body: form.receiptFile,
            // No Content-Type header — avoids CORS preflight on the R2 presigned URL.
            // R2 infers the type from the file bytes.
          });

          await expensesApi.update(savedExpense.id, { receiptUrl });
        } catch {
          // Receipt upload is non-critical — show error but don't block success
          setErrors((prev) => ({ ...prev, receipt: 'Receipt upload failed. You can re-attach it by editing the expense.' }));
        } finally {
          setUploadingReceipt(false);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      onSuccess();
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setErrors((prev) => ({ ...prev, submit: message }));
    },
  });

  function validate(): boolean {
    const next: FormErrors = {};
    const amountNum = parseFloat(form.amount);

    if (!form.amount || isNaN(amountNum) || amountNum <= 0) {
      next.amount = 'Amount must be greater than 0.';
    } else if (amountNum > 999_999.99) {
      next.amount = 'Amount must be ≤ 999,999.99.';
    }

    if (!form.date) {
      next.date = 'Date is required.';
    } else if (form.date > maxDateISO()) {
      next.date = 'Date cannot be more than 7 days in the future.';
    }

    if (!form.categoryId) {
      next.categoryId = 'Please select a category.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload: CreateExpenseDTO = {
      amount: Math.round(parseFloat(form.amount) * 100),
      currency: form.currency.toUpperCase().slice(0, 3) || 'PHP',
      date: form.date,
      categoryId: form.categoryId,
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
    };

    mutation.mutate(payload);
  }

  function field<K extends keyof FormState>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
      // Clear field error on change
      if (errors[key as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [key]: undefined }));
      }
    };
  }

  const inputClass = (hasError?: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors ${
      hasError ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
    }`;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 pt-1">
      {/* Amount */}
      <div>
        <label htmlFor="ef-amount" className="block text-sm font-medium text-gray-700 mb-1">
          Amount
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">
            {form.currency || 'PHP'}
          </span>
          <input
            id="ef-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max="999999.99"
            placeholder="0.00"
            value={form.amount}
            onChange={field('amount')}
            className={`${inputClass(errors.amount)} pl-12`}
            aria-describedby={errors.amount ? 'ef-amount-error' : undefined}
            aria-invalid={!!errors.amount}
          />
        </div>
        {errors.amount && (
          <p id="ef-amount-error" role="alert" className="mt-1 text-xs text-red-600">
            {errors.amount}
          </p>
        )}
      </div>

      {/* Currency */}
      <div>
        <label htmlFor="ef-currency" className="block text-sm font-medium text-gray-700 mb-1">
          Currency
        </label>
        <input
          id="ef-currency"
          type="text"
          maxLength={3}
          placeholder="PHP"
          value={form.currency}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase().slice(0, 3) }))
          }
          className={inputClass()}
        />
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Date
        </label>
        <DatePicker
          id="ef-date"
          label="Date"
          showLabel={false}
          value={form.date}
          onChange={(v) => {
            setForm((prev) => ({ ...prev, date: v }));
            if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }));
          }}
          max={maxDateISO()}
          hasError={!!errors.date}
          className="w-full py-2"
        />
        {errors.date && (
          <p id="ef-date-error" role="alert" className="mt-1 text-xs text-red-600">
            {errors.date}
          </p>
        )}
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Category
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setCategoryOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={categoryOpen}
            disabled={categoriesLoading}
            aria-describedby={errors.categoryId ? 'ef-category-error' : undefined}
            aria-invalid={!!errors.categoryId}
            className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors disabled:opacity-50 ${
              errors.categoryId ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
            } ${form.categoryId ? 'text-gray-900' : 'text-gray-400'}`}
          >
            <span>
              {categoriesLoading
                ? 'Loading categories…'
                : categories.find((c) => c.id === form.categoryId)
                  ? `${categories.find((c) => c.id === form.categoryId)!.icon} ${categories.find((c) => c.id === form.categoryId)!.name}`
                  : 'Select a category'}
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-400 transition-transform shrink-0 ${categoryOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          {categoryOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setCategoryOpen(false)} aria-hidden="true" />
              <ul role="listbox" aria-label="Category" className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-52 overflow-y-auto py-1">
                {categories.map((cat) => (
                  <li
                    key={cat.id}
                    role="option"
                    aria-selected={form.categoryId === cat.id}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, categoryId: cat.id }));
                      if (errors.categoryId) setErrors((prev) => ({ ...prev, categoryId: undefined }));
                      setCategoryOpen(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none transition-colors ${
                      form.categoryId === cat.id ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span aria-hidden="true">{cat.icon}</span>
                    {cat.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        {errors.categoryId && (
          <p id="ef-category-error" role="alert" className="mt-1 text-xs text-red-600">
            {errors.categoryId}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="ef-description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
          <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          id="ef-description"
          rows={3}
          maxLength={500}
          placeholder="What was this for?"
          value={form.description}
          onChange={field('description')}
          className={`${inputClass()} resize-none`}
        />
        <p className="mt-1 text-xs text-gray-400 text-right">
          {form.description.length}/500
        </p>
      </div>

      {/* Receipt */}
      <div>
        <label htmlFor="ef-receipt" className="block text-sm font-medium text-gray-700 mb-1">
          Receipt
          <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
        </label>

        {/* Existing receipt preview */}
        {expense?.receiptUrl && !form.receiptFile && !receiptDeleted && (
          <div className="mb-2 flex items-start gap-3">
            {/\.(jpe?g|png|gif|webp)$/i.test(expense.receiptUrl) ? (
              <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <img
                  src={expense.receiptUrl}
                  alt="Receipt"
                  className="h-20 w-auto rounded-lg border border-gray-200 object-cover hover:opacity-80 transition-opacity"
                />
              </a>
            ) : (
              <a
                href={expense.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-gray-600 underline hover:text-gray-900"
              >
                📎 View receipt
              </a>
            )}
            <button
              type="button"
              disabled={deletingReceipt}
              onClick={async () => {
                setDeletingReceipt(true);
                try {
                  await expensesApi.deleteReceipt(expense.id);
                  setReceiptDeleted(true);
                  queryClient.invalidateQueries({ queryKey: ['expenses'] });
                } catch {
                  setErrors((prev) => ({ ...prev, receipt: 'Failed to delete receipt. Try again.' }));
                } finally {
                  setDeletingReceipt(false);
                }
              }}
              className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Delete receipt"
            >
              {deletingReceipt ? (
                <span className="animate-pulse">Deleting…</span>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Remove
                </>
              )}
            </button>
          </div>
        )}

        <input
          id="ef-receipt"
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setForm((prev) => ({ ...prev, receiptFile: file }));
            if (errors.receipt) setErrors((prev) => ({ ...prev, receipt: undefined }));
          }}
          className="w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 transition-colors cursor-pointer"
        />

        {uploadingReceipt && (
          <p className="mt-1.5 text-xs text-gray-500 animate-pulse">Uploading receipt…</p>
        )}

        {errors.receipt && (
          <p role="alert" className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            {errors.receipt}
          </p>
        )}
      </div>

      {/* Submit error */}
      {errors.submit && (
        <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {errors.submit}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={mutation.isPending}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending || uploadingReceipt}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
        >
          {uploadingReceipt ? 'Uploading…' : mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add expense'}
        </button>
      </div>
    </form>
  );
}
