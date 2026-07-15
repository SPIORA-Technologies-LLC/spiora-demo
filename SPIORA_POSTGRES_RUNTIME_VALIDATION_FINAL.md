# SPIORA — PostgreSQL Runtime Validation Final (PR #15.2 + #15.3)

**Дата:** 2026-07-15  
**Проект:** Spiora Demo  
**Приложение:** `http://localhost:3000` (`SPIORA_ENABLE_SUPABASE=true`)  
**Код / миграции / seed baseline:** migration 023 не менялась; seed baseline DOC-DEMO-001…016 сохранён  

---

## PR #15.3 — Fix external_id generator

### Root cause

`sbNextDemoDocumentExternalId()` брал:

```text
ORDER BY external_id DESC LIMIT 1
```

Это **лексикографическая** сортировка строк.

После создания `DOC-DEMO-0017` (runtime):

- `"DOC-DEMO-016" > "DOC-DEMO-0017"` как строки (`'1' > '0'` после `DOC-DEMO-0`)
- `DESC LIMIT 1` снова отдавал `DOC-DEMO-016`
- next = `0017` → unique conflict `23505` → API **503**

Archived `DOC-DEMO-0017` не становился lexical max, поэтому конфликт повторялся.

### Исправление

1. Pure helper `computeNextDemoDocumentExternalId()` — **numeric max** по всем `DOC-DEMO-*` (включая archived)
2. Store: retry до 5 раз при `23505` на `external_id`
3. Исчерпание retry → `ClientDocumentsConflictError` → API **409** (локализовано), не 503
4. Archive: `.select("id")` вместо ненадёжного `count`

### Runtime result (PR #15.3)

| Шаг | Результат |
|-----|-----------|
| Cleanup leftover `DOC-DEMO-0017` (pr15_2) | deleted by exact external_id |
| CREATE A | **200** `DOC-DEMO-0017` |
| CREATE B | **200** `DOC-DEMO-0018` |
| PATCH status → approved | **200** |
| ARCHIVE A+B (owner) | **200 / 200** |
| Remove A/B rows | restored seed-only |
| Active documents final | **16** |
| API storage leak | **false** |

---

## Runtime summary (итого)

| Область | Вердикт |
|---------|---------|
| PostgreSQL counts | ✅ clients=25, documents active=16, orphans=0 |
| CRM | ✅ source=postgresql |
| Notes | ✅ |
| Documents list/create/update/archive | ✅ после #15.3 |
| external_id generator | ✅ numeric + retry |
| Security API leak | ✅ |
| Google | ✅ disabled for CRM |

---

## SAFE / NOT SAFE

| Действие | Вердикт |
|----------|---------|
| **COMMIT** | **SAFE TO COMMIT** (fix + tests + i18n + docs; без secrets) |
| **PUSH** | **SAFE TO PUSH** после commit |

---

*Обновлено PR #15.3*
