'use strict';

/* ============================================================
   ДЖЕМБАЛАНС — PLANNER v2.3
   Supabase + Auth + Realtime + Responsible users
   + Quick action "Связался"
   + Private file attachments
   ============================================================ */


/* ============================================================
   1. SUPABASE
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
  60 * 5;


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
   4. DOM
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
    document.getElementById('selectedFileName')
};


/* ============================================================
   5. STATE
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

let fileUploadInProgress = false;

let activeFilesLeadId = null;


/* ============================================================
   6. HELPERS
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
  return String(value)
    .padStart(2, '0');
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

  const lastDigit =
    number % 10;

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

function pluralizeRecords(value) {
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

function pluralizeFiles(value) {
  const number =
    Math.abs(value) % 100;

  const digit =
    number % 10;

  if (
    number >= 11 &&
    number <= 19
  ) {
    return 'файлов';
  }

  if (digit === 1) {
    return 'файл';
  }

  if (
    digit >= 2 &&
    digit <= 4
  ) {
    return 'файла';
  }

  return 'файлов';
}

function getInitials(name, email) {
  const source =
    cleanText(name, 200) ||
    cleanText(
      email,
      200
    ).split('@')[0] ||
    'Д';

  const words =
    source
      .split(/\s+/)
      .filter(Boolean);

  if (
    words.length >= 2
  ) {
    return (
      words[0][0] +
      words[1][0]
    ).toLocaleUpperCase(
      'ru-RU'
    );
  }

  return source
    .slice(0, 2)
    .toLocaleUpperCase(
      'ru-RU'
    );
}

function getDisplayName(lead) {
  const name =
    cleanText(
      lead.client_name,
      180
    );

  const form =
    cleanText(
      lead.org_form,
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
    lead.status
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
      .slice(2, 12)
  );
}

function sanitizeStorageFileName(fileName) {
  const original =
    cleanText(
      fileName,
      220
    );

  const dotIndex =
    original.lastIndexOf('.');

  const extension =
    dotIndex > 0
      ? original
          .slice(dotIndex + 1)
          .toLowerCase()
          .replace(
            /[^a-z0-9]/g,
            ''
          )
          .slice(0, 12)
      : '';

  const base =
    (
      dotIndex > 0
        ? original.slice(
            0,
            dotIndex
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
      .slice(0, 70) ||
    'file';

  return extension
    ? `${base}.${extension}`
    : base;
}

function formatFileSize(bytes) {
  const size =
    Number(bytes);

  if (
    !Number.isFinite(size) ||
    size < 0
  ) {
    return '';
  }

  if (size < 1024) {
    return `${size} Б`;
  }

  if (
    size <
    1024 * 1024
  ) {
    return (
      (
        size / 1024
      ).toFixed(1) +
      ' КБ'
    );
  }

  return (
    (
      size /
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
    mime ===
      'application/pdf' ||
    name.endsWith('.pdf')
  ) {
    return '📕';
  }

  if (
    name.endsWith('.doc') ||
    name.endsWith('.docx')
  ) {
    return '📘';
  }

  if (
    name.endsWith('.xls') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.csv')
  ) {
    return '📗';
  }

  if (
    name.endsWith('.zip') ||
    name.endsWith('.rar') ||
    name.endsWith('.7z')
  ) {
    return '🗜️';
  }

  return '📄';
}


/* ============================================================
   7. PROFILE HELPERS
   ============================================================ */

function getProfileById(id) {
  if (!id) {
    return null;
  }

  return (
    profiles.find(
      (profile) =>
        profile.id === id
    ) || null
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
    !lead.responsible_user
  ) {
    return 'Не назначен';
  }

  const profile =
    getProfileById(
      lead.responsible_user
    );

  if (profile) {
    return getProfileDisplayName(
      profile
    );
  }

  return 'Сотрудник';
}

function getUploaderDisplayName(file) {
  if (!file?.uploaded_by) {
    return '';
  }

  const profile =
    getProfileById(
      file.uploaded_by
    );

  return profile
    ? getProfileDisplayName(
        profile
      )
    : 'Сотрудник';
}


/* ============================================================
   8. DATE HELPERS
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
    getLocalDayNumber(
      target
    ) -
    getLocalDayNumber(
      new Date()
    )
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
      label:
        'Дата не назначена',
      dateText:
        'Не назначен'
    };
  }

  const date =
    new Date(
      lead.next_contact
    );

  if (!isValidDate(date)) {
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
        pluralizeDays(days),

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
  numberOfDays
) {
  const result =
    new Date(date);

  result.setDate(
    result.getDate() +
    numberOfDays
  );

  return result;
}

function addMonths(
  date,
  numberOfMonths
) {
  const result =
    new Date(date);

  const originalDay =
    result.getDate();

  result.setDate(1);

  result.setMonth(
    result.getMonth() +
    numberOfMonths
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
   9. TOAST
   ============================================================ */

function showToast(
  message,
  type = 'success',
  duration = 4200
) {
  if (!elements.toastStack) {
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
   10. LOADING
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
    window.alert(message);

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
   11. SUPABASE CLIENT
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
            persistSession:
              true,

            autoRefreshToken:
              true,

            detectSessionInUrl:
              true
          }
        }
      );
}


/* ============================================================
   12. AUTH
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

  const session =
    data?.session;

  if (
    !session?.user
  ) {
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
      .from(
        'profiles'
      )
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
    cleanText(
      currentProfile
        ?.full_name,
      200
    ) ||
    currentUser
      ?.email
      ?.split('@')[0] ||
    'Сотрудник';

  const email =
    cleanText(
      currentProfile
        ?.email,
      200
    ) ||
    currentUser
      ?.email ||
    '';

  if (
    elements.userName
  ) {
    elements.userName
      .textContent =
        name;
  }

  if (
    elements.userEmail
  ) {
    elements.userEmail
      .textContent =
        email;
  }

  if (
    elements.userAvatar
  ) {
    elements.userAvatar
      .textContent =
        getInitials(
          name,
          email
        );
  }
}


/* ============================================================
   13. PROFILES
   ============================================================ */

async function loadProfiles() {
  setLoadingText(
    'Загружаем список сотрудников…'
  );

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        'profiles'
      )
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
          ascending:
            true
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
          'ru',
          {
            sensitivity:
              'base'
          }
        )
  );

  renderResponsibleOptions();
}


/* ============================================================
   14. RESPONSIBLE OPTIONS
   ============================================================ */

function renderResponsibleOptions() {
  if (
    elements.responsibleUser
  ) {
    const oldValue =
      elements.responsibleUser
        .value;

    const options = [
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
            ? (
                name +
                ' — ' +
                position
              )
            : name;

        options.push(`
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

    elements.responsibleUser
      .innerHTML =
        options.join('');

    if (
      oldValue &&
      profiles.some(
        (profile) =>
          profile.id ===
            oldValue
      )
    ) {
      elements.responsibleUser
        .value =
          oldValue;
    }
  }

  if (
    elements.responsibleFilter
  ) {
    const oldValue =
      elements.responsibleFilter
        .value ||
      state.responsible ||
      'all';

    const options = [
      '<option value="all">Все сотрудники</option>',
      '<option value="mine">Только мои</option>',
      '<option value="none">Не назначен</option>'
    ];

    profiles.forEach(
      (profile) => {
        options.push(`
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
        options.join('');

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

    if (
      allowed.has(
        oldValue
      )
    ) {
      elements.responsibleFilter
        .value =
          oldValue;
    } else {
      elements.responsibleFilter
        .value =
          'all';

      state.responsible =
        'all';
    }
  }

  renderQuickContactResponsibleOptions();
}

function renderQuickContactResponsibleOptions() {
  if (
    !elements.quickContactResponsible
  ) {
    return;
  }

  const oldValue =
    elements.quickContactResponsible
      .value;

  const options = [
    '<option value="">Не назначен</option>'
  ];

  profiles.forEach(
    (profile) => {
      options.push(`
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

  elements.quickContactResponsible
    .innerHTML =
      options.join('');

  if (
    oldValue &&
    profiles.some(
      (profile) =>
        profile.id ===
          oldValue
    )
  ) {
    elements.quickContactResponsible
      .value =
        oldValue;
  }
}


/* ============================================================
   15. LOAD LEADS
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
          .from(
            'planner_leads'
          )
          .select('*')
          .order(
            'created_at',
            {
              ascending:
                false
            }
          ),

        supabaseClient
          .from(
            'crm_files'
          )
          .select('*')
          .not(
            'lead_id',
            'is',
            null
          )
          .order(
            'created_at',
            {
              ascending:
                false
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

    checkTodayNotifications();
  } catch (error) {
    console.error(
      'Ошибка загрузки данных:',
      error
    );

    showToast(
      'Не удалось загрузить общую таблицу.',
      'error'
    );
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

function upsertFileLocally(file) {
  if (!file?.id) {
    return;
  }

  const index =
    crmFiles.findIndex(
      (item) =>
        item.id === file.id
    );

  if (index >= 0) {
    crmFiles[index] =
      file;
  } else {
    crmFiles.push(
      file
    );
  }
}

function removeFileLocally(id) {
  crmFiles =
    crmFiles.filter(
      (file) =>
        file.id !== id
    );
}


/* ============================================================
   17. SEARCH
   ============================================================ */

function getSearchText(lead) {
  const fileNames =
    getLeadFiles(
      lead.id
    )
      .map(
        (file) =>
          file.original_file_name ||
          file.file_name
      )
      .join(' ');

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
      fileNames
    ].join(' ')
  );
}


/* ============================================================
   18. FILTERS
   ============================================================ */

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
      difference ===
      null
    );
  }

  if (
    difference ===
    null
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
   19. SORT
   ============================================================ */

function sortLeads(items) {
  const copy = [
    ...items
  ];

  if (
    state.sort ===
    'name'
  ) {
    return copy.sort(
      (a, b) =>
        getDisplayName(a)
          .localeCompare(
            getDisplayName(b),
            'ru',
            {
              sensitivity:
                'base'
            }
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
        const aPriority =
          PRIORITY_META[
            a.priority ||
            'none'
          ]?.order ||
          4;

        const bPriority =
          PRIORITY_META[
            b.priority ||
            'none'
          ]?.order ||
          4;

        if (
          aPriority !==
          bPriority
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
      const aClosed =
        isClosed(a);

      const bClosed =
        isClosed(b);

      if (
        aClosed !==
        bClosed
      ) {
        return aClosed
          ? 1
          : -1;
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
        aHasDate !==
        bHasDate
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

        if (
          difference !== 0
        ) {
          return difference;
        }
      }

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

      return getDisplayName(a)
        .localeCompare(
          getDisplayName(b),
          'ru',
          {
            sensitivity:
              'base'
          }
        );
    }
  );
}


/* ============================================================
   20. STATISTICS
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

  elements.statActive
    ?.replaceChildren(
      document.createTextNode(
        String(
          active.length
        )
      )
    );

  elements.statToday
    ?.replaceChildren(
      document.createTextNode(
        String(today)
      )
    );

  elements.statWeek
    ?.replaceChildren(
      document.createTextNode(
        String(week)
      )
    );

  elements.statOverdue
    ?.replaceChildren(
      document.createTextNode(
        String(overdue)
      )
    );

  elements.statNoDate
    ?.replaceChildren(
      document.createTextNode(
        String(noDate)
      )
    );
}


/* ============================================================
   21. TABLE ROW
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

  const classes = [];

  if (
    isClosed(lead)
  ) {
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
        href="tel:${escapeHtml(
          phoneHref
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

        <span
          class="dialogueLabel"
        >
          Предыдущий диалог
        </span>

        <div
          class="dialogueText"
        >
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

        <span
          class="dialogueLabel"
        >
          Следующий шаг
        </span>

        <div
          class="dialogueText"
        >
          ${escapeHtml(
            lead.next_step
          )}
        </div>

      </div>
    `);
  }

  const business = [];

  if (
    lead.source
  ) {
    business.push(`
      <div class="clientMeta">
        Канал:
        ${escapeHtml(
          lead.source
        )}
      </div>
    `);
  }

  if (
    lead.activity
  ) {
    business.push(`
      <div class="activity">
        ${escapeHtml(
          lead.activity
        )}
      </div>
    `);
  }

  const methodLabel =
    METHOD_META[
      lead.communication_method
    ];

  const responsible =
    getProfileById(
      lead.responsible_user
    );

  let responsibleHtml =
    '<span class="muted">Не назначен</span>';

  if (responsible) {
    const responsibleName =
      getProfileDisplayName(
        responsible
      );

    const initials =
      getInitials(
        responsibleName,
        responsible.email
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
            initials
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
            responsibleName
          )}
        </span>
      </div>
    `;
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
          title="Зафиксировать контакт и назначить следующий"
        >
          📞 Связался
        </button>
      `;

  const fileCount =
    getLeadFileCount(
      lead.id
    );

  const filesButton = `
    <button
      class="tableButton"
      type="button"
      data-action="files"
      data-id="${escapeHtml(
        lead.id
      )}"
      title="Файлы клиента"
    >
      📎 Файлы${
        fileCount > 0
          ? ' (' +
            fileCount +
            ')'
          : ''
      }
    </button>
  `;

  return `
    <tr
      class="${classes.join(
        ' '
      )}"
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
              <span
                class="pill methodPill"
              >
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
          <span
            class="priorityDot"
          ></span>

          ${escapeHtml(
            priority.label
          )}
        </span>
      </td>

      <td>
        ${responsibleHtml}
      </td>

      <td>
        <div
          class="dateMain"
        >
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
              <div
                class="notesText"
              >
                ${escapeHtml(
                  lead.notes
                )}
              </div>
            `
            : '<span class="muted">Нет примечаний</span>'
        }
      </td>

      <td>
        <div
          class="rowActions"
        >

          ${quickContactButton}

          ${filesButton}

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


/* ============================================================
   22. TABLE RENDER
   ============================================================ */

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
    elements.visibleCount
      .textContent =
        'Показано: ' +
        visible.length +
        ' из ' +
        leads.length;
  }

  if (
    visible.length ===
    0
  ) {
    elements.leadTableBody
      .innerHTML = `
        <tr>
          <td
            class="emptyCell"
            colspan="12"
          >
            <div
              class="emptyTitle"
            >
              Записей не найдено
            </div>

            <div
              class="emptyText"
            >
              Измените фильтры или добавьте нового
              потенциального клиента.
            </div>
          </td>
        </tr>
      `;

    return;
  }

  elements.leadTableBody
    .innerHTML =
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
   23. MAIN FORM
   ============================================================ */

function resetLeadForm() {
  elements.leadForm
    ?.reset();

  if (
    elements.leadId
  ) {
    elements.leadId
      .value =
        '';
  }

  if (
    elements.priority
  ) {
    elements.priority
      .value =
        'none';
  }

  if (
    elements.status
  ) {
    elements.status
      .value =
        'new';
  }

  if (
    elements.communicationMethod
  ) {
    elements.communicationMethod
      .value =
        '';
  }

  if (
    elements.responsibleUser &&
    currentUser?.id
  ) {
    elements.responsibleUser
      .value =
        currentUser.id;
  }
}

function openLeadModal(
  lead = null
) {
  resetLeadForm();

  if (lead) {
    elements.modalTitle
      .textContent =
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

    if (
      elements.responsibleUser
    ) {
      elements.responsibleUser
        .value =
          lead.responsible_user ||
          '';
    }

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
  } else {
    elements.modalTitle
      .textContent =
        'Новый потенциальный клиент';
  }

  elements.modalBackdrop
    .classList.add(
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
      ) || null,

    inn:
      cleanText(
        elements.inn
          ?.value,
        20
      ) || null,

    activity:
      cleanText(
        elements.activity
          ?.value,
        180
      ) || null,

    source:
      cleanText(
        elements.source
          ?.value,
        140
      ) || null,

    phone:
      cleanText(
        elements.phone
          ?.value,
        80
      ) || null,

    email:
      cleanText(
        elements.email
          ?.value,
        180
      ) || null,

    communication_method:
      elements.communicationMethod
        ?.value ||
      null,

    estimated_amount:
      cleanText(
        elements.estimatedAmount
          ?.value,
        120
      ) || null,

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
      ) || null,

    next_step:
      cleanText(
        elements.nextStep
          ?.value,
        2000
      ) || null,

    notes:
      cleanText(
        elements.notes
          ?.value,
        3000
      ) || null
  };
}


/* ============================================================
   24. MAIN SAVE
   ============================================================ */

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

  elements.saveLeadBtn.disabled =
    true;

  elements.saveLeadBtn.textContent =
    'Сохраняем…';

  const leadId =
    cleanText(
      elements.leadId
        ?.value,
      100
    );

  const existingLead =
    leadId
      ? leads.find(
          (lead) =>
            lead.id ===
            leadId
        )
      : null;

  try {
    if (
      existingLead
    ) {
      payload.updated_by =
        currentUser.id;

      const {
        data,
        error
      } =
        await supabaseClient
          .from(
            'planner_leads'
          )
          .update(
            payload
          )
          .eq(
            'id',
            existingLead.id
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

      if (
        !payload.responsible_user
      ) {
        payload.responsible_user =
          currentUser.id;
      }

      const {
        data,
        error
      } =
        await supabaseClient
          .from(
            'planner_leads'
          )
          .insert(
            payload
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
    saveInProgress =
      false;

    elements.saveLeadBtn.disabled =
      false;

    elements.saveLeadBtn.textContent =
      'Сохранить запись';
  }
}

function upsertLeadLocally(
  lead
) {
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
   25. QUICK CONTACT
   ============================================================ */

function resetQuickContactForm() {
  elements.quickContactForm
    ?.reset();

  if (
    elements.quickContactLeadId
  ) {
    elements.quickContactLeadId
      .value =
        '';
  }

  if (
    elements.quickContactPreset
  ) {
    elements.quickContactPreset
      .value =
        'week';
  }

  if (
    elements.quickContactDate
  ) {
    elements.quickContactDate
      .value =
        toLocalDateTimeInput(
          getPresetDate(
            'week'
          )
        );
  }

  if (
    elements.quickContactComment
  ) {
    elements.quickContactComment
      .value =
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
    !elements.quickContactBackdrop ||
    !elements.quickContactForm
  ) {
    showToast(
      'Для кнопки «Связался» нужно добавить окно в planner.html.',
      'warning',
      6000
    );

    return;
  }

  resetQuickContactForm();

  elements.quickContactLeadId
    .value =
      lead.id;

  if (
    elements.quickContactClient
  ) {
    elements.quickContactClient
      .textContent =
        getDisplayName(
          lead
        );
  }

  if (
    elements.quickContactTitle
  ) {
    elements.quickContactTitle
      .textContent =
        'Связались с клиентом';
  }

  if (
    elements.quickContactResponsible
  ) {
    elements.quickContactResponsible
      .value =
        lead.responsible_user ||
        currentUser?.id ||
        '';
  }

  elements.quickContactPreset
    .value =
      'week';

  elements.quickContactDate
    .value =
      toLocalDateTimeInput(
        getPresetDate(
          'week'
        )
      );

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
    50
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
    elements.quickContactDate
      .value =
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

  const id =
    cleanText(
      elements.quickContactLeadId
        ?.value,
      100
    );

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

    closeQuickContactModal();

    await loadLeads({
      silent: true
    });

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

    elements.quickContactDate
      ?.focus();

    return;
  }

  const comment =
    cleanText(
      elements.quickContactComment
        ?.value,
      3000
    );

  const responsibleUser =
    elements.quickContactResponsible
      ?.value ||
    lead.responsible_user ||
    currentUser?.id ||
    null;

  const payload = {
    next_contact:
      nextContact,

    status:
      'callback',

    responsible_user:
      responsibleUser,

    updated_by:
      currentUser.id
  };

  if (comment) {
    payload.last_dialogue =
      comment;
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
    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          'planner_leads'
        )
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

    showToast(
      'Контакт зафиксирован. Следующая дата назначена.',
      'success',
      5200
    );

    checkTodayNotifications();
  } catch (error) {
    console.error(
      'Ошибка быстрого контакта:',
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
   26. FILES — MODAL
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
    elements.selectedFileName
      .textContent =
        'Файл не выбран';

    return;
  }

  elements.selectedFileName
    .textContent =
      file.name +
      ' · ' +
      formatFileSize(
        file.size
      );
}

function openFilesModal(id) {
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
    !elements.filesBackdrop
  ) {
    showToast(
      'Для файлов нужно добавить окно в planner.html.',
      'warning',
      6000
    );

    return;
  }

  activeFilesLeadId =
    lead.id;

  if (
    elements.filesLeadId
  ) {
    elements.filesLeadId.value =
      lead.id;
  }

  if (
    elements.filesTitle
  ) {
    elements.filesTitle.textContent =
      'Файлы клиента';
  }

  if (
    elements.filesClient
  ) {
    elements.filesClient.textContent =
      getDisplayName(
        lead
      );
  }

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

  if (
    elements.filesLeadId
  ) {
    elements.filesLeadId.value =
      '';
  }

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

        <div
          class="filesEmptyIcon"
        >
          📎
        </div>

        <div
          class="filesEmptyTitle"
        >
          Файлов пока нет
        </div>

        <div
          class="filesEmptyText"
        >
          Прикрепите коммерческое предложение,
          договор, таблицу, изображение или другой документ.
        </div>

      </div>
    `;

    return;
  }

  elements.filesList.innerHTML =
    files
      .map(
        createFileItemHtml
      )
      .join('');
}

function createFileItemHtml(file) {
  const displayName =
    file.original_file_name ||
    file.file_name ||
    'Файл';

  const uploader =
    getUploaderDisplayName(
      file
    );

  const metaParts = [];

  if (
    file.file_size !== null &&
    file.file_size !== undefined
  ) {
    metaParts.push(
      formatFileSize(
        file.file_size
      )
    );
  }

  if (uploader) {
    metaParts.push(
      uploader
    );
  }

  const created =
    formatFileDate(
      file.created_at
    );

  if (created) {
    metaParts.push(
      created
    );
  }

  return `
    <div
      class="fileItem"
      data-file-id="${escapeHtml(
        file.id
      )}"
    >

      <div
        class="fileIcon"
        aria-hidden="true"
      >
        ${getFileIcon(
          file
        )}
      </div>

      <div
        class="fileInfo"
      >

        <div
          class="fileName"
        >
          ${escapeHtml(
            displayName
          )}
        </div>

        ${
          metaParts.length
            ? `
              <div
                class="fileMeta"
              >
                ${escapeHtml(
                  metaParts.join(
                    ' · '
                  )
                )}
              </div>
            `
            : ''
        }

        ${
          file.description
            ? `
              <div
                class="fileDescription"
              >
                ${escapeHtml(
                  file.description
                )}
              </div>
            `
            : ''
        }

      </div>

      <div
        class="fileActions"
      >

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
  `;
}


/* ============================================================
   27. FILES — UPLOAD
   ============================================================ */

async function uploadSelectedFile() {
  if (
    fileUploadInProgress
  ) {
    return;
  }

  const leadId =
    activeFilesLeadId ||
    cleanText(
      elements.filesLeadId
        ?.value,
      100
    );

  if (!leadId) {
    showToast(
      'Не удалось определить клиента.',
      'error'
    );

    return;
  }

  const lead =
    leads.find(
      (item) =>
        item.id === leadId
    );

  if (!lead) {
    showToast(
      'Клиент больше не найден в таблице.',
      'warning'
    );

    return;
  }

  const file =
    elements.fileInput
      ?.files?.[0];

  if (!file) {
    showToast(
      'Сначала выберите файл.',
      'warning'
    );

    elements.fileInput
      ?.click();

    return;
  }

  if (
    file.size <= 0
  ) {
    showToast(
      'Выбранный файл пуст.',
      'warning'
    );

    return;
  }

  if (
    file.size >
    MAX_FILE_SIZE
  ) {
    showToast(
      'Файл слишком большой. Максимальный размер сейчас — 20 МБ.',
      'warning',
      6000
    );

    return;
  }

  const description =
    cleanText(
      elements.fileDescription
        ?.value,
      1000
    );

  const safeName =
    sanitizeStorageFileName(
      file.name
    );

  const storagePath =
    'leads/' +
    lead.id +
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

  if (
    elements.fileInput
  ) {
    elements.fileInput.disabled =
      true;
  }

  try {
    /*
     * 1. Загружаем сам файл в приватный Storage.
     */

    const uploadOptions = {
      cacheControl:
        '3600',

      upsert:
        false
    };

    if (file.type) {
      uploadOptions.contentType =
        file.type;
    }

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
          storagePath,
          file,
          uploadOptions
        );

    if (
      uploadError
    ) {
      throw uploadError;
    }

    /*
     * 2. Сохраняем связь файла с лидом
     *    в нашей таблице crm_files.
     */

    const {
      data:
        metadata,
      error:
        metadataError
    } =
      await supabaseClient
        .from(
          'crm_files'
        )
        .insert({
          lead_id:
            lead.id,

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
            storagePath,

          mime_type:
            cleanText(
              file.type,
              150
            ) ||
            null,

          file_size:
            file.size,

          description:
            description ||
            null,

          uploaded_by:
            currentUser.id
        })
        .select()
        .single();

    /*
     * Если Storage успешно принял файл,
     * а метаданные сохранить не удалось,
     * удаляем загруженный объект обратно,
     * чтобы не оставлять "сиротский" файл.
     */

    if (
      metadataError
    ) {
      await supabaseClient
        .storage
        .from(
          STORAGE_BUCKET
        )
        .remove([
          storagePath
        ]);

      throw metadataError;
    }

    upsertFileLocally(
      metadata
    );

    resetFileUploadForm();

    renderFilesList();

    renderTable();

    showToast(
      'Файл прикреплён.',
      'success'
    );
  } catch (error) {
    console.error(
      'Ошибка загрузки файла:',
      error
    );

    showToast(
      getFriendlyFileError(
        error
      ),
      'error',
      6500
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

    if (
      elements.fileInput
    ) {
      elements.fileInput.disabled =
        false;
    }
  }
}


/* ============================================================
   28. FILES — OPEN
   ============================================================ */

async function openFile(fileId) {
  const file =
    crmFiles.find(
      (item) =>
        item.id === fileId
    );

  if (!file) {
    showToast(
      'Информация о файле не найдена.',
      'warning'
    );

    return;
  }

  const bucket =
    file.storage_bucket ||
    STORAGE_BUCKET;

  const path =
    file.storage_path;

  if (!path) {
    showToast(
      'У файла отсутствует путь в хранилище.',
      'error'
    );

    return;
  }

  /*
   * Открываем пустую вкладку сразу,
   * чтобы браузер не заблокировал window.open()
   * после асинхронного запроса к Supabase.
   */

  const newWindow =
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
          bucket
        )
        .createSignedUrl(
          path,
          SIGNED_URL_LIFETIME_SECONDS
        );

    if (error) {
      throw error;
    }

    const signedUrl =
      data?.signedUrl;

    if (!signedUrl) {
      throw new Error(
        'Signed URL was not returned.'
      );
    }

    if (newWindow) {
      newWindow.location.href =
        signedUrl;
    } else {
      window.location.href =
        signedUrl;
    }
  } catch (error) {
    if (
      newWindow &&
      !newWindow.closed
    ) {
      newWindow.close();
    }

    console.error(
      'Ошибка открытия файла:',
      error
    );

    showToast(
      getFriendlyFileError(
        error
      ),
      'error',
      6000
    );
  }
}


/* ============================================================
   29. FILES — DELETE
   ============================================================ */

async function deleteFile(fileId) {
  const file =
    crmFiles.find(
      (item) =>
        item.id === fileId
    );

  if (!file) {
    return;
  }

  const displayName =
    file.original_file_name ||
    file.file_name ||
    'файл';

  const confirmed =
    window.confirm(
      'Удалить файл «' +
      displayName +
      '»?\n\n' +
      'Файл будет удалён окончательно.'
    );

  if (!confirmed) {
    return;
  }

  try {
    /*
     * Сначала удаляем физический файл.
     */

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

    /*
     * Затем удаляем запись о файле.
     */

    const {
      error:
        metadataError
    } =
      await supabaseClient
        .from(
          'crm_files'
        )
        .delete()
        .eq(
          'id',
          file.id
        );

    if (
      metadataError
    ) {
      throw metadataError;
    }

    removeFileLocally(
      file.id
    );

    renderFilesList();

    renderTable();

    showToast(
      'Файл удалён.',
      'success'
    );
  } catch (error) {
    console.error(
      'Ошибка удаления файла:',
      error
    );

    showToast(
      getFriendlyFileError(
        error
      ),
      'error',
      6000
    );

    /*
     * Синхронизируем метаданные с сервером,
     * если операция завершилась только частично.
     */

    await reloadFilesOnly();
  }
}


/* ============================================================
   30. FILES — RELOAD
   ============================================================ */

async function reloadFilesOnly() {
  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          'crm_files'
        )
        .select('*')
        .not(
          'lead_id',
          'is',
          null
        )
        .order(
          'created_at',
          {
            ascending:
              false
          }
        );

    if (error) {
      throw error;
    }

    crmFiles =
      Array.isArray(data)
        ? data
        : [];

    renderTable();

    if (
      activeFilesLeadId
    ) {
      renderFilesList();
    }
  } catch (error) {
    console.warn(
      'Не удалось обновить список файлов:',
      error
    );
  }
}


/* ============================================================
   31. FILE ERRORS
   ============================================================ */

function getFriendlyFileError(error) {
  const message =
    String(
      error?.message ||
      error?.error ||
      ''
    ).toLocaleLowerCase(
      'ru-RU'
    );

  if (
    message.includes(
      'maximum allowed size'
    ) ||
    message.includes(
      'payload too large'
    ) ||
    message.includes(
      'entity too large'
    )
  ) {
    return (
      'Файл превышает разрешённый размер.'
    );
  }

  if (
    message.includes(
      'row-level security'
    ) ||
    message.includes(
      'unauthorized'
    ) ||
    message.includes(
      'forbidden'
    )
  ) {
    return (
      'Нет разрешения на работу с файлом. ' +
      'Проверьте вход в систему.'
    );
  }

  if (
    message.includes(
      'not found'
    ) ||
    message.includes(
      'nosuchkey'
    )
  ) {
    return (
      'Файл не найден в хранилище.'
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
      'Не удалось связаться с хранилищем. ' +
      'Проверьте интернет.'
    );
  }

  return (
    'Не удалось выполнить операцию с файлом.'
  );
}


/* ============================================================
   32. EDIT
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

  openLeadModal(
    lead
  );
}


/* ============================================================
   33. DELETE LEAD
   ============================================================ */

async function deleteLead(id) {
  const lead =
    leads.find(
      (item) =>
        item.id === id
    );

  if (!lead) {
    return;
  }

  const files =
    getLeadFiles(
      id
    );

  const fileWarning =
    files.length > 0
      ? (
          '\n\nК записи прикреплено ' +
          files.length +
          ' ' +
          pluralizeFiles(
            files.length
          ) +
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
      fileWarning +
      '\n\nЭто действие нельзя отменить.'
    );

  if (
    !confirmed
  ) {
    return;
  }

  try {
    /*
     * Сначала удаляем физические файлы.
     * Записи crm_files затем удалятся каскадно
     * вместе с planner_leads.
     */

    const storagePaths =
      files
        .filter(
          (file) =>
            file.storage_path
        )
        .map(
          (file) =>
            file.storage_path
        );

    if (
      storagePaths.length > 0
    ) {
      const {
        error:
          filesDeleteError
      } =
        await supabaseClient
          .storage
          .from(
            STORAGE_BUCKET
          )
          .remove(
            storagePaths
          );

      if (
        filesDeleteError
      ) {
        throw filesDeleteError;
      }
    }

    const {
      error
    } =
      await supabaseClient
        .from(
          'planner_leads'
        )
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
      'Ошибка удаления:',
      error
    );

    showToast(
      getFriendlyDatabaseError(
        error
      ),
      'error',
      6000
    );
  }
}


/* ============================================================
   34. DATABASE ERRORS
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
      'Вернитесь на главную и войдите снова.'
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
   35. REALTIME — LEADS
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

  realtimeChannel =
    supabaseClient
      .channel(
        'jambalance-planner-leads-v23'
      )
      .on(
        'postgres_changes',
        {
          event:
            'INSERT',

          schema:
            'public',

          table:
            'planner_leads'
        },
        handleRealtimeInsert
      )
      .on(
        'postgres_changes',
        {
          event:
            'UPDATE',

          schema:
            'public',

          table:
            'planner_leads'
        },
        handleRealtimeUpdate
      )
      .on(
        'postgres_changes',
        {
          event:
            'DELETE',

          schema:
            'public',

          table:
            'planner_leads'
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

  if (
    !lead?.id
  ) {
    return;
  }

  const existed =
    leads.some(
      (item) =>
        item.id ===
        lead.id
    );

  upsertLeadLocally(
    lead
  );

  render();

  if (
    !existed
  ) {
    showToast(
      'В таблице появилась новая запись.',
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

  if (
    !lead?.id
  ) {
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

  crmFiles =
    crmFiles.filter(
      (file) =>
        file.lead_id !== id
    );

  render();

  if (
    activeFilesLeadId === id
  ) {
    closeFilesModal();
  }
}


/* ============================================================
   36. REALTIME — PROFILES
   ============================================================ */

function subscribeToProfilesRealtime() {
  if (
    profilesRealtimeChannel
  ) {
    supabaseClient
      .removeChannel(
        profilesRealtimeChannel
      );
  }

  profilesRealtimeChannel =
    supabaseClient
      .channel(
        'jambalance-profiles-v23'
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema:
            'public',
          table:
            'profiles'
        },
        async () => {
          try {
            await loadProfiles();

            render();

            if (
              activeFilesLeadId
            ) {
              renderFilesList();
            }
          } catch (error) {
            console.warn(
              'Не удалось обновить список сотрудников:',
              error
            );
          }
        }
      )
      .subscribe();
}


/* ============================================================
   37. REALTIME — FILE METADATA
   ============================================================ */

function subscribeToFilesRealtime() {
  if (
    filesRealtimeChannel
  ) {
    supabaseClient
      .removeChannel(
        filesRealtimeChannel
      );
  }

  filesRealtimeChannel =
    supabaseClient
      .channel(
        'jambalance-crm-files-v23'
      )
      .on(
        'postgres_changes',
        {
          event:
            'INSERT',

          schema:
            'public',

          table:
            'crm_files'
        },
        (payload) => {
          const file =
            payload.new;

          if (
            !file?.id ||
            !file.lead_id
          ) {
            return;
          }

          upsertFileLocally(
            file
          );

          renderTable();

          if (
            activeFilesLeadId ===
            file.lead_id
          ) {
            renderFilesList();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event:
            'UPDATE',

          schema:
            'public',

          table:
            'crm_files'
        },
        (payload) => {
          const file =
            payload.new;

          if (
            !file?.id
          ) {
            return;
          }

          upsertFileLocally(
            file
          );

          renderTable();

          if (
            activeFilesLeadId ===
            file.lead_id
          ) {
            renderFilesList();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event:
            'DELETE',

          schema:
            'public',

          table:
            'crm_files'
        },
        (payload) => {
          const id =
            payload.old?.id;

          if (!id) {
            reloadFilesOnly();

            return;
          }

          removeFileLocally(
            id
          );

          renderTable();

          if (
            activeFilesLeadId
          ) {
            renderFilesList();
          }
        }
      )
      .subscribe(
        (status) => {
          if (
            status ===
            'SUBSCRIBED'
          ) {
            console.log(
              'Files Realtime подключён.'
            );
          }
        }
      );
}


/* ============================================================
   38. RESET FILTERS
   ============================================================ */

function resetFilters() {
  state.search =
    '';

  state.status =
    'all';

  state.priority =
    'all';

  state.responsible =
    'all';

  state.date =
    'all';

  state.sort =
    'nearest';

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
}


/* ============================================================
   39. EXPORT
   ============================================================ */

function downloadBlob(
  blob,
  fileName
) {
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
    fileName;

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

function exportBackup() {
  const payload = {
    application:
      'ДжемБаланс — планировщик',

    version:
      '2.3',

    exportedAt:
      new Date()
        .toISOString(),

    exportedBy:
      currentUser?.email ||
      null,

    profiles,

    leads,

    fileMetadata:
      crmFiles.map(
        (file) => ({
          id:
            file.id,

          lead_id:
            file.lead_id,

          original_file_name:
            file.original_file_name,

          file_name:
            file.file_name,

          storage_bucket:
            file.storage_bucket,

          storage_path:
            file.storage_path,

          mime_type:
            file.mime_type,

          file_size:
            file.file_size,

          description:
            file.description,

          uploaded_by:
            file.uploaded_by,

          created_at:
            file.created_at
        })
      )
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
    'Резервная копия данных скачана. Сами вложения в JSON не включаются.',
    'success',
    6000
  );
}


/* ============================================================
   40. LEGACY DATA
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

    if (
      !Array.isArray(
        parsed
      )
    ) {
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
  if (
    !elements.migrationPanel
  ) {
    return;
  }

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

    if (
      elements.migrateBtn
    ) {
      elements.migrateBtn
        .textContent =
          'Перенести ' +
          legacy.length +
          ' ' +
          pluralizeRecords(
            legacy.length
          );
    }
  } else {
    elements.migrationPanel
      .classList.remove(
        'show'
      );
  }
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

    responsible_user:
      currentUser.id,

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
      ?.classList.remove(
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

  if (
    !confirmed
  ) {
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
        .from(
          'planner_leads'
        )
        .insert(
          prepared
        )
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
      'Старые записи перенесены: ' +
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
      'Они останутся только в браузере этого компьютера.'
    );

  if (
    !confirmed
  ) {
    return;
  }

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
   41. NOTIFICATIONS
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

    if (
      !parsed ||
      typeof parsed !==
        'object' ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    return parsed;
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
      permission ===
      'granted'
    ) {
      showToast(
        'Уведомления включены.',
        'success'
      );

      checkTodayNotifications();
    }
  } catch (error) {
    showToast(
      'Не удалось включить уведомления.',
      'error'
    );
  }
}

function checkTodayNotifications() {
  if (
    !(
      'Notification'
      in window
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
      (lead) => {
        if (
          isClosed(lead)
        ) {
          return false;
        }

        if (
          getDayDifference(
            lead.next_contact
          ) !== 0
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

  let changed =
    false;

  todayLeads.forEach(
    (lead) => {
      const key =
        lead.id +
        ':' +
        todayKey;

      if (
        history[key]
      ) {
        return;
      }

      const parts = [];

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

      if (
        lead.phone
      ) {
        parts.push(
          'Телефон: ' +
          lead.phone
        );
      }

      try {
        const notification =
          new Notification(
            'Сегодня назначен контакт: ' +
            getDisplayName(
              lead
            ),
            {
              body:
                parts
                  .join(' · ')
                  .slice(
                    0,
                    220
                  ) ||
                'Откройте планировщик для подробностей.',

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

        changed =
          true;
      } catch (error) {
        console.warn(
          'Не удалось показать уведомление:',
          error
        );
      }
    }
  );

  if (
    changed
  ) {
    saveNotificationHistory(
      history
    );
  }
}


/* ============================================================
   42. EVENTS
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

  elements.leadTableBody
    ?.addEventListener(
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
          action ===
          'contacted'
        ) {
          openQuickContactModal(
            id
          );

          return;
        }

        if (
          action ===
          'files'
        ) {
          openFilesModal(
            id
          );

          return;
        }

        if (
          action ===
          'edit'
        ) {
          editLead(
            id
          );

          return;
        }

        if (
          action ===
          'delete'
        ) {
          deleteLead(
            id
          );
        }
      }
    );

  /* Quick contact */

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
          elements.quickContactPreset
            .value =
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

  elements.fileInput
    ?.addEventListener(
      'change',
      updateSelectedFileDisplay
    );

  elements.uploadFileBtn
    ?.addEventListener(
      'click',
      uploadSelectedFile
    );

  elements.filesList
    ?.addEventListener(
      'click',
      (event) => {
        const button =
          event.target.closest(
            'button[data-file-action]'
          );

        if (!button) {
          return;
        }

        const id =
          button.dataset.fileId;

        const action =
          button.dataset.fileAction;

        if (
          action ===
          'open'
        ) {
          openFile(id);

          return;
        }

        if (
          action ===
          'delete'
        ) {
          deleteFile(id);
        }
      }
    );

  /*
   * Зона drag & drop.
   */

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

        const transfer =
          new DataTransfer();

        transfer.items.add(
          file
        );

        elements.fileInput.files =
          transfer.files;

        updateSelectedFileDisplay();
      }
    );

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
   43. AUTH WATCHER
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
   44. PERIODIC TASKS
   ============================================================ */

function startPeriodicTasks() {
  window.setInterval(
    () => {
      renderStatistics();

      renderTable();

      checkTodayNotifications();
    },
    60000
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
   45. INITIALIZE
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

    if (
      !authenticated
    ) {
      return;
    }

    const profileLoaded =
      await loadCurrentProfile();

    if (
      !profileLoaded
    ) {
      return;
    }

    await loadProfiles();

    setLoadingText(
      'Загружаем общую таблицу и файлы…'
    );

    await loadLeads({
      silent: true
    });

    setLoadingText(
      'Подключаем обновления в реальном времени…'
    );

    subscribeToRealtime();

    subscribeToProfilesRealtime();

    subscribeToFilesRealtime();

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
   46. START
   ============================================================ */

initialize();