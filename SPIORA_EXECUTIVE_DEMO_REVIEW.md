# SPIORA — Executive Demo Review (PR #11.5)

**Дата:** 11 июля 2026  
**Роль реviewer:** CEO компании ~80 сотрудников, впервые видит Spiora, не знает разработчика  
**Контекст демо:** Spiora — иммиграционное/relocation-агентство, ~12 клиентов в CRM, команда 4 человека  
**Метод:** прохождение buyer journey глазами покупателя — без кода, без тестов, без поиска багов  
**Язык демо:** English (default)

---

## 0. Первое впечатление (первые 60 секунд)

Я захожу на login — тёмный экран, логотип Spiora, подпись *Corporate Digital Workspace*. Выглядит серьёзно. Ввожу учётку, попадаю на Dashboard с приветствием по имени и hero-баннером.

**Мысль CEO:** «Это не Google Sheets с кнопками. Это уже похоже на внутреннюю операционную систему компании.»

**Но сразу же:** в sidebar 15 пунктов меню, бейджи *Demo data*, ссылка на *Checkups in Yerevan*, поле Search в шапке, которое никуда не ведёт. Появляется ощущение: *хороший продукт, но ещё не упакован для продажи*.

---

## 1. Путь покупателя — экран за экраном

### 1.1 Login

| Критерий | Оценка |
|----------|--------|
| **WOW** | Минималистичный вход без визуального шума. Тёмная тема + бордовый акцент создают ощущение «закрытого корпоративного пространства», а не публичного SaaS. |
| **Дорого** | Да — типографика, скругления, градиент фона. Уровень зрелого B2B-портала. |
| **Enterprise** | Copy «Forgot your password? Contact your platform administrator» — правильный тон. Переключатель EN/RU на login — сигнал international-ready. |
| **Незаконченно** | Блок *Demo accounts* с email `olivia@spiora.demo` и подсказкой про `.env.local` — для sales-demo это «кухня разработки на экране входа». |
| **Дёшево** | Placeholder email в поле ввода; отсутствие SSO/SAML badge (даже как «Enterprise plan»). |
| **Переделал бы** | Sales-login: один клик «Enter as CEO» без технических подсказок; строка «Trusted by relocation teams in Europe» или логотипы-клиенты (даже synthetic). |

---

### 1.2 Dashboard

| Критерий | Оценка |
|----------|--------|
| **WOW** | Живая картина: ближайшие встречи, задачи с overdue-подсветкой, последние сообщения команды, кто online. CEO чувствует: *компания движется*. |
| **Дорого** | Hero с glow-эффектом, карточная сетка KPI — визуально ближе к Notion/Linear, чем к Excel. |
| **Enterprise** | Агрегированные метрики (Clients in CRM, Active consultations, AI requests), drill-down в Tasks/Calendar. RBAC виден через роль в topbar. |
| **Незаконченно** | Только 2 quick actions. Нет CEO-уровня: revenue, pipeline value, clients at risk, SLA breaches. Emoji 📋 в заголовке Tasks — мелочь, но снижает boardroom-тон. |
| **Дёшево** | KPI «New applications (7 days): 4» без контекста «хорошо это или плохо» — цифры без narrative. |
| **Переделал бы** | Верхний блок: 3 CEO-метрики (Active cases · Revenue pipeline · Overdue actions) + одна красная «требует внимания» карточка с именем клиента. |

---

### 1.3 CRM — Clients (список)

| Критерий | Оценка |
|----------|--------|
| **WOW** | Глубина полей: booking address, residence permit dates, referent — видно, что продукт *знает отрасль*, а не «универсальный CRM». |
| **Дорого** | Нет. Визуально — Google Sheet в Card: горизонтальный scroll, 15 колонок, monospace-ощущение. |
| **Enterprise** | Заявлена интеграция с Google Sheets — для ops-команды плюс; для CEO — «мы всё ещё живём в таблице». |
| **Незаконченно** | Нет kanban, нет status badges в списке, нет сегментации по направлениям (Spain / Croatia / Portugal). |
| **Дёшево** | Бейдж **Demo data**; ID `DEMO-1001`; телефоны `+000 000 000 002`; колонка **App password** в общей таблице — красный флаг для compliance-minded buyer. |
| **Переделал бы** | Card/list view: фото/инициалы, имя, направление, статус, менеджер, next action. 6 колонок max. Synthetic data без DEMO-префиксов. |

---

### 1.4 CRM — Client Card

| Критерий | Оценка |
|----------|--------|
| **WOW** | **AI-панель в карточке клиента** — «Ask AI about client» + 10 пресетов («What documents does the client still need?», «Draft follow-up email»). Это differentiation, которого нет у типичного CRM. |
| **Дорого** | Умеренно. Функционально сильно, визуально — плоский grid полей как в админке 2018 года. |
| **Enterprise** | Documents, Manager notes, Applications, AI Summary — полный case file для compliance-heavy отрасли. |
| **Незаконченно** | Нет timeline коммуникаций (calls, emails, status changes). Нет визуального pipeline stage. |
| **Дёшево** | Source: «Demo data» / «Google Sheets» — ломает immersion. Поля идут списком без visual hierarchy. |
| **Переделал бы** | Layout: слева профиль + status pipeline; центр — timeline; справа sticky AI assistant. Убрать технические source labels из buyer view. |

---

### 1.5 Calendar

| Критerий | Оценка |
|----------|--------|
| **WOW** | **Сильнейший модуль демо.** Day/Week/Month, video meetings (LiveKit), guest invite links, waiting room, привязка к клиенту, reminders. Ощущение Calendly + Zoom внутри CRM. |
| **Дорого** | Да. Toolbar, timezone, event modal — уровень standalone calendar product. |
| **Enterprise** | Company vs My events layers; RBAC на edit/delete; audit trail для meetings. |
| **Незаконченно** | Событие «Demo Environment Review» в календаре — meta-demo ломает иллюзию реальной компании. |
| **Дёшево** | — |
| **Переделал бы** | Dashboard widget «Join next meeting in 12 min» с one-click; убрать meta-demo названия событий; показать consultation с Sofia Martins как hero-event. |

---

### 1.6 AI Workspace

| Критерий | Оценка |
|----------|--------|
| **WOW** | **Главная звезда демо.** «How can I help the team today?» + 8 пресетов, режимы Brief/Detailed/Client message/Case analysis, источники CRM/KB/Tasks/Calendar. Ответы с draft emails и case summaries — *ощущение реального AI-ассистента*. |
| **Дорого** | Да — двухколоночный chat UI, markdown-ответы, history sidebar. |
| **Enterprise** | Client disambiguation, rate limits, guardrails — архитектурная зрелость видна даже buyer'у. |
| **Незаконченно** | Badge «Demo response» + «no external AI provider was called» — честно, но убивает magic moment. |
| **Дёшево** | Disclaimer'ы на каждом ответе. Пресеты работают, но buyer понимает: «это заготовки». |
| **Переделал бы** | Sales mode: live LLM с тихим fallback; убрать demo-badge при успешном ответе; первый экран — один большой пресет «Show me today's priorities» с cinematic ответом. |

---

### 1.7 Team Chat

| Критерий | Оценка |
|----------|--------|
| **WOW** | 27 реалистичных сообщений: standup, pipeline updates, threads про Sofia Martins и Anna Kowalska. Voice, files, pins, shared media. «Почему не Slack?» → «Потому что контекст клиента рядом». |
| **Дорого** | Да — feature depth выше ожиданий от demo. Messenger-style UI, online indicators, pinned bar. |
| **Enterprise** | Owner clear chat, delete permissions, presence, unread counter в sidebar. |
| **Незаконченно** | Нет deep link «Open client card» из упоминания клиента в сообщении. |
| **Дёшево** | Кнопка «🗑 Delete» с emoji — мелочь, но не enterprise polish. |
| **Переделал бы** | @client mentions с кликабельной ссылкой на CRM card; highlight «3 clients mentioned today». |

---

### 1.8 Knowledge Base

| Критerий | Оценка |
|----------|--------|
| **WOW** | 14+ статей: onboarding checklist, escalation procedure, working with AI Workspace — believable internal wiki, не 3 stub-страницы. |
| **Дорого** | Умеренно — чистый sidebar + cards, но без rich preview/editor feel. |
| **Enterprise** | Категории, теги, multi-source (Drive fallback) — правильная enterprise story. |
| **Незаконченно** | Create/Edit/Upload disabled — видно, что CRUD заблокирован. |
| **Дёшево** | Бейдж Demo data; кнопки Open и Preview ведут к одному действию. |
| **Переделал бы** | 3 hero-articles для buyer tour с красивым markdown preview; убрать duplicate buttons. |

---

### 1.9 Analytics

| Критерий | Оценка |
|----------|--------|
| **WOW** | Overview: KPI grid с delta %, bar chart monthly activity, team workload, client distribution — CEO может «увидеть бизнес». |
| **Дорого** | Overview — да. Croatia tab — детальная аналитика. |
| **Enterprise** | Period filter, export Excel/PDF (disabled in demo), role-gated access. |
| **Незаконченно** | **Spain и Medical checkups — явные placeholders** с текстом «will be connected after data is loaded» и bullet list «Also planned: financial dashboard, B2B…». |
| **Дёшево** | 50% раздела — roadmap в UI вместо данных. Buyer видит: «половина продукта ещё не сделана». |
| **Переделал бы** | Показывать только Overview + Croatia; скрыть пустые tabs; добавить 1 «immigration pipeline funnel» chart. |

---

### 1.10 Team

| Критерий | Оценка |
|----------|--------|
| **WOW** | AI requests/month на карточке каждого сотрудника — уникальная метрика, которой нет в типичном HR-модуле. |
| **Дорого** | Минималистично, не перегружено. |
| **Enterprise** | Presence (online dot), delete RBAC, role labels. |
| **Незаконченно** | Нет invite flow, departments, role editing. |
| **Дёшево** | 4 пользователя — «игрушечная компания на 80 человек». Нет аватаров. |
| **Переделал бы** | 8–12 synthetic users с initials-avatars и отделами (Sales · Case Management · Legal). |

---

### 1.11 Settings

| Критерий | Оценка |
|----------|--------|
| **WOW** | Integrations matrix: Google Drive, Sheets, Supabase, LiveKit — «это платформа, не одна фича». |
| **Дорого** | Структура admin panel правильная — 9 tabs, hint-тексты, status badges. |
| **Enterprise** | Password reset для команды, integration statuses, Company profile (Spiora, Prague). |
| **Незаконченно** | Badge «Demo mode — Preview only»; ~80% полей read-only. |
| **Дёшево** | Много tabs с 2–3 disabled полями — ширина без глубины. |
| **Переделал бы** | Buyer-demo: 3 tabs (Company · Integrations · Security); остальное — collapsed «Advanced». |

---

### 1.12 Навигация (сквозной слой)

| Критерий | Оценка |
|----------|--------|
| **WOW** | Unread counter в Team Chat; уведомления с реальными сценариями (Sofia Martins consultation). |
| **Дорого** | Sidebar gradient active state, Sora font — не bootstrap. |
| **Enterprise** | RBAC: Owner видит Analytics/Settings, Manager — нет. |
| **Незаконченно** | **Глобальный Search в topbar — декоративный**, не работает. |
| **Дёшево** | 15 пунктов меню включая Checkups in Yerevan, Relocation, Formgrid Clients, Meeting Recordings — ощущение кастомного проекта под одного клиента. |
| **Переделал бы** | 8 пунктов для buyer tour; grouped nav (CRM · Operations · Insights · Admin); рабочий global search или убрать поле. |

---

## 2. ТОП-20 улучшений, которые повысят вероятность покупки

*Формулировки причинно-следственные: «если исправить X → buyer Y».*

| # | Если исправить… | …вероятность покупки станет выше, потому что |
|---|-----------------|---------------------------------------------|
| 1 | **Убрать все видимые «Demo data» / «Demo mode» badges** с экранов buyer tour | CEO перестанет воспринимать продукт как MVP и начнёт оценивать как готовое решение |
| 2 | **Заменить DEMO-1001, +000 телефоны, @example.com на believable synthetic data** | исчезнет ощущение «фейковой витрины» — buyer поверит, что так будет выглядеть его компания |
| 3 | **Спрятать Lead Review, Formgrid, Meeting Recordings, Checkups, Relocation из sidebar** в buyer demo | меню перестанет кричать «кастом под одного клиента» и начнёт выглядеть как продукт |
| 4 | **Сделать CRM list card-view** (6 полей, status badge, manager avatar) вместо 15-column spreadsheet | CEO увидит CRM, а не Excel — ключевой mental model shift для сделки |
| 5 | **Убрать placeholder tabs Spain/Checkups из Analytics** или заполнить данными | buyer не увидит «половина аналитики не готова» — один из главных deal-killers |
| 6 | **Подключить live AI** (или скрыть disclaimer «no external AI provider») | magic moment AI Workspace сохранится — buyer запомнит wow, а не оговорку |
| 7 | **Сделать global Search рабочим** (хотя бы по clients + KB) или убрать поле | исчезнет ощущение «сломанного продукта» на каждом экране |
| 8 | **Client Card: timeline + pipeline stage** вместо flat field list | buyer увидит case management, а не database viewer — ценность для immigration ops станет очевидной |
| 9 | **Dashboard: 3 CEO-KPI** (active cases, overdue actions, pipeline) вместо 8 равных карточек | CEO за 5 секунд поймёт «это для меня», а не «это для операционки» |
| 10 | **Calendar: one-click «Join next meeting»** на Dashboard | buyer почувствует daily driver value, а не «ещё один календарь» |
| 11 | **Team Chat: @client → link to CRM card** | buyer увидит unified workspace story — главный аргумент против Slack+CRM |
| 12 | **Убрать колонку App password** из CRM list | compliance-minded buyer (immigration = sensitive data) не отвалится на первом экране CRM |
| 13 | **Login: убрать Demo accounts block** и `.env.local` hints | первый экран перестанет выглядеть как dev environment |
| 14 | **AI Workspace: cinematic first response** на «Today's priorities» | buyer получит emotional peak в первые 2 минуты demo — запоминается на 10× дольше features list |
| 15 | **Knowledge Base: 3 hero-articles** с rich preview (TOC, formatting) | buyer поверит, что команда реально пользуется базой знаний |
| 16 | **Team: показать 8–12 users** с departments | buyer на 80 человек увидит масштабируемость, а не «портал для 4 человек» |
| 17 | **Settings: 3 active tabs** вместо 9 read-only | buyer не потратит 5 минут на «всё disabled» и не уйдёт с впечатлением «ещё не готово» |
| 18 | **Убрать emoji** (📋, 🗑) из UI | boardroom credibility вырастет — мелочь, но CEO замечает |
| 19 | **Единый narrative thread**: Sofia Martins проходит через CRM → Calendar → Chat → AI → Tasks | buyer почувствует coherence — «это система, а не набор модулей» |
| 20 | **Добавить «Request pricing» / «Book a pilot» CTA** в Settings или Dashboard footer | buyer получит clear next step — без него demo остаётся «интересно, но что дальше?» |

---

## 3. Взгляд директора иммиграционной компании

*Persona: директор агентства ~60–100 клиентов в pipeline, 15–25 сотрудников, устал от Google Sheets + WhatsApp + Calendly.*

### Купил бы?

**Скорее да — на пилот / proof-of-concept.**  
**Полную enterprise-лицензию — пока нет**, без доработки packaging.

### Почему да

1. **AI в контексте клиента** — я 10 лет мечтал, чтобы менеджер мог спросить «какие документы не хватает Sofia?» и получить ответ за 5 секунд, а не лезть в 4 таблицы.
2. **Календарь с video + client binding** — заменяет Calendly + Zoom + ручную привязку к CRM.
3. **Team Chat с контекстом** — команда обсуждает кейсы, не теряя их в WhatsApp.
4. **Knowledge Base** — onboarding нового менеджера перестанет быть «сиди с Olga 2 недели».
5. **Отраслевая глубина полей** — booking, residence permit, referent — видно, что продукт *понимает* immigration, а не «Salesforce с лишними полями».

### Что смутило

1. **Demo data everywhere** — я не хочу показывать это своей команде, пока не выглядит «настоящим».
2. **CRM = spreadsheet** — мои менеджеры и так живут в Google Sheets; зачас платить за то же самое в prettier UI?
3. **Lead Review на русском** при EN default — red flag для international agency.
4. **Analytics наполовину пустой** — я принимаю решения по цифрам; половина dashboard'а говорит «coming soon».
5. **4 пользователя в Team** — моя компания 22 человека; где остальные?
6. **App password в CRM table** — мой DPO уволит меня за это.

### Чего не хватило

- **Client portal** — клиент сам загружает документы, видит статус (даже mock).
- **Pipeline funnel** — сколько лидов → консультаций → подписанных контрактов.
- **Billing / invoicing** hook — хотя бы placeholder «Invoices: 3 pending».
- **Multi-office** — Prague + Barcelona + Yerevan offices.
- **White-label** — мой бренд, не Spiora.

### Что вызвало восторг

1. AI Workspace preset «Find Sofia Martins» → полный case summary с next steps.
2. Calendar consultation с video link и client name.
3. Team Chat thread про Spain checklist — *это наша реальная переписка*.
4. Dashboard overdue tasks — я сразу вижу, где команда тормозит.
5. Settings integrations matrix — «они думали об инфраструктуре, не только о UI».

---

## 4. Оценки по шкале 1–10 (sales perspective)

*Критерий: «Насколько этот модуль помогает продать платформу CEO/buyer'у?»*

| Модуль | Score | Комментарий |
|--------|-------|-------------|
| **Dashboard** | **7/10** | Живая операционка, но нет CEO-KPI; emoji снижает tonality |
| **CRM** | **5/10** | Отраслевая глубина + AI в карточке vs spreadsheet UI + DEMO-data + App password column |
| **Calendar** | **9/10** | Лучший модуль для demo; video + client link = instant value |
| **AI Workspace** | **9/10** | Star of the show; disclaimer'ы снимают 1 балл |
| **Team Chat** | **8/10** | Реалистичные threads; не хватает CRM deep links |
| **Analytics** | **5/10** | Overview хорош; половина tabs — placeholders |
| **Knowledge Base** | **7/10** | Believable content; disabled CRUD и duplicate buttons |
| **Settings** | **6/10** | Integrations story сильный; 80% read-only разочаровывает |

**Средняя sales-оценка: 7.0/10**

---

## 5. Если бы было ещё 5 дней разработки — путь к «продукт за $100 000»

*Не новые features. Только packaging, polish, narrative — чтобы buyer *почувствовал* ценник.*

### День 1 — «Убрать демо-шлейф»
- Скрыть все Demo badges/mode labels с buyer-facing screens
- Заменить DEMO-* IDs, +000 phones, @example.com на premium synthetic data
- Убрать Demo accounts block с login
- Убрать App password column из CRM

### День 2 — «CRM, который продаёт»
- Card/list view для Clients (6 полей, status badge, manager, direction flag)
- Client Card: левая колонка profile + pipeline stage; правая — AI sticky panel
- Timeline stub (5 synthetic events: consultation → documents sent → review)

### День 3 — «CEO tour»
- Sidebar: 8 пунктов (Dashboard · Clients · Calendar · Tasks · AI · Chat · KB · Analytics)
- Dashboard: 3 CEO-KPI + «Requires attention» card (Sofia Martins — documents overdue)
- Global search: working client lookup (или убрать поле)
- Analytics: показать только Overview + 1 filled tab; скрыть placeholders

### День 4 — «AI magic moment»
- AI Workspace: live LLM (или premium canned responses без disclaimer)
- Первый экран: auto-suggest «Today's priorities» с rich formatted response
- Client Card AI: один click → draft email to Sofia Martins

### День 5 — «Enterprise polish»
- Team: 10 synthetic users с departments и initials-avatars
- Knowledge Base: 3 hero-articles с rich markdown preview
- Calendar: «Join next meeting» widget на Dashboard
- Login footer: «Schedule a pilot» CTA
- Final pass: убрать emoji, mixed-language leaks, meta-demo event names

**Результат 5 дней:** тот же функционал, но buyer видит *готовый продукт для immigration agency*, а не *demo MVP с oговорками*. Perceived value: **$80–120K custom platform** или **$150–250/user/month SaaS**.

---

## 6. Итоговый вердикт

| Вопрос | Ответ |
|--------|-------|
| **Готов ли Spiora к sales demo сегодня?** | **Да** — для warm lead / niche buyer (relocation agency) |
| **Готов ли к cold enterprise sale?** | **Нет** — demo-артефакты и packaging gaps убьют deal |
| **Главный актив** | AI Workspace + Calendar + Team Chat = unified ops story |
| **Главный liability** | CRM spreadsheet UI + visible demo labels + half-empty Analytics |
| **Приоритет перед PR #12 (Demo Reset)** | **PR #11.5 polish** — 5 дней packaging дадут больше для продаж, чем технический reset |

---

## 7. Связь с roadmap

| PR | Фокус | Sales impact |
|----|-------|--------------|
| **#11.5 (этот review)** | Executive polish, narrative, hide demo artifacts | **High** — first impression |
| **#12 Demo Reset** | Technical: seed, reset, persistence | Medium — buyer не видит |
| **#13+ Infra** | Supabase, Vercel, GitHub | Low для первого demo — high для scale |

**Рекомендация:** реализовать TOP-10 из раздела 2 *до* массовых demo-показов. Demo Reset и infra — параллельно, но не вместо packaging.

---

*Документ подготовлен без изменения кода. Executive review only.*
