'use strict';

/* ============================================================
   ДЖЕМБАЛАНС — PLANNER
   Supabase + Auth + Realtime + Notifications
   ============================================================ */


/* ============================================================
   1. НАСТРОЙКИ SUPABASE
   ============================================================ */

const SUPABASE_URL =
  'https://fqcltmxiarohfpfnghjn.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_PqjH12Cbf7Fw9CWxvTPHaQ_MYYq7HQT';


/* ============================================================
   2. ЛОКАЛЬНЫЕ КЛЮЧИ
   Нужны только для переноса старых данных и уведомлений.
   Основная база теперь — Supabase.
   ============================================================ */

const LEGACY_STORAGE_KEY =
  'jambalance_planner_leads_v1';

const MIGRATION_DISMISSED_KEY =
  'jambalance_planner_migration_dismissed_v2';

const MIGRATION_DONE_KEY =
  'jambalance_planner_migration_done_v2';

const NOTIFICATION_HISTORY_KEY =
  'jambalance_planner_notifications_v2';


/* ============================================================
   3. СПРАВОЧНИКИ
   ============================================================ */

const CLOSED_STATUSES = new Set([
  'client',
  'lost'
]);

const STATUS_META = {
  new: {
    label: 'Новый лид',
    className: 'status-new'
  },

  contacted: {
    label: 'Связались',
    className: 'status-contacted'
  },

  callback: {
    label: 'Назначен контакт',
    className: 'status-callback'
  },

  transition: {
    label: 'Готовим переход',
    className: 'status-transition'
  },

  contract: {
    label: 'Заключаем договор',
    className: 'status-contract'
  },

  client: {
    label: 'Стал клиентом',
    className: 'status-client'
  },

  paused: {
    label: 'Отложен',
    className: 'status-paused'
  },

  lost: {
    label: 'Неактуально',
    className: 'status-lost'
  }
};

const PRIORITY_META = {
  high: {
    label: 'Высокий',
    className: 'priority-high',
    order: 1
  },

  medium: {
    label: 'Средний',
    className: 'priority-medium',
    order: 2
  },

  low: {
    label: 'Низкий',
    className: 'priority-low',
    order: 3
  },

  none: {
    label: 'Не указан',
    className: 'priority-none',
    order: 4
  }
};

const METHOD_META = {
  phone: 'Телефон',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  max: 'MAX',
  email: 'E-mail',
  meeting: 'Личная встреча',
  other: 'Другое'
};


/* ============================================================
   4. ЭЛЕМЕНТЫ СТРАНИЦЫ
   ============================================================ */

const elements = {
  loadingScreen:
    document.getElementById('loadingScreen'),

  loadingText:
    document.getElementById('loadingText'),

  userAvatar:
    document.getElementById('userAvatar'),

  userName:
    document.getElementById('userName'),

  userEmail:
    document.getElementById('userEmail'),

  addLeadBtn:
    document.getElementById('addLeadBtn'),

  notificationBtn:
    document.getElementById('notificationBtn'),

  notificationNote:
    document.getElementById('notificationNote'),

  migrationPanel:
    document.getElementById('migrationPanel'),

  migrateBtn:
    document.getElementById('migrateBtn'),

  skipMigrationBtn:
    document.getElementById('skipMigrationBtn'),

  statActive:
    document.getElementById('statActive'),

  statToday:
    document.getElementById('statToday'),

  statWeek:
    document.getElementById('statWeek'),

  statOverdue:
    document.getElementById('statOverdue'),

  statNoDate:
    document.getElementById('statNoDate'),

  searchInput:
    document.getElementById('searchInput'),

  statusFilter:
    document.getElementById('statusFilter'),

  priorityFilter:
    document.getElementById('priorityFilter'),

  dateFilter:
    document.getElementById('dateFilter'),

  sortSelect:
    document.getElementById('sortSelect'),

  resetFiltersBtn:
    document.getElementById('resetFiltersBtn'),

  refreshBtn:
    document.getElementById('refreshBtn'),

  exportBtn:
    document.getElementById('exportBtn'),

  visibleCount:
    document.getElementById('visibleCount'),

  leadTableBody:
    document.getElementById('leadTableBody'),

  modalBackdrop:
    document.getElementById('modalBackdrop'),

  modalTitle:
    document.getElementById('modalTitle'),

  closeModalBtn:
    document.getElementById('closeModalBtn'),

  cancelBtn:
    document.getElementById('cancelBtn'),

  saveLeadBtn:
    document.getElementById('saveLeadBtn'),

  leadForm:
    document.getElementById('leadForm'),

  leadId:
    document.getElementById('leadId'),

  clientName:
    document.getElementById('clientName'),

  orgForm:
    document.getElementById('orgForm'),

  inn:
    document.getElementById('inn'),

  activity:
    document.getElementById('activity'),

  source:
    document.getElementById('source'),

  phone:
    document.getElementById('phone'),

  email:
    document.getElementById('email'),

  communicationMethod:
    document.getElementById('communicationMethod'),

  estimatedAmount:
    document.getElementById('estimatedAmount'),

  priority:
    document.getElementById('priority'),

  status:
    document.getElementById('status'),

  nextContact:
    document.getElementById('nextContact'),

  lastDialogue:
    document.getElementById('lastDialogue'),

  nextStep:
    document.getElementById('nextStep'),

  notes:
    document.getElementById('notes'),

  toastStack:
    document.getElementById('toastStack')
};


/* ============================================================
   5. СОСТОЯНИЕ ПРИЛОЖЕНИЯ
   ============================================================ */

const state = {
  search: '',
  status: 'all',
  priority: 'all',
  date: 'all',
  sort: 'nearest'
};

let supabaseClient = null;

let currentUser = null;

let currentProfile = null;

let leads = [];

let realtimeChannel = null;

let isLoadingLeads = false;

let saveInProgress = false;


/* ============================================================
   6. БАЗОВЫЕ УТИЛИТЫ
   ============================================================ */

function cleanText(value, maxLength = 5000) {
  return String(value ?? '')
    .trim()
    .slice(0, maxLength);
}

function normalizeSearch(value) {
  return String(value ?? '')
    .toLocaleLowerCase('ru-RU')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function padNumber(value) {
  return String(value).padStart(2, '0');
}

function isValidDate(date) {
  return (
    date instanceof Date &&
    !Number.isNaN(date.getTime())
  );
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function pluralizeDays(value) {
  const number = Math.abs(value) % 100;
  const lastDigit = number % 10;

  if (
    number >= 11 &&
    number <= 19
  ) {
    return 'дней';
  }

  if (lastDigit === 1) {
    return 'день';
  }

  if (
    lastDigit >= 2 &&
    lastDigit <= 4
  ) {
    return 'дня';
  }

  return 'дней';
}

function getInitials(name, email) {
  const source =
    cleanText(name, 200) ||
    cleanText(email, 200).split('@')[0] ||
    'Д';

  const parts =
    source
      .split(/\s+/)
      .filter(Boolean);

  if (parts.length >= 2) {
    return (
      parts[0][0] +
      parts[1][0]
    ).toLocaleUpperCase('ru-RU');
  }

  return source
    .slice(0, 2)
    .toLocaleUpperCase('ru-RU');
}

function getDisplayName(lead) {
  const name =
    cleanText(lead.client_name, 180);

  const form =
    cleanText(lead.org_form, 80);

  if (!form) {
    return name;
  }

  const normalizedName =
    normalizeSearch(name);

  const normalizedForm =
    normalizeSearch(form);

  if (
    normalizedName === normalizedForm ||
    normalizedName.startsWith(
      normalizedForm + ' '
    )
  ) {
    return name;
  }

  return form + ' ' + name;
}

function isClosed(lead) {
  return CLOSED_STATUSES.has(
    lead.status
  );
}


/* ============================================================
   7. ДАТЫ
   ============================================================ */

function toLocalDateTimeInput(value) {
  if (!value) {
    return '';
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (!isValidDate(date)) {
    return '';
  }

  return (
    date.getFullYear() +
    '-' +
    padNumber(date.getMonth() + 1) +
    '-' +
    padNumber(date.getDate()) +
    'T' +
    padNumber(date.getHours()) +
    ':' +
    padNumber(date.getMinutes())
  );
}

function toDatabaseTimestamp(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (!isValidDate(date)) {
    return null;
  }

  return date.toISOString();
}

function getLocalDayNumber(date) {
  return (
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ) / 86400000
  );
}

function getDayDifference(value) {
  if (!value) {
    return null;
  }

  const target =
    new Date(value);

  if (!isValidDate(target)) {
    return null;
  }

  const today =
    new Date();

  return (
    getLocalDayNumber(target) -
    getLocalDayNumber(today)
  );
}

function formatContactDate(value) {
  if (!value) {
    return 'Не назначен';
  }

  const date =
    new Date(value);

  if (!isValidDate(date)) {
    return 'Не назначен';
  }

  return new Intl.DateTimeFormat(
    'ru-RU',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(date);
}

function getDueInfo(lead) {
  if (!lead.next_contact) {
    return {
      type: 'no-date',
      rowClass: '',
      label: 'Дата не назначена',
      dateText: 'Не назначен'
    };
  }

  const date =
    new Date(lead.next_contact);

  if (!isValidDate(date)) {
    return {
      type: 'no-date',
      rowClass: '',
      label: 'Дата не назначена',
      dateText: 'Не назначен'
    };
  }

  const difference =
    getDayDifference(
      lead.next_contact
    );

  const time =
    new Intl.DateTimeFormat(
      'ru-RU',
      {
        hour: '2-digit',
        minute: '2-digit'
      }
    ).format(date);

  const dateText =
    formatContactDate(
      lead.next_contact
    );

  if (difference < 0) {
    const days =
      Math.abs(difference);

    return {
      type: 'overdue',
      rowClass: 'row-overdue',
      label:
        'Просрочено на ' +
        days +
        ' ' +
        pluralizeDays(days),
      dateText
    };
  }

  if (difference === 0) {
    return {
      type: 'today',
      rowClass: 'row-today',
      label:
        'Сегодня, ' + time,
      dateText
    };
  }

  if (difference === 1) {
    return {
      type: 'soon',
      rowClass: 'row-soon',
      label:
        'Завтра, ' + time,
      dateText
    };
  }

  if (difference <= 7) {
    return {
      type: 'soon',
      rowClass: 'row-soon',
      label:
        'Через ' +
        difference +
        ' ' +
        pluralizeDays(difference),
      dateText
    };
  }

  return {
    type: 'future',
    rowClass: '',
    label:
      'Через ' +
      difference +
      ' ' +
      pluralizeDays(difference),
    dateText
  };
}


/* ============================================================
   8. TOAST
   ============================================================ */

function showToast(
  message,
  type = 'success',
  duration = 4200
) {
  const toast =
    document.createElement('div');

  toast.className =
    'toast ' + type;

  toast.textContent =
    message;

  elements.toastStack
    .appendChild(toast);

  window.setTimeout(
    () => {
      toast.remove();
    },
    duration
  );
}


/* ============================================================
   9. ЗАГРУЗОЧНЫЙ ЭКРАН
   ============================================================ */

function setLoadingText(text) {
  if (elements.loadingText) {
    elements.loadingText.textContent =
      text;
  }
}

function showApplication() {
  document.body.classList.add(
    'ready'
  );

  elements.loadingScreen
    .classList.add('hidden');
}

function redirectToLogin() {
  window.location.replace(
    '../index.html'
  );
}

function showFatalError(message) {
  elements.loadingScreen
    .classList.remove('hidden');

  elements.loadingScreen.innerHTML = `
    <div class="loadingCard">
      <img
        class="loadingLogo"
        src="/favicon.png"
        alt=""
      >

      <div
        style="
          color:#c4473d;
          font-size:18px;
          font-weight:900;
          margin-bottom:10px;
        "
      >
        Не удалось открыть планировщик
      </div>

      <div
        style="
          color:#6b7280;
          font-size:13px;
          line-height:1.55;
          margin-bottom:18px;
        "
      >
        ${escapeHtml(message)}
      </div>

      <a
        href="../index.html"
        style="
          display:inline-block;
          padding:11px 15px;
          border-radius:12px;
          color:white;
          background:#f99303;
          text-decoration:none;
          font-weight:800;
        "
      >
        Вернуться на главную
      </a>
    </div>
  `;
}


/* ============================================================
   10. SUPABASE
   ============================================================ */

function createSupabaseClient() {
  if (
    !window.supabase ||
    typeof window.supabase.createClient !==
      'function'
  ) {
    throw new Error(
      'Не загрузилась библиотека Supabase.'
    );
  }

  supabaseClient =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
}


/* ============================================================
   11. АВТОРИЗАЦИЯ
   ============================================================ */

async function ensureAuthenticated() {
  setLoadingText(
    'Проверяем авторизацию…'
  );

  const {
    data,
    error
  } =
    await supabaseClient.auth
      .getSession();

  if (error) {
    throw error;
  }

  const session =
    data?.session;

  if (!session?.user) {
    redirectToLogin();

    return false;
  }

  currentUser =
    session.user;

  return true;
}

async function loadCurrentProfile() {
  setLoadingText(
    'Загружаем профиль сотрудника…'
  );

  const {
    data,
    error
  } =
    await supabaseClient
      .from('profiles')
      .select(
        'id, full_name, email, position, role, is_active'
      )
      .eq(
        'id',
        currentUser.id
      )
      .maybeSingle();

  if (error) {
    console.warn(
      'Не удалось загрузить профиль:',
      error
    );
  }

  if (
    data &&
    data.is_active === false
  ) {
    await supabaseClient.auth
      .signOut();

    redirectToLogin();

    return false;
  }

  currentProfile =
    data || {
      id: currentUser.id,
      full_name:
        currentUser.user_metadata
          ?.full_name ||
        currentUser.email
          ?.split('@')[0] ||
        'Сотрудник',

      email:
        currentUser.email || ''
    };

  renderCurrentUser();

  return true;
}

function renderCurrentUser() {
  const name =
    cleanText(
      currentProfile?.full_name,
      200
    ) ||
    currentUser?.email
      ?.split('@')[0] ||
    'Сотрудник';

  const email =
    cleanText(
      currentProfile?.email,
      200
    ) ||
    currentUser?.email ||
    '';

  elements.userName.textContent =
    name;

  elements.userEmail.textContent =
    email;

  elements.userAvatar.textContent =
    getInitials(
      name,
      email
    );
}


/* ============================================================
   12. ЗАГРУЗКА ЛИДОВ
   ============================================================ */

async function loadLeads({
  silent = false
} = {}) {
  if (isLoadingLeads) {
    return;
  }

  isLoadingLeads = true;

  if (!silent) {
    elements.refreshBtn.disabled =
      true;

    elements.refreshBtn.textContent =
      'Обновляем…';
  }

  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .from('planner_leads')
        .select('*')
        .order(
          'created_at',
          {
            ascending: false
          }
        );

    if (error) {
      throw error;
    }

    leads =
      Array.isArray(data)
        ? data
        : [];

    render();

    checkTodayNotifications();
  } catch (error) {
    console.error(
      'Ошибка загрузки лидов:',
      error
    );

    showToast(
      'Не удалось загрузить общую таблицу.',
      'error'
    );
  } finally {
    isLoadingLeads = false;

    if (!silent) {
      elements.refreshBtn.disabled =
        false;

      elements.refreshBtn.textContent =
        '↻ Обновить';
    }
  }
}


/* ============================================================
   13. ПОИСК И ФИЛЬТРАЦИЯ
   ============================================================ */

function getSearchText(lead) {
  return normalizeSearch(
    [
      lead.client_name,
      lead.org_form,
      lead.inn,
      lead.activity,
      lead.source,
      lead.phone,
      lead.email,
      METHOD_META[
        lead.communication_method
      ],
      lead.estimated_amount,
      PRIORITY_META[
        lead.priority
      ]?.label,
      STATUS_META[
        lead.status
      ]?.label,
      lead.last_dialogue,
      lead.next_step,
      lead.notes
    ].join(' ')
  );
}

function matchesDateFilter(lead) {
  if (state.date === 'all') {
    return true;
  }

  if (state.date === 'closed') {
    return isClosed(lead);
  }

  if (isClosed(lead)) {
    return false;
  }

  const difference =
    getDayDifference(
      lead.next_contact
    );

  if (state.date === 'nodate') {
    return difference === null;
  }

  if (difference === null) {
    return false;
  }

  if (state.date === 'today') {
    return difference === 0;
  }

  if (state.date === 'week') {
    return (
      difference >= 0 &&
      difference <= 7
    );
  }

  if (state.date === 'overdue') {
    return difference < 0;
  }

  if (state.date === 'future') {
    return difference > 0;
  }

  return true;
}

function getVisibleLeads() {
  const search =
    normalizeSearch(
      state.search
    );

  const filtered =
    leads.filter(
      (lead) => {
        if (
          search &&
          !getSearchText(lead)
            .includes(search)
        ) {
          return false;
        }

        if (
          state.status !== 'all' &&
          lead.status !==
            state.status
        ) {
          return false;
        }

        if (
          state.priority !== 'all' &&
          (
            lead.priority ||
            'none'
          ) !==
            state.priority
        ) {
          return false;
        }

        return matchesDateFilter(
          lead
        );
      }
    );

  return sortLeads(filtered);
}


/* ============================================================
   14. СОРТИРОВКА
   ============================================================ */

function sortLeads(items) {
  const copy = [...items];

  if (state.sort === 'name') {
    return copy.sort(
      (a, b) =>
        getDisplayName(a)
          .localeCompare(
            getDisplayName(b),
            'ru',
            {
              sensitivity: 'base'
            }
          )
    );
  }

  if (state.sort === 'newest') {
    return copy.sort(
      (a, b) =>
        new Date(
          b.created_at || 0
        ).getTime() -
        new Date(
          a.created_at || 0
        ).getTime()
    );
  }

  if (state.sort === 'updated') {
    return copy.sort(
      (a, b) =>
        new Date(
          b.updated_at || 0
        ).getTime() -
        new Date(
          a.updated_at || 0
        ).getTime()
    );
  }

  if (state.sort === 'priority') {
    return copy.sort(
      (a, b) => {
        const aPriority =
          PRIORITY_META[
            a.priority || 'none'
          ]?.order || 4;

        const bPriority =
          PRIORITY_META[
            b.priority || 'none'
          ]?.order || 4;

        if (
          aPriority !== bPriority
        ) {
          return (
            aPriority -
            bPriority
          );
        }

        const aDate =
          a.next_contact
            ? new Date(
                a.next_contact
              ).getTime()
            : Number.MAX_SAFE_INTEGER;

        const bDate =
          b.next_contact
            ? new Date(
                b.next_contact
              ).getTime()
            : Number.MAX_SAFE_INTEGER;

        return aDate - bDate;
      }
    );
  }

  /*
   * Основная сортировка:
   *
   * 1. Активные записи раньше закрытых.
   * 2. Записи с датой раньше записей без даты.
   * 3. Ближайшая дата выше.
   * 4. При одинаковой дате — более высокий приоритет.
   */

  return copy.sort(
    (a, b) => {
      const aClosed =
        isClosed(a);

      const bClosed =
        isClosed(b);

      if (
        aClosed !== bClosed
      ) {
        return aClosed ? 1 : -1;
      }

      const aHasDate =
        Boolean(
          a.next_contact
        );

      const bHasDate =
        Boolean(
          b.next_contact
        );

      if (
        aHasDate !== bHasDate
      ) {
        return aHasDate
          ? -1
          : 1;
      }

      if (
        aHasDate &&
        bHasDate
      ) {
        const difference =
          new Date(
            a.next_contact
          ).getTime() -
          new Date(
            b.next_contact
          ).getTime();

        if (difference !== 0) {
          return difference;
        }
      }

      const priorityDifference =
        (
          PRIORITY_META[
            a.priority || 'none'
          ]?.order || 4
        ) -
        (
          PRIORITY_META[
            b.priority || 'none'
          ]?.order || 4
        );

      if (
        priorityDifference !== 0
      ) {
        return priorityDifference;
      }

      return getDisplayName(a)
        .localeCompare(
          getDisplayName(b),
          'ru',
          {
            sensitivity: 'base'
          }
        );
    }
  );
}


/* ============================================================
   15. СТАТИСТИКА
   ============================================================ */

function renderStatistics() {
  const active =
    leads.filter(
      (lead) =>
        !isClosed(lead)
    );

  const today =
    active.filter(
      (lead) =>
        getDayDifference(
          lead.next_contact
        ) === 0
    ).length;

  const week =
    active.filter(
      (lead) => {
        const difference =
          getDayDifference(
            lead.next_contact
          );

        return (
          difference !== null &&
          difference >= 0 &&
          difference <= 7
        );
      }
    ).length;

  const overdue =
    active.filter(
      (lead) => {
        const difference =
          getDayDifference(
            lead.next_contact
          );

        return (
          difference !== null &&
          difference < 0
        );
      }
    ).length;

  const noDate =
    active.filter(
      (lead) =>
        !lead.next_contact
    ).length;

  elements.statActive.textContent =
    String(active.length);

  elements.statToday.textContent =
    String(today);

  elements.statWeek.textContent =
    String(week);

  elements.statOverdue.textContent =
    String(overdue);

  elements.statNoDate.textContent =
    String(noDate);
}


/* ============================================================
   16. РЕНДЕР ТАБЛИЦЫ
   ============================================================ */

function createLeadRowHtml(lead) {
  const due =
    getDueInfo(lead);

  const status =
    STATUS_META[
      lead.status
    ] ||
    STATUS_META.new;

  const priority =
    PRIORITY_META[
      lead.priority || 'none'
    ] ||
    PRIORITY_META.none;

  const classes = [];

  if (isClosed(lead)) {
    classes.push(
      'row-closed'
    );
  } else if (
    due.rowClass
  ) {
    classes.push(
      due.rowClass
    );
  }

  const contacts = [];

  if (lead.phone) {
    const phoneHref =
      cleanText(
        lead.phone,
        100
      ).replace(
        /[^\d+]/g,
        ''
      );

    contacts.push(`
      <a
        class="contactLink"
        href="tel:${escapeHtml(phoneHref)}"
      >
        ${escapeHtml(lead.phone)}
      </a>
    `);
  }

  if (lead.email) {
    contacts.push(`
      <a
        class="contactLink"
        href="mailto:${escapeHtml(lead.email)}"
      >
        ${escapeHtml(lead.email)}
      </a>
    `);
  }

  const dialogue = [];

  if (lead.last_dialogue) {
    dialogue.push(`
      <div class="dialogueBlock">
        <span class="dialogueLabel">
          Предыдущий диалог
        </span>

        <div class="dialogueText">
          ${escapeHtml(lead.last_dialogue)}
        </div>
      </div>
    `);
  }

  if (lead.next_step) {
    dialogue.push(`
      <div class="dialogueBlock">
        <span class="dialogueLabel">
          Следующий шаг
        </span>

        <div class="dialogueText">
          ${escapeHtml(lead.next_step)}
        </div>
      </div>
    `);
  }

  const business = [];

  if (lead.source) {
    business.push(`
      <div class="clientMeta">
        Канал:
        ${escapeHtml(lead.source)}
      </div>
    `);
  }

  if (lead.activity) {
    business.push(`
      <div class="activity">
        ${escapeHtml(lead.activity)}
      </div>
    `);
  }

  const methodLabel =
    METHOD_META[
      lead.communication_method
    ];

  return `
    <tr class="${classes.join(' ')}">

      <td>
        <div class="clientName">
          ${escapeHtml(
            getDisplayName(lead)
          )}
        </div>

        <div class="clientMeta">
          ${
            lead.inn
              ? 'ИНН: ' +
                escapeHtml(
                  lead.inn
                )
              : 'ИНН не указан'
          }
        </div>
      </td>

      <td>
        ${
          business.length
            ? business.join('')
            : '<span class="muted">Не указано</span>'
        }
      </td>

      <td>
        ${
          contacts.length
            ? contacts.join('')
            : '<span class="muted">Не указаны</span>'
        }
      </td>

      <td>
        ${
          methodLabel
            ? `
              <span class="pill methodPill">
                ${escapeHtml(methodLabel)}
              </span>
            `
            : '<span class="muted">Не указан</span>'
        }
      </td>

      <td>
        ${
          lead.estimated_amount
            ? `
              <div class="amount">
                ${escapeHtml(
                  lead.estimated_amount
                )}
              </div>
            `
            : '<span class="muted">Не указана</span>'
        }
      </td>

      <td>
        <span
          class="pill ${escapeHtml(
            priority.className
          )}"
        >
          <span class="priorityDot"></span>

          ${escapeHtml(
            priority.label
          )}
        </span>
      </td>

      <td>
        <div class="dateMain">
          ${escapeHtml(
            due.dateText
          )}
        </div>

        <span
          class="dateBadge ${escapeHtml(
            due.type
          )}"
        >
          ${escapeHtml(
            due.label
          )}
        </span>
      </td>

      <td>
        <span
          class="pill ${escapeHtml(
            status.className
          )}"
        >
          ${escapeHtml(
            status.label
          )}
        </span>
      </td>

      <td>
        ${
          dialogue.length
            ? dialogue.join('')
            : '<span class="muted">Не заполнено</span>'
        }
      </td>

      <td>
        ${
          lead.notes
            ? `
              <div class="notesText">
                ${escapeHtml(
                  lead.notes
                )}
              </div>
            `
            : '<span class="muted">Нет примечаний</span>'
        }
      </td>

      <td>
        <div class="rowActions">

          <button
            class="tableButton"
            type="button"
            data-action="edit"
            data-id="${escapeHtml(
              lead.id
            )}"
          >
            Изменить
          </button>

          <button
            class="tableButton delete"
            type="button"
            data-action="delete"
            data-id="${escapeHtml(
              lead.id
            )}"
          >
            Удалить
          </button>

        </div>
      </td>

    </tr>
  `;
}

function renderTable() {
  const visible =
    getVisibleLeads();

  elements.visibleCount.textContent =
    'Показано: ' +
    visible.length +
    ' из ' +
    leads.length;

  if (
    visible.length === 0
  ) {
    elements.leadTableBody.innerHTML = `
      <tr>
        <td
          class="emptyCell"
          colspan="11"
        >
          <div class="emptyTitle">
            Записей не найдено
          </div>

          <div class="emptyText">
            Измените фильтры или добавьте нового
            потенциального клиента.
          </div>
        </td>
      </tr>
    `;

    return;
  }

  elements.leadTableBody.innerHTML =
    visible
      .map(
        createLeadRowHtml
      )
      .join('');
}

function render() {
  renderStatistics();
  renderTable();
}


/* ============================================================
   17. ФОРМА
   ============================================================ */

function resetLeadForm() {
  elements.leadForm.reset();

  elements.leadId.value =
    '';

  elements.priority.value =
    'none';

  elements.status.value =
    'new';

  elements.communicationMethod.value =
    '';
}

function openLeadModal(
  lead = null
) {
  resetLeadForm();

  if (lead) {
    elements.modalTitle.textContent =
      'Редактирование клиента';

    elements.leadId.value =
      lead.id;

    elements.clientName.value =
      lead.client_name || '';

    elements.orgForm.value =
      lead.org_form || '';

    elements.inn.value =
      lead.inn || '';

    elements.activity.value =
      lead.activity || '';

    elements.source.value =
      lead.source || '';

    elements.phone.value =
      lead.phone || '';

    elements.email.value =
      lead.email || '';

    elements.communicationMethod.value =
      lead.communication_method || '';

    elements.estimatedAmount.value =
      lead.estimated_amount || '';

    elements.priority.value =
      lead.priority || 'none';

    elements.status.value =
      lead.status || 'new';

    elements.nextContact.value =
      toLocalDateTimeInput(
        lead.next_contact
      );

    elements.lastDialogue.value =
      lead.last_dialogue || '';

    elements.nextStep.value =
      lead.next_step || '';

    elements.notes.value =
      lead.notes || '';
  } else {
    elements.modalTitle.textContent =
      'Новый потенциальный клиент';
  }

  elements.modalBackdrop
    .classList.add('show');

  document.body
    .classList.add(
      'modal-open'
    );

  window.setTimeout(
    () => {
      elements.clientName
        .focus();
    },
    40
  );
}

function closeLeadModal() {
  elements.modalBackdrop
    .classList.remove('show');

  document.body
    .classList.remove(
      'modal-open'
    );

  resetLeadForm();
}

function collectLeadFormData() {
  return {
    client_name:
      cleanText(
        elements.clientName.value,
        180
      ),

    org_form:
      cleanText(
        elements.orgForm.value,
        80
      ) || null,

    inn:
      cleanText(
        elements.inn.value,
        20
      ) || null,

    activity:
      cleanText(
        elements.activity.value,
        180
      ) || null,

    source:
      cleanText(
        elements.source.value,
        140
      ) || null,

    phone:
      cleanText(
        elements.phone.value,
        80
      ) || null,

    email:
      cleanText(
        elements.email.value,
        180
      ) || null,

    communication_method:
      elements.communicationMethod
        .value || null,

    estimated_amount:
      cleanText(
        elements.estimatedAmount.value,
        120
      ) || null,

    priority:
      elements.priority.value ||
      'none',

    status:
      elements.status.value ||
      'new',

    next_contact:
      toDatabaseTimestamp(
        elements.nextContact.value
      ),

    last_dialogue:
      cleanText(
        elements.lastDialogue.value,
        3000
      ) || null,

    next_step:
      cleanText(
        elements.nextStep.value,
        2000
      ) || null,

    notes:
      cleanText(
        elements.notes.value,
        3000
      ) || null
  };
}


/* ============================================================
   18. СОХРАНЕНИЕ
   ============================================================ */

async function handleLeadSubmit(
  event
) {
  event.preventDefault();

  if (saveInProgress) {
    return;
  }

  const payload =
    collectLeadFormData();

  if (!payload.client_name) {
    showToast(
      'Укажите имя или название клиента.',
      'warning'
    );

    elements.clientName.focus();

    return;
  }

  saveInProgress = true;

  elements.saveLeadBtn.disabled =
    true;

  elements.saveLeadBtn.textContent =
    'Сохраняем…';

  const leadId =
    cleanText(
      elements.leadId.value,
      100
    );

  const existingLead =
    leadId
      ? leads.find(
          (lead) =>
            lead.id === leadId
        )
      : null;

  try {
    if (existingLead) {
      payload.updated_by =
        currentUser.id;

      const {
        data,
        error
      } =
        await supabaseClient
          .from('planner_leads')
          .update(payload)
          .eq(
            'id',
            existingLead.id
          )
          .select()
          .single();

      if (error) {
        throw error;
      }

      upsertLeadLocally(data);

      await recordLeadActivity({
        leadId: data.id,
        type: 'note',
        text:
          'Карточка потенциального клиента обновлена.'
      });

      render();

      closeLeadModal();

      showToast(
        'Запись обновлена.',
        'success'
      );
    } else {
      payload.created_by =
        currentUser.id;

      payload.updated_by =
        currentUser.id;

      /*
       * Если пока не назначен отдельный ответственный,
       * автоматически назначаем сотрудника,
       * который создал запись.
       */
      payload.responsible_user =
        currentUser.id;

      const {
        data,
        error
      } =
        await supabaseClient
          .from('planner_leads')
          .insert(payload)
          .select()
          .single();

      if (error) {
        throw error;
      }

      upsertLeadLocally(data);

      await recordLeadActivity({
        leadId: data.id,
        type: 'note',
        text:
          'Потенциальный клиент добавлен в планировщик.'
      });

      render();

      closeLeadModal();

      showToast(
        'Потенциальный клиент добавлен.',
        'success'
      );
    }

    checkTodayNotifications();
  } catch (error) {
    console.error(
      'Ошибка сохранения:',
      error
    );

    showToast(
      getFriendlyDatabaseError(
        error
      ),
      'error',
      6000
    );
  } finally {
    saveInProgress = false;

    elements.saveLeadBtn.disabled =
      false;

    elements.saveLeadBtn.textContent =
      'Сохранить запись';
  }
}

function upsertLeadLocally(
  lead
) {
  if (!lead?.id) {
    return;
  }

  const index =
    leads.findIndex(
      (item) =>
        item.id === lead.id
    );

  if (index >= 0) {
    leads[index] =
      lead;
  } else {
    leads.push(
      lead
    );
  }
}


/* ============================================================
   19. ИСТОРИЯ ДЕЙСТВИЙ
   ============================================================ */

async function recordLeadActivity({
  leadId,
  type = 'note',
  text
}) {
  if (
    !leadId ||
    !text ||
    !currentUser
  ) {
    return;
  }

  try {
    const {
      error
    } =
      await supabaseClient
        .from('lead_activities')
        .insert({
          lead_id: leadId,
          activity_type: type,
          activity_text: text,
          author_id:
            currentUser.id
        });

    if (error) {
      console.warn(
        'Не удалось записать историю:',
        error
      );
    }
  } catch (error) {
    console.warn(
      'Ошибка истории:',
      error
    );
  }
}


/* ============================================================
   20. РЕДАКТИРОВАНИЕ И УДАЛЕНИЕ
   ============================================================ */

function editLead(id) {
  const lead =
    leads.find(
      (item) =>
        item.id === id
    );

  if (!lead) {
    showToast(
      'Запись уже была изменена или удалена.',
      'warning'
    );

    loadLeads({
      silent: true
    });

    return;
  }

  openLeadModal(lead);
}

async function deleteLead(id) {
  const lead =
    leads.find(
      (item) =>
        item.id === id
    );

  if (!lead) {
    return;
  }

  const confirmed =
    window.confirm(
      'Удалить запись «' +
      getDisplayName(lead) +
      '»?\n\nЭто действие нельзя отменить.'
    );

  if (!confirmed) {
    return;
  }

  try {
    const {
      error
    } =
      await supabaseClient
        .from('planner_leads')
        .delete()
        .eq(
          'id',
          id
        );

    if (error) {
      throw error;
    }

    leads =
      leads.filter(
        (item) =>
          item.id !== id
      );

    render();

    showToast(
      'Запись удалена.',
      'success'
    );
  } catch (error) {
    console.error(
      'Ошибка удаления:',
      error
    );

    showToast(
      getFriendlyDatabaseError(
        error
      ),
      'error'
    );
  }
}


/* ============================================================
   21. ОШИБКИ БАЗЫ
   ============================================================ */

function getFriendlyDatabaseError(
  error
) {
  const message =
    String(
      error?.message ||
      ''
    ).toLocaleLowerCase(
      'ru-RU'
    );

  if (
    message.includes(
      'jwt'
    ) ||
    message.includes(
      'authentication'
    )
  ) {
    return (
      'Сессия входа устарела. ' +
      'Вернитесь на главную страницу и войдите снова.'
    );
  }

  if (
    message.includes(
      'row-level security'
    )
  ) {
    return (
      'Supabase не разрешил это действие. ' +
      'Проверьте авторизацию пользователя.'
    );
  }

  if (
    message.includes(
      'failed to fetch'
    ) ||
    message.includes(
      'network'
    )
  ) {
    return (
      'Нет связи с общей базой. ' +
      'Проверьте интернет и попробуйте снова.'
    );
  }

  return (
    'Не удалось выполнить операцию с общей базой.'
  );
}


/* ============================================================
   22. REALTIME
   ============================================================ */

function subscribeToRealtime() {
  if (realtimeChannel) {
    supabaseClient
      .removeChannel(
        realtimeChannel
      );
  }

  realtimeChannel =
    supabaseClient
      .channel(
        'jambalance-planner-leads'
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'planner_leads'
        },
        handleRealtimeInsert
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'planner_leads'
        },
        handleRealtimeUpdate
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'planner_leads'
        },
        handleRealtimeDelete
      )
      .subscribe(
        (status) => {
          if (
            status ===
            'SUBSCRIBED'
          ) {
            console.log(
              'Planner Realtime подключён.'
            );
          }

          if (
            status ===
              'CHANNEL_ERROR' ||
            status ===
              'TIMED_OUT'
          ) {
            console.warn(
              'Проблема Realtime:',
              status
            );
          }
        }
      );
}

function handleRealtimeInsert(
  payload
) {
  const lead =
    payload.new;

  if (!lead?.id) {
    return;
  }

  /*
   * Если запись уже есть локально,
   * просто заменяем её.
   */
  const existed =
    leads.some(
      (item) =>
        item.id === lead.id
    );

  upsertLeadLocally(
    lead
  );

  render();

  if (!existed) {
    showToast(
      'В общей таблице появилась новая запись.',
      'success'
    );
  }

  checkTodayNotifications();
}

function handleRealtimeUpdate(
  payload
) {
  const lead =
    payload.new;

  if (!lead?.id) {
    return;
  }

  upsertLeadLocally(
    lead
  );

  render();

  checkTodayNotifications();
}

function handleRealtimeDelete(
  payload
) {
  const id =
    payload.old?.id;

  if (!id) {
    /*
     * Если Supabase не передал старый ID,
     * просто перечитаем таблицу.
     */
    loadLeads({
      silent: true
    });

    return;
  }

  leads =
    leads.filter(
      (item) =>
        item.id !== id
    );

  render();
}


/* ============================================================
   23. ФИЛЬТРЫ
   ============================================================ */

function resetFilters() {
  state.search = '';
  state.status = 'all';
  state.priority = 'all';
  state.date = 'all';
  state.sort = 'nearest';

  elements.searchInput.value =
    '';

  elements.statusFilter.value =
    'all';

  elements.priorityFilter.value =
    'all';

  elements.dateFilter.value =
    'all';

  elements.sortSelect.value =
    'nearest';

  renderTable();
}


/* ============================================================
   24. ЭКСПОРТ
   ============================================================ */

function downloadBlob(
  blob,
  fileName
) {
  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement('a');

  link.href = url;
  link.download = fileName;

  document.body
    .appendChild(link);

  link.click();
  link.remove();

  window.setTimeout(
    () => {
      URL.revokeObjectURL(
        url
      );
    },
    1000
  );
}

function exportBackup() {
  const payload = {
    application:
      'ДжемБаланс — планировщик',

    version:
      '2.0',

    exportedAt:
      new Date().toISOString(),

    exportedBy:
      currentUser?.email ||
      null,

    leads
  };

  const blob =
    new Blob(
      [
        JSON.stringify(
          payload,
          null,
          2
        )
      ],
      {
        type:
          'application/json;charset=utf-8'
      }
    );

  const today =
    new Date();

  const fileName =
    'jambalance-planner-' +
    today.getFullYear() +
    '-' +
    padNumber(
      today.getMonth() + 1
    ) +
    '-' +
    padNumber(
      today.getDate()
    ) +
    '.json';

  downloadBlob(
    blob,
    fileName
  );

  showToast(
    'Резервная копия скачана.',
    'success'
  );
}


/* ============================================================
   25. ПЕРЕНОС СТАРЫХ LOCALSTORAGE-ДАННЫХ
   ============================================================ */

function getLegacyLeads() {
  try {
    const raw =
      localStorage.getItem(
        LEGACY_STORAGE_KEY
      );

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item) =>
        cleanText(
          item?.clientName,
          180
        )
    );
  } catch (error) {
    console.warn(
      'Не удалось прочитать старый localStorage:',
      error
    );

    return [];
  }
}

function checkLegacyMigration() {
  const migrated =
    localStorage.getItem(
      MIGRATION_DONE_KEY
    ) === '1';

  const dismissed =
    localStorage.getItem(
      MIGRATION_DISMISSED_KEY
    ) === '1';

  if (
    migrated ||
    dismissed
  ) {
    elements.migrationPanel
      .classList.remove(
        'show'
      );

    return;
  }

  const legacy =
    getLegacyLeads();

  if (
    legacy.length > 0
  ) {
    elements.migrationPanel
      .classList.add(
        'show'
      );

    elements.migrateBtn.textContent =
      'Перенести ' +
      legacy.length +
      ' ' +
      pluralizeRecords(
        legacy.length
      );
  } else {
    elements.migrationPanel
      .classList.remove(
        'show'
      );
  }
}

function pluralizeRecords(
  value
) {
  const number =
    Math.abs(value) % 100;

  const digit =
    number % 10;

  if (
    number >= 11 &&
    number <= 19
  ) {
    return 'записей';
  }

  if (digit === 1) {
    return 'запись';
  }

  if (
    digit >= 2 &&
    digit <= 4
  ) {
    return 'записи';
  }

  return 'записей';
}

function legacyToDatabaseLead(
  item
) {
  const method =
    METHOD_META[
      item.communicationMethod
    ]
      ? item.communicationMethod
      : null;

  const priority =
    PRIORITY_META[
      item.priority
    ]
      ? item.priority
      : 'none';

  const status =
    STATUS_META[
      item.status
    ]
      ? item.status
      : 'new';

  return {
    client_name:
      cleanText(
        item.clientName,
        180
      ),

    org_form:
      cleanText(
        item.orgForm,
        80
      ) || null,

    inn:
      cleanText(
        item.inn,
        20
      ) || null,

    activity:
      cleanText(
        item.activity,
        180
      ) || null,

    source:
      cleanText(
        item.source,
        140
      ) || null,

    phone:
      cleanText(
        item.phone,
        80
      ) || null,

    email:
      cleanText(
        item.email,
        180
      ) || null,

    communication_method:
      method,

    estimated_amount:
      cleanText(
        item.estimatedAmount,
        120
      ) || null,

    priority,

    status,

    next_contact:
      item.nextContact
        ? toDatabaseTimestamp(
            item.nextContact
          )
        : null,

    last_dialogue:
      cleanText(
        item.lastDialogue,
        3000
      ) || null,

    next_step:
      cleanText(
        item.nextStep,
        2000
      ) || null,

    notes:
      cleanText(
        item.notes,
        3000
      ) || null,

    responsible_user:
      currentUser.id,

    created_by:
      currentUser.id,

    updated_by:
      currentUser.id
  };
}

async function migrateLegacyData() {
  const legacy =
    getLegacyLeads();

  if (
    legacy.length === 0
  ) {
    elements.migrationPanel
      .classList.remove(
        'show'
      );

    return;
  }

  const confirmed =
    window.confirm(
      'Перенести старые записи в общую базу?\n\n' +
      'Будет добавлено записей: ' +
      legacy.length +
      '.\n\n' +
      'После переноса они станут видны всем сотрудникам.'
    );

  if (!confirmed) {
    return;
  }

  elements.migrateBtn.disabled =
    true;

  elements.skipMigrationBtn.disabled =
    true;

  elements.migrateBtn.textContent =
    'Переносим…';

  try {
    const prepared =
      legacy
        .map(
          legacyToDatabaseLead
        )
        .filter(
          (item) =>
            item.client_name
        );

    const {
      data,
      error
    } =
      await supabaseClient
        .from('planner_leads')
        .insert(prepared)
        .select();

    if (error) {
      throw error;
    }

    localStorage.setItem(
      MIGRATION_DONE_KEY,
      '1'
    );

    elements.migrationPanel
      .classList.remove(
        'show'
      );

    showToast(
      'Старые записи перенесены в общую базу: ' +
      data.length +
      '.',
      'success',
      6000
    );

    await loadLeads({
      silent: true
    });
  } catch (error) {
    console.error(
      'Ошибка миграции:',
      error
    );

    showToast(
      'Не удалось перенести старые записи.',
      'error',
      6000
    );
  } finally {
    elements.migrateBtn.disabled =
      false;

    elements.skipMigrationBtn.disabled =
      false;
  }
}

function skipLegacyMigration() {
  const confirmed =
    window.confirm(
      'Не переносить старые локальные записи?\n\n' +
      'Они останутся в браузере этого компьютера, ' +
      'но в общей таблице не появятся.'
    );

  if (!confirmed) {
    return;
  }

  localStorage.setItem(
    MIGRATION_DISMISSED_KEY,
    '1'
  );

  elements.migrationPanel
    .classList.remove(
      'show'
    );
}


/* ============================================================
   26. БРАУЗЕРНЫЕ УВЕДОМЛЕНИЯ
   ============================================================ */

function getTodayKey() {
  const today =
    new Date();

  return (
    today.getFullYear() +
    '-' +
    padNumber(
      today.getMonth() + 1
    ) +
    '-' +
    padNumber(
      today.getDate()
    )
  );
}

function loadNotificationHistory() {
  try {
    const raw =
      localStorage.getItem(
        NOTIFICATION_HISTORY_KEY
      );

    if (!raw) {
      return {};
    }

    const parsed =
      JSON.parse(raw);

    return (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    )
      ? parsed
      : {};
  } catch (error) {
    return {};
  }
}

function saveNotificationHistory(
  history
) {
  try {
    const cutoff =
      Date.now() -
      (
        60 *
        24 *
        60 *
        60 *
        1000
      );

    const cleaned = {};

    Object.entries(
      history
    ).forEach(
      (
        [
          key,
          value
        ]
      ) => {
        if (
          Number(value) >
          cutoff
        ) {
          cleaned[key] =
            Number(value);
        }
      }
    );

    localStorage.setItem(
      NOTIFICATION_HISTORY_KEY,
      JSON.stringify(
        cleaned
      )
    );
  } catch (error) {
    console.warn(
      'Не удалось сохранить историю уведомлений.'
    );
  }
}

function updateNotificationInterface() {
  if (
    !(
      'Notification' in window
    )
  ) {
    elements.notificationBtn.disabled =
      true;

    elements.notificationBtn.textContent =
      'Уведомления недоступны';

    elements.notificationNote.innerHTML = `
      <div class="infoIcon">!</div>

      <div>
        Этот браузер не поддерживает системные уведомления.
        Планировщик продолжит выделять сегодняшние
        и просроченные контакты в таблице.
      </div>
    `;

    return;
  }

  if (
    Notification.permission ===
    'granted'
  ) {
    elements.notificationBtn.disabled =
      false;

    elements.notificationBtn.textContent =
      '✓ Уведомления включены';

    elements.notificationNote.innerHTML = `
      <div class="infoIcon">✓</div>

      <div>
        Уведомления разрешены. В день назначенного контакта
        браузер покажет напоминание, пока планировщик открыт
        или находится в фоновой вкладке.
      </div>
    `;

    return;
  }

  if (
    Notification.permission ===
    'denied'
  ) {
    elements.notificationBtn.disabled =
      false;

    elements.notificationBtn.textContent =
      '× Уведомления запрещены';

    elements.notificationNote.innerHTML = `
      <div class="infoIcon">!</div>

      <div>
        Уведомления заблокированы в браузере.
        Разрешение можно изменить в настройках сайта.
      </div>
    `;

    return;
  }

  elements.notificationBtn.disabled =
    false;

  elements.notificationBtn.textContent =
    '🔔 Включить уведомления';
}

async function requestNotifications() {
  if (
    !(
      'Notification' in window
    )
  ) {
    showToast(
      'Этот браузер не поддерживает уведомления.',
      'warning'
    );

    return;
  }

  if (
    !window.isSecureContext &&
    window.location.hostname !==
      'localhost'
  ) {
    showToast(
      'Для уведомлений сайт должен работать через HTTPS.',
      'warning'
    );

    return;
  }

  if (
    Notification.permission ===
    'denied'
  ) {
    showToast(
      'Уведомления запрещены в настройках браузера.',
      'warning'
    );

    return;
  }

  try {
    const permission =
      await Notification
        .requestPermission();

    updateNotificationInterface();

    if (
      permission === 'granted'
    ) {
      showToast(
        'Уведомления включены.',
        'success'
      );

      checkTodayNotifications();
    }
  } catch (error) {
    console.error(
      'Ошибка уведомлений:',
      error
    );

    showToast(
      'Не удалось включить уведомления.',
      'error'
    );
  }
}

function checkTodayNotifications() {
  if (
    !(
      'Notification' in window
    ) ||
    Notification.permission !==
      'granted'
  ) {
    return;
  }

  const todayKey =
    getTodayKey();

  const history =
    loadNotificationHistory();

  const todayLeads =
    leads.filter(
      (lead) =>
        !isClosed(lead) &&
        getDayDifference(
          lead.next_contact
        ) === 0
    );

  let changed = false;

  todayLeads.forEach(
    (lead) => {
      const key =
        lead.id +
        ':' +
        todayKey;

      if (history[key]) {
        return;
      }

      const parts = [];

      if (lead.next_step) {
        parts.push(
          lead.next_step
        );
      } else if (
        lead.last_dialogue
      ) {
        parts.push(
          lead.last_dialogue
        );
      }

      if (
        lead.communication_method
      ) {
        parts.push(
          'Связь: ' +
          (
            METHOD_META[
              lead.communication_method
            ] ||
            lead.communication_method
          )
        );
      }

      if (lead.phone) {
        parts.push(
          'Телефон: ' +
          lead.phone
        );
      }

      const body =
        parts
          .join(' · ')
          .slice(0, 220) ||
        'Откройте планировщик для подробностей.';

      try {
        const notification =
          new Notification(
            'Сегодня назначен контакт: ' +
            getDisplayName(lead),
            {
              body,
              icon:
                '/favicon.png',
              tag:
                'jambalance-' +
                lead.id +
                '-' +
                todayKey
            }
          );

        notification.onclick =
          () => {
            window.focus();

            editLead(
              lead.id
            );

            notification.close();
          };

        history[key] =
          Date.now();

        changed = true;
      } catch (error) {
        console.warn(
          'Не удалось показать уведомление:',
          error
        );
      }
    }
  );

  if (changed) {
    saveNotificationHistory(
      history
    );
  }
}


/* ============================================================
   27. ОБРАБОТЧИКИ СОБЫТИЙ
   ============================================================ */

function bindEvents() {
  elements.addLeadBtn
    .addEventListener(
      'click',
      () => {
        openLeadModal();
      }
    );

  elements.closeModalBtn
    .addEventListener(
      'click',
      closeLeadModal
    );

  elements.cancelBtn
    .addEventListener(
      'click',
      closeLeadModal
    );

  elements.modalBackdrop
    .addEventListener(
      'click',
      (event) => {
        if (
          event.target ===
          elements.modalBackdrop
        ) {
          closeLeadModal();
        }
      }
    );

  elements.leadForm
    .addEventListener(
      'submit',
      handleLeadSubmit
    );

  elements.searchInput
    .addEventListener(
      'input',
      () => {
        state.search =
          elements.searchInput.value;

        renderTable();
      }
    );

  elements.statusFilter
    .addEventListener(
      'change',
      () => {
        state.status =
          elements.statusFilter.value;

        renderTable();
      }
    );

  elements.priorityFilter
    .addEventListener(
      'change',
      () => {
        state.priority =
          elements.priorityFilter.value;

        renderTable();
      }
    );

  elements.dateFilter
    .addEventListener(
      'change',
      () => {
        state.date =
          elements.dateFilter.value;

        renderTable();
      }
    );

  elements.sortSelect
    .addEventListener(
      'change',
      () => {
        state.sort =
          elements.sortSelect.value;

        renderTable();
      }
    );

  elements.resetFiltersBtn
    .addEventListener(
      'click',
      resetFilters
    );

  elements.refreshBtn
    .addEventListener(
      'click',
      () => {
        loadLeads();
      }
    );

  elements.exportBtn
    .addEventListener(
      'click',
      exportBackup
    );

  elements.notificationBtn
    .addEventListener(
      'click',
      requestNotifications
    );

  elements.migrateBtn
    .addEventListener(
      'click',
      migrateLegacyData
    );

  elements.skipMigrationBtn
    .addEventListener(
      'click',
      skipLegacyMigration
    );

  elements.leadTableBody
    .addEventListener(
      'click',
      (event) => {
        const button =
          event.target.closest(
            'button[data-action]'
          );

        if (!button) {
          return;
        }

        const id =
          button.dataset.id;

        const action =
          button.dataset.action;

        if (
          action === 'edit'
        ) {
          editLead(id);
        }

        if (
          action === 'delete'
        ) {
          deleteLead(id);
        }
      }
    );

  document.addEventListener(
    'keydown',
    (event) => {
      if (
        event.key ===
          'Escape' &&
        elements.modalBackdrop
          .classList.contains(
            'show'
          )
      ) {
        closeLeadModal();
      }
    }
  );

  document.addEventListener(
    'visibilitychange',
    () => {
      if (
        !document.hidden
      ) {
        loadLeads({
          silent: true
        });

        checkTodayNotifications();
      }
    }
  );

  window.addEventListener(
    'focus',
    () => {
      loadLeads({
        silent: true
      });

      checkTodayNotifications();
    }
  );

  window.addEventListener(
    'online',
    () => {
      showToast(
        'Соединение с интернетом восстановлено.',
        'success'
      );

      loadLeads({
        silent: true
      });
    }
  );

  window.addEventListener(
    'offline',
    () => {
      showToast(
        'Нет подключения к интернету. Изменения пока нельзя сохранить.',
        'warning',
        6000
      );
    }
  );
}


/* ============================================================
   28. ИЗМЕНЕНИЯ СОСТОЯНИЯ AUTH
   ============================================================ */

function bindAuthWatcher() {
  supabaseClient.auth
    .onAuthStateChange(
      (
        event,
        session
      ) => {
        if (
          event ===
            'SIGNED_OUT' ||
          !session?.user
        ) {
          redirectToLogin();

          return;
        }

        currentUser =
          session.user;
      }
    );
}


/* ============================================================
   29. ПЕРИОДИЧЕСКОЕ ОБНОВЛЕНИЕ
   ============================================================ */

function startPeriodicTasks() {
  /*
   * Раз в минуту пересчитываем подписи:
   * "сегодня", "завтра", "просрочено".
   */

  window.setInterval(
    () => {
      renderStatistics();
      renderTable();
      checkTodayNotifications();
    },
    60000
  );

  /*
   * Realtime уже должен показывать изменения сразу.
   * Но раз в 5 минут дополнительно перечитываем базу.
   * Это страховка на случай разрыва Realtime-соединения.
   */

  window.setInterval(
    () => {
      if (
        !document.hidden &&
        navigator.onLine
      ) {
        loadLeads({
          silent: true
        });
      }
    },
    5 * 60 * 1000
  );
}


/* ============================================================
   30. ИНИЦИАЛИЗАЦИЯ
   ============================================================ */

async function initialize() {
  try {
    setLoadingText(
      'Подключаем Supabase…'
    );

    createSupabaseClient();

    bindEvents();

    bindAuthWatcher();

    const authenticated =
      await ensureAuthenticated();

    if (!authenticated) {
      return;
    }

    const profileLoaded =
      await loadCurrentProfile();

    if (!profileLoaded) {
      return;
    }

    setLoadingText(
      'Загружаем общую таблицу потенциальных клиентов…'
    );

    await loadLeads({
      silent: true
    });

    setLoadingText(
      'Подключаем обновления в реальном времени…'
    );

    subscribeToRealtime();

    updateNotificationInterface();

    checkLegacyMigration();

    startPeriodicTasks();

    showApplication();

    checkTodayNotifications();
  } catch (error) {
    console.error(
      'Ошибка запуска Planner:',
      error
    );

    showFatalError(
      'Не удалось подключиться к общей базе. ' +
      'Проверьте интернет и обновите страницу.'
    );
  }
}


/* ============================================================
   31. СТАРТ
   ============================================================ */

initialize();