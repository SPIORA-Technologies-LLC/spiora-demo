# SPIORA Knowledge Base — UX Review (PR #9)

**Дата:** 11 июля 2026  
**Модуль:** Knowledge Base  
**Режим:** Demo (`SPIORA_DEMO_MODE=true`)

---

## Общая оценка

Модуль переведён с Google Drive browser на полноценную demo-библиотеку статей с категориями, тегами, поиском и предпросмотром. Структура понятна для публичной демонстрации. Готовность к demo: **высокая**, с замечаниями ниже.

---

## High Priority

| # | Замечание | Рекомендация |
|---|-----------|--------------|
| H1 | На mobile sidebar фильтров отображается над списком — длинный скролл до статей | На `<900px` свернуть фильтры в collapsible drawer или tabs |
| H2 | Копирование ссылки не показывает toast-подтверждение | Добавить toast из `knowledgeBase.toast.linkCopied` |
| H3 | Нет явной кнопки «Создать статью» с disabled-состоянием | Показать disabled CTA с tooltip `upload.disabled` для прозрачности demo policy |

---

## Medium Priority

| # | Замечание | Рекомендация |
|---|-----------|--------------|
| M1 | Breadcrumb в Drive-режиме (production) показывает «…» без имён промежуточных папок | Передавать имена папок в history stack |
| M2 | Время чтения (`readingTime`) не вычисляется | Добавить estimate по word count |
| M3 | AI Workspace ссылки в контексте ведут на `/knowledge-base?article=` — хорошо, но нет deep-link из AI UI badge | Добавить кликабельный source link в AI Workspace |
| M4 | Поиск срабатывает только по submit, не live-debounce | Debounce 300ms для UX power users |
| M5 | Переключение языка сохраняет query params — OK; статья перезагружается на новом языке — OK | — |

---

## Low Priority

| # | Замечание | Рекомендация |
|---|-----------|--------------|
| L1 | Demo badge мелкий — можно усилить визуально рядом с заголовком страницы | Перенести badge в SectionHeader |
| L2 | Теги в sidebar не показывают count | Добавить count как у категорий |
| L3 | Markdown tables в статьях не стилизованы отдельно | Добавить CSS для GFM tables |
| L4 | Нет keyboard shortcut для focus search (`/` как в Notion) | Nice-to-have |
| L5 | `scripts/kb-i18n-*.json` — source fragments, можно удалить после merge | Cleanup в follow-up |

---

## Оценка по критериям

| Критерий | Оценка (1–5) | Комментарий |
|----------|--------------|-------------|
| Понятность структуры | 4 | 5 категорий, sidebar + list + detail |
| Качество demo-контента | 5 | 15 реалистичных статей, fictional authors |
| Удобство поиска | 4 | EN/RU работает; нет live search |
| Внешний вид статьи | 4 | Markdown, tags, meta — чисто |
| Связь с AI | 4 | Demo context only, localized links |
| Mobile layout | 3 | Grid collapse OK, но sidebar длинный |
| Готовность к demo | 4 | Upload disabled, read-only, no Drive errors |

**Итоговая UX-оценка: 4.0 / 5** — готово к публичной демонстрации с minor polish в follow-up.
