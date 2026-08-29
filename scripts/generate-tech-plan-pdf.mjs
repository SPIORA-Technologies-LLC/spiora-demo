/**
 * Regenerates Spiora technical business-plan section as PDF (Cyrillic via Windows Arial).
 */
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

const OUT = path.join(
  process.env.USERPROFILE || process.env.HOME || ".",
  "Downloads",
  "Spiora_Техническая_часть_бизнес_плана_обновлённая_август_2026.pdf",
);

const FONT_REG = "C:/Windows/Fonts/arial.ttf";
const FONT_BOLD = "C:/Windows/Fonts/arialbd.ttf";

const MARGIN = 50;
const PAGE_W = 595.28;
const CONTENT_W = PAGE_W - MARGIN * 2;

function createDoc() {
  const doc = new PDFDocument({
    size: "A4",
    bufferPages: true,
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: "SPIORA — Техническая часть бизнес-плана",
      Author: "Spiora",
      Subject: "Технологический стек, архитектура, данные, AI, безопасность",
    },
  });
  doc.registerFont("Body", FONT_REG);
  doc.registerFont("Bold", FONT_BOLD);
  return doc;
}

function ensureSpace(doc, need = 60) {
  if (doc.y > doc.page.height - MARGIN - need) {
    doc.addPage();
    pageFooter(doc);
  }
}

function pageFooter(doc) {
  const pageNo = doc.bufferedPageRange
    ? null
    : null;
  // drawn at end via switchToPage
}

function headerBar(doc, title) {
  doc.font("Bold").fontSize(9).fillColor("#444444");
  doc.text("SPIORA  |  ТЕХНИЧЕСКАЯ ЧАСТЬ", MARGIN, MARGIN - 28, {
    width: CONTENT_W,
    align: "left",
  });
  doc
    .moveTo(MARGIN, MARGIN - 12)
    .lineTo(PAGE_W - MARGIN, MARGIN - 12)
    .strokeColor("#CCCCCC")
    .stroke();
  doc.fillColor("#000000");
  if (title) {
    // unused
  }
}

function h1(doc, text) {
  ensureSpace(doc, 40);
  doc.moveDown(0.4);
  doc.font("Bold").fontSize(14).fillColor("#000000").text(text, { width: CONTENT_W });
  doc.moveDown(0.35);
}

function h2(doc, text) {
  ensureSpace(doc, 36);
  doc.moveDown(0.25);
  doc.font("Bold").fontSize(11).text(text, { width: CONTENT_W });
  doc.moveDown(0.2);
}

function p(doc, text) {
  ensureSpace(doc, 48);
  doc.font("Body").fontSize(10).fillColor("#111111").text(text, {
    width: CONTENT_W,
    align: "justify",
    lineGap: 2,
  });
  doc.moveDown(0.35);
}

function bullet(doc, text) {
  ensureSpace(doc, 36);
  doc.font("Body").fontSize(10).text(`•  ${text}`, {
    width: CONTENT_W,
    align: "left",
    lineGap: 2,
  });
  doc.moveDown(0.15);
}

function callout(doc, label, text) {
  ensureSpace(doc, 70);
  doc.font("Bold").fontSize(9).fillColor("#E82916").text(label);
  doc.font("Body").fontSize(9).fillColor("#222222").text(text, {
    width: CONTENT_W,
    align: "justify",
    lineGap: 1.5,
  });
  doc.fillColor("#000000");
  doc.moveDown(0.45);
}

function table2(doc, rows) {
  const col1 = 130;
  const col2 = CONTENT_W - col1;
  for (const [a, b] of rows) {
    ensureSpace(doc, 28);
    const y = doc.y;
    doc.font("Bold").fontSize(9).text(a, MARGIN, y, { width: col1 });
    doc.font("Body").fontSize(9).text(b, MARGIN + col1, y, { width: col2 });
    doc.y = Math.max(doc.y, y + 14);
    doc.moveDown(0.15);
  }
  doc.moveDown(0.3);
}

async function main() {
  if (!fs.existsSync(FONT_REG)) {
    throw new Error("Arial font not found at " + FONT_REG);
  }

  const doc = createDoc();
  const stream = fs.createWriteStream(OUT);
  doc.pipe(stream);

  // —— Cover ——
  doc.font("Bold").fontSize(28).text("SPIORA", { align: "left" });
  doc.moveDown(0.4);
  doc.font("Bold").fontSize(18).text("Техническая часть\nбизнес-плана");
  doc.moveDown(0.8);
  doc
    .font("Body")
    .fontSize(11)
    .fillColor("#333333")
    .text(
      "Технологический стек, архитектура, данные, AI, безопасность\nи взаимодействие с мобильным приложением",
      { width: CONTENT_W },
    );
  doc.moveDown(1.2);
  callout(
    doc,
    "Тип продукта",
    "Вертикальная SaaS-платформа с адаптацией под клиента: готовое отраслевое ядро, которое настраивается и дорабатывается под процесс каждой компании (не «коробка как есть» и не разработка с нуля).",
  );
  doc.moveDown(0.5);
  doc
    .font("Body")
    .fontSize(9)
    .fillColor("#555555")
    .text(
      "Статус документа: актуализированная техническая архитектура (редакция после обновления MFA и политики безопасности данных клиентов).\nОбновлённая редакция • август 2026",
      { width: CONTENT_W },
    );

  // —— 1 ——
  doc.addPage();
  headerBar(doc);
  h1(doc, "1. Назначение технического раздела");
  p(
    doc,
    "Настоящий раздел описывает фактическую технологическую архитектуру Spiora для включения в бизнес-план. Spiora — вертикальная SaaS-платформа с адаптацией под клиента: веб-система для сотрудников и руководителей, клиентский PWA-портал, общая серверная часть, PostgreSQL-база, файловое хранилище и AI-модули. Под каждого клиента платформа разворачивается и адаптируется (функции, процесс, бренд, доступы), а не поставляется как единый неизменяемый набор для всех.",
  );
  callout(
    doc,
    "Правило достоверности",
    "Компоненты, подтверждённые кодовой базой или production-проверкой, описываются как реализованные; возможности, активация которых зависит от конфигурации (feature flags), — как поддерживаемые архитектурой; отсутствующие компоненты — как дорожная карта.",
  );

  h1(doc, "2. Краткое техническое резюме");
  table2(doc, [
    ["Тип продукта", "Вертикальная SaaS-платформа с адаптацией под клиента"],
    ["Backend", "Node.js, Next.js 15, TypeScript, REST Route Handlers — реализовано"],
    ["Frontend", "React 19.1, App Router, CSS Modules, next-intl — реализовано"],
    ["База данных", "PostgreSQL (Supabase); SQL-миграции; локальный JSON fallback — в коде"],
    ["Файлы", "Supabase Storage: private buckets, signed URLs — реализовано"],
    ["Инфраструктура", "Vercel + Supabase — реализовано"],
    ["CI/CD", "Vercel deploy + GitHub Actions (calendar reminders) — частично"],
    ["AI", "OpenRouter/OpenAI; контекст CRM/KB/PDF; без embeddings/pgvector — частично"],
    [
      "Авторизация",
      "Supabase Auth + RBAC + RLS (часть таблиц) + MFA (TOTP) по feature flags — реализовано / включается конфигурацией",
    ],
    ["Мобильная часть", "PWA и клиентский портал; native iOS/Android — дорожная карта"],
  ]);

  h1(doc, "3. Backend");
  p(
    doc,
    "Основной runtime — Node.js в составе Next.js server. Язык — TypeScript. Фреймворк — Next.js ^15.3.3 (App Router). Интерфейсы — REST API Route Handlers; Server Actions минимально для входа/выхода. Архитектура — модульный монолит: UI, REST API и серверная логика в одном приложении. Работа с данными — Supabase SDK и SQL-миграции (Prisma/Drizzle не используются). Middleware обеспечивает i18n, сессию, аутентификацию и ACL по маршрутам.",
  );
  p(
    doc,
    "Серверная часть отвечает за бизнес-логику, авторизацию, проверку прав, работу с клиентами, заявками и документами, финансы, уведомления, AI, календарь, видеовстречи и синхронизацию с клиентским порталом.",
  );

  h1(doc, "4. Frontend");
  bullet(doc, "Next.js ^15.3.3 и React ^19.1.0; TypeScript; Server/Client Components.");
  bullet(doc, "Адаптивный UI; русский и английский через next-intl.");
  bullet(doc, "PWA: manifest и service worker; полноценный offline-first и web push не подтверждены.");
  bullet(doc, "CSS Modules; Tailwind/Redux/Zustand/React Query не используются.");

  h1(doc, "5. База данных");
  p(
    doc,
    "Production-путь — PostgreSQL на Supabase. Миграции покрывают CRM, клиентский портал, заявки, задачи, базу знаний, календарь, видеовстречи, финансы, уведомления, подпись договоров, Company Details и AI-чаты. Для локального/демо режима предусмотрен fallback на .data/*.json.",
  );
  h2(doc, "5.1. Разделение данных");
  table2(doc, [
    ["Клиентский", "Профиль, приглашения, анкеты, кейсы, документы, статусы, финансы, AI-помощник"],
    ["Внутренний", "CRM, заметки, задачи, календарь, командный чат, база знаний"],
    ["Финансовый", "Профили, контракты, платежи, задолженности, аналитика"],
    ["Административный", "Пользователи, роли, настройки, feature flags, журналы"],
  ]);
  p(
    doc,
    "Доступ ограничивается RBAC, серверными проверками и Row Level Security для поддерживаемых таблиц. При доступе через service role основная проверка выполняется бизнес-логикой приложения; RLS — дополнительный слой.",
  );
  callout(
    doc,
    "Multi-tenant",
    "В данных есть организационная привязка (включая companyId). Полноценная multi-organization админ-модель и tenant management UI реализованы частично. Модель поставки: отдельный адаптированный контур под компанию клиента.",
  );

  h1(doc, "6–8. Кэш, очереди, файлы");
  p(
    doc,
    "Redis/Memcached не используются. Отдельная очередь заданий отсутствует: фоновые процессы через REST/cron (GitHub Actions — calendar reminders каждые 5 минут). Файлы — Supabase Storage (private buckets), метаданные в PostgreSQL. Buckets: task-attachments, team-chat-*, meeting-recordings, knowledge-base. Signed URLs; проверка MIME/размера. Антивирус и версионирование файлов — дорожная карта. Для коммерческого запуска планируется отдельное хранилище чувствительных документов (паспорта, выписки, сканы).",
  );

  h1(doc, "9–11. Инфраструктура, CI/CD, Git");
  table2(doc, [
    ["Веб / API", "Vercel (production, ветка main)"],
    ["PostgreSQL / Auth", "Supabase"],
    ["Файлы", "Supabase Storage"],
    ["AI", "OpenRouter (основной); OpenAI API (fallback)"],
    ["Видео", "LiveKit"],
    ["Репозиторий", "GitHub; секреты в env / Secrets"],
  ]);
  p(
    doc,
    "Vercel deployment подтверждён. GitHub Actions — calendar reminders. Полноценный quality-gate CI (обязательные lint/tests/migrations) относится к дальнейшему развитию. Branch protection на момент предыдущего аудита не был включён.",
  );

  h1(doc, "12. Искусственный интеллект");
  p(
    doc,
    "AI вызывается только сервером. Провайдер — OpenRouter; OpenAI — резерв. Функции: AI Workspace, AI по карточке клиента, Ask Spiora; контекст из CRM, KB, Drive и PDF. Vector RAG / embeddings / pgvector не реализованы. Внешний AI включается feature flag; без ключа возможен демо-ответ. Для демо допустим внешний AI на учебных данных; для реальных клиентов — маскирование PII и/или корпоративный AI в EU (Azure/AWS).",
  );

  h1(doc, "13. Авторизация");
  table2(doc, [
    ["Регистрация и вход", "Supabase Auth; локально/legacy — JWT cookie + bcrypt"],
    ["Сессия", "Supabase SSR либо spiora_session (jose)"],
    ["Права", "RBAC: owner, manager, finance_manager"],
    ["RLS", "SQL для части таблиц"],
    [
      "Двухфакторная аутентификация (MFA)",
      "Реализована (TOTP): сотрудники — SPIORA_MFA_EMPLOYEE; клиентский портал — SPIORA_MFA_CLIENT; recovery codes. Включается конфигурацией production",
    ],
    ["OAuth / SSO", "Пользовательский Google/Microsoft login — дорожная карта"],
    ["Клиентский портал", "Отдельная Auth-сессия и client_portal_users; плоскости employee/client разделены"],
  ]);

  h1(doc, "14. Безопасность");
  h2(doc, "14.1. Реализовано");
  bullet(doc, "HTTPS (Vercel); серверное хранение секретов;");
  bullet(doc, "RBAC, middleware ACL и RLS для поддерживаемых таблиц;");
  bullet(doc, "MFA (TOTP) для сотрудников и клиентского портала — в коде, включается feature flags;");
  bullet(doc, "private Storage buckets и подписанные ссылки;");
  bullet(doc, "SameSite cookies; частичный rate limiting (login/AI/chat);");
  bullet(doc, "аудит встреч и activity log клиентских кейсов;");
  bullet(doc, "токены приглашений, OTP подписи и MFA recovery — в hash, не открытым текстом.");

  h2(doc, "14.2. Безопасность данных клиентов: демо и коммерческий запуск");
  p(
    doc,
    "Сейчас в демо. Система работает на учебных данных — вымышленные клиенты и документы. Настоящие паспорта и личные данные живых людей туда не загружаются. Доступ разделён: сотрудники и клиенты входят по-разному. Файлы закрыты и открываются только внутри системы. Этого достаточно, чтобы безопасно показать, как работает продукт.",
  );
  p(doc, "Для реального клиента мы усилим защиту:");
  bullet(
    doc,
    "Персональные данные не будут уходить в обычный внешний AI в открытом виде — подключим защищённый корпоративный AI.",
  );
  bullet(doc, "Каждый сотрудник увидит только своих клиентов, а не всю базу.");
  bullet(
    doc,
    "Паспорта и другие важные документы будем хранить отдельно, с более строгим доступом.",
  );
  bullet(
    doc,
    "Настроим правила под закон страны клиента (Европа — GDPR, Россия — 152‑ФЗ).",
  );
  bullet(doc, "По запросу человека данные можно будет выгрузить или удалить.");
  bullet(
    doc,
    "Введём корпоративные аккаунты (аккаунты компании, не личные), правила доступа и журнал важных действий.",
  );

  h2(doc, "14.3. Требует усиления до коммерческого запуска");
  bullet(doc, "пользовательский OAuth/SSO;");
  bullet(doc, "CSP и HSTS в конфигурации приложения;");
  bullet(doc, "распределённый rate limiting и централизованный security logging;");
  bullet(doc, "антивирусная проверка загружаемых файлов;");
  bullet(doc, "полный аудит RLS и service-role операций;");
  bullet(doc, "формализованная политика резервного копирования и восстановления;");
  bullet(doc, "отдельный bucket и политики для чувствительных KYC-документов.");

  h1(doc, "15. Архитектура");
  p(
    doc,
    "Spiora — модульное клиент-серверное SaaS-приложение (вертикальная платформа с адаптацией под клиента). Внутренняя веб-платформа и клиентский PWA взаимодействуют с общей серверной частью через REST API. Модульный монолит на Next.js; микросервисы — только при подтверждённой нагрузке.",
  );

  h1(doc, "16. Мобильное приложение");
  p(
    doc,
    "Адаптивный PWA-портал клиента: вход, анкеты, документы, статусы, разрешённые финансы, Ask Spiora. Нативные iOS/Android — дорожная карта.",
  );

  h1(doc, "17. Дополнительные модули");
  h2(doc, "17.1. Видеовстречи");
  p(
    doc,
    "LiveKit + календарь: staff/guest токены, waiting room, аудит, запись встреч, библиотека записей, уведомления участникам команды о сохранённой записи.",
  );
  h2(doc, "17.2. Финансовый учёт");
  p(
    doc,
    "Клиентские финансовые профили, контракты, платежи, задолженности и аналитика. Банковский эквайринг — не реализован.",
  );

  h1(doc, "18. Технические этапы развития");
  table2(doc, [
    ["1. Foundation", "Vercel, Supabase, Auth, Storage, RBAC, часть RLS, MFA в коде"],
    ["2. Клиентская интеграция", "Портал, приглашения, анкеты, кейсы, документы, AI-помощник"],
    ["3. Бизнес-модули", "CRM, задачи, финансы, календарь, LiveKit, KB, chat, notifications"],
    ["4. AI", "OpenRouter/OpenAI; embeddings/OCR/STT — дорожная карта; EU corporate AI — при реальных клиентах"],
    ["5. Надёжность", "CSP/HSTS, полный CI, мониторинг, restore drill, scoped ACL, sensitive storage"],
    ["6. Масштаб", "Redis/очередь — после нагрузочного подтверждения"],
  ]);

  h1(doc, "19. Что подтвердить у администратора");
  bullet(doc, "live feature flags, SPIORA_DEMO_MODE, SPIORA_MFA_EMPLOYEE / SPIORA_MFA_CLIENT;");
  bullet(doc, "Supabase project, buckets, RLS, тариф backups/PITR;");
  bullet(doc, "production AI-модели и провайдеры;");
  bullet(doc, "LiveKit, Google, webhooks;");
  bullet(doc, "централизованный monitoring/error tracking.");

  h1(doc, "20. Краткая формулировка");
  p(
    doc,
    "Техническая архитектура Spiora: вертикальная SaaS-платформа с адаптацией под клиента на Node.js, Next.js 15, React 19 и TypeScript. Внутренняя платформа и клиентский PWA взаимодействуют через REST API. Production — Vercel; код — GitHub; данные — PostgreSQL, Supabase Auth и private Storage (с demo JSON fallback). Авторизация: Supabase Auth, RBAC, RLS (часть таблиц) и двухфакторная аутентификация TOTP (сотрудники и портал, включается feature flags). AI — OpenRouter/OpenAI без vector RAG. Подтверждены CRM, портал, задачи, финансы, KB, чат, календарь, LiveKit, уведомления, аналитика и PWA. Для демо безопасность строится на учебных данных и разделённом доступе; для реальных клиентов — усиление AI/ACL/sensitive storage и соответствие GDPR или 152‑ФЗ. Полноценный CI/CD, OAuth/SSO, CSP/HSTS, Redis, native mobile и подтверждённый backup/restore остаются в плане развития.",
  );

  doc.moveDown(0.6);
  h2(doc, "Статусы в документе");
  table2(doc, [
    ["Реализовано", "Подтверждено кодом или production-проверкой"],
    ["Поддерживается архитектурой", "В коде есть; включение зависит от конфигурации"],
    ["Частично", "Основа есть, controls или проверки не завершены"],
    ["Дорожная карта", "В текущей реализации отсутствует"],
  ]);

  doc.moveDown(0.8);
  doc
    .font("Body")
    .fontSize(8)
    .fillColor("#666666")
    .text(
      "Основание: технический аудит репозитория spiora-demo и обновление августа 2026 (тип продукта, MFA, политика безопасности данных клиентов). Документ подготовлен для включения в бизнес-план Spiora.",
      { width: CONTENT_W },
    );

  // Page numbers
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc
      .font("Body")
      .fontSize(8)
      .fillColor("#888888")
      .text(`Страница ${i + 1} из ${range.count}`, MARGIN, doc.page.height - 36, {
        width: CONTENT_W,
        align: "right",
      });
  }

  doc.end();
  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
  console.log("Wrote", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
