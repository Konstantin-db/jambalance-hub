'use strict';

/* ============================================================
   ДЖЕМБАЛАНС — PLANNER v2.5

   Supabase
   Авторизация
   Realtime
   Ответственные сотрудники
   Быстрый контакт "Связался"
   Файлы
   Умные напоминания
   Кликабельная сводка
   Быстрые действия
   ============================================================ */


/* ============================================================
   1. SUPABASE / STORAGE
   ============================================================ */

const SUPABASE_URL =
  'https://fqcltmxiarohfpfnghjn.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_PqjH12Cbf7Fw9CWxvTPHaQ_MYYq7HQT';

const STORAGE_BUCKET =
  'crm-files';

const MAX_FILE_SIZE =
  20 * 1024 * 1024;

const SIGNED_URL_LIFETIME_SECONDS =
  5 * 60;


/* ============================================================
   2. LOCAL STORAGE
   ============================================================ */

const LEGACY_STORAGE_KEY =
  'jambalance_planner_leads_v1';

const MIGRATION_DISMISSED_KEY =
  'jambalance_planner_migration_dismissed_v2';

const MIGRATION_DONE_KEY =
  'jambalance_planner_migration_done_v2';

const NOTIFICATION_HISTORY_KEY =
  'jambalance_planner_notifications_v25';

const DAILY_SUMMARY_HISTORY_KEY =
  'jambalance_planner_daily_summary_v25';


/* ============================================================
   3. REMINDERS
   ============================================================ */

const REMINDER_SOON_MINUTES =
  60;

const OVERDUE_NOTIFICATION_COOLDOWN_HOURS =
  24;


/* ============================================================
   4. СПРАВОЧНИКИ
   ============================================================ */

const CLOSED_STATUSES =
  new Set([
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
   5. DOM
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

  responsibleFilter:
    document.getElementById('responsibleFilter'),

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

  /* Основная карточка */

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

  responsibleUser:
    document.getElementById('responsibleUser'),

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
    document.getElementById('toastStack'),

  /* Быстрый контакт */

  quickContactBackdrop:
    document.getElementById('quickContactBackdrop'),

  quickContactForm:
    document.getElementById('quickContactForm'),

  quickContactTitle:
    document.getElementById('quickContactTitle'),

  quickContactClient:
    document.getElementById('quickContactClient'),

  quickContactLeadId:
    document.getElementById('quickContactLeadId'),

  quickContactPreset:
    document.getElementById('quickContactPreset'),

  quickContactDate:
    document.getElementById('quickContactDate'),

  quickContactComment:
    document.getElementById('quickContactComment'),

  quickContactResponsible:
    document.getElementById('quickContactResponsible'),

  quickContactCloseBtn:
    document.getElementById('quickContactCloseBtn'),

  quickContactCancelBtn:
    document.getElementById('quickContactCancelBtn'),

  quickContactSaveBtn:
    document.getElementById('quickContactSaveBtn'),

  /* Файлы */

  filesBackdrop:
    document.getElementById('filesBackdrop'),

  filesTitle:
    document.getElementById('filesTitle'),

  filesClient:
    document.getElementById('filesClient'),

  filesLeadId:
    document.getElementById('filesLeadId'),

  filesList:
    document.getElementById('filesList'),

  fileInput:
    document.getElementById('fileInput'),

  fileDescription:
    document.getElementById('fileDescription'),

  uploadFileBtn:
    document.getElementById('uploadFileBtn'),

  filesCloseBtn:
    document.getElementById('filesCloseBtn'),

  filesDoneBtn:
    document.getElementById('filesDoneBtn'),

  fileDropZone:
    document.getElementById('fileDropZone'),

  selectedFileName:
    document.getElementById('selectedFileName'),

  /* Умная сводка */

  smartSummary:
    document.getElementById('smartSummary'),

  smartSummaryToday:
    document.getElementById('smartSummaryToday'),

  smartSummaryOverdue:
    document.getElementById('smartSummaryOverdue'),

  smartSummaryWeek:
    document.getElementById('smartSummaryWeek'),

  smartSummaryText:
    document.getElementById('smartSummaryText'),

  /* ========================================================
     v2.5 — Быстрые действия
     Эти элементы добавим следующим HTML-патчем.
     ======================================================== */

  quickActionsBackdrop:
    document.getElementById('quickActionsBackdrop'),

  quickActionsClient:
    document.getElementById('quickActionsClient'),

  quickActionsLeadId:
    document.getElementById('quickActionsLeadId'),

  quickActionsCloseBtn:
    document.getElementById('quickActionsCloseBtn'),

  quickActionsCancelBtn:
    document.getElementById('quickActionsCancelBtn'),

  quickActionRescheduleBtn:
    document.getElementById('quickActionRescheduleBtn'),

  quickActionPauseBtn:
    document.getElementById('quickActionPauseBtn'),

  quickActionClientBtn:
    document.getElementById('quickActionClientBtn'),

  quickActionLostBtn:
    document.getElementById('quickActionLostBtn'),

  quickActionDeleteBtn:
    document.getElementById('quickActionDeleteBtn'),

  /* Быстрое назначение даты */

  actionScheduleBackdrop:
    document.getElementById('actionScheduleBackdrop'),

  actionScheduleTitle:
    document.getElementById('actionScheduleTitle'),

  actionScheduleSubtitle:
    document.getElementById('actionScheduleSubtitle'),

  actionScheduleForm:
    document.getElementById('actionScheduleForm'),

  actionScheduleLeadId:
    document.getElementById('actionScheduleLeadId'),

  actionScheduleMode:
    document.getElementById('actionScheduleMode'),

  actionScheduleClient:
    document.getElementById('actionScheduleClient'),

  actionSchedulePreset:
    document.getElementById('actionSchedulePreset'),

  actionScheduleDate:
    document.getElementById('actionScheduleDate'),

  actionScheduleComment:
    document.getElementById('actionScheduleComment'),

  actionScheduleCloseBtn:
    document.getElementById('actionScheduleCloseBtn'),

  actionScheduleCancelBtn:
    document.getElementById('actionScheduleCancelBtn'),

  actionScheduleSaveBtn:
    document.getElementById('actionScheduleSaveBtn')
};


/* ============================================================
   6. STATE
   ============================================================ */

const state = {
  search: '',
  status: 'all',
  priority: 'all',
  responsible: 'all',
  date: 'all',
  sort: 'nearest'
};

let supabaseClient = null;

let currentUser = null;

let currentProfile = null;

let profiles = [];

let leads = [];

let crmFiles = [];

let realtimeChannel = null;

let profilesRealtimeChannel = null;

let filesRealtimeChannel = null;

let isLoadingLeads = false;

let saveInProgress = false;

let quickContactSaveInProgress = false;

let actionScheduleSaveInProgress = false;

let fileUploadInProgress = false;

let activeFilesLeadId = null;


/* ============================================================
   7. BASIC HELPERS
   ============================================================ */

function cleanText(
  value,
  maxLength = 5000
) {
  return String(value ?? '')
    .trim()
    .slice(
      0,
      maxLength
    );
}

function normalizeSearch(value) {
  return String(value ?? '')
    .toLocaleLowerCase('ru-RU')
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#039;'
    );
}

function padNumber(value) {
  return String(value)
    .padStart(
      2,
      '0'
    );
}

function isValidDate(date) {
  return (
    date instanceof Date &&
    !Number.isNaN(
      date.getTime()
    )
  );
}

function pluralizeDays(value) {
  const number =
    Math.abs(value) % 100;

  const last =
    number % 10;

  if (
    number >= 11 &&
    number <= 19
  ) {
    return 'дней';
  }

  if (last === 1) {
    return 'день';
  }

  if (
    last >= 2 &&
    last <= 4
  ) {
    return 'дня';
  }

  return 'дней';
}

function pluralizeRecords(value) {
  const number =
    Math.abs(value) % 100;

  const last =
    number % 10;

  if (
    number >= 11 &&
    number <= 19
  ) {
    return 'записей';
  }

  if (last === 1) {
    return 'запись';
  }

  if (
    last >= 2 &&
    last <= 4
  ) {
    return 'записи';
  }

  return 'записей';
}

function getInitials(
  name,
  email
) {
  const source =
    cleanText(
      name,
      200
    ) ||
    cleanText(
      email,
      200
    ).split('@')[0] ||
    'Д';

  const parts =
    source
      .split(/\s+/)
      .filter(Boolean);

  if (
    parts.length >= 2
  ) {
    return (
      parts[0][0] +
      parts[1][0]
    ).toLocaleUpperCase(
      'ru-RU'
    );
  }

  return source
    .slice(
      0,
      2
    )
    .toLocaleUpperCase(
      'ru-RU'
    );
}

function getDisplayName(lead) {
  const name =
    cleanText(
      lead?.client_name,
      180
    );

  const form =
    cleanText(
      lead?.org_form,
      80
    );

  if (!form) {
    return name;
  }

  const normalizedName =
    normalizeSearch(name);

  const normalizedForm =
    normalizeSearch(form);

  if (
    normalizedName ===
      normalizedForm ||
    normalizedName.startsWith(
      normalizedForm + ' '
    )
  ) {
    return name;
  }

  return (
    form +
    ' ' +
    name
  );
}

function isClosed(lead) {
  return CLOSED_STATUSES.has(
    lead?.status
  );
}

function createRandomId() {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
      'function'
  ) {
    return window.crypto
      .randomUUID();
  }

  return (
    Date.now()
      .toString(36) +
    '-' +
    Math.random()
      .toString(36)
      .slice(2)
  );
}


/* ============================================================
   8. PROFILE HELPERS
   ============================================================ */

function getProfileById(id) {
  if (!id) {
    return null;
  }

  return (
    profiles.find(
      (profile) =>
        profile.id === id
    ) ||
    null
  );
}

function getProfileDisplayName(profile) {
  if (!profile) {
    return '';
  }

  return (
    cleanText(
      profile.full_name,
      200
    ) ||
    cleanText(
      profile.email,
      200
    ).split('@')[0] ||
    'Сотрудник'
  );
}

function getResponsibleDisplayName(lead) {
  if (
    !lead?.responsible_user
  ) {
    return 'Не назначен';
  }

  const profile =
    getProfileById(
      lead.responsible_user
    );

  return profile
    ? getProfileDisplayName(
        profile
      )
    : 'Сотрудник';
}

function getUploaderDisplayName(file) {
  const profile =
    getProfileById(
      file?.uploaded_by
    );

  return profile
    ? getProfileDisplayName(
        profile
      )
    : 'Сотрудник';
}


/* ============================================================
   9. DATE HELPERS
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
    padNumber(
      date.getMonth() + 1
    ) +
    '-' +
    padNumber(
      date.getDate()
    ) +
    'T' +
    padNumber(
      date.getHours()
    ) +
    ':' +
    padNumber(
      date.getMinutes()
    )
  );
}

function toDatabaseTimestamp(value) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  return isValidDate(date)
    ? date.toISOString()
    : null;
}

function getLocalDayNumber(date) {
  return (
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ) /
    86400000
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

  return (
    getLocalDayNumber(target) -
    getLocalDayNumber(
      new Date()
    )
  );
}

function getMinutesUntil(value) {
  if (!value) {
    return null;
  }

  const target =
    new Date(value);

  if (!isValidDate(target)) {
    return null;
  }

  return Math.round(
    (
      target.getTime() -
      Date.now()
    ) /
    60000
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

function formatTime(value) {
  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  if (!isValidDate(date)) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'ru-RU',
    {
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
      label:
        'Дата не назначена',
      dateText:
        'Не назначен'
    };
  }

  const difference =
    getDayDifference(
      lead.next_contact
    );

  const dateText =
    formatContactDate(
      lead.next_contact
    );

  const time =
    formatTime(
      lead.next_contact
    );

  if (
    difference === null
  ) {
    return {
      type: 'no-date',
      rowClass: '',
      label:
        'Дата не назначена',
      dateText:
        'Не назначен'
    };
  }

  if (difference < 0) {
    const days =
      Math.abs(
        difference
      );

    return {
      type: 'overdue',
      rowClass:
        'row-overdue',

      label:
        'Просрочено на ' +
        days +
        ' ' +
        pluralizeDays(
          days
        ),

      dateText
    };
  }

  if (difference === 0) {
    return {
      type: 'today',
      rowClass:
        'row-today',

      label:
        'Сегодня, ' +
        time,

      dateText
    };
  }

  if (difference === 1) {
    return {
      type: 'soon',
      rowClass:
        'row-soon',

      label:
        'Завтра, ' +
        time,

      dateText
    };
  }

  if (difference <= 7) {
    return {
      type: 'soon',
      rowClass:
        'row-soon',

      label:
        'Через ' +
        difference +
        ' ' +
        pluralizeDays(
          difference
        ),

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
      pluralizeDays(
        difference
      ),

    dateText
  };
}

function addDays(
  date,
  days
) {
  const result =
    new Date(date);

  result.setDate(
    result.getDate() +
    days
  );

  return result;
}

function addMonths(
  date,
  months
) {
  const result =
    new Date(date);

  const originalDay =
    result.getDate();

  result.setDate(1);

  result.setMonth(
    result.getMonth() +
    months
  );

  const maxDay =
    new Date(
      result.getFullYear(),
      result.getMonth() + 1,
      0
    ).getDate();

  result.setDate(
    Math.min(
      originalDay,
      maxDay
    )
  );

  return result;
}

function getDefaultContactTime(date) {
  const result =
    new Date(date);

  result.setHours(
    10,
    0,
    0,
    0
  );

  return result;
}

function getPresetDate(preset) {
  const now =
    new Date();

  if (
    preset === 'tomorrow'
  ) {
    return getDefaultContactTime(
      addDays(
        now,
        1
      )
    );
  }

  if (
    preset === 'week'
  ) {
    return getDefaultContactTime(
      addDays(
        now,
        7
      )
    );
  }

  if (
    preset === 'month'
  ) {
    return getDefaultContactTime(
      addMonths(
        now,
        1
      )
    );
  }

  return null;
}


/* ============================================================
   10. TOAST
   ============================================================ */

function showToast(
  message,
  type = 'success',
  duration = 4200
) {
  if (
    !elements.toastStack
  ) {
    return;
  }

  const toast =
    document.createElement(
      'div'
    );

  toast.className =
    'toast ' + type;

  toast.textContent =
    message;

  elements.toastStack
    .appendChild(
      toast
    );

  window.setTimeout(
    () => {
      toast.remove();
    },
    duration
  );
}


/* ============================================================
   11. LOADING
   ============================================================ */

function setLoadingText(text) {
  if (
    elements.loadingText
  ) {
    elements.loadingText
      .textContent =
        text;
  }
}

function showApplication() {
  document.body
    .classList.add(
      'ready'
    );

  elements.loadingScreen
    ?.classList.add(
      'hidden'
    );
}

function redirectToLogin() {
  window.location.replace(
    '../index.html'
  );
}

function showFatalError(message) {
  if (
    !elements.loadingScreen
  ) {
    window.alert(
      message
    );

    return;
  }

  elements.loadingScreen
    .classList.remove(
      'hidden'
    );

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
        ${escapeHtml(
          message
        )}
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
   12. SUPABASE
   ============================================================ */

function createSupabaseClient() {
  if (
    !window.supabase ||
    typeof window.supabase
      .createClient !==
      'function'
  ) {
    throw new Error(
      'Не загрузилась библиотека Supabase.'
    );
  }

  supabaseClient =
    window.supabase
      .createClient(
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
   13. AUTH
   ============================================================ */

async function ensureAuthenticated() {
  setLoadingText(
    'Проверяем авторизацию…'
  );

  const {
    data,
    error
  } =
    await supabaseClient
      .auth
      .getSession();

  if (error) {
    throw error;
  }

  if (
    !data?.session?.user
  ) {
    redirectToLogin();

    return false;
  }

  currentUser =
    data.session.user;

  return true;
}

async function loadCurrentProfile() {
  setLoadingText(
    'Загружаем профиль…'
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
      'Profile:',
      error
    );
  }

  if (
    data?.is_active === false
  ) {
    await supabaseClient
      .auth
      .signOut();

    redirectToLogin();

    return false;
  }

  currentProfile =
    data || {
      id:
        currentUser.id,

      full_name:
        currentUser
          .user_metadata
          ?.full_name ||
        currentUser
          .email
          ?.split('@')[0] ||
        'Сотрудник',

      email:
        currentUser.email ||
        ''
    };

  renderCurrentUser();

  return true;
}

function renderCurrentUser() {
  const name =
    getProfileDisplayName(
      currentProfile
    );

  const email =
    cleanText(
      currentProfile?.email,
      200
    ) ||
    currentUser?.email ||
    '';

  if (
    elements.userName
  ) {
    elements.userName.textContent =
      name;
  }

  if (
    elements.userEmail
  ) {
    elements.userEmail.textContent =
      email;
  }

  if (
    elements.userAvatar
  ) {
    elements.userAvatar.textContent =
      getInitials(
        name,
        email
      );
  }
}


/* ============================================================
   14. PROFILES
   ============================================================ */

async function loadProfiles() {
  setLoadingText(
    'Загружаем сотрудников…'
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
        'is_active',
        true
      )
      .order(
        'full_name',
        {
          ascending: true
        }
      );

  if (error) {
    throw error;
  }

  profiles =
    Array.isArray(data)
      ? data
      : [];

  if (
    currentProfile &&
    !profiles.some(
      (profile) =>
        profile.id ===
        currentProfile.id
    )
  ) {
    profiles.push(
      currentProfile
    );
  }

  profiles.sort(
    (a, b) =>
      getProfileDisplayName(a)
        .localeCompare(
          getProfileDisplayName(b),
          'ru'
        )
  );

  renderResponsibleOptions();
}

function renderResponsibleOptions() {
  const normalOptions = [
    '<option value="">Не назначен</option>'
  ];

  profiles.forEach(
    (profile) => {
      const name =
        getProfileDisplayName(
          profile
        );

      const position =
        cleanText(
          profile.position,
          120
        );

      const label =
        position
          ? name +
            ' — ' +
            position
          : name;

      normalOptions.push(`
        <option
          value="${escapeHtml(
            profile.id
          )}"
        >
          ${escapeHtml(
            label
          )}
        </option>
      `);
    }
  );

  if (
    elements.responsibleUser
  ) {
    const old =
      elements.responsibleUser
        .value;

    elements.responsibleUser
      .innerHTML =
        normalOptions.join('');

    if (old) {
      elements.responsibleUser.value =
        old;
    }
  }

  if (
    elements.quickContactResponsible
  ) {
    const old =
      elements.quickContactResponsible
        .value;

    elements.quickContactResponsible
      .innerHTML =
        normalOptions.join('');

    if (old) {
      elements.quickContactResponsible
        .value =
          old;
    }
  }

  if (
    elements.responsibleFilter
  ) {
    const old =
      elements.responsibleFilter
        .value ||
      state.responsible ||
      'all';

    const filterOptions = [
      '<option value="all">Все сотрудники</option>',
      '<option value="mine">Только мои</option>',
      '<option value="none">Не назначен</option>'
    ];

    profiles.forEach(
      (profile) => {
        filterOptions.push(`
          <option
            value="${escapeHtml(
              profile.id
            )}"
          >
            ${escapeHtml(
              getProfileDisplayName(
                profile
              )
            )}
          </option>
        `);
      }
    );

    elements.responsibleFilter
      .innerHTML =
        filterOptions.join('');

    const allowed =
      new Set([
        'all',
        'mine',
        'none',
        ...profiles.map(
          (profile) =>
            profile.id
        )
      ]);

    elements.responsibleFilter.value =
      allowed.has(old)
        ? old
        : 'all';

    state.responsible =
      elements.responsibleFilter.value;
  }
}


/* ============================================================
   15. LOAD DATA
   ============================================================ */

async function loadLeads({
  silent = false
} = {}) {
  if (
    isLoadingLeads
  ) {
    return;
  }

  isLoadingLeads =
    true;

  if (
    !silent &&
    elements.refreshBtn
  ) {
    elements.refreshBtn.disabled =
      true;

    elements.refreshBtn.textContent =
      'Обновляем…';
  }

  try {
    const [
      leadsResult,
      filesResult
    ] =
      await Promise.all([
        supabaseClient
          .from('planner_leads')
          .select('*')
          .order(
            'created_at',
            {
              ascending: false
            }
          ),

        supabaseClient
          .from('crm_files')
          .select('*')
          .not(
            'lead_id',
            'is',
            null
          )
          .order(
            'created_at',
            {
              ascending: false
            }
          )
      ]);

    if (
      leadsResult.error
    ) {
      throw leadsResult.error;
    }

    if (
      filesResult.error
    ) {
      throw filesResult.error;
    }

    leads =
      Array.isArray(
        leadsResult.data
      )
        ? leadsResult.data
        : [];

    crmFiles =
      Array.isArray(
        filesResult.data
      )
        ? filesResult.data
        : [];

    render();

    if (
      activeFilesLeadId
    ) {
      renderFilesList();
    }

    runSmartReminders();
  } catch (error) {
    console.error(
      'Ошибка загрузки:',
      error
    );

    if (!silent) {
      showToast(
        'Не удалось загрузить данные.',
        'error'
      );
    }
  } finally {
    isLoadingLeads =
      false;

    if (
      !silent &&
      elements.refreshBtn
    ) {
      elements.refreshBtn.disabled =
        false;

      elements.refreshBtn.textContent =
        '↻ Обновить';
    }
  }
}


/* ============================================================
   16. FILE HELPERS
   ============================================================ */

function getLeadFiles(leadId) {
  if (!leadId) {
    return [];
  }

  return crmFiles
    .filter(
      (file) =>
        file.lead_id ===
        leadId
    )
    .sort(
      (a, b) =>
        new Date(
          b.created_at || 0
        ).getTime() -
        new Date(
          a.created_at || 0
        ).getTime()
    );
}

function getLeadFileCount(leadId) {
  return getLeadFiles(
    leadId
  ).length;
}

function formatFileSize(bytes) {
  const value =
    Number(bytes);

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    return '';
  }

  if (value < 1024) {
    return (
      value +
      ' Б'
    );
  }

  if (
    value <
    1024 * 1024
  ) {
    return (
      (
        value / 1024
      ).toFixed(1) +
      ' КБ'
    );
  }

  return (
    (
      value /
      1024 /
      1024
    ).toFixed(1) +
    ' МБ'
  );
}

function formatFileDate(value) {
  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  if (!isValidDate(date)) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'ru-RU',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(date);
}

function sanitizeStorageFileName(fileName) {
  const original =
    cleanText(
      fileName,
      220
    );

  const dot =
    original.lastIndexOf('.');

  const extension =
    dot > 0
      ? original
          .slice(
            dot + 1
          )
          .toLowerCase()
          .replace(
            /[^a-z0-9]/g,
            ''
          )
          .slice(
            0,
            12
          )
      : '';

  const base =
    (
      dot > 0
        ? original.slice(
            0,
            dot
          )
        : original
    )
      .normalize('NFKD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        '-'
      )
      .replace(
        /^-+|-+$/g,
        ''
      )
      .slice(
        0,
        70
      ) ||
    'file';

  return extension
    ? `${base}.${extension}`
    : base;
}

function getFileIcon(file) {
  const mime =
    String(
      file?.mime_type ||
      ''
    ).toLowerCase();

  const name =
    String(
      file?.original_file_name ||
      file?.file_name ||
      ''
    ).toLowerCase();

  if (
    mime.startsWith(
      'image/'
    )
  ) {
    return '🖼️';
  }

  if (
    name.endsWith('.pdf')
  ) {
    return '📕';
  }

  if (
    /\.(doc|docx)$/.test(
      name
    )
  ) {
    return '📘';
  }

  if (
    /\.(xls|xlsx|csv)$/.test(
      name
    )
  ) {
    return '📗';
  }

  return '📄';
}


/* ============================================================
   17. SEARCH / FILTER
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

      getResponsibleDisplayName(
        lead
      ),

      lead.last_dialogue,
      lead.next_step,
      lead.notes,

      ...getLeadFiles(
        lead.id
      ).map(
        (file) =>
          file.original_file_name
      )
    ].join(' ')
  );
}

function matchesResponsibleFilter(
  lead
) {
  if (
    state.responsible ===
    'all'
  ) {
    return true;
  }

  if (
    state.responsible ===
    'mine'
  ) {
    return (
      lead.responsible_user ===
      currentUser?.id
    );
  }

  if (
    state.responsible ===
    'none'
  ) {
    return (
      !lead.responsible_user
    );
  }

  return (
    lead.responsible_user ===
    state.responsible
  );
}

function matchesDateFilter(lead) {
  if (
    state.date ===
    'all'
  ) {
    return true;
  }

  if (
    state.date ===
    'closed'
  ) {
    return isClosed(
      lead
    );
  }

  if (
    isClosed(lead)
  ) {
    return false;
  }

  const difference =
    getDayDifference(
      lead.next_contact
    );

  if (
    state.date ===
    'nodate'
  ) {
    return (
      difference === null
    );
  }

  if (
    difference === null
  ) {
    return false;
  }

  if (
    state.date ===
    'today'
  ) {
    return (
      difference === 0
    );
  }

  if (
    state.date ===
    'week'
  ) {
    return (
      difference >= 0 &&
      difference <= 7
    );
  }

  if (
    state.date ===
    'overdue'
  ) {
    return (
      difference < 0
    );
  }

  if (
    state.date ===
    'future'
  ) {
    return (
      difference > 0
    );
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
          !getSearchText(
            lead
          ).includes(
            search
          )
        ) {
          return false;
        }

        if (
          state.status !==
            'all' &&
          lead.status !==
            state.status
        ) {
          return false;
        }

        if (
          state.priority !==
            'all' &&
          (
            lead.priority ||
            'none'
          ) !==
            state.priority
        ) {
          return false;
        }

        if (
          !matchesResponsibleFilter(
            lead
          )
        ) {
          return false;
        }

        return matchesDateFilter(
          lead
        );
      }
    );

  return sortLeads(
    filtered
  );
}


/* ============================================================
   18. SORT
   ============================================================ */

function sortLeads(items) {
  const copy =
    [...items];

  if (
    state.sort ===
    'name'
  ) {
    return copy.sort(
      (a, b) =>
        getDisplayName(a)
          .localeCompare(
            getDisplayName(b),
            'ru'
          )
    );
  }

  if (
    state.sort ===
    'newest'
  ) {
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

  if (
    state.sort ===
    'updated'
  ) {
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

  if (
    state.sort ===
    'priority'
  ) {
    return copy.sort(
      (a, b) => {
        const priorityDifference =
          (
            PRIORITY_META[
              a.priority ||
              'none'
            ]?.order ||
            4
          ) -
          (
            PRIORITY_META[
              b.priority ||
              'none'
            ]?.order ||
            4
          );

        if (
          priorityDifference !==
          0
        ) {
          return (
            priorityDifference
          );
        }

        const aDate =
          a.next_contact
            ? new Date(
                a.next_contact
              ).getTime()
            : Number
                .MAX_SAFE_INTEGER;

        const bDate =
          b.next_contact
            ? new Date(
                b.next_contact
              ).getTime()
            : Number
                .MAX_SAFE_INTEGER;

        return (
          aDate -
          bDate
        );
      }
    );
  }

  return copy.sort(
    (a, b) => {
      if (
        isClosed(a) !==
        isClosed(b)
      ) {
        return isClosed(a)
          ? 1
          : -1;
      }

      const aDate =
        a.next_contact
          ? new Date(
              a.next_contact
            ).getTime()
          : Number
              .MAX_SAFE_INTEGER;

      const bDate =
        b.next_contact
          ? new Date(
              b.next_contact
            ).getTime()
          : Number
              .MAX_SAFE_INTEGER;

      if (
        aDate !==
        bDate
      ) {
        return (
          aDate -
          bDate
        );
      }

      return (
        (
          PRIORITY_META[
            a.priority ||
            'none'
          ]?.order ||
          4
        ) -
        (
          PRIORITY_META[
            b.priority ||
            'none'
          ]?.order ||
          4
        )
      );
    }
  );
}


/* ============================================================
   19. STATISTICS / SMART SUMMARY
   ============================================================ */

function getReminderScopeLeads() {
  return leads.filter(
    (lead) => {
      if (
        isClosed(lead)
      ) {
        return false;
      }

      return (
        !lead.responsible_user ||
        lead.responsible_user ===
          currentUser?.id
      );
    }
  );
}

function getSmartSummaryData() {
  const scoped =
    getReminderScopeLeads();

  const today =
    scoped.filter(
      (lead) =>
        getDayDifference(
          lead.next_contact
        ) === 0
    );

  const overdue =
    scoped.filter(
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
    );

  const week =
    scoped.filter(
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
    );

  return {
    today,
    overdue,
    week
  };
}

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

  if (
    elements.statActive
  ) {
    elements.statActive.textContent =
      String(
        active.length
      );
  }

  if (
    elements.statToday
  ) {
    elements.statToday.textContent =
      String(today);
  }

  if (
    elements.statWeek
  ) {
    elements.statWeek.textContent =
      String(week);
  }

  if (
    elements.statOverdue
  ) {
    elements.statOverdue.textContent =
      String(overdue);
  }

  if (
    elements.statNoDate
  ) {
    elements.statNoDate.textContent =
      String(noDate);
  }

  renderSmartSummary();
}

function updateSmartSummarySelection() {
  if (
    !elements.smartSummary
  ) {
    return;
  }

  const items =
    elements.smartSummary
      .querySelectorAll(
        '[data-summary-filter]'
      );

  items.forEach(
    (item) => {
      const active =
        item.dataset.summaryFilter ===
        state.date;

      item.classList.toggle(
        'active',
        active
      );

      item.setAttribute(
        'aria-pressed',
        String(active)
      );
    }
  );
}

function renderSmartSummary() {
  if (
    !elements.smartSummary
  ) {
    return;
  }

  const summary =
    getSmartSummaryData();

  if (
    elements.smartSummaryToday
  ) {
    elements.smartSummaryToday.textContent =
      String(
        summary.today.length
      );
  }

  if (
    elements.smartSummaryOverdue
  ) {
    elements.smartSummaryOverdue.textContent =
      String(
        summary.overdue.length
      );
  }

  if (
    elements.smartSummaryWeek
  ) {
    elements.smartSummaryWeek.textContent =
      String(
        summary.week.length
      );
  }

  if (
    elements.smartSummaryText
  ) {
    if (
      summary.overdue.length > 0
    ) {
      elements.smartSummaryText.textContent =
        `Есть просроченные контакты: ${summary.overdue.length}.`;
    } else if (
      summary.today.length > 0
    ) {
      elements.smartSummaryText.textContent =
        `Сегодня запланировано контактов: ${summary.today.length}.`;
    } else {
      elements.smartSummaryText.textContent =
        'Просроченных и сегодняшних контактов нет.';
    }
  }

  updateSmartSummarySelection();
}


/* ============================================================
   20. TABLE
   ============================================================ */

function createLeadRowHtml(lead) {
  const due =
    getDueInfo(
      lead
    );

  const status =
    STATUS_META[
      lead.status
    ] ||
    STATUS_META.new;

  const priority =
    PRIORITY_META[
      lead.priority ||
      'none'
    ] ||
    PRIORITY_META.none;

  const responsible =
    getProfileById(
      lead.responsible_user
    );

  let responsibleHtml =
    '<span class="muted">Не назначен</span>';

  if (responsible) {
    const name =
      getProfileDisplayName(
        responsible
      );

    responsibleHtml = `
      <div
        style="
          display:flex;
          align-items:center;
          gap:7px;
        "
      >
        <span
          style="
            display:inline-flex;
            align-items:center;
            justify-content:center;
            flex:0 0 auto;
            width:27px;
            height:27px;
            border-radius:50%;
            color:#a85b17;
            background:#fff3e3;
            font-size:10px;
            font-weight:900;
          "
        >
          ${escapeHtml(
            getInitials(
              name,
              responsible.email
            )
          )}
        </span>

        <span
          style="
            color:#374151;
            font-size:12px;
            font-weight:800;
            line-height:1.3;
          "
        >
          ${escapeHtml(
            name
          )}
        </span>
      </div>
    `;
  }

  const methodLabel =
    METHOD_META[
      lead.communication_method
    ];

  const files =
    getLeadFileCount(
      lead.id
    );

  const contacts = [];

  if (lead.phone) {
    contacts.push(`
      <a
        class="contactLink"
        href="tel:${escapeHtml(
          String(
            lead.phone
          ).replace(
            /[^\d+]/g,
            ''
          )
        )}"
      >
        ${escapeHtml(
          lead.phone
        )}
      </a>
    `);
  }

  if (lead.email) {
    contacts.push(`
      <a
        class="contactLink"
        href="mailto:${escapeHtml(
          lead.email
        )}"
      >
        ${escapeHtml(
          lead.email
        )}
      </a>
    `);
  }

  const dialogue = [];

  if (
    lead.last_dialogue
  ) {
    dialogue.push(`
      <div class="dialogueBlock">

        <span class="dialogueLabel">
          Предыдущий диалог
        </span>

        <div class="dialogueText">
          ${escapeHtml(
            lead.last_dialogue
          )}
        </div>

      </div>
    `);
  }

  if (
    lead.next_step
  ) {
    dialogue.push(`
      <div class="dialogueBlock">

        <span class="dialogueLabel">
          Следующий шаг
        </span>

        <div class="dialogueText">
          ${escapeHtml(
            lead.next_step
          )}
        </div>

      </div>
    `);
  }

  const quickContactButton =
    isClosed(lead)
      ? ''
      : `
        <button
          class="tableButton"
          type="button"
          data-action="contacted"
          data-id="${escapeHtml(
            lead.id
          )}"
        >
          Связался
        </button>
      `;

  return `
    <tr
      class="${
        isClosed(lead)
          ? 'row-closed'
          : due.rowClass
      }"
    >

      <td>

        <div class="clientName">
          ${escapeHtml(
            getDisplayName(
              lead
            )
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
          lead.source
            ? `
              <div class="clientMeta">
                Канал:
                ${escapeHtml(
                  lead.source
                )}
              </div>
            `
            : ''
        }

        ${
          lead.activity
            ? `
              <div class="activity">
                ${escapeHtml(
                  lead.activity
                )}
              </div>
            `
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
                ${escapeHtml(
                  methodLabel
                )}
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
        ${responsibleHtml}
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

          ${quickContactButton}

          <button
            class="tableButton"
            type="button"
            data-action="quick-actions"
            data-id="${escapeHtml(
              lead.id
            )}"
          >
            Действия
          </button>

          <button
            class="tableButton"
            type="button"
            data-action="files"
            data-id="${escapeHtml(
              lead.id
            )}"
          >
            Файлы${
              files > 0
                ? ' (' +
                  files +
                  ')'
                : ''
            }
          </button>

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

        </div>

      </td>

    </tr>
  `;
}

function renderTable() {
  if (
    !elements.leadTableBody
  ) {
    return;
  }

  const visible =
    getVisibleLeads();

  if (
    elements.visibleCount
  ) {
    elements.visibleCount.textContent =
      `Показано: ${visible.length} из ${leads.length}`;
  }

  if (
    visible.length === 0
  ) {
    elements.leadTableBody.innerHTML = `
      <tr>

        <td
          class="emptyCell"
          colspan="12"
        >
          <div class="emptyTitle">
            Записей не найдено
          </div>

          <div class="emptyText">
            Измените фильтры или добавьте нового потенциального клиента.
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
   21. MAIN FORM
   ============================================================ */

function resetLeadForm() {
  elements.leadForm
    ?.reset();

  if (
    elements.leadId
  ) {
    elements.leadId.value =
      '';
  }

  if (
    elements.priority
  ) {
    elements.priority.value =
      'none';
  }

  if (
    elements.status
  ) {
    elements.status.value =
      'new';
  }

  if (
    elements.communicationMethod
  ) {
    elements.communicationMethod.value =
      '';
  }

  if (
    elements.responsibleUser &&
    currentUser?.id
  ) {
    elements.responsibleUser.value =
      currentUser.id;
  }
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
      lead.client_name ||
      '';

    elements.orgForm.value =
      lead.org_form ||
      '';

    elements.inn.value =
      lead.inn ||
      '';

    elements.activity.value =
      lead.activity ||
      '';

    elements.source.value =
      lead.source ||
      '';

    elements.phone.value =
      lead.phone ||
      '';

    elements.email.value =
      lead.email ||
      '';

    elements.communicationMethod.value =
      lead.communication_method ||
      '';

    elements.estimatedAmount.value =
      lead.estimated_amount ||
      '';

    elements.priority.value =
      lead.priority ||
      'none';

    elements.responsibleUser.value =
      lead.responsible_user ||
      '';

    elements.status.value =
      lead.status ||
      'new';

    elements.nextContact.value =
      toLocalDateTimeInput(
        lead.next_contact
      );

    elements.lastDialogue.value =
      lead.last_dialogue ||
      '';

    elements.nextStep.value =
      lead.next_step ||
      '';

    elements.notes.value =
      lead.notes ||
      '';
  } else if (
    elements.modalTitle
  ) {
    elements.modalTitle.textContent =
      'Новый потенциальный клиент';
  }

  elements.modalBackdrop
    ?.classList.add(
      'show'
    );

  document.body
    .classList.add(
      'modal-open'
    );

  window.setTimeout(
    () => {
      elements.clientName
        ?.focus();
    },
    40
  );
}

function closeLeadModal() {
  elements.modalBackdrop
    ?.classList.remove(
      'show'
    );

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
        elements.clientName
          ?.value,
        180
      ),

    org_form:
      cleanText(
        elements.orgForm
          ?.value,
        80
      ) ||
      null,

    inn:
      cleanText(
        elements.inn
          ?.value,
        20
      ) ||
      null,

    activity:
      cleanText(
        elements.activity
          ?.value,
        180
      ) ||
      null,

    source:
      cleanText(
        elements.source
          ?.value,
        140
      ) ||
      null,

    phone:
      cleanText(
        elements.phone
          ?.value,
        80
      ) ||
      null,

    email:
      cleanText(
        elements.email
          ?.value,
        180
      ) ||
      null,

    communication_method:
      elements.communicationMethod
        ?.value ||
      null,

    estimated_amount:
      cleanText(
        elements.estimatedAmount
          ?.value,
        120
      ) ||
      null,

    priority:
      elements.priority
        ?.value ||
      'none',

    responsible_user:
      elements.responsibleUser
        ?.value ||
      null,

    status:
      elements.status
        ?.value ||
      'new',

    next_contact:
      toDatabaseTimestamp(
        elements.nextContact
          ?.value
      ),

    last_dialogue:
      cleanText(
        elements.lastDialogue
          ?.value,
        3000
      ) ||
      null,

    next_step:
      cleanText(
        elements.nextStep
          ?.value,
        2000
      ) ||
      null,

    notes:
      cleanText(
        elements.notes
          ?.value,
        3000
      ) ||
      null
  };
}

async function handleLeadSubmit(
  event
) {
  event.preventDefault();

  if (
    saveInProgress
  ) {
    return;
  }

  const payload =
    collectLeadFormData();

  if (
    !payload.client_name
  ) {
    showToast(
      'Укажите имя или название клиента.',
      'warning'
    );

    elements.clientName
      ?.focus();

    return;
  }

  saveInProgress =
    true;

  if (
    elements.saveLeadBtn
  ) {
    elements.saveLeadBtn.disabled =
      true;

    elements.saveLeadBtn.textContent =
      'Сохраняем…';
  }

  try {
    const id =
      cleanText(
        elements.leadId
          ?.value,
        100
      );

    let savedLead;

    if (id) {
      payload.updated_by =
        currentUser.id;

      const {
        data,
        error
      } =
        await supabaseClient
          .from('planner_leads')
          .update(
            payload
          )
          .eq(
            'id',
            id
          )
          .select()
          .single();

      if (error) {
        throw error;
      }

      savedLead =
        data;
    } else {
      payload.created_by =
        currentUser.id;

      payload.updated_by =
        currentUser.id;

      payload.responsible_user =
        payload.responsible_user ||
        currentUser.id;

      const {
        data,
        error
      } =
        await supabaseClient
          .from('planner_leads')
          .insert(
            payload
          )
          .select()
          .single();

      if (error) {
        throw error;
      }

      savedLead =
        data;
    }

    upsertLeadLocally(
      savedLead
    );

    render();

    closeLeadModal();

    runSmartReminders();

    showToast(
      'Запись сохранена.',
      'success'
    );
  } catch (error) {
    console.error(
      'Ошибка сохранения:',
      error
    );

    showToast(
      'Не удалось сохранить запись.',
      'error'
    );
  } finally {
    saveInProgress =
      false;

    if (
      elements.saveLeadBtn
    ) {
      elements.saveLeadBtn.disabled =
        false;

      elements.saveLeadBtn.textContent =
        'Сохранить запись';
    }
  }
}

function upsertLeadLocally(lead) {
  if (
    !lead?.id
  ) {
    return;
  }

  const index =
    leads.findIndex(
      (item) =>
        item.id ===
        lead.id
    );

  if (
    index >= 0
  ) {
    leads[index] =
      lead;
  } else {
    leads.push(
      lead
    );
  }
}


/* ============================================================
   22. QUICK CONTACT — "СВЯЗАЛСЯ"
   ============================================================ */

function resetQuickContactForm() {
  elements.quickContactForm
    ?.reset();

  if (
    elements.quickContactLeadId
  ) {
    elements.quickContactLeadId.value =
      '';
  }

  if (
    elements.quickContactPreset
  ) {
    elements.quickContactPreset.value =
      'week';
  }

  if (
    elements.quickContactDate
  ) {
    elements.quickContactDate.value =
      toLocalDateTimeInput(
        getPresetDate(
          'week'
        )
      );
  }

  if (
    elements.quickContactComment
  ) {
    elements.quickContactComment.value =
      '';
  }
}

function openQuickContactModal(id) {
  const lead =
    leads.find(
      (item) =>
        item.id === id
    );

  if (!lead) {
    showToast(
      'Запись не найдена.',
      'warning'
    );

    return;
  }

  if (
    isClosed(lead)
  ) {
    showToast(
      'Эта запись уже завершена.',
      'warning'
    );

    return;
  }

  if (
    !elements.quickContactBackdrop
  ) {
    showToast(
      'Окно быстрого контакта не найдено.',
      'error'
    );

    return;
  }

  resetQuickContactForm();

  elements.quickContactLeadId.value =
    lead.id;

  elements.quickContactClient.textContent =
    getDisplayName(
      lead
    );

  elements.quickContactPreset.value =
    'week';

  elements.quickContactDate.value =
    toLocalDateTimeInput(
      getPresetDate(
        'week'
      )
    );

  elements.quickContactResponsible.value =
    lead.responsible_user ||
    currentUser?.id ||
    '';

  elements.quickContactBackdrop
    .classList.add(
      'show'
    );

  document.body
    .classList.add(
      'modal-open'
    );

  window.setTimeout(
    () => {
      elements.quickContactComment
        ?.focus();
    },
    40
  );
}

function closeQuickContactModal() {
  elements.quickContactBackdrop
    ?.classList.remove(
      'show'
    );

  document.body
    .classList.remove(
      'modal-open'
    );

  resetQuickContactForm();
}

function applyQuickContactPreset() {
  if (
    !elements.quickContactPreset ||
    !elements.quickContactDate
  ) {
    return;
  }

  const preset =
    elements.quickContactPreset
      .value;

  if (
    preset ===
    'custom'
  ) {
    elements.quickContactDate
      .focus();

    return;
  }

  const date =
    getPresetDate(
      preset
    );

  if (date) {
    elements.quickContactDate.value =
      toLocalDateTimeInput(
        date
      );
  }
}

async function handleQuickContactSubmit(
  event
) {
  event.preventDefault();

  if (
    quickContactSaveInProgress
  ) {
    return;
  }

  const lead =
    leads.find(
      (item) =>
        item.id ===
        elements.quickContactLeadId
          ?.value
    );

  if (!lead) {
    showToast(
      'Запись не найдена.',
      'warning'
    );

    return;
  }

  const nextContact =
    toDatabaseTimestamp(
      elements.quickContactDate
        ?.value
    );

  if (!nextContact) {
    showToast(
      'Укажите дату следующего контакта.',
      'warning'
    );

    return;
  }

  quickContactSaveInProgress =
    true;

  if (
    elements.quickContactSaveBtn
  ) {
    elements.quickContactSaveBtn.disabled =
      true;

    elements.quickContactSaveBtn.textContent =
      'Сохраняем…';
  }

  try {
    const comment =
      cleanText(
        elements.quickContactComment
          ?.value,
        3000
      );

    const payload = {
      next_contact:
        nextContact,

      status:
        'callback',

      responsible_user:
        elements.quickContactResponsible
          ?.value ||
        lead.responsible_user ||
        currentUser.id,

      updated_by:
        currentUser.id
    };

    if (comment) {
      payload.last_dialogue =
        comment;
    }

    const {
      data,
      error
    } =
      await supabaseClient
        .from('planner_leads')
        .update(
          payload
        )
        .eq(
          'id',
          lead.id
        )
        .select()
        .single();

    if (error) {
      throw error;
    }

    upsertLeadLocally(
      data
    );

    render();

    closeQuickContactModal();

    runSmartReminders();

    showToast(
      'Контакт зафиксирован.',
      'success'
    );
  } catch (error) {
    console.error(
      'Quick contact:',
      error
    );

    showToast(
      'Не удалось сохранить контакт.',
      'error'
    );
  } finally {
    quickContactSaveInProgress =
      false;

    if (
      elements.quickContactSaveBtn
    ) {
      elements.quickContactSaveBtn.disabled =
        false;

      elements.quickContactSaveBtn.textContent =
        'Сохранить';
    }
  }
}


/* ============================================================
   23. v2.5 — QUICK ACTIONS MENU
   ============================================================ */

function getLeadById(id) {
  return (
    leads.find(
      (lead) =>
        lead.id === id
    ) ||
    null
  );
}

function openQuickActionsModal(id) {
  const lead =
    getLeadById(id);

  if (!lead) {
    showToast(
      'Запись не найдена.',
      'warning'
    );

    return;
  }

  if (
    !elements.quickActionsBackdrop
  ) {
    showToast(
      'Для быстрых действий нужно добавить окно в planner.html.',
      'warning',
      6000
    );

    return;
  }

  elements.quickActionsLeadId.value =
    lead.id;

  elements.quickActionsClient.textContent =
    getDisplayName(
      lead
    );

  /*
   * Если запись уже стала клиентом —
   * скрываем бессмысленную кнопку
   * "Стал клиентом".
   */

  if (
    elements.quickActionClientBtn
  ) {
    elements.quickActionClientBtn.hidden =
      lead.status ===
      'client';
  }

  /*
   * Если уже неактуальна —
   * скрываем "Неактуально".
   */

  if (
    elements.quickActionLostBtn
  ) {
    elements.quickActionLostBtn.hidden =
      lead.status ===
      'lost';
  }

  elements.quickActionsBackdrop
    .classList.add(
      'show'
    );

  document.body
    .classList.add(
      'modal-open'
    );
}

function closeQuickActionsModal() {
  elements.quickActionsBackdrop
    ?.classList.remove(
      'show'
    );

  document.body
    .classList.remove(
      'modal-open'
    );

  if (
    elements.quickActionsLeadId
  ) {
    elements.quickActionsLeadId.value =
      '';
  }
}

function getActiveQuickActionLead() {
  const id =
    elements.quickActionsLeadId
      ?.value;

  return getLeadById(
    id
  );
}


/* ============================================================
   24. QUICK ACTION — STATUS
   ============================================================ */

async function setLeadStatusQuickly(
  lead,
  status,
  {
    clearDate = false,
    successMessage =
      'Статус обновлён.'
  } = {}
) {
  if (!lead) {
    return false;
  }

  const payload = {
    status,
    updated_by:
      currentUser.id
  };

  if (clearDate) {
    payload.next_contact =
      null;
  }

  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .from('planner_leads')
        .update(
          payload
        )
        .eq(
          'id',
          lead.id
        )
        .select()
        .single();

    if (error) {
      throw error;
    }

    upsertLeadLocally(
      data
    );

    render();

    runSmartReminders();

    showToast(
      successMessage,
      'success'
    );

    return true;
  } catch (error) {
    console.error(
      'Quick status:',
      error
    );

    showToast(
      'Не удалось изменить статус.',
      'error'
    );

    return false;
  }
}

async function markLeadAsClient() {
  const lead =
    getActiveQuickActionLead();

  if (!lead) {
    return;
  }

  const confirmed =
    window.confirm(
      'Отметить «' +
      getDisplayName(lead) +
      '» как клиента?\n\n' +
      'Запись останется в Planner, но перестанет участвовать в активных напоминаниях.'
    );

  if (!confirmed) {
    return;
  }

  const success =
    await setLeadStatusQuickly(
      lead,
      'client',
      {
        clearDate: true,
        successMessage:
          'Лид отмечен как клиент.'
      }
    );

  if (success) {
    closeQuickActionsModal();
  }
}

async function markLeadAsLost() {
  const lead =
    getActiveQuickActionLead();

  if (!lead) {
    return;
  }

  const confirmed =
    window.confirm(
      'Отметить «' +
      getDisplayName(lead) +
      '» как неактуальный?\n\n' +
      'Запись не удалится и останется доступна в Planner.'
    );

  if (!confirmed) {
    return;
  }

  const success =
    await setLeadStatusQuickly(
      lead,
      'lost',
      {
        clearDate: true,
        successMessage:
          'Лид отмечен как неактуальный.'
      }
    );

  if (success) {
    closeQuickActionsModal();
  }
}


/* ============================================================
   25. QUICK ACTION — RESCHEDULE / PAUSE
   ============================================================ */

function resetActionScheduleForm() {
  elements.actionScheduleForm
    ?.reset();

  if (
    elements.actionScheduleLeadId
  ) {
    elements.actionScheduleLeadId.value =
      '';
  }

  if (
    elements.actionScheduleMode
  ) {
    elements.actionScheduleMode.value =
      '';
  }

  if (
    elements.actionSchedulePreset
  ) {
    elements.actionSchedulePreset.value =
      'week';
  }

  if (
    elements.actionScheduleDate
  ) {
    elements.actionScheduleDate.value =
      toLocalDateTimeInput(
        getPresetDate(
          'week'
        )
      );
  }

  if (
    elements.actionScheduleComment
  ) {
    elements.actionScheduleComment.value =
      '';
  }
}

function openActionScheduleModal(
  lead,
  mode
) {
  if (!lead) {
    return;
  }

  if (
    !elements.actionScheduleBackdrop
  ) {
    showToast(
      'Для этого действия нужно добавить небольшое окно в planner.html.',
      'warning',
      6000
    );

    return;
  }

  resetActionScheduleForm();

  elements.actionScheduleLeadId.value =
    lead.id;

  elements.actionScheduleMode.value =
    mode;

  elements.actionScheduleClient.textContent =
    getDisplayName(
      lead
    );

  elements.actionSchedulePreset.value =
    'week';

  elements.actionScheduleDate.value =
    toLocalDateTimeInput(
      getPresetDate(
        'week'
      )
    );

  if (
    mode ===
    'reschedule'
  ) {
    elements.actionScheduleTitle.textContent =
      'Перенести контакт';

    if (
      elements.actionScheduleSubtitle
    ) {
      elements.actionScheduleSubtitle.textContent =
        'Назначьте новую дату контакта. Статус лида останется прежним.';
    }
  }

  if (
    mode ===
    'pause'
  ) {
    elements.actionScheduleTitle.textContent =
      'Отложить лид';

    if (
      elements.actionScheduleSubtitle
    ) {
      elements.actionScheduleSubtitle.textContent =
        'Укажите дату, когда нужно вернуться к этому лиду.';
    }
  }

  closeQuickActionsModal();

  elements.actionScheduleBackdrop
    .classList.add(
      'show'
    );

  document.body
    .classList.add(
      'modal-open'
    );
}

function closeActionScheduleModal() {
  elements.actionScheduleBackdrop
    ?.classList.remove(
      'show'
    );

  document.body
    .classList.remove(
      'modal-open'
    );

  resetActionScheduleForm();
}

function openRescheduleFromQuickActions() {
  const lead =
    getActiveQuickActionLead();

  if (!lead) {
    return;
  }

  openActionScheduleModal(
    lead,
    'reschedule'
  );
}

function openPauseFromQuickActions() {
  const lead =
    getActiveQuickActionLead();

  if (!lead) {
    return;
  }

  openActionScheduleModal(
    lead,
    'pause'
  );
}

function applyActionSchedulePreset() {
  if (
    !elements.actionSchedulePreset ||
    !elements.actionScheduleDate
  ) {
    return;
  }

  const preset =
    elements.actionSchedulePreset
      .value;

  if (
    preset ===
    'custom'
  ) {
    elements.actionScheduleDate
      .focus();

    return;
  }

  const date =
    getPresetDate(
      preset
    );

  if (date) {
    elements.actionScheduleDate.value =
      toLocalDateTimeInput(
        date
      );
  }
}

async function handleActionScheduleSubmit(
  event
) {
  event.preventDefault();

  if (
    actionScheduleSaveInProgress
  ) {
    return;
  }

  const lead =
    getLeadById(
      elements.actionScheduleLeadId
        ?.value
    );

  if (!lead) {
    showToast(
      'Запись не найдена.',
      'warning'
    );

    closeActionScheduleModal();

    return;
  }

  const mode =
    elements.actionScheduleMode
      ?.value;

  if (
    mode !== 'reschedule' &&
    mode !== 'pause'
  ) {
    return;
  }

  const nextContact =
    toDatabaseTimestamp(
      elements.actionScheduleDate
        ?.value
    );

  if (!nextContact) {
    showToast(
      'Укажите дату.',
      'warning'
    );

    elements.actionScheduleDate
      ?.focus();

    return;
  }

  const comment =
    cleanText(
      elements.actionScheduleComment
        ?.value,
      2000
    );

  const payload = {
    next_contact:
      nextContact,

    updated_by:
      currentUser.id
  };

  if (
    mode ===
    'pause'
  ) {
    payload.status =
      'paused';
  }

  /*
   * Комментарий при переносе/отложении
   * становится новым "Следующим шагом".
   */

  if (comment) {
    payload.next_step =
      comment;
  }

  actionScheduleSaveInProgress =
    true;

  if (
    elements.actionScheduleSaveBtn
  ) {
    elements.actionScheduleSaveBtn.disabled =
      true;

    elements.actionScheduleSaveBtn.textContent =
      'Сохраняем…';
  }

  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .from('planner_leads')
        .update(
          payload
        )
        .eq(
          'id',
          lead.id
        )
        .select()
        .single();

    if (error) {
      throw error;
    }

    upsertLeadLocally(
      data
    );

    render();

    closeActionScheduleModal();

    runSmartReminders();

    showToast(
      mode === 'pause'
        ? 'Лид отложен.'
        : 'Дата контакта перенесена.',
      'success'
    );
  } catch (error) {
    console.error(
      'Schedule action:',
      error
    );

    showToast(
      'Не удалось сохранить действие.',
      'error'
    );
  } finally {
    actionScheduleSaveInProgress =
      false;

    if (
      elements.actionScheduleSaveBtn
    ) {
      elements.actionScheduleSaveBtn.disabled =
        false;

      elements.actionScheduleSaveBtn.textContent =
        'Сохранить';
    }
  }
}


/* ============================================================
   26. FILES
   ============================================================ */

function resetFileUploadForm() {
  if (
    elements.fileInput
  ) {
    elements.fileInput.value =
      '';
  }

  if (
    elements.fileDescription
  ) {
    elements.fileDescription.value =
      '';
  }

  updateSelectedFileDisplay();
}

function updateSelectedFileDisplay() {
  if (
    !elements.selectedFileName
  ) {
    return;
  }

  const file =
    elements.fileInput
      ?.files?.[0];

  if (!file) {
    elements.selectedFileName.textContent =
      'Файл не выбран';

    return;
  }

  elements.selectedFileName.textContent =
    file.name +
    ' · ' +
    formatFileSize(
      file.size
    );
}

function openFilesModal(id) {
  const lead =
    getLeadById(id);

  if (!lead) {
    showToast(
      'Запись не найдена.',
      'warning'
    );

    return;
  }

  if (
    !elements.filesBackdrop
  ) {
    return;
  }

  activeFilesLeadId =
    lead.id;

  elements.filesLeadId.value =
    lead.id;

  elements.filesClient.textContent =
    getDisplayName(
      lead
    );

  resetFileUploadForm();

  renderFilesList();

  elements.filesBackdrop
    .classList.add(
      'show'
    );

  document.body
    .classList.add(
      'modal-open'
    );
}

function closeFilesModal() {
  elements.filesBackdrop
    ?.classList.remove(
      'show'
    );

  document.body
    .classList.remove(
      'modal-open'
    );

  activeFilesLeadId =
    null;

  resetFileUploadForm();
}

function renderFilesList() {
  if (
    !elements.filesList
  ) {
    return;
  }

  if (
    !activeFilesLeadId
  ) {
    elements.filesList.innerHTML =
      '';

    return;
  }

  const files =
    getLeadFiles(
      activeFilesLeadId
    );

  if (
    files.length === 0
  ) {
    elements.filesList.innerHTML = `
      <div class="filesEmpty">

        <div class="filesEmptyIcon">
          📎
        </div>

        <div class="filesEmptyTitle">
          Файлов пока нет
        </div>

        <div class="filesEmptyText">
          Прикрепите первый файл к этому потенциальному клиенту.
        </div>

      </div>
    `;

    return;
  }

  elements.filesList.innerHTML =
    files
      .map(
        (file) => `
          <div class="fileItem">

            <div class="fileIcon">
              ${getFileIcon(
                file
              )}
            </div>

            <div class="fileInfo">

              <div class="fileName">
                ${escapeHtml(
                  file.original_file_name ||
                  file.file_name ||
                  'Файл'
                )}
              </div>

              <div class="fileMeta">
                ${escapeHtml(
                  [
                    formatFileSize(
                      file.file_size
                    ),
                    getUploaderDisplayName(
                      file
                    ),
                    formatFileDate(
                      file.created_at
                    )
                  ]
                    .filter(Boolean)
                    .join(' · ')
                )}
              </div>

              ${
                file.description
                  ? `
                    <div class="fileDescription">
                      ${escapeHtml(
                        file.description
                      )}
                    </div>
                  `
                  : ''
              }

            </div>

            <div class="fileActions">

              <button
                class="tableButton"
                type="button"
                data-file-action="open"
                data-file-id="${escapeHtml(
                  file.id
                )}"
              >
                Открыть
              </button>

              <button
                class="tableButton delete"
                type="button"
                data-file-action="delete"
                data-file-id="${escapeHtml(
                  file.id
                )}"
              >
                Удалить
              </button>

            </div>

          </div>
        `
      )
      .join('');
}

async function uploadSelectedFile() {
  const file =
    elements.fileInput
      ?.files?.[0];

  if (
    !file ||
    !activeFilesLeadId ||
    fileUploadInProgress
  ) {
    if (!file) {
      showToast(
        'Сначала выберите файл.',
        'warning'
      );
    }

    return;
  }

  if (
    file.size >
    MAX_FILE_SIZE
  ) {
    showToast(
      'Файл больше 20 МБ.',
      'warning'
    );

    return;
  }

  const safeName =
    sanitizeStorageFileName(
      file.name
    );

  const path =
    'leads/' +
    activeFilesLeadId +
    '/' +
    createRandomId() +
    '_' +
    safeName;

  fileUploadInProgress =
    true;

  if (
    elements.uploadFileBtn
  ) {
    elements.uploadFileBtn.disabled =
      true;

    elements.uploadFileBtn.textContent =
      'Загружаем…';
  }

  try {
    const {
      error:
        uploadError
    } =
      await supabaseClient
        .storage
        .from(
          STORAGE_BUCKET
        )
        .upload(
          path,
          file,
          {
            cacheControl:
              '3600',

            upsert:
              false,

            contentType:
              file.type ||
              undefined
          }
        );

    if (
      uploadError
    ) {
      throw uploadError;
    }

    const {
      data,
      error
    } =
      await supabaseClient
        .from('crm_files')
        .insert({
          lead_id:
            activeFilesLeadId,

          file_name:
            safeName,

          original_file_name:
            cleanText(
              file.name,
              255
            ),

          storage_bucket:
            STORAGE_BUCKET,

          storage_path:
            path,

          mime_type:
            file.type ||
            null,

          file_size:
            file.size,

          description:
            cleanText(
              elements.fileDescription
                ?.value,
              1000
            ) ||
            null,

          uploaded_by:
            currentUser.id
        })
        .select()
        .single();

    if (error) {
      await supabaseClient
        .storage
        .from(
          STORAGE_BUCKET
        )
        .remove([
          path
        ]);

      throw error;
    }

    const index =
      crmFiles.findIndex(
        (item) =>
          item.id ===
          data.id
      );

    if (
      index >= 0
    ) {
      crmFiles[index] =
        data;
    } else {
      crmFiles.push(
        data
      );
    }

    resetFileUploadForm();

    renderFilesList();

    renderTable();

    showToast(
      'Файл прикреплён.',
      'success'
    );
  } catch (error) {
    console.error(
      'Upload:',
      error
    );

    showToast(
      'Не удалось загрузить файл.',
      'error'
    );
  } finally {
    fileUploadInProgress =
      false;

    if (
      elements.uploadFileBtn
    ) {
      elements.uploadFileBtn.disabled =
        false;

      elements.uploadFileBtn.textContent =
        '＋ Прикрепить файл';
    }
  }
}

async function openFile(id) {
  const file =
    crmFiles.find(
      (item) =>
        item.id === id
    );

  if (!file) {
    return;
  }

  const popup =
    window.open(
      '',
      '_blank'
    );

  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .storage
        .from(
          file.storage_bucket ||
          STORAGE_BUCKET
        )
        .createSignedUrl(
          file.storage_path,
          SIGNED_URL_LIFETIME_SECONDS
        );

    if (error) {
      throw error;
    }

    if (
      !data?.signedUrl
    ) {
      throw new Error(
        'Signed URL missing'
      );
    }

    if (popup) {
      popup.location.href =
        data.signedUrl;
    } else {
      window.location.href =
        data.signedUrl;
    }
  } catch (error) {
    popup?.close();

    console.error(
      'Open file:',
      error
    );

    showToast(
      'Не удалось открыть файл.',
      'error'
    );
  }
}

async function deleteFile(id) {
  const file =
    crmFiles.find(
      (item) =>
        item.id === id
    );

  if (!file) {
    return;
  }

  if (
    !window.confirm(
      'Удалить файл «' +
      (
        file.original_file_name ||
        file.file_name
      ) +
      '»?'
    )
  ) {
    return;
  }

  try {
    if (
      file.storage_path
    ) {
      const {
        error:
          storageError
      } =
        await supabaseClient
          .storage
          .from(
            file.storage_bucket ||
            STORAGE_BUCKET
          )
          .remove([
            file.storage_path
          ]);

      if (
        storageError
      ) {
        throw storageError;
      }
    }

    const {
      error
    } =
      await supabaseClient
        .from('crm_files')
        .delete()
        .eq(
          'id',
          id
        );

    if (error) {
      throw error;
    }

    crmFiles =
      crmFiles.filter(
        (item) =>
          item.id !== id
      );

    renderFilesList();

    renderTable();

    showToast(
      'Файл удалён.',
      'success'
    );
  } catch (error) {
    console.error(
      'Delete file:',
      error
    );

    showToast(
      'Не удалось удалить файл.',
      'error'
    );
  }
}


/* ============================================================
   27. EDIT / DELETE LEAD
   ============================================================ */

function editLead(id) {
  const lead =
    getLeadById(id);

  if (!lead) {
    showToast(
      'Запись не найдена.',
      'warning'
    );

    return;
  }

  openLeadModal(
    lead
  );
}

async function deleteLead(id) {
  const lead =
    getLeadById(id);

  if (!lead) {
    return;
  }

  const files =
    getLeadFiles(
      id
    );

  const warning =
    files.length
      ? (
          '\n\nТакже будут удалены прикреплённые файлы: ' +
          files.length +
          '.'
        )
      : '';

  const confirmed =
    window.confirm(
      'Удалить запись «' +
      getDisplayName(
        lead
      ) +
      '»?' +
      warning +
      '\n\nЭто действие нельзя отменить.'
    );

  if (!confirmed) {
    return;
  }

  try {
    const storageGroups =
      new Map();

    files.forEach(
      (file) => {
        if (
          !file.storage_path
        ) {
          return;
        }

        const bucket =
          file.storage_bucket ||
          STORAGE_BUCKET;

        if (
          !storageGroups.has(
            bucket
          )
        ) {
          storageGroups.set(
            bucket,
            []
          );
        }

        storageGroups
          .get(bucket)
          .push(
            file.storage_path
          );
      }
    );

    for (
      const [
        bucket,
        paths
      ] of storageGroups
    ) {
      if (
        paths.length > 0
      ) {
        const {
          error
        } =
          await supabaseClient
            .storage
            .from(bucket)
            .remove(paths);

        if (error) {
          throw error;
        }
      }
    }

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

    crmFiles =
      crmFiles.filter(
        (file) =>
          file.lead_id !== id
      );

    render();

    showToast(
      'Запись удалена.',
      'success'
    );
  } catch (error) {
    console.error(
      'Delete lead:',
      error
    );

    showToast(
      'Не удалось удалить запись.',
      'error'
    );
  }
}

async function deleteLeadFromQuickActions() {
  const lead =
    getActiveQuickActionLead();

  if (!lead) {
    return;
  }

  closeQuickActionsModal();

  await deleteLead(
    lead.id
  );
}


/* ============================================================
   28. SMART NOTIFICATIONS
   ============================================================ */

function getTodayKey() {
  const now =
    new Date();

  return (
    now.getFullYear() +
    '-' +
    padNumber(
      now.getMonth() + 1
    ) +
    '-' +
    padNumber(
      now.getDate()
    )
  );
}

function readJsonStorage(
  key,
  fallback = {}
) {
  try {
    const raw =
      localStorage.getItem(
        key
      );

    return raw
      ? JSON.parse(raw)
      : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(
  key,
  value
) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(
        value
      )
    );
  } catch {
    /* Ничего */
  }
}

function loadNotificationHistory() {
  return readJsonStorage(
    NOTIFICATION_HISTORY_KEY,
    {}
  );
}

function saveNotificationHistory(
  history
) {
  const cutoff =
    Date.now() -
    (
      90 *
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
        Number(value) >=
        cutoff
      ) {
        cleaned[key] =
          Number(value);
      }
    }
  );

  writeJsonStorage(
    NOTIFICATION_HISTORY_KEY,
    cleaned
  );
}

function buildNotificationBody(
  lead
) {
  const parts = [];

  if (
    lead.next_contact
  ) {
    parts.push(
      formatTime(
        lead.next_contact
      )
    );
  }

  if (
    lead.communication_method
  ) {
    parts.push(
      METHOD_META[
        lead.communication_method
      ] ||
      lead.communication_method
    );
  }

  if (
    lead.next_step
  ) {
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

  return (
    parts
      .join(' · ')
      .slice(
        0,
        240
      ) ||
    'Откройте Planner для подробностей.'
  );
}

function showBrowserNotification(
  title,
  body,
  tag,
  leadId = null
) {
  if (
    !(
      'Notification'
      in window
    ) ||
    Notification.permission !==
      'granted'
  ) {
    return false;
  }

  try {
    const notification =
      new Notification(
        title,
        {
          body,
          icon:
            '/favicon.png',
          tag
        }
      );

    notification.onclick =
      () => {
        window.focus();

        if (leadId) {
          editLead(
            leadId
          );
        }

        notification.close();
      };

    return true;
  } catch {
    return false;
  }
}

function runTodayNotifications(
  history
) {
  const today =
    getTodayKey();

  getReminderScopeLeads()
    .filter(
      (lead) =>
        getDayDifference(
          lead.next_contact
        ) === 0
    )
    .forEach(
      (lead) => {
        const key =
          `today:${lead.id}:${today}`;

        if (
          history[key]
        ) {
          return;
        }

        const shown =
          showBrowserNotification(
            'Сегодня контакт: ' +
              getDisplayName(
                lead
              ),

            buildNotificationBody(
              lead
            ),

            key,

            lead.id
          );

        if (shown) {
          history[key] =
            Date.now();
        }
      }
    );
}

function runOneHourNotifications(
  history
) {
  getReminderScopeLeads()
    .forEach(
      (lead) => {
        const minutes =
          getMinutesUntil(
            lead.next_contact
          );

        if (
          minutes === null ||
          minutes < 0 ||
          minutes >
            REMINDER_SOON_MINUTES
        ) {
          return;
        }

        const key =
          `soon:${lead.id}:${lead.next_contact}`;

        if (
          history[key]
        ) {
          return;
        }

        const shown =
          showBrowserNotification(
            'Скоро контакт: ' +
              getDisplayName(
                lead
              ),

            (
              'Примерно через ' +
              Math.max(
                1,
                minutes
              ) +
              ' мин. · ' +
              buildNotificationBody(
                lead
              )
            ).slice(
              0,
              240
            ),

            key,

            lead.id
          );

        if (shown) {
          history[key] =
            Date.now();
        }
      }
    );
}

function runOverdueNotifications(
  history
) {
  const cooldown =
    OVERDUE_NOTIFICATION_COOLDOWN_HOURS *
    60 *
    60 *
    1000;

  getReminderScopeLeads()
    .filter(
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
    )
    .forEach(
      (lead) => {
        const days =
          Math.abs(
            getDayDifference(
              lead.next_contact
            )
          );

        const key =
          `overdue:${lead.id}`;

        const previous =
          Number(
            history[key] ||
            0
          );

        if (
          Date.now() -
            previous <
          cooldown
        ) {
          return;
        }

        const shown =
          showBrowserNotification(
            'Просрочен контакт: ' +
              getDisplayName(
                lead
              ),

            (
              'Просрочено на ' +
              days +
              ' ' +
              pluralizeDays(
                days
              ) +
              '. ' +
              buildNotificationBody(
                lead
              )
            ).slice(
              0,
              240
            ),

            key,

            lead.id
          );

        if (shown) {
          history[key] =
            Date.now();
        }
      }
    );
}

function showDailySummaryIfNeeded() {
  const today =
    getTodayKey();

  const history =
    readJsonStorage(
      DAILY_SUMMARY_HISTORY_KEY,
      {}
    );

  if (
    history[today]
  ) {
    return;
  }

  const summary =
    getSmartSummaryData();

  const text =
    `Сегодня: ${summary.today.length}. ` +
    `Просрочено: ${summary.overdue.length}. ` +
    `На ближайшие 7 дней: ${summary.week.length}.`;

  showToast(
    'Сводка: ' +
      text,
    summary.overdue.length
      ? 'warning'
      : 'success',
    8000
  );

  if (
    summary.today.length > 0 ||
    summary.overdue.length > 0
  ) {
    showBrowserNotification(
      'Planner — сводка на сегодня',
      text,
      'daily-summary-' +
        today
    );
  }

  history[today] =
    Date.now();

  writeJsonStorage(
    DAILY_SUMMARY_HISTORY_KEY,
    history
  );
}

function runSmartReminders() {
  renderSmartSummary();

  if (
    !currentUser
  ) {
    return;
  }

  const history =
    loadNotificationHistory();

  runTodayNotifications(
    history
  );

  runOneHourNotifications(
    history
  );

  runOverdueNotifications(
    history
  );

  saveNotificationHistory(
    history
  );

  showDailySummaryIfNeeded();
}


/* ============================================================
   29. NOTIFICATION PERMISSION
   ============================================================ */

function updateNotificationInterface() {
  if (
    !elements.notificationBtn
  ) {
    return;
  }

  if (
    !(
      'Notification'
      in window
    )
  ) {
    elements.notificationBtn.disabled =
      true;

    elements.notificationBtn.textContent =
      'Уведомления недоступны';

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
      'Notification'
      in window
    )
  ) {
    return;
  }

  if (
    Notification.permission ===
    'denied'
  ) {
    showToast(
      'Разрешите уведомления в настройках браузера.',
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
      permission ===
      'granted'
    ) {
      showToast(
        'Умные уведомления включены.',
        'success'
      );

      runSmartReminders();
    }
  } catch (error) {
    console.error(
      'Notifications:',
      error
    );
  }
}


/* ============================================================
   30. RESET / EXPORT
   ============================================================ */

function resetFilters() {
  Object.assign(
    state,
    {
      search: '',
      status: 'all',
      priority: 'all',
      responsible: 'all',
      date: 'all',
      sort: 'nearest'
    }
  );

  if (
    elements.searchInput
  ) {
    elements.searchInput.value =
      '';
  }

  if (
    elements.statusFilter
  ) {
    elements.statusFilter.value =
      'all';
  }

  if (
    elements.priorityFilter
  ) {
    elements.priorityFilter.value =
      'all';
  }

  if (
    elements.responsibleFilter
  ) {
    elements.responsibleFilter.value =
      'all';
  }

  if (
    elements.dateFilter
  ) {
    elements.dateFilter.value =
      'all';
  }

  if (
    elements.sortSelect
  ) {
    elements.sortSelect.value =
      'nearest';
  }

  renderTable();

  updateSmartSummarySelection();
}

function exportBackup() {
  const blob =
    new Blob(
      [
        JSON.stringify(
          {
            application:
              'ДжемБаланс — Planner',

            version:
              '2.5',

            exported_at:
              new Date()
                .toISOString(),

            leads,

            fileMetadata:
              crmFiles
          },
          null,
          2
        )
      ],
      {
        type:
          'application/json;charset=utf-8'
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      'a'
    );

  link.href =
    url;

  link.download =
    'jambalance-planner-' +
    getTodayKey() +
    '.json';

  document.body
    .appendChild(
      link
    );

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


/* ============================================================
   31. LEGACY MIGRATION
   ============================================================ */

function getLegacyLeads() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          LEGACY_STORAGE_KEY
        ) ||
        '[]'
      );

    return Array.isArray(
      parsed
    )
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function checkLegacyMigration() {
  if (
    !elements.migrationPanel
  ) {
    return;
  }

  if (
    localStorage.getItem(
      MIGRATION_DONE_KEY
    ) === '1' ||
    localStorage.getItem(
      MIGRATION_DISMISSED_KEY
    ) === '1'
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
    legacy.length
  ) {
    elements.migrationPanel
      .classList.add(
        'show'
      );

    if (
      elements.migrateBtn
    ) {
      elements.migrateBtn.textContent =
        `Перенести ${legacy.length} ${pluralizeRecords(
          legacy.length
        )}`;
    }
  }
}

async function migrateLegacyData() {
  const legacy =
    getLegacyLeads();

  if (
    !legacy.length
  ) {
    return;
  }

  const rows =
    legacy
      .filter(
        (item) =>
          cleanText(
            item.clientName
          )
      )
      .map(
        (item) => ({
          client_name:
            cleanText(
              item.clientName,
              180
            ),

          org_form:
            cleanText(
              item.orgForm,
              80
            ) ||
            null,

          inn:
            cleanText(
              item.inn,
              20
            ) ||
            null,

          activity:
            cleanText(
              item.activity,
              180
            ) ||
            null,

          source:
            cleanText(
              item.source,
              140
            ) ||
            null,

          phone:
            cleanText(
              item.phone,
              80
            ) ||
            null,

          email:
            cleanText(
              item.email,
              180
            ) ||
            null,

          communication_method:
            item.communicationMethod ||
            null,

          estimated_amount:
            cleanText(
              item.estimatedAmount,
              120
            ) ||
            null,

          priority:
            item.priority ||
            'none',

          status:
            item.status ||
            'new',

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
            ) ||
            null,

          next_step:
            cleanText(
              item.nextStep,
              2000
            ) ||
            null,

          notes:
            cleanText(
              item.notes,
              3000
            ) ||
            null,

          responsible_user:
            currentUser.id,

          created_by:
            currentUser.id,

          updated_by:
            currentUser.id
        })
      );

  try {
    const {
      error
    } =
      await supabaseClient
        .from('planner_leads')
        .insert(
          rows
        );

    if (error) {
      throw error;
    }

    localStorage.setItem(
      MIGRATION_DONE_KEY,
      '1'
    );

    elements.migrationPanel
      ?.classList.remove(
        'show'
      );

    await loadLeads();

    showToast(
      'Старые записи перенесены.',
      'success'
    );
  } catch (error) {
    console.error(
      'Migration:',
      error
    );

    showToast(
      'Не удалось перенести старые записи.',
      'error'
    );
  }
}

function skipLegacyMigration() {
  localStorage.setItem(
    MIGRATION_DISMISSED_KEY,
    '1'
  );

  elements.migrationPanel
    ?.classList.remove(
      'show'
    );
}


/* ============================================================
   32. REALTIME
   ============================================================ */

function subscribeToRealtime() {
  if (
    realtimeChannel
  ) {
    supabaseClient
      .removeChannel(
        realtimeChannel
      );
  }

  if (
    profilesRealtimeChannel
  ) {
    supabaseClient
      .removeChannel(
        profilesRealtimeChannel
      );
  }

  if (
    filesRealtimeChannel
  ) {
    supabaseClient
      .removeChannel(
        filesRealtimeChannel
      );
  }

  realtimeChannel =
    supabaseClient
      .channel(
        'planner-v25'
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table:
            'planner_leads'
        },
        () => {
          loadLeads({
            silent: true
          });
        }
      )
      .subscribe();

  profilesRealtimeChannel =
    supabaseClient
      .channel(
        'profiles-v25'
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table:
            'profiles'
        },
        async () => {
          try {
            await loadProfiles();

            render();
          } catch (error) {
            console.warn(
              'Profiles realtime:',
              error
            );
          }
        }
      )
      .subscribe();

  filesRealtimeChannel =
    supabaseClient
      .channel(
        'files-v25'
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table:
            'crm_files'
        },
        () => {
          loadLeads({
            silent: true
          });
        }
      )
      .subscribe();
}


/* ============================================================
   33. EVENTS
   ============================================================ */

function bindEvents() {
  elements.addLeadBtn
    ?.addEventListener(
      'click',
      () => {
        openLeadModal();
      }
    );

  elements.closeModalBtn
    ?.addEventListener(
      'click',
      closeLeadModal
    );

  elements.cancelBtn
    ?.addEventListener(
      'click',
      closeLeadModal
    );

  elements.modalBackdrop
    ?.addEventListener(
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
    ?.addEventListener(
      'submit',
      handleLeadSubmit
    );


  /* Фильтры */

  elements.searchInput
    ?.addEventListener(
      'input',
      () => {
        state.search =
          elements.searchInput.value;

        renderTable();
      }
    );

  elements.statusFilter
    ?.addEventListener(
      'change',
      () => {
        state.status =
          elements.statusFilter.value;

        renderTable();
      }
    );

  elements.priorityFilter
    ?.addEventListener(
      'change',
      () => {
        state.priority =
          elements.priorityFilter.value;

        renderTable();
      }
    );

  elements.responsibleFilter
    ?.addEventListener(
      'change',
      () => {
        state.responsible =
          elements.responsibleFilter.value;

        renderTable();
      }
    );

  elements.dateFilter
    ?.addEventListener(
      'change',
      () => {
        state.date =
          elements.dateFilter.value;

        renderTable();

        updateSmartSummarySelection();
      }
    );

  elements.sortSelect
    ?.addEventListener(
      'change',
      () => {
        state.sort =
          elements.sortSelect.value;

        renderTable();
      }
    );

  elements.resetFiltersBtn
    ?.addEventListener(
      'click',
      resetFilters
    );


  /* Кликабельная сводка */

  elements.smartSummary
    ?.addEventListener(
      'click',
      (event) => {
        const item =
          event.target.closest(
            '[data-summary-filter]'
          );

        if (!item) {
          return;
        }

        const selected =
          item.dataset.summaryFilter;

        state.date =
          state.date ===
            selected
            ? 'all'
            : selected;

        if (
          elements.dateFilter
        ) {
          elements.dateFilter.value =
            state.date;
        }

        renderTable();

        updateSmartSummarySelection();
      }
    );


  /* Верхние кнопки */

  elements.refreshBtn
    ?.addEventListener(
      'click',
      () => {
        loadLeads();
      }
    );

  elements.exportBtn
    ?.addEventListener(
      'click',
      exportBackup
    );

  elements.notificationBtn
    ?.addEventListener(
      'click',
      requestNotifications
    );

  elements.migrateBtn
    ?.addEventListener(
      'click',
      migrateLegacyData
    );

  elements.skipMigrationBtn
    ?.addEventListener(
      'click',
      skipLegacyMigration
    );


  /* Кнопки в строке таблицы */

  elements.leadTableBody
    ?.addEventListener(
      'click',
      (event) => {
        const button =
          event.target.closest(
            '[data-action]'
          );

        if (!button) {
          return;
        }

        const id =
          button.dataset.id;

        switch (
          button.dataset.action
        ) {
          case 'contacted':
            openQuickContactModal(
              id
            );
            break;

          case 'quick-actions':
            openQuickActionsModal(
              id
            );
            break;

          case 'files':
            openFilesModal(
              id
            );
            break;

          case 'edit':
            editLead(
              id
            );
            break;
        }
      }
    );


  /* "Связался" */

  elements.quickContactCloseBtn
    ?.addEventListener(
      'click',
      closeQuickContactModal
    );

  elements.quickContactCancelBtn
    ?.addEventListener(
      'click',
      closeQuickContactModal
    );

  elements.quickContactBackdrop
    ?.addEventListener(
      'click',
      (event) => {
        if (
          event.target ===
          elements.quickContactBackdrop
        ) {
          closeQuickContactModal();
        }
      }
    );

  elements.quickContactForm
    ?.addEventListener(
      'submit',
      handleQuickContactSubmit
    );

  elements.quickContactPreset
    ?.addEventListener(
      'change',
      applyQuickContactPreset
    );

  elements.quickContactDate
    ?.addEventListener(
      'input',
      () => {
        if (
          elements.quickContactPreset
        ) {
          elements.quickContactPreset.value =
            'custom';
        }
      }
    );


  /* v2.5 — меню быстрых действий */

  elements.quickActionsCloseBtn
    ?.addEventListener(
      'click',
      closeQuickActionsModal
    );

  elements.quickActionsCancelBtn
    ?.addEventListener(
      'click',
      closeQuickActionsModal
    );

  elements.quickActionsBackdrop
    ?.addEventListener(
      'click',
      (event) => {
        if (
          event.target ===
          elements.quickActionsBackdrop
        ) {
          closeQuickActionsModal();
        }
      }
    );

  elements.quickActionRescheduleBtn
    ?.addEventListener(
      'click',
      openRescheduleFromQuickActions
    );

  elements.quickActionPauseBtn
    ?.addEventListener(
      'click',
      openPauseFromQuickActions
    );

  elements.quickActionClientBtn
    ?.addEventListener(
      'click',
      markLeadAsClient
    );

  elements.quickActionLostBtn
    ?.addEventListener(
      'click',
      markLeadAsLost
    );

  elements.quickActionDeleteBtn
    ?.addEventListener(
      'click',
      deleteLeadFromQuickActions
    );


  /* Перенести / Отложить */

  elements.actionScheduleCloseBtn
    ?.addEventListener(
      'click',
      closeActionScheduleModal
    );

  elements.actionScheduleCancelBtn
    ?.addEventListener(
      'click',
      closeActionScheduleModal
    );

  elements.actionScheduleBackdrop
    ?.addEventListener(
      'click',
      (event) => {
        if (
          event.target ===
          elements.actionScheduleBackdrop
        ) {
          closeActionScheduleModal();
        }
      }
    );

  elements.actionScheduleForm
    ?.addEventListener(
      'submit',
      handleActionScheduleSubmit
    );

  elements.actionSchedulePreset
    ?.addEventListener(
      'change',
      applyActionSchedulePreset
    );

  elements.actionScheduleDate
    ?.addEventListener(
      'input',
      () => {
        if (
          elements.actionSchedulePreset
        ) {
          elements.actionSchedulePreset.value =
            'custom';
        }
      }
    );


  /* Files */

  elements.filesCloseBtn
    ?.addEventListener(
      'click',
      closeFilesModal
    );

  elements.filesDoneBtn
    ?.addEventListener(
      'click',
      closeFilesModal
    );

  elements.filesBackdrop
    ?.addEventListener(
      'click',
      (event) => {
        if (
          event.target ===
          elements.filesBackdrop
        ) {
          closeFilesModal();
        }
      }
    );

  elements.uploadFileBtn
    ?.addEventListener(
      'click',
      uploadSelectedFile
    );

  elements.fileInput
    ?.addEventListener(
      'change',
      updateSelectedFileDisplay
    );

  elements.filesList
    ?.addEventListener(
      'click',
      (event) => {
        const button =
          event.target.closest(
            '[data-file-action]'
          );

        if (!button) {
          return;
        }

        const id =
          button.dataset.fileId;

        if (
          button.dataset.fileAction ===
          'open'
        ) {
          openFile(
            id
          );
        }

        if (
          button.dataset.fileAction ===
          'delete'
        ) {
          deleteFile(
            id
          );
        }
      }
    );


  /* Drag & Drop */

  elements.fileDropZone
    ?.addEventListener(
      'click',
      () => {
        elements.fileInput
          ?.click();
      }
    );

  elements.fileDropZone
    ?.addEventListener(
      'keydown',
      (event) => {
        if (
          event.key ===
            'Enter' ||
          event.key ===
            ' '
        ) {
          event.preventDefault();

          elements.fileInput
            ?.click();
        }
      }
    );

  elements.fileDropZone
    ?.addEventListener(
      'dragover',
      (event) => {
        event.preventDefault();

        elements.fileDropZone
          .classList.add(
            'dragging'
          );
      }
    );

  elements.fileDropZone
    ?.addEventListener(
      'dragleave',
      () => {
        elements.fileDropZone
          .classList.remove(
            'dragging'
          );
      }
    );

  elements.fileDropZone
    ?.addEventListener(
      'drop',
      (event) => {
        event.preventDefault();

        elements.fileDropZone
          .classList.remove(
            'dragging'
          );

        const file =
          event.dataTransfer
            ?.files?.[0];

        if (
          !file ||
          !elements.fileInput
        ) {
          return;
        }

        try {
          const transfer =
            new DataTransfer();

          transfer.items.add(
            file
          );

          elements.fileInput.files =
            transfer.files;

          updateSelectedFileDisplay();
        } catch {
          showToast(
            'Не удалось принять перетащенный файл. Выберите его обычным способом.',
            'warning'
          );
        }
      }
    );


  /* ESC */

  document.addEventListener(
    'keydown',
    (event) => {
      if (
        event.key !==
        'Escape'
      ) {
        return;
      }

      if (
        elements.actionScheduleBackdrop
          ?.classList.contains(
            'show'
          )
      ) {
        closeActionScheduleModal();

        return;
      }

      if (
        elements.quickActionsBackdrop
          ?.classList.contains(
            'show'
          )
      ) {
        closeQuickActionsModal();

        return;
      }

      if (
        elements.filesBackdrop
          ?.classList.contains(
            'show'
          )
      ) {
        closeFilesModal();

        return;
      }

      if (
        elements.quickContactBackdrop
          ?.classList.contains(
            'show'
          )
      ) {
        closeQuickContactModal();

        return;
      }

      if (
        elements.modalBackdrop
          ?.classList.contains(
            'show'
          )
      ) {
        closeLeadModal();
      }
    }
  );


  /* Возврат на вкладку */

  document.addEventListener(
    'visibilitychange',
    () => {
      if (
        !document.hidden
      ) {
        loadLeads({
          silent: true
        });

        runSmartReminders();
      }
    }
  );

  window.addEventListener(
    'focus',
    () => {
      runSmartReminders();
    }
  );

  window.addEventListener(
    'online',
    () => {
      showToast(
        'Соединение восстановлено.',
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
        'Нет подключения к интернету.',
        'warning',
        6000
      );
    }
  );
}


/* ============================================================
   34. PERIODIC TASKS
   ============================================================ */

function startPeriodicTasks() {
  window.setInterval(
    () => {
      render();

      runSmartReminders();
    },
    60 * 1000
  );

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
   35. AUTH WATCHER
   ============================================================ */

function bindAuthWatcher() {
  supabaseClient
    .auth
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
   36. INITIALIZE
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

    await loadProfiles();

    setLoadingText(
      'Загружаем Planner…'
    );

    await loadLeads({
      silent: true
    });

    setLoadingText(
      'Подключаем синхронизацию…'
    );

    subscribeToRealtime();

    updateNotificationInterface();

    checkLegacyMigration();

    showApplication();

    startPeriodicTasks();

    runSmartReminders();
  } catch (error) {
    console.error(
      'Planner init:',
      error
    );

    showFatalError(
      'Не удалось подключиться к общей базе.'
    );
  }
}


/* ============================================================
   37. START
   ============================================================ */

initialize();