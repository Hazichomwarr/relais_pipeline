# autoFetchDateDataSteps.md

# GOAL

Automatically fetch and display reports based on the selected date from the Date Picker.

Flow:
User selects date → URL updates → Admin page refetches → Supabase returns filtered reports.

---

# 1. CREATE CLIENT COMPONENT

Component:

- FilterDate

Directive:

- "use client"

Reason:

- uses browser interaction
- router navigation
- input events

---

# 2. IMPORT REQUIRED HOOKS

Hooks:

- useRouter
- useSearchParams
- useRef

From:

- next/navigation
- react

---

# 3. CREATE ROUTER

Function:

- useRouter()

Variable:

- router

Purpose:

- update URL automatically

---

# 4. CREATE SEARCH PARAMS

Function:

- useSearchParams()

Variable:

- searchParams

Purpose:

- read current selected date from URL

---

# 5. GET CURRENT DATE PARAM

Function:

- searchParams.get()

Param:

- "date"

Variable:

- selectedDate

Fallback:

- empty string

Purpose:

- keep picker synced with URL

---

# 6. CREATE INPUT REF

Hook:

- useRef<HTMLInputElement>()

Variable:

- inputRef

Purpose:

- manually open native browser date picker

---

# 7. CREATE openPicker FUNCTION

Function:

- openPicker

Method:

- inputRef.current?.showPicker?.()

Purpose:

- open browser calendar when button clicked

---

# 8. CREATE handleChange FUNCTION

Function:

- handleChange

Event Type:

- React.ChangeEvent<HTMLInputElement>

Purpose:

- capture selected date

---

# 9. GET DATE VALUE

Property:

- e.target.value

Variable:

- value

Format:

- YYYY-MM-DD

Example:

- 2025-05-27

---

# 10. UPDATE URL AUTOMATICALLY

Function:

- router.push()

URL pattern:

- /admin?date=value

Example:

- /admin?date=2025-05-27

Purpose:

- trigger automatic server rerender

---

# 11. CREATE BUTTON WRAPPER

Element:

- button

Type:

- button

Event:

- onClick

Function:

- openPicker

Purpose:

- entire date picker UI becomes clickable

---

# 12. CREATE INVISIBLE INPUT

Element:

- input

Type:

- date

Ref:

- inputRef

Value:

- selectedDate

Event:

- onChange

Function:

- handleChange

Purpose:

- native browser calendar

---

# 13. READ searchParams IN ADMIN PAGE

Component:

- AdminPage

Make:

- async

Add param:

- searchParams

Structure:

- searchParams.date

Purpose:

- access selected date from URL

---

# 14. EXTRACT DATE PARAM

Variable:

- selectedDate

Value:

- searchParams.date

Purpose:

- pass into database query

---

# 15. PASS DATE INTO getReports()

Function:

- getReports(selectedDate)

Purpose:

- fetch filtered reports

---

# 16. UPDATE getReports FUNCTION

Function:

- getReports

Param:

- date?: string

Purpose:

- optional date filtering

---

# 17. CREATE BASE QUERY

Methods:

- supabase.from()
- select()
- order()

Purpose:

- fetch reports sorted by newest first

---

# 18. ADD CONDITIONAL DATE FILTER

Condition:

- if (date)

Purpose:

- only filter when date exists

---

# 19. FILTER USING created_at

Methods:

- gte()
- lt()

Field:

- created_at

Purpose:

- filter entire day range

Reason:

- created_at includes:
  - hours
  - minutes
  - timezone

So exact equality will fail.

---

# 20. DATE RANGE FORMAT

Start:

- YYYY-MM-DDT00:00:00

End:

- YYYY-MM-DDT23:59:59

Purpose:

- include all reports from selected day

---

# 21. EXECUTE QUERY

Method:

- await query

Variables:

- data
- error

Purpose:

- fetch filtered reports from Supabase

---

# 22. HANDLE ERRORS

Condition:

- if (error)

Actions:

- console.error()
- return []

Purpose:

- avoid dashboard crash

---

# 23. RETURN DATA

Return:

- data

Purpose:

- render reports in dashboard

---

# 24. DASHBOARD AUTOMATICALLY UPDATES

Flow:

- user selects date
- URL changes
- Next.js rerenders server component
- getReports() runs again
- Supabase returns filtered data
- dashboard refreshes automatically

---

# IMPORTANT CONCEPTS LEARNED

- useRouter
- useSearchParams
- useRef
- showPicker
- URL state
- search params
- server rerendering
- reactive filtering
- Supabase querying
- date range filtering
- server/client boundaries

---

# FINAL ARCHITECTURE FLOW

FilterDate
→ router.push()
→ URL search params
→ AdminPage rerender
→ getReports(selectedDate)
→ Supabase query
→ filtered reports returned
→ Dashboard updates
