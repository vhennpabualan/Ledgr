# Requirements Document

## Introduction

Ledgr is a personal expenses management application for a single user to track, categorize, and analyze spending. It provides expense CRUD, category management, budget envelopes with real-time spend tracking, reporting with charts and CSV export, and a full immutable audit trail. The system is built on a React + TypeScript frontend, a Node.js REST API, and a PostgreSQL database, deployed on zero-cost cloud infrastructure (Vercel, Railway/Render, Neon, Cloudflare R2).

## Glossary

- **Expense_Service**: The backend service responsible for creating, reading, updating, and soft-deleting expense records.
- **Budget_Service**: The backend service responsible for managing budget envelopes and computing spend vs. limit.
- **Report_Service**: The backend service responsible for aggregating expense data into summaries, trends, and CSV exports.
- **Auth_Service**: The backend service responsible for issuing and validating JWT tokens and managing user sessions.
- **Ledger**: The append-only audit trail table that records every mutation to expenses and budgets.
- **Category**: A user-defined or system-default grouping applied to expenses, supporting one level of nesting.
- **Budget**: A spending limit defined per category and calendar month/year.
- **BudgetStatus**: The computed state of a budget including amount spent, remaining, percent used, and over-budget flag.
- **Expense**: A single spending record with amount, currency, date, category, optional description, and optional receipt.
- **LedgerEntry**: An immutable record of a create, update, or delete action on an expense or budget.
- **Minor_Units**: Integer representation of currency amounts (e.g. cents for USD) to avoid floating-point rounding.
- **Soft_Delete**: Marking a record as deleted via a `deletedAt` timestamp without removing it from the database.
- **Pre-signed URL**: A time-limited URL granting temporary upload or download access to a file in Cloudflare R2.
- **React_Query_Cache**: The client-side cache managed by React Query that holds server state on the frontend.
- **Zod**: The runtime schema validation library used to validate API request payloads.
- **JWT**: JSON Web Token used for stateless authentication between client and API.

---

## Requirements

### Requirement 1: User Authentication

**User Story:** As a user, I want to log in and maintain a secure session, so that my expense data is protected and only accessible to me.

#### Acceptance Criteria

1. WHEN a user submits valid credentials, THE Auth_Service SHALL issue an access token (15-minute expiry) and a refresh token (30-day expiry).
2. THE Auth_Service SHALL store the refresh token in an httpOnly, Secure, SameSite=Strict cookie.
3. WHEN an access token expires, THE Auth_Service SHALL issue a new access token upon receiving a valid refresh token.
4. IF a refresh token is invalid or expired, THEN THE Auth_Service SHALL return a 401 Unauthorized response and the client SHALL redirect the user to the login page.
5. WHEN a user logs out, THE Auth_Service SHALL invalidate the session and clear the refresh token cookie.
6. WHEN a request arrives without a valid access token, THE Auth_Service SHALL return `{ error: "UNAUTHORIZED" }` with HTTP 401.

---

### Requirement 2: Expense Creation

**User Story:** As a user, I want to record a new expense with amount, date, category, and optional details, so that I can track my spending accurately.

#### Acceptance Criteria

1. WHEN a valid expense payload is submitted, THE Expense_Service SHALL persist the expense record and return HTTP 201 with the created expense.
2. THE Expense_Service SHALL store all amounts as positive integers in Minor_Units.
3. IF the submitted `amount` is zero, negative, or greater than 999,999,99 Minor_Units, THEN THE Expense_Service SHALL return a 400 Validation Error.
4. IF the submitted `date` is more than 7 days in the future, THEN THE Expense_Service SHALL return a 400 Validation Error.
5. IF the submitted `currency` is not a valid ISO 4217 code, THEN THE Expense_Service SHALL return a 400 Validation Error.
6. IF the submitted `categoryId` does not exist or belongs to another user, THEN THE Expense_Service SHALL return a 400 Validation Error.
7. WHEN an expense is successfully created, THE Expense_Service SHALL append an immutable LedgerEntry recording the creation action and full snapshot.
8. WHEN an expense is successfully created, THE React_Query_Cache SHALL be invalidated so the expense list reflects the new record.

---

### Requirement 3: Expense Retrieval and Listing

**User Story:** As a user, I want to browse and filter my expenses, so that I can review my spending history.

#### Acceptance Criteria

1. WHEN a list request is received, THE Expense_Service SHALL return only expenses belonging to the authenticated user.
2. THE Expense_Service SHALL support filtering by date range (`from`, `to`), category IDs, minimum amount, and maximum amount.
3. THE Expense_Service SHALL paginate results with a maximum page size of 100 expenses per page.
4. WHILE an expense has a non-null `deletedAt` value, THE Expense_Service SHALL exclude it from all list and report query results.
5. WHEN a single expense is requested by ID, IF the expense does not exist or belongs to another user, THEN THE Expense_Service SHALL return `{ error: "NOT_FOUND" }` with HTTP 404.

---

### Requirement 4: Expense Update and Soft Delete

**User Story:** As a user, I want to correct or remove expenses, so that my records stay accurate without losing history.

#### Acceptance Criteria

1. WHEN a valid update payload is submitted for an existing expense, THE Expense_Service SHALL apply the patch and return the updated expense.
2. IF an update targets an expense that does not exist or belongs to another user, THEN THE Expense_Service SHALL return HTTP 404.
3. WHEN an expense is updated, THE Expense_Service SHALL append an immutable LedgerEntry recording only the changed fields as a diff.
4. WHEN a delete is requested, THE Expense_Service SHALL set `deletedAt` to the current timestamp and SHALL NOT physically remove the row.
5. WHEN an expense is soft-deleted, THE Expense_Service SHALL append an immutable LedgerEntry recording the delete action.

---

### Requirement 5: Category Management

**User Story:** As a user, I want to create and manage expense categories, so that I can organize my spending meaningfully.

#### Acceptance Criteria

1. WHEN a valid category is created, THE Expense_Service SHALL persist it with the authenticated user's ID and return the created category.
2. IF a category `name` is empty, exceeds 50 characters after trimming, or is missing, THEN THE Expense_Service SHALL return a 400 Validation Error.
3. IF a `parentId` references a category that already has a parent (depth > 1), THEN THE Expense_Service SHALL return a 400 Validation Error.
4. WHILE a category has `userId = null` (system default), THE Expense_Service SHALL reject any delete request for that category with HTTP 403.
5. WHEN a category is archived, THE Expense_Service SHALL set `isArchived = true` and SHALL continue to return it in queries that include archived categories.
6. THE Expense_Service SHALL return both user-defined and system-default categories when listing categories for the authenticated user.

---

### Requirement 6: Budget Management

**User Story:** As a user, I want to set monthly spending limits per category, so that I can stay within my financial goals.

#### Acceptance Criteria

1. WHEN a valid budget payload is submitted, THE Budget_Service SHALL persist the budget and return HTTP 201 with the created budget.
2. IF a budget already exists for the same `(categoryId, year, month)` combination for the user, THEN THE Budget_Service SHALL return `{ error: "CONFLICT" }` with HTTP 409.
3. IF `limitAmount` is zero or negative, THEN THE Budget_Service SHALL return a 400 Validation Error.
4. IF `month` is outside the range 1–12, THEN THE Budget_Service SHALL return a 400 Validation Error.
5. WHEN a budget status is requested, THE Budget_Service SHALL compute and return `spent`, `remaining`, `percentUsed`, and `isOverBudget` reflecting all non-deleted expenses in that category and period.
6. WHEN total spending in a category reaches 80% of the budget limit, THE Budget_Service SHALL set a threshold-reached indicator in the BudgetStatus response.
7. WHEN total spending in a category meets or exceeds 100% of the budget limit, THE Budget_Service SHALL set `isOverBudget = true` in the BudgetStatus response.

---

### Requirement 7: Reporting and Analytics

**User Story:** As a user, I want to view spending summaries, trends, and breakdowns, so that I can understand and improve my financial habits.

#### Acceptance Criteria

1. WHEN a summary report is requested with a date range and grouping, THE Report_Service SHALL return `totalSpent`, a `breakdown` by category, and a list of top expenses.
2. THE Report_Service SHALL support grouping by `category`, `day`, `week`, or `month`.
3. WHEN a trend report is requested, THE Report_Service SHALL return a time-series of spending data points for the specified period.
4. WHEN a CSV export is requested, THE Report_Service SHALL return a downloadable stream containing all expenses in the specified date range formatted as valid CSV.
5. THE Report_Service SHALL only include expenses belonging to the authenticated user in all report outputs.
6. WHILE an expense is soft-deleted, THE Report_Service SHALL exclude it from all aggregations and exports.

---

### Requirement 8: Receipt Attachment

**User Story:** As a user, I want to attach receipt images to expenses, so that I have a visual record of my purchases.

#### Acceptance Criteria

1. WHEN a receipt upload is initiated, THE Expense_Service SHALL generate a Pre-signed URL for Cloudflare R2 with a maximum expiry of 15 minutes.
2. WHEN a receipt URL is provided on an expense, THE Expense_Service SHALL store only the URL reference in the expense record and SHALL NOT store the file in the database.
3. IF a receipt URL is provided that is not a valid URL format, THEN THE Expense_Service SHALL return a 400 Validation Error.

---

### Requirement 9: Audit Trail (Ledger)

**User Story:** As a user, I want every change to my data to be recorded, so that I have a complete and trustworthy history of all modifications.

#### Acceptance Criteria

1. THE Ledger SHALL record a LedgerEntry for every create, update, and delete action on expenses and budgets.
2. THE Ledger SHALL be append-only: THE system SHALL never issue UPDATE or DELETE statements against the ledger table.
3. WHEN an expense is updated, THE Ledger SHALL store only the changed fields in the `diff` field of the LedgerEntry.
4. THE Ledger SHALL record the `userId` of the actor, the `entityType`, the `entityId`, the `action`, and a `timestamp` on every entry.

---

### Requirement 10: Data Validation and Error Responses

**User Story:** As a user, I want clear error messages when I submit invalid data, so that I can correct my input without confusion.

#### Acceptance Criteria

1. WHEN a request payload fails Zod schema validation, THE system SHALL return HTTP 400 with `{ error: "VALIDATION_ERROR", fields: { [field]: string } }` identifying each invalid field.
2. WHEN a resource is not found or belongs to another user, THE system SHALL return HTTP 404 with `{ error: "NOT_FOUND" }`.
3. WHEN a duplicate resource conflict occurs, THE system SHALL return HTTP 409 with `{ error: "CONFLICT", message: string }`.
4. WHEN an unauthenticated request is received, THE system SHALL return HTTP 401 with `{ error: "UNAUTHORIZED" }`.

---

### Requirement 11: Data Ownership and Security

**User Story:** As a user, I want my data to be isolated from any other users, so that my financial information remains private.

#### Acceptance Criteria

1. THE system SHALL enforce row-level security at the database layer so that queries for one user cannot return data belonging to another user.
2. THE system SHALL store all currency amounts as integers in Minor_Units with no floating-point representation.
3. WHEN a resource is requested by ID, IF the resource exists but belongs to a different user, THEN THE system SHALL return HTTP 404 (not 403) to avoid leaking resource existence.
4. THE Expense_Service SHALL leave the `splits` field as an empty array in v1 and SHALL NOT expose split functionality in the API or UI.
