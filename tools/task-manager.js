/* ============================================================
   JamBalance — Задачник
   task-manager.js

   Таблицы:
   - public.tasks
   - public.profiles
   - public.clients
   - public.task_attachments

   Storage:
   - task-attachments

   ВАЖНО:
   service_role / secret key в браузере НЕ используется.
   ============================================================ */

'use strict';

/* ============================================================
   SUPABASE
   ============================================================ */

const SUPABASE_URL =
  'https://fqcltmxiarohfpfnghjn.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_PqjH12Cbf7Fw9CWxvTPHaQ_MYYq7HQT';

const TASK_STORAGE_BUCKET =
  'task-attachments';

/* ============================================================
   КОНФИГУРАЦИЯ
   ============================================================ */

const TASK_MANAGER_CONFIG = {
  tables: {
    tasks: 'tasks',
    profiles: 'profiles',
    clients: 'clients',
    attachments: 'task_attachments'
  },

storageBucket: TASK_STORAGE_BUCKET,

  maxFileSize: 20 * 1024 * 1024,

  signedUrlLifetime: 60 * 10,

  calendar: {
    firstHour: 7,
    lastHour: 22,
    maxMonthTasksVisible: 4
  }
};


/* ============================================================
   СОСТОЯНИЕ
   ============================================================ */

const state = {
  supabase: null,

  user: null,
  profile: null,

  profiles: [],
  clients: [],
  tasks: [],
  attachments: new Map(),

  view: 'month',

  cursorDate: startOfDay(new Date()),
  selectedDate: startOfDay(new Date()),

  editingTaskId: null,

  pendingFiles: [],
  removedAttachmentIds: new Set(),

  filters: {
    types: new Set([
      'payment',
      'act',
      'call',
      'document',
      'meeting',
      'other'
    ]),
    assignee: '',
    status: ''
  },

  notificationTimer: null,
  realtimeChannel: null,

  initialized: false
};


/* ============================================================
   СПРАВОЧНИК ТИПОВ ЗАДАЧ
   ============================================================ */

const TASK_TYPES = {
  payment: {
    label: 'Оплата',
    color: '#f99303'
  },

  act: {
    label: 'Составление акта',
    color: '#7b61ff'
  },

  call: {
    label: 'Созвон',
    color: '#2f80ed'
  },

  document: {
    label: 'Документы',
    color: '#0f9d84'
  },

  meeting: {
    label: 'Встреча',
    color: '#d946ef'
  },

  other: {
    label: 'Другое',
    color: '#667085'
  }
};


/* ============================================================
   СООТВЕТСТВИЕ ПОЛЕЙ SUPABASE

   Если мы позже увидим, что какое-то имя столбца в tasks
   отличается, меняем его здесь — остальной код трогать
   не потребуется.
   ============================================================ */

const TASK_FIELDS = {
  id: 'id',

  title: 'title',
  description: 'description',

  type: 'task_type',

  date: 'task_date',
  time: 'task_time',

  status: 'status',

  clientId: 'client_id',
  clientName: 'client_name',

  assignedTo: 'assigned_to',

  repeatType: 'recurrence_type',
  repeatWeekday: 'recurrence_weekday',
  repeatMonthday: 'recurrence_monthday',
  repeatUntil: 'recurrence_until',

  createdBy: 'created_by',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
};


const ATTACHMENT_FIELDS = {
  id: 'id',
  taskId: 'task_id',
  fileName: 'file_name',
  filePath: 'file_path',
  fileSize: 'file_size',
  mimeType: 'mime_type',
  uploadedBy: 'uploaded_by',
  createdAt: 'created_at'
};


/* ============================================================
   DOM HELPERS
   ============================================================ */

function $(id) {
  return document.getElementById(id);
}


function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}


function setHidden(element, hidden) {
  if (!element) return;
  element.classList.toggle('hidden', Boolean(hidden));
}


function setLoading(on) {
  const el = $('calendar-loading');
  if (!el) return;
  el.classList.toggle('active', Boolean(on));
}


function escapeHtml(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


/* ============================================================
   ДАТЫ
   ============================================================ */

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}


function cloneDate(date) {
  return new Date(date.getTime());
}


function addDays(date, amount) {
  const d = cloneDate(date);
  d.setDate(d.getDate() + amount);
  return d;
}


function addMonths(date, amount) {
  const d = cloneDate(date);

  const originalDay = d.getDate();

  d.setDate(1);
  d.setMonth(d.getMonth() + amount);

  const max = daysInMonth(
    d.getFullYear(),
    d.getMonth()
  );

  d.setDate(Math.min(originalDay, max));

  return d;
}


function addYears(date, amount) {
  const d = cloneDate(date);
  d.setFullYear(d.getFullYear() + amount);
  return d;
}


function daysInMonth(year, monthIndex) {
  return new Date(
    year,
    monthIndex + 1,
    0
  ).getDate();
}


function startOfMonth(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}


function endOfMonth(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  );
}


function startOfWeek(date) {
  const d = startOfDay(date);

  let day = d.getDay();

  if (day === 0) {
    day = 7;
  }

  return addDays(d, 1 - day);
}


function endOfWeek(date) {
  return addDays(
    startOfWeek(date),
    6
  );
}


function startOfQuarter(date) {
  const month =
    Math.floor(date.getMonth() / 3) * 3;

  return new Date(
    date.getFullYear(),
    month,
    1
  );
}


function endOfQuarter(date) {
  const start = startOfQuarter(date);

  return new Date(
    start.getFullYear(),
    start.getMonth() + 3,
    0
  );
}


function toISODate(date) {
  const y = date.getFullYear();
  const m = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const d = String(
    date.getDate()
  ).padStart(2, '0');

  return `${y}-${m}-${d}`;
}


function fromISODate(value) {
  if (!value) return null;

  const parts = value
    .slice(0, 10)
    .split('-')
    .map(Number);

  if (parts.length !== 3) return null;

  return new Date(
    parts[0],
    parts[1] - 1,
    parts[2]
  );
}


function sameDay(a, b) {
  if (!a || !b) return false;

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}


function dateBetween(
  date,
  from,
  to
) {
  const x = startOfDay(date).getTime();
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();

  return x >= a && x <= b;
}


function formatDateLong(date) {
  if (!date) return '';

  return new Intl.DateTimeFormat(
    'ru-RU',
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long'
    }
  ).format(date);
}


function formatMonthTitle(date) {
  let text = new Intl.DateTimeFormat(
    'ru-RU',
    {
      month: 'long',
      year: 'numeric'
    }
  ).format(date);

  return capitalize(text);
}


function formatMonthShort(date) {
  return capitalize(
    new Intl.DateTimeFormat(
      'ru-RU',
      {
        month: 'long'
      }
    ).format(date)
  );
}


function formatWeekTitle(date) {
  const from = startOfWeek(date);
  const to = endOfWeek(date);

  const sameMonth =
    from.getMonth() === to.getMonth();

  const sameYear =
    from.getFullYear() === to.getFullYear();

  if (sameMonth && sameYear) {
    return (
      `${from.getDate()}–${to.getDate()} ` +
      `${new Intl.DateTimeFormat(
        'ru-RU',
        {
          month: 'long',
          year: 'numeric'
        }
      ).format(to)}`
    );
  }

  return (
    `${from.toLocaleDateString(
      'ru-RU',
      {
        day: 'numeric',
        month: 'short'
      }
    )} — ` +
    `${to.toLocaleDateString(
      'ru-RU',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }
    )}`
  );
}


function formatQuarterTitle(date) {
  const start = startOfQuarter(date);

  const number =
    Math.floor(start.getMonth() / 3) + 1;

  return `${number} квартал ${start.getFullYear()}`;
}


function formatTime(value) {
  if (!value) return '';

  return String(value)
    .slice(0, 5);
}


function capitalize(value) {
  if (!value) return '';

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}


/* ============================================================
   SUPABASE — ПОДКЛЮЧЕНИЕ

   Поддерживаем несколько вариантов подключения, чтобы
   Задачник использовал тот же Supabase, что и Planner.
   ============================================================ */

async function resolveSupabaseClient() {
  if (
    !window.supabase ||
    typeof window.supabase.createClient !== 'function'
  ) {
    throw new Error(
      'Библиотека Supabase не загружена.'
    );
  }

  const client = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

  window.supabaseClient = client;

  return client;
}


/* ============================================================
   АВТОРИЗАЦИЯ
   ============================================================ */

async function loadCurrentUser() {
  const {
    data,
    error
  } = await state.supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data?.user) {
    throw new Error(
      'Пользователь не авторизован в Рабочей станции.'
    );
  }

  state.user = data.user;
}


async function loadCurrentProfile() {
  if (!state.user) return;

  const {
    data,
    error
  } = await state.supabase
    .from(
      TASK_MANAGER_CONFIG.tables.profiles
    )
    .select('*')
    .eq(
      'id',
      state.user.id
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  state.profile = data || null;
}


/* ============================================================
   ЗАГРУЗКА СПРАВОЧНИКОВ
   ============================================================ */

async function loadProfiles() {
  const {
    data,
    error
  } = await state.supabase
    .from(
      TASK_MANAGER_CONFIG.tables.profiles
    )
    .select('*')
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

  state.profiles =
    data || [];

  renderAssigneeSelects();
}


async function loadClients() {
  const {
    data,
    error
  } = await state.supabase
    .from(
      TASK_MANAGER_CONFIG.tables.clients
    )
    .select('*')
    .eq(
      'status',
      'active'
    )
    .order(
      'client_name',
      {
        ascending: true
      }
    );

  if (error) {
    throw error;
  }

  state.clients =
    data || [];

  renderClientSelect();
}


/* ============================================================
   SUPABASE TASK NORMALIZATION
   ============================================================ */

function normalizeTask(row) {
  return {
    id:
      row[TASK_FIELDS.id],

    title:
      row[TASK_FIELDS.title] || '',

    description:
      row[TASK_FIELDS.description] || '',

    type:
      row[TASK_FIELDS.type] || 'other',

    date:
      row[TASK_FIELDS.date] || '',

    time:
      row[TASK_FIELDS.time] || '',

    status:
      row[TASK_FIELDS.status] || 'pending',

    clientId:
      row[TASK_FIELDS.clientId] || null,

    clientName:
      row[TASK_FIELDS.clientName] || '',

    assignedTo:
      row[TASK_FIELDS.assignedTo] || null,

    repeatType:
      row[TASK_FIELDS.repeatType] || 'none',

    repeatWeekday:
      row[TASK_FIELDS.repeatWeekday],

    repeatMonthday:
      row[TASK_FIELDS.repeatMonthday],

    repeatUntil:
      row[TASK_FIELDS.repeatUntil] || null,

    createdBy:
      row[TASK_FIELDS.createdBy] || null,

    createdAt:
      row[TASK_FIELDS.createdAt] || null,

    updatedAt:
      row[TASK_FIELDS.updatedAt] || null,

    raw: row
  };
}


/* ============================================================
   ЗАГРУЗКА ЗАДАЧ
   ============================================================ */

function getCalendarLoadRange() {
  let from;
  let to;

  switch (state.view) {

    case 'week':
      from =
        addDays(
          startOfWeek(state.cursorDate),
          -7
        );

      to =
        addDays(
          endOfWeek(state.cursorDate),
          7
        );
      break;


    case 'quarter':
      from =
        addMonths(
          startOfQuarter(state.cursorDate),
          -1
        );

      to =
        addMonths(
          endOfQuarter(state.cursorDate),
          1
        );
      break;


    case 'year':
      from =
        new Date(
          state.cursorDate.getFullYear(),
          0,
          1
        );

      to =
        new Date(
          state.cursorDate.getFullYear(),
          11,
          31
        );
      break;


    case 'month':
    default:
      from =
        addDays(
          startOfWeek(
            startOfMonth(
              state.cursorDate
            )
          ),
          -7
        );

      to =
        addDays(
          endOfWeek(
            endOfMonth(
              state.cursorDate
            )
          ),
          7
        );
      break;
  }

  return {
    from,
    to
  };
}


async function loadTasks() {
  const range =
    getCalendarLoadRange();

  setLoading(true);

  try {
    const {
      data,
      error
    } = await state.supabase
      .from(
        TASK_MANAGER_CONFIG.tables.tasks
      )
      .select('*')
      .lte(
        TASK_FIELDS.date,
        toISODate(range.to)
      )
      .or(
        `${TASK_FIELDS.repeatUntil}.is.null,` +
        `${TASK_FIELDS.repeatUntil}.gte.${toISODate(range.from)},` +
        `${TASK_FIELDS.date}.gte.${toISODate(range.from)}`
      )
      .order(
        TASK_FIELDS.date,
        {
          ascending: true
        }
      );

    if (error) {
      throw error;
    }

    state.tasks =
      (data || [])
        .map(normalizeTask);

    await loadAttachmentsForCurrentTasks();

    renderCalendar();
    renderSelectedDay();

  } finally {
    setLoading(false);
  }
}


/* ============================================================
   ПОВТОРЯЕМОСТЬ
   ============================================================ */

function taskOccursOnDate(
  task,
  date
) {
  const taskDate =
    fromISODate(task.date);

  if (!taskDate) {
    return false;
  }

  const target =
    startOfDay(date);

  if (
    target.getTime() <
    taskDate.getTime()
  ) {
    return false;
  }


  if (task.repeatUntil) {
    const until =
      fromISODate(
        task.repeatUntil
      );

    if (
      until &&
      target.getTime() >
      until.getTime()
    ) {
      return false;
    }
  }


  switch (
    task.repeatType
  ) {

    case 'weekly': {
      const weekday =
        Number.isInteger(
          Number(task.repeatWeekday)
        )
          ? Number(task.repeatWeekday)
          : taskDate.getDay();

      return (
        target.getDay() === weekday
      );
    }


    case 'monthly': {
      const day =
        Number(
          task.repeatMonthday
        ) ||
        taskDate.getDate();

      return (
        target.getDate() ===
        Math.min(
          day,
          daysInMonth(
            target.getFullYear(),
            target.getMonth()
          )
        )
      );
    }


    case 'quarterly': {
      const months =
        monthsDifference(
          taskDate,
          target
        );

      if (
        months < 0 ||
        months % 3 !== 0
      ) {
        return false;
      }

      const wantedDay =
        taskDate.getDate();

      return (
        target.getDate() ===
        Math.min(
          wantedDay,
          daysInMonth(
            target.getFullYear(),
            target.getMonth()
          )
        )
      );
    }


    case 'halfyear': {
      const months =
        monthsDifference(
          taskDate,
          target
        );

      if (
        months < 0 ||
        months % 6 !== 0
      ) {
        return false;
      }

      const wantedDay =
        taskDate.getDate();

      return (
        target.getDate() ===
        Math.min(
          wantedDay,
          daysInMonth(
            target.getFullYear(),
            target.getMonth()
          )
        )
      );
    }


    case 'none':
    default:
      return sameDay(
        taskDate,
        target
      );
  }
}


function monthsDifference(
  from,
  to
) {
  return (
    (
      to.getFullYear() -
      from.getFullYear()
    ) * 12 +
    (
      to.getMonth() -
      from.getMonth()
    )
  );
}


function getTasksForDate(date) {
  return getFilteredTasks()
    .filter(
      task =>
        taskOccursOnDate(
          task,
          date
        )
    )
    .sort(compareTasks);
}


function compareTasks(a, b) {
  const timeA =
    a.time || '99:99';

  const timeB =
    b.time || '99:99';

  if (timeA !== timeB) {
    return timeA.localeCompare(
      timeB
    );
  }

  return a.title.localeCompare(
    b.title,
    'ru'
  );
}


/* ============================================================
   ФИЛЬТРЫ
   ============================================================ */

function getFilteredTasks() {
  return state.tasks.filter(
    task => {

      if (
        !state.filters.types.has(
          task.type
        )
      ) {
        return false;
      }


      if (
        state.filters.assignee &&
        task.assignedTo !==
          state.filters.assignee
      ) {
        return false;
      }


      if (
        state.filters.status &&
        task.status !==
          state.filters.status
      ) {
        return false;
      }


      return true;
    }
  );
}


/* ============================================================
   КАЛЕНДАРЬ — ОБЩИЙ RENDER
   ============================================================ */

function renderCalendar() {
  renderCalendarPeriodTitle();

  switch (state.view) {

    case 'week':
      renderWeekView();
      break;

    case 'quarter':
      renderQuarterView();
      break;

    case 'year':
      renderYearView();
      break;

    case 'month':
    default:
      renderMonthView();
      break;
  }
}


function renderCalendarPeriodTitle() {
  const title =
    $('calendar-period-title');

  if (!title) return;

  switch (state.view) {

    case 'week':
      title.textContent =
        formatWeekTitle(
          state.cursorDate
        );
      break;

    case 'quarter':
      title.textContent =
        formatQuarterTitle(
          state.cursorDate
        );
      break;

    case 'year':
      title.textContent =
        String(
          state.cursorDate.getFullYear()
        );
      break;

    case 'month':
    default:
      title.textContent =
        formatMonthTitle(
          state.cursorDate
        );
      break;
  }
}


/* ============================================================
   МЕСЯЦ
   ============================================================ */

function renderMonthView() {
  const root =
    $('calendar-root');

  if (!root) return;

  const weekdays = [
    'Пн',
    'Вт',
    'Ср',
    'Чт',
    'Пт',
    'Сб',
    'Вс'
  ];

  const monthStart =
    startOfMonth(
      state.cursorDate
    );

  const gridStart =
    startOfWeek(
      monthStart
    );

  let html =
    '<div class="month-grid">';

  html += weekdays
    .map(
      day =>
        `<div class="weekday-head">${day}</div>`
    )
    .join('');


  for (
    let i = 0;
    i < 42;
    i++
  ) {
    const date =
      addDays(
        gridStart,
        i
      );

    const iso =
      toISODate(date);

    const tasks =
      getTasksForDate(date);

    const outside =
      date.getMonth() !==
      state.cursorDate.getMonth();

    const today =
      sameDay(
        date,
        new Date()
      );

    const selected =
      sameDay(
        date,
        state.selectedDate
      );

    html += `
      <div
        class="calendar-day
          ${outside ? 'outside' : ''}
          ${today ? 'today' : ''}
          ${selected ? 'selected' : ''}"
        data-date="${iso}"
      >

        <div class="day-head">

          <button
            type="button"
            class="day-number"
            data-select-date="${iso}"
            style="
              border:0;
              cursor:pointer;
            "
          >
            ${date.getDate()}
          </button>

          <button
            type="button"
            class="day-add"
            data-new-task-date="${iso}"
            title="Новая задача"
          >
            +
          </button>

        </div>

        <div class="day-tasks">
          ${buildMonthTaskChips(
            tasks
          )}
        </div>

      </div>
    `;
  }

  html += '</div>';

  root.innerHTML = html;

  bindCalendarTaskEvents(root);
}


/* ============================================================
   TASK CHIPS
   ============================================================ */

function buildMonthTaskChips(tasks) {
  const max =
    TASK_MANAGER_CONFIG
      .calendar
      .maxMonthTasksVisible;

  const visible =
    tasks.slice(
      0,
      max
    );

  let html =
    visible.map(
      task =>
        buildTaskChip(task)
    ).join('');


  if (
    tasks.length > max
  ) {
    html += `
      <div class="task-more">
        ещё ${tasks.length - max}
      </div>
    `;
  }

  return html;
}


function buildTaskChip(task) {
  const type =
    TASK_TYPES[task.type] ||
    TASK_TYPES.other;

  const time =
    task.time
      ? `${formatTime(task.time)} `
      : '';

  return `
    <button
      type="button"
      class="task-chip
        ${task.status === 'done'
          ? 'done'
          : ''}"
      data-task-id="${escapeHtml(task.id)}"
      style="--task-color:${type.color};"
      title="${escapeHtml(task.title)}"
    >
      ${escapeHtml(time)}
      ${escapeHtml(task.title)}
    </button>
  `;
}


/* ============================================================
   НЕДЕЛЯ
   ============================================================ */

function renderWeekView() {
  const root =
    $('calendar-root');

  if (!root) return;

  const start =
    startOfWeek(
      state.cursorDate
    );

  let html =
    '<div class="week-scroll">' +
    '<div class="week-view">';

  html +=
    '<div class="week-time-head"></div>';


  for (
    let dayIndex = 0;
    dayIndex < 7;
    dayIndex++
  ) {
    const date =
      addDays(
        start,
        dayIndex
      );

    html += `
      <div
        class="week-day-head
          ${sameDay(date, new Date())
            ? 'today'
            : ''}"
      >
        <div class="week-day-name">
          ${[
            'ПН',
            'ВТ',
            'СР',
            'ЧТ',
            'ПТ',
            'СБ',
            'ВС'
          ][dayIndex]}
        </div>

        <button
          type="button"
          class="week-day-num"
          data-select-date="${toISODate(date)}"
          style="
            border:0;
            cursor:pointer;
          "
        >
          ${date.getDate()}
        </button>
      </div>
    `;
  }


  const firstHour =
    TASK_MANAGER_CONFIG
      .calendar
      .firstHour;

  const lastHour =
    TASK_MANAGER_CONFIG
      .calendar
      .lastHour;


  for (
    let hour = firstHour;
    hour <= lastHour;
    hour++
  ) {

    html += `
      <div class="time-label">
        ${String(hour).padStart(2, '0')}:00
      </div>
    `;


    for (
      let dayIndex = 0;
      dayIndex < 7;
      dayIndex++
    ) {
      const date =
        addDays(
          start,
          dayIndex
        );

      const iso =
        toISODate(date);

      const tasks =
        getTasksForDate(date)
          .filter(
            task => {

              if (!task.time) {
                return hour === firstHour;
              }

              return (
                Number(
                  String(task.time)
                    .slice(0, 2)
                ) === hour
              );
            }
          );


      html += `
        <div
          class="week-cell"
          data-new-task-date="${iso}"
          data-new-task-hour="${hour}"
        >
          ${tasks
            .map(
              task =>
                buildWeekTask(task)
            )
            .join('')}
        </div>
      `;
    }
  }


  html +=
    '</div>' +
    '</div>';

  root.innerHTML = html;

  bindCalendarTaskEvents(root);
}


function buildWeekTask(task) {
  const type =
    TASK_TYPES[task.type] ||
    TASK_TYPES.other;

  return `
    <div
      class="week-task"
      data-task-id="${escapeHtml(task.id)}"
      style="--task-color:${type.color};"
      title="${escapeHtml(task.title)}"
    >
      ${
        task.time
          ? `${formatTime(task.time)} `
          : ''
      }
      ${escapeHtml(task.title)}
    </div>
  `;
}


/* ============================================================
   КВАРТАЛ
   ============================================================ */

function renderQuarterView() {
  const root =
    $('calendar-root');

  if (!root) return;

  const start =
    startOfQuarter(
      state.cursorDate
    );

  let html =
    '<div class="mini-months-grid">';

  for (
    let i = 0;
    i < 3;
    i++
  ) {
    html +=
      buildMiniMonth(
        addMonths(
          start,
          i
        )
      );
  }

  html += '</div>';

  root.innerHTML = html;

  bindCalendarTaskEvents(root);
}


/* ============================================================
   ГОД
   ============================================================ */

function renderYearView() {
  const root =
    $('calendar-root');

  if (!root) return;

  const year =
    state.cursorDate
      .getFullYear();

  let html =
    '<div class="year-grid">';

  for (
    let month = 0;
    month < 12;
    month++
  ) {
    html +=
      buildMiniMonth(
        new Date(
          year,
          month,
          1
        )
      );
  }

  html += '</div>';

  root.innerHTML = html;

  bindCalendarTaskEvents(root);
}


/* ============================================================
   MINI MONTH
   ============================================================ */

function buildMiniMonth(monthDate) {
  const monthStart =
    startOfMonth(
      monthDate
    );

  const gridStart =
    startOfWeek(
      monthStart
    );

  const weekdays = [
    'П',
    'В',
    'С',
    'Ч',
    'П',
    'С',
    'В'
  ];

  let html = `
    <div class="mini-month">

      <div class="mini-month-title">
        ${escapeHtml(
          formatMonthShort(
            monthDate
          )
        )}
      </div>

      <div class="mini-month-grid">
  `;


  html += weekdays
    .map(
      d =>
        `<div class="mini-weekday">${d}</div>`
    )
    .join('');


  for (
    let i = 0;
    i < 42;
    i++
  ) {
    const date =
      addDays(
        gridStart,
        i
      );

    const tasks =
      getTasksForDate(date);

    const outside =
      date.getMonth() !==
      monthDate.getMonth();

    const today =
      sameDay(
        date,
        new Date()
      );


    html += `
      <button
        type="button"
        class="
          mini-day
          ${outside ? 'outside' : ''}
          ${today ? 'today' : ''}
          ${tasks.length ? 'has-tasks' : ''}
        "
        data-select-date="${toISODate(date)}"
        title="${
          tasks.length
            ? `${tasks.length} задач`
            : ''
        }"
      >
        ${date.getDate()}
      </button>
    `;
  }


  html += `
      </div>
    </div>
  `;

  return html;
}


/* ============================================================
   СОБЫТИЯ КАЛЕНДАРЯ
   ============================================================ */

function bindCalendarTaskEvents(root) {

  $all(
    '[data-task-id]',
    root
  ).forEach(
    element => {

      element.addEventListener(
        'click',
        event => {

          event.stopPropagation();

          openTaskModal(
            element.dataset.taskId
          );
        }
      );
    }
  );


  $all(
    '[data-select-date]',
    root
  ).forEach(
    element => {

      element.addEventListener(
        'click',
        event => {

          event.stopPropagation();

          const date =
            fromISODate(
              element.dataset.selectDate
            );

          if (!date) return;

          selectDate(date);
        }
      );
    }
  );


  $all(
    '[data-new-task-date]',
    root
  ).forEach(
    element => {

      element.addEventListener(
        'click',
        event => {

          event.stopPropagation();

          const date =
            fromISODate(
              element.dataset.newTaskDate
            );

          const hour =
            element.dataset.newTaskHour;

          openTaskModal(
            null,
            date,
            hour
          );
        }
      );
    }
  );
}


/* ============================================================
   ВЫБРАННЫЙ ДЕНЬ
   ============================================================ */

function selectDate(date) {
  state.selectedDate =
    startOfDay(date);

  state.cursorDate =
    startOfDay(date);

  renderCalendar();
  renderSelectedDay();
}


function renderSelectedDay() {
  const label =
    $('selected-date-label');

  const box =
    $('selected-day-tasks');

  if (!label || !box) {
    return;
  }


  label.textContent =
    capitalize(
      formatDateLong(
        state.selectedDate
      )
    );


  const tasks =
    getTasksForDate(
      state.selectedDate
    );


  if (!tasks.length) {
    box.innerHTML = `
      <div class="summary-empty">
        На этот день задач нет.
        <br><br>
        <button
          class="btn btn-primary btn-sm"
          type="button"
          id="sidebar-add-task"
        >
          + Добавить задачу
        </button>
      </div>
    `;

    const btn =
      $('sidebar-add-task');

    if (btn) {
      btn.addEventListener(
        'click',
        () =>
          openTaskModal(
            null,
            state.selectedDate
          )
      );
    }

    return;
  }


  box.innerHTML =
    tasks.map(
      task =>
        buildSummaryTask(task)
    ).join('');


  $all(
    '[data-summary-task-id]',
    box
  ).forEach(
    element => {

      element.addEventListener(
        'click',
        () => {

          openTaskModal(
            element.dataset
              .summaryTaskId
          );
        }
      );
    }
  );
}


function buildSummaryTask(task) {
  const type =
    TASK_TYPES[task.type] ||
    TASK_TYPES.other;

  const profile =
    findProfile(
      task.assignedTo
    );

  const client =
    getTaskClientName(task);

  return `
    <div
      class="summary-task"
      data-summary-task-id="${escapeHtml(task.id)}"
      style="
        border-left:
          3px solid
          ${type.color};
      "
    >

      <div class="summary-task-head">

        <div class="summary-task-title">
          ${escapeHtml(task.title)}
        </div>

        <div class="summary-task-time">
          ${
            task.time
              ? escapeHtml(
                  formatTime(task.time)
                )
              : ''
          }
        </div>

      </div>

      <div class="summary-task-meta">
        ${escapeHtml(type.label)}

        ${
          client
            ? ` • ${escapeHtml(client)}`
            : ''
        }

        ${
          profile
            ? ` • ${escapeHtml(profileDisplayName(profile))}`
            : ''
        }
      </div>

      <div>
        ${buildStatusPill(task.status)}
      </div>

    </div>
  `;
}


/* ============================================================
   СТАТУС
   ============================================================ */

function buildStatusPill(status) {
  switch (status) {

    case 'done':
      return `
        <span class="status-pill done">
          ✓ Выполнена
        </span>
      `;

    case 'cancelled':
      return `
        <span class="status-pill cancelled">
          Отменена
        </span>
      `;

    case 'pending':
    default:
      return `
        <span class="status-pill pending">
          Активная
        </span>
      `;
  }
}


/* ============================================================
   PROFILE / CLIENT HELPERS
   ============================================================ */

function findProfile(id) {
  return (
    state.profiles.find(
      p => p.id === id
    ) ||
    null
  );
}


function profileDisplayName(profile) {
  if (!profile) return '';

  return (
    profile.full_name ||
    profile.email ||
    profile.position ||
    'Сотрудник'
  );
}


function findClient(id) {
  return (
    state.clients.find(
      c => c.id === id
    ) ||
    null
  );
}


function getTaskClientName(task) {
  if (task.clientId) {
    const client =
      findClient(
        task.clientId
      );

    if (client) {
      return (
        client.client_name ||
        client.short_name ||
        task.clientName ||
        ''
      );
    }
  }

  return task.clientName || '';
}


/* ============================================================
   SELECTS
   ============================================================ */

function renderAssigneeSelects() {
  const formSelect =
    $('task-assigned-to');

  const filterSelect =
    $('filter-assignee');


  const options =
    state.profiles.map(
      profile => `
        <option value="${escapeHtml(profile.id)}">
          ${escapeHtml(profileDisplayName(profile))}
          ${
            profile.position
              ? ` — ${escapeHtml(profile.position)}`
              : ''
          }
        </option>
      `
    ).join('');


  if (formSelect) {
    const old =
      formSelect.value;

    formSelect.innerHTML =
      '<option value="">— выбрать сотрудника —</option>' +
      options;

    formSelect.value =
      old ||
      state.user?.id ||
      '';
  }


  if (filterSelect) {
    const old =
      filterSelect.value;

    filterSelect.innerHTML =
      '<option value="">Все сотрудники</option>' +
      options;

    filterSelect.value =
      old || '';
  }
}


function renderClientSelect() {
  const select =
    $('task-client-select');

  if (!select) return;


  const old =
    select.value;


  const options =
    state.clients.map(
      client => {

        const name =
          client.short_name ||
          client.client_name ||
          'Клиент';

        return `
          <option value="${escapeHtml(client.id)}">
            ${escapeHtml(name)}
          </option>
        `;
      }
    ).join('');


  select.innerHTML =
    `
      <option value="">
        — выбрать из базы клиентов —
      </option>
    ` +
    options +
    `
      <option value="manual">
        Ввести вручную…
      </option>
    `;


  if (
    old &&
    (
      old === 'manual' ||
      state.clients.some(
        c => c.id === old
      )
    )
  ) {
    select.value = old;
  }
}


/* ============================================================
   MODALS
   ============================================================ */

function openModal(id) {
  const modal =
    $(id);

  if (!modal) return;

  modal.classList.add(
    'active'
  );

  document.body.classList.add(
    'modal-open'
  );
}


function closeModal(id) {
  const modal =
    $(id);

  if (!modal) return;

  modal.classList.remove(
    'active'
  );


  if (
    !$all(
      '.modal-backdrop.active'
    ).length
  ) {
    document.body.classList.remove(
      'modal-open'
    );
  }
}


/* ============================================================
   TASK MODAL
   ============================================================ */

async function openTaskModal(
  taskId = null,
  date = null,
  hour = null
) {
  resetTaskForm();

  state.editingTaskId =
    taskId || null;


  if (taskId) {
    const task =
      state.tasks.find(
        item =>
          item.id === taskId
      );

    if (!task) {
      toast(
        'Задача не найдена',
        'err'
      );

      return;
    }

    fillTaskForm(task);

    $('task-modal-title').textContent =
      'Редактирование задачи';

    $('task-modal-subtitle').textContent =
      task.title;

    setHidden(
      $('btn-delete-task'),
      false
    );

    await renderExistingAttachments(
      task.id
    );

  } else {

    $('task-modal-title').textContent =
      'Новая задача';

    $('task-modal-subtitle').textContent =
      'Заполните основные параметры задачи';

    setHidden(
      $('btn-delete-task'),
      true
    );


    const chosenDate =
      date ||
      state.selectedDate ||
      new Date();

    $('task-date').value =
      toISODate(
        chosenDate
      );


    if (hour !== null) {
      $('task-time').value =
        `${String(hour).padStart(2, '0')}:00`;
    }


    if (state.user?.id) {
      $('task-assigned-to').value =
        state.user.id;
    }
  }


  updateRepeatFieldsVisibility();

  openModal(
    'task-modal'
  );


  setTimeout(
    () => {
      $('task-title')?.focus();
    },
    100
  );
}


function resetTaskForm() {
  state.pendingFiles = [];

  state.removedAttachmentIds.clear();


  $('task-id').value = '';
  $('task-title').value = '';
  $('task-type').value = 'other';

  $('task-date').value =
    toISODate(new Date());

  $('task-time').value = '';

  $('task-status').value =
    'pending';

  $('task-client-select').value =
    '';

  $('task-client-name').value =
    '';

  $('task-assigned-to').value =
    state.user?.id || '';

  $('task-repeat-type').value =
    'none';

  $('task-repeat-weekday').value =
    '1';

  $('task-repeat-monthday').value =
    '';

  $('task-repeat-until').value =
    '';

  $('task-description').value =
    '';

  $('task-file-input').value =
    '';

  $('task-attachment-list').innerHTML =
    '';


  setHidden(
    $('task-client-manual-field'),
    true
  );


  $all(
    '.task-type-option'
  ).forEach(
    btn => {

      btn.classList.toggle(
        'active',
        btn.dataset.type === 'other'
      );
    }
  );
}


function fillTaskForm(task) {
  $('task-id').value =
    task.id;

  $('task-title').value =
    task.title || '';

  setTaskType(
    task.type || 'other'
  );

  $('task-date').value =
    task.date || '';

  $('task-time').value =
    task.time
      ? formatTime(task.time)
      : '';

  $('task-status').value =
    task.status || 'pending';

  $('task-assigned-to').value =
    task.assignedTo || '';

  $('task-description').value =
    task.description || '';

  $('task-repeat-type').value =
    task.repeatType || 'none';

  $('task-repeat-weekday').value =
    task.repeatWeekday !== null &&
    task.repeatWeekday !== undefined
      ? String(task.repeatWeekday)
      : '1';

  $('task-repeat-monthday').value =
    task.repeatMonthday || '';

  $('task-repeat-until').value =
    task.repeatUntil || '';


  if (task.clientId) {

    $('task-client-select').value =
      task.clientId;

    setHidden(
      $('task-client-manual-field'),
      true
    );

  } else if (task.clientName) {

    $('task-client-select').value =
      'manual';

    $('task-client-name').value =
      task.clientName;

    setHidden(
      $('task-client-manual-field'),
      false
    );

  } else {

    $('task-client-select').value =
      '';

    setHidden(
      $('task-client-manual-field'),
      true
    );
  }
}


/* ============================================================
   TASK TYPE
   ============================================================ */

function setTaskType(type) {
  const safeType =
    TASK_TYPES[type]
      ? type
      : 'other';

  $('task-type').value =
    safeType;

  $all(
    '.task-type-option'
  ).forEach(
    btn => {

      btn.classList.toggle(
        'active',
        btn.dataset.type === safeType
      );
    }
  );
}


/* ============================================================
   REPEAT FORM
   ============================================================ */

function updateRepeatFieldsVisibility() {
  const type =
    $('task-repeat-type').value;

  setHidden(
    $('repeat-weekday-field'),
    type !== 'weekly'
  );

  setHidden(
    $('repeat-monthday-field'),
    type !== 'monthly'
  );

  setHidden(
    $('repeat-until-field'),
    type === 'none'
  );


  if (
    type === 'weekly' &&
    !$('task-repeat-weekday').value
  ) {
    const date =
      fromISODate(
        $('task-date').value
      ) ||
      new Date();

    $('task-repeat-weekday').value =
      String(date.getDay());
  }


  if (
    type === 'monthly' &&
    !$('task-repeat-monthday').value
  ) {
    const date =
      fromISODate(
        $('task-date').value
      ) ||
      new Date();

    $('task-repeat-monthday').value =
      String(date.getDate());
  }
}


/* ============================================================
   FORM → PAYLOAD
   ============================================================ */

function buildTaskPayload() {
  const title =
    $('task-title')
      .value
      .trim();

  const date =
    $('task-date').value;

  const assignedTo =
    $('task-assigned-to').value;


  if (!title) {
    throw new Error(
      'Укажите название задачи.'
    );
  }


  if (!date) {
    throw new Error(
      'Укажите дату задачи.'
    );
  }


  if (!assignedTo) {
    throw new Error(
      'Выберите ответственного.'
    );
  }


  const clientChoice =
    $('task-client-select').value;

  let clientId = null;
  let clientName = null;


  if (
    clientChoice &&
    clientChoice !== 'manual'
  ) {
    clientId =
      clientChoice;

    const client =
      findClient(clientId);

    clientName =
      client
        ? (
            client.client_name ||
            client.short_name ||
            null
          )
        : null;

  } else if (
    clientChoice === 'manual'
  ) {
    clientName =
      $('task-client-name')
        .value
        .trim() ||
      null;
  }


  const repeatType =
    $('task-repeat-type').value;

  let repeatWeekday = null;
  let repeatMonthday = null;
  let repeatUntil = null;


  if (
    repeatType === 'weekly'
  ) {
    repeatWeekday =
      Number(
        $('task-repeat-weekday').value
      );
  }


  if (
    repeatType === 'monthly'
  ) {
    repeatMonthday =
      Number(
        $('task-repeat-monthday').value
      );

    if (
      !repeatMonthday ||
      repeatMonthday < 1 ||
      repeatMonthday > 31
    ) {
      throw new Error(
        'Укажите корректное число месяца от 1 до 31.'
      );
    }
  }


  if (
    repeatType !== 'none'
  ) {
    repeatUntil =
      $('task-repeat-until').value ||
      null;
  }


  return {
    [TASK_FIELDS.title]:
      title,

    [TASK_FIELDS.description]:
      $('task-description')
        .value
        .trim() ||
      null,

    [TASK_FIELDS.type]:
      $('task-type').value ||
      'other',

    [TASK_FIELDS.date]:
      date,

    [TASK_FIELDS.time]:
      $('task-time').value ||
      null,

    [TASK_FIELDS.status]:
      $('task-status').value ||
      'pending',

    [TASK_FIELDS.clientId]:
      clientId,

    [TASK_FIELDS.clientName]:
      clientName,

    [TASK_FIELDS.assignedTo]:
      assignedTo,

    [TASK_FIELDS.repeatType]:
      repeatType,

    [TASK_FIELDS.repeatWeekday]:
      repeatWeekday,

    [TASK_FIELDS.repeatMonthday]:
      repeatMonthday,

    [TASK_FIELDS.repeatUntil]:
      repeatUntil
  };
}


/* ============================================================
   SAVE TASK
   ============================================================ */

async function saveTask() {
  const button =
    $('btn-save-task');

  try {
    setButtonBusy(
      button,
      true,
      'Сохраняем…'
    );


    const payload =
      buildTaskPayload();


    let savedTask;


    if (state.editingTaskId) {

      const {
        data,
        error
      } = await state.supabase
        .from(
          TASK_MANAGER_CONFIG.tables.tasks
        )
        .update(payload)
        .eq(
          TASK_FIELDS.id,
          state.editingTaskId
        )
        .select()
        .single();

      if (error) {
        throw error;
      }

      savedTask =
        normalizeTask(data);

    } else {

      payload[
        TASK_FIELDS.createdBy
      ] = state.user.id;


      const {
        data,
        error
      } = await state.supabase
        .from(
          TASK_MANAGER_CONFIG.tables.tasks
        )
        .insert(payload)
        .select()
        .single();

      if (error) {
        throw error;
      }

      savedTask =
        normalizeTask(data);
    }


    await deleteRemovedAttachments();

    await uploadPendingFiles(
      savedTask.id
    );


    state.selectedDate =
      fromISODate(
        savedTask.date
      ) ||
      state.selectedDate;


    state.cursorDate =
      cloneDate(
        state.selectedDate
      );


    closeModal(
      'task-modal'
    );


    toast(
      state.editingTaskId
        ? 'Задача обновлена'
        : 'Задача создана',
      'ok'
    );


    state.editingTaskId =
      null;


    await loadTasks();

  } catch (error) {

    console.error(
      'Ошибка сохранения задачи:',
      error
    );

    toast(
      friendlyError(error),
      'err'
    );

  } finally {

    setButtonBusy(
      button,
      false
    );
  }
}


/* ============================================================
   DELETE TASK
   ============================================================ */

function requestDeleteTask() {
  if (!state.editingTaskId) {
    return;
  }

  const task =
    state.tasks.find(
      x =>
        x.id === state.editingTaskId
    );


  confirmDialog(
    'Удалить задачу?',
    task
      ? `Задача «${task.title}» будет удалена вместе с её вложениями.`
      : 'Задача будет удалена.',
    async () => {
      await deleteTask(
        state.editingTaskId
      );
    }
  );
}


async function deleteTask(taskId) {
  try {
    const attachments =
      state.attachments.get(
        taskId
      ) || [];


    if (attachments.length) {

      const paths =
        attachments
          .map(
            item =>
              item.filePath
          )
          .filter(Boolean);


      if (paths.length) {
        const {
          error: storageError
        } = await state.supabase
          .storage
          .from(
            TASK_MANAGER_CONFIG
              .storageBucket
          )
          .remove(paths);

        if (storageError) {
          console.warn(
            'Не удалось удалить часть файлов:',
            storageError
          );
        }
      }


      const {
        error: attachmentError
      } = await state.supabase
        .from(
          TASK_MANAGER_CONFIG
            .tables
            .attachments
        )
        .delete()
        .eq(
          ATTACHMENT_FIELDS.taskId,
          taskId
        );

      if (attachmentError) {
        throw attachmentError;
      }
    }


    const {
      error
    } = await state.supabase
      .from(
        TASK_MANAGER_CONFIG.tables.tasks
      )
      .delete()
      .eq(
        TASK_FIELDS.id,
        taskId
      );


    if (error) {
      throw error;
    }


    closeModal(
      'task-modal'
    );


    state.editingTaskId =
      null;


    toast(
      'Задача удалена',
      'ok'
    );


    await loadTasks();

  } catch (error) {

    console.error(
      'Ошибка удаления задачи:',
      error
    );

    toast(
      friendlyError(error),
      'err'
    );
  }
}


/* ============================================================
   FILES — UI
   ============================================================ */

function handleFilesSelected(fileList) {
  const files =
    Array.from(
      fileList || []
    );


  for (const file of files) {

    if (
      file.size >
      TASK_MANAGER_CONFIG.maxFileSize
    ) {
      toast(
        `Файл «${file.name}» слишком большой. Максимум 20 МБ.`,
        'err'
      );

      continue;
    }


    state.pendingFiles.push({
      id:
        createLocalId(),

      file
    });
  }


  renderPendingFiles();
}


function renderPendingFiles() {
  const box =
    $('task-attachment-list');

  if (!box) return;


  const existingTaskId =
    state.editingTaskId;

  const existing =
    existingTaskId
      ? (
          state.attachments.get(
            existingTaskId
          ) || []
        )
      : [];


  const existingHtml =
    existing
      .filter(
        item =>
          !state.removedAttachmentIds.has(
            item.id
          )
      )
      .map(
        item =>
          buildExistingAttachmentItem(
            item
          )
      )
      .join('');


  const pendingHtml =
    state.pendingFiles
      .map(
        item =>
          buildPendingAttachmentItem(
            item
          )
      )
      .join('');


  box.innerHTML =
    existingHtml +
    pendingHtml;


  bindAttachmentButtons();
}


function buildPendingAttachmentItem(item) {
  return `
    <div class="attachment-item">

      <svg class="icon" viewBox="0 0 24 24">
        <path d="M21 12.5L12.5 21a6 6 0 01-8.5-8.5L13 3.5a4 4 0 015.5 5.5L9.5 18a2 2 0 01-3-3l8-8"/>
      </svg>

      <div class="attachment-name">
        ${escapeHtml(item.file.name)}
      </div>

      <div class="attachment-size">
        ${formatFileSize(item.file.size)}
      </div>

      <button
        class="btn btn-ghost btn-sm"
        type="button"
        data-remove-pending-file="${escapeHtml(item.id)}"
        title="Убрать файл"
      >
        ×
      </button>

    </div>
  `;
}


function buildExistingAttachmentItem(item) {
  return `
    <div class="attachment-item">

      <svg class="icon" viewBox="0 0 24 24">
        <path d="M21 12.5L12.5 21a6 6 0 01-8.5-8.5L13 3.5a4 4 0 015.5 5.5L9.5 18a2 2 0 01-3-3l8-8"/>
      </svg>

      <button
        type="button"
        class="attachment-name"
        data-open-attachment="${escapeHtml(item.id)}"
        style="
          border:0;
          background:none;
          text-align:left;
          cursor:pointer;
          padding:0;
        "
      >
        ${escapeHtml(item.fileName)}
      </button>

      <div class="attachment-size">
        ${formatFileSize(item.fileSize)}
      </div>

      <button
        class="btn btn-ghost btn-sm"
        type="button"
        data-remove-existing-file="${escapeHtml(item.id)}"
        title="Удалить вложение"
      >
        ×
      </button>

    </div>
  `;
}


function bindAttachmentButtons() {

  $all(
    '[data-remove-pending-file]'
  ).forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

          const id =
            button.dataset
              .removePendingFile;

          state.pendingFiles =
            state.pendingFiles
              .filter(
                item =>
                  item.id !== id
              );

          renderPendingFiles();
        }
      );
    }
  );


  $all(
    '[data-remove-existing-file]'
  ).forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

          state.removedAttachmentIds.add(
            button.dataset
              .removeExistingFile
          );

          renderPendingFiles();
        }
      );
    }
  );


  $all(
    '[data-open-attachment]'
  ).forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

          openAttachment(
            button.dataset
              .openAttachment
          );
        }
      );
    }
  );
}


/* ============================================================
   FILES — DATABASE
   ============================================================ */

function normalizeAttachment(row) {
  return {
    id:
      row[
        ATTACHMENT_FIELDS.id
      ],

    taskId:
      row[
        ATTACHMENT_FIELDS.taskId
      ],

    fileName:
      row[
        ATTACHMENT_FIELDS.fileName
      ] || 'Файл',

    filePath:
      row[
        ATTACHMENT_FIELDS.filePath
      ] || '',

    fileSize:
      Number(
        row[
          ATTACHMENT_FIELDS.fileSize
        ]
      ) || 0,

    mimeType:
      row[
        ATTACHMENT_FIELDS.mimeType
      ] || '',

    uploadedBy:
      row[
        ATTACHMENT_FIELDS.uploadedBy
      ] || null,

    createdAt:
      row[
        ATTACHMENT_FIELDS.createdAt
      ] || null,

    raw: row
  };
}


async function loadAttachmentsForCurrentTasks() {
  state.attachments.clear();

  const ids =
    state.tasks
      .map(
        task =>
          task.id
      )
      .filter(Boolean);


  if (!ids.length) {
    return;
  }


  const {
    data,
    error
  } = await state.supabase
    .from(
      TASK_MANAGER_CONFIG
        .tables
        .attachments
    )
    .select('*')
    .in(
      ATTACHMENT_FIELDS.taskId,
      ids
    );


  if (error) {
    console.warn(
      'Вложения не загрузились:',
      error
    );

    return;
  }


  for (
    const row of data || []
  ) {
    const item =
      normalizeAttachment(row);

    if (
      !state.attachments.has(
        item.taskId
      )
    ) {
      state.attachments.set(
        item.taskId,
        []
      );
    }

    state.attachments
      .get(item.taskId)
      .push(item);
  }
}


async function renderExistingAttachments(taskId) {
  if (
    !state.attachments.has(
      taskId
    )
  ) {
    await loadAttachmentsForTask(
      taskId
    );
  }

  renderPendingFiles();
}


async function loadAttachmentsForTask(taskId) {
  const {
    data,
    error
  } = await state.supabase
    .from(
      TASK_MANAGER_CONFIG
        .tables
        .attachments
    )
    .select('*')
    .eq(
      ATTACHMENT_FIELDS.taskId,
      taskId
    )
    .order(
      ATTACHMENT_FIELDS.createdAt,
      {
        ascending: true
      }
    );


  if (error) {
    throw error;
  }


  state.attachments.set(
    taskId,
    (data || [])
      .map(
        normalizeAttachment
      )
  );
}


/* ============================================================
   FILE UPLOAD
   ============================================================ */

async function uploadPendingFiles(taskId) {
  if (
    !state.pendingFiles.length
  ) {
    return;
  }


  for (
    const pending of
    state.pendingFiles
  ) {
    const file =
      pending.file;

    const safeName =
      sanitizeFileName(
        file.name
      );

    const filePath =
      `${state.user.id}/` +
      `${taskId}/` +
      `${Date.now()}_` +
      `${createLocalId()}_` +
      `${safeName}`;


    const {
      error: uploadError
    } = await state.supabase
      .storage
      .from(
        TASK_MANAGER_CONFIG
          .storageBucket
      )
      .upload(
        filePath,
        file,
        {
          cacheControl: '3600',
          upsert: false,
          contentType:
            file.type ||
            'application/octet-stream'
        }
      );


    if (uploadError) {
      throw uploadError;
    }


    const record = {
      [ATTACHMENT_FIELDS.taskId]:
        taskId,

      [ATTACHMENT_FIELDS.fileName]:
        file.name,

      [ATTACHMENT_FIELDS.filePath]:
        filePath,

      [ATTACHMENT_FIELDS.fileSize]:
        file.size,

      [ATTACHMENT_FIELDS.mimeType]:
        file.type ||
        null,

      [ATTACHMENT_FIELDS.uploadedBy]:
        state.user.id
    };


    const {
      error: dbError
    } = await state.supabase
      .from(
        TASK_MANAGER_CONFIG
          .tables
          .attachments
      )
      .insert(record);


    if (dbError) {

      await state.supabase
        .storage
        .from(
          TASK_MANAGER_CONFIG
            .storageBucket
        )
        .remove([
          filePath
        ]);

      throw dbError;
    }
  }


  state.pendingFiles = [];
}


/* ============================================================
   DELETE ATTACHMENTS
   ============================================================ */

async function deleteRemovedAttachments() {
  if (
    !state.removedAttachmentIds.size
  ) {
    return;
  }


  const all =
    Array.from(
      state.attachments.values()
    ).flat();


  const items =
    all.filter(
      item =>
        state.removedAttachmentIds.has(
          item.id
        )
    );


  for (
    const item of items
  ) {

    if (item.filePath) {
      const {
        error
      } = await state.supabase
        .storage
        .from(
          TASK_MANAGER_CONFIG
            .storageBucket
        )
        .remove([
          item.filePath
        ]);

      if (error) {
        throw error;
      }
    }


    const {
      error
    } = await state.supabase
      .from(
        TASK_MANAGER_CONFIG
          .tables
          .attachments
      )
      .delete()
      .eq(
        ATTACHMENT_FIELDS.id,
        item.id
      );


    if (error) {
      throw error;
    }
  }


  state.removedAttachmentIds.clear();
}


/* ============================================================
   OPEN PRIVATE ATTACHMENT
   ============================================================ */

async function openAttachment(
  attachmentId
) {
  try {
    const all =
      Array.from(
        state.attachments.values()
      ).flat();


    const item =
      all.find(
        x =>
          x.id === attachmentId
      );


    if (!item) {
      throw new Error(
        'Вложение не найдено.'
      );
    }


    const {
      data,
      error
    } = await state.supabase
      .storage
      .from(
        TASK_MANAGER_CONFIG
          .storageBucket
      )
      .createSignedUrl(
        item.filePath,
        TASK_MANAGER_CONFIG
          .signedUrlLifetime
      );


    if (error) {
      throw error;
    }


    if (
      !data?.signedUrl
    ) {
      throw new Error(
        'Не удалось получить ссылку на файл.'
      );
    }


    window.open(
      data.signedUrl,
      '_blank',
      'noopener,noreferrer'
    );

  } catch (error) {

    console.error(
      error
    );

    toast(
      friendlyError(error),
      'err'
    );
  }
}


/* ============================================================
   FILE UTILS
   ============================================================ */

function sanitizeFileName(name) {
  return String(name)
    .normalize('NFKD')
    .replace(
      /[^\w.\-а-яА-ЯёЁ]+/g,
      '_'
    )
    .replace(
      /_+/g,
      '_'
    )
    .slice(
      0,
      160
    );
}


function formatFileSize(bytes) {
  const value =
    Number(bytes) || 0;

  if (value < 1024) {
    return `${value} Б`;
  }

  if (
    value <
    1024 * 1024
  ) {
    return (
      `${(
        value / 1024
      ).toFixed(1)} КБ`
    );
  }

  return (
    `${(
      value /
      (1024 * 1024)
    ).toFixed(1)} МБ`
  );
}


function createLocalId() {
  if (
    window.crypto?.randomUUID
  ) {
    return window.crypto
      .randomUUID();
  }

  return (
    Date.now()
      .toString(36) +
    Math.random()
      .toString(36)
      .slice(2)
  );
}


/* ============================================================
   НАВИГАЦИЯ ПО КАЛЕНДАРЮ
   ============================================================ */

async function moveCalendar(direction) {
  switch (state.view) {

    case 'week':
      state.cursorDate =
        addDays(
          state.cursorDate,
          direction * 7
        );
      break;

    case 'quarter':
      state.cursorDate =
        addMonths(
          state.cursorDate,
          direction * 3
        );
      break;

    case 'year':
      state.cursorDate =
        addYears(
          state.cursorDate,
          direction
        );
      break;

    case 'month':
    default:
      state.cursorDate =
        addMonths(
          state.cursorDate,
          direction
        );
      break;
  }

  await loadTasks();
}


async function goToday() {
  state.cursorDate =
    startOfDay(
      new Date()
    );

  state.selectedDate =
    startOfDay(
      new Date()
    );

  await loadTasks();
}


async function switchCalendarView(
  view
) {
  if (
    ![
      'week',
      'month',
      'quarter',
      'year'
    ].includes(view)
  ) {
    return;
  }

  state.view = view;


  $all(
    '#calendar-view-switch button'
  ).forEach(
    button => {

      button.classList.toggle(
        'active',
        button.dataset.view === view
      );
    }
  );


  await loadTasks();
}


/* ============================================================
   NOTIFICATIONS
   ============================================================ */

async function requestNotificationPermission() {
  if (
    !('Notification' in window)
  ) {
    toast(
      'Этот браузер не поддерживает системные уведомления.',
      'warn'
    );

    return;
  }


  if (
    Notification.permission ===
    'granted'
  ) {
    toast(
      'Уведомления уже разрешены.',
      'ok'
    );

    runNotificationCheck();

    return;
  }


  if (
    Notification.permission ===
    'denied'
  ) {
    toast(
      'Уведомления запрещены в настройках браузера.',
      'warn'
    );

    return;
  }


  const permission =
    await Notification
      .requestPermission();


  if (
    permission ===
    'granted'
  ) {
    toast(
      'Уведомления включены.',
      'ok'
    );

    runNotificationCheck();

  } else {

    toast(
      'Разрешение на уведомления не выдано.',
      'warn'
    );
  }
}


/* ============================================================
   REMINDER CHECK

   Это браузерное уведомление работает, пока Рабочая станция
   открыта в браузере.

   Полноценные фоновые push-уведомления при полностью закрытом
   сайте потребуют Service Worker / Web Push и серверной части.
   ============================================================ */

function startNotificationWatcher() {
  if (
    state.notificationTimer
  ) {
    clearInterval(
      state.notificationTimer
    );
  }


  runNotificationCheck();


  state.notificationTimer =
    setInterval(
      runNotificationCheck,
      60 * 1000
    );
}


function runNotificationCheck() {
  if (
    !('Notification' in window) ||
    Notification.permission !==
      'granted' ||
    !state.user
  ) {
    return;
  }


  const now =
    new Date();

  const today =
    startOfDay(now);

  const tasks =
    state.tasks.filter(
      task =>
        task.status === 'pending' &&
        task.assignedTo ===
          state.user.id &&
        taskOccursOnDate(
          task,
          today
        )
    );


  for (
    const task of tasks
  ) {

    const storageKey =
      getNotificationStorageKey(
        task,
        today
      );


    if (
      sessionStorage.getItem(
        storageKey
      )
    ) {
      continue;
    }


    if (task.time) {
      const [
        hours,
        minutes
      ] =
        formatTime(task.time)
          .split(':')
          .map(Number);


      const due =
        new Date(today);

      due.setHours(
        hours || 0,
        minutes || 0,
        0,
        0
      );


      /*
       * Показываем уведомление от времени задачи
       * и в течение следующих 60 минут.
       */
      const diff =
        now.getTime() -
        due.getTime();


      if (
        diff < 0 ||
        diff >
          60 * 60 * 1000
      ) {
        continue;
      }
    }


    showTaskNotification(
      task
    );


    sessionStorage.setItem(
      storageKey,
      '1'
    );
  }
}


function getNotificationStorageKey(
  task,
  date
) {
  return (
    'jambalance_task_notice_' +
    task.id +
    '_' +
    toISODate(date)
  );
}


function showTaskNotification(task) {
  const type =
    TASK_TYPES[task.type] ||
    TASK_TYPES.other;


  const bodyParts = [];


  if (task.time) {
    bodyParts.push(
      formatTime(task.time)
    );
  }


  const client =
    getTaskClientName(task);

  if (client) {
    bodyParts.push(client);
  }


  bodyParts.push(
    type.label
  );


  const notification =
    new Notification(
      `Задачник: ${task.title}`,
      {
        body:
          bodyParts.join(' • '),

        tag:
          `jambalance-task-${task.id}`,

        renotify: false
      }
    );


  notification.onclick =
    () => {

      window.focus();

      openTaskModal(
        task.id
      );

      notification.close();
    };
}


/* ============================================================
   REALTIME

   Если Realtime для tasks в Supabase включён, изменения
   других сотрудников будут появляться автоматически.
   Если нет — Задачник всё равно работает без него.
   ============================================================ */

function startRealtime() {
  if (
    !state.supabase?.channel
  ) {
    return;
  }


  if (
    state.realtimeChannel
  ) {
    state.supabase
      .removeChannel(
        state.realtimeChannel
      );

    state.realtimeChannel =
      null;
  }


  try {
    state.realtimeChannel =
      state.supabase
        .channel(
          'jambalance-task-manager'
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              TASK_MANAGER_CONFIG
                .tables
                .tasks
          },
          debounceAsync(
            async () => {
              await loadTasks();
            },
            350
          )
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              TASK_MANAGER_CONFIG
                .tables
                .attachments
          },
          debounceAsync(
            async () => {
              await loadAttachmentsForCurrentTasks();

              if (
                state.editingTaskId
              ) {
                renderPendingFiles();
              }
            },
            350
          )
        )
        .subscribe();

  } catch (error) {

    console.warn(
      'Realtime не запущен:',
      error
    );
  }
}


/* ============================================================
   CONFIRM
   ============================================================ */

function confirmDialog(
  title,
  text,
  onConfirm
) {
  $('confirm-title').textContent =
    title;

  $('confirm-text').textContent =
    text;


  const oldButton =
    $('confirm-ok-btn');

  const newButton =
    oldButton.cloneNode(true);

  oldButton
    .parentNode
    .replaceChild(
      newButton,
      oldButton
    );


  newButton.addEventListener(
    'click',
    async () => {

      closeModal(
        'confirm-modal'
      );

      try {
        await onConfirm();
      } catch (error) {

        console.error(error);

        toast(
          friendlyError(error),
          'err'
        );
      }
    }
  );


  openModal(
    'confirm-modal'
  );
}


/* ============================================================
   TOAST
   ============================================================ */

function toast(
  text,
  kind = ''
) {
  const stack =
    $('toast-stack');

  if (!stack) return;


  const element =
    document.createElement(
      'div'
    );


  element.className =
    `toast ${kind}`;


  element.textContent =
    text;


  stack.appendChild(
    element
  );


  setTimeout(
    () => {

      element.style.transition =
        'opacity .25s ease, transform .25s ease';

      element.style.opacity =
        '0';

      element.style.transform =
        'translateX(16px)';


      setTimeout(
        () => {
          element.remove();
        },
        280
      );

    },
    3200
  );
}


/* ============================================================
   ERRORS
   ============================================================ */

function friendlyError(error) {
  if (!error) {
    return 'Неизвестная ошибка.';
  }


  const message =
    error.message ||
    String(error);


  if (
    message.includes(
      'row-level security'
    )
  ) {
    return (
      'Supabase отклонил операцию политикой RLS. ' +
      'Проверьте policies для Задачника.'
    );
  }


  if (
    message.includes(
      'duplicate'
    )
  ) {
    return (
      'Такая запись уже существует.'
    );
  }


  if (
    message.includes(
      'JWT'
    ) ||
    message.includes(
      'not authenticated'
    )
  ) {
    return (
      'Сессия авторизации истекла. ' +
      'Перезайдите в Рабочую станцию.'
    );
  }


  return message;
}


/* ============================================================
   BUTTON BUSY
   ============================================================ */

function setButtonBusy(
  button,
  busy,
  busyText = 'Подождите…'
) {
  if (!button) return;


  if (busy) {

    if (
      !button.dataset.originalHtml
    ) {
      button.dataset.originalHtml =
        button.innerHTML;
    }

    button.disabled = true;
    button.textContent =
      busyText;

  } else {

    button.disabled = false;

    if (
      button.dataset.originalHtml
    ) {
      button.innerHTML =
        button.dataset.originalHtml;

      delete button.dataset
        .originalHtml;
    }
  }
}


/* ============================================================
   DEBOUNCE
   ============================================================ */

function debounceAsync(
  fn,
  wait
) {
  let timer = null;

  return (...args) => {

    clearTimeout(timer);

    timer =
      setTimeout(
        () => {
          Promise
            .resolve(
              fn(...args)
            )
            .catch(
              console.error
            );
        },
        wait
      );
  };
}


/* ============================================================
   EVENTS
   ============================================================ */

function bindUIEvents() {

  $('btn-new-task')
    ?.addEventListener(
      'click',
      () =>
        openTaskModal(
          null,
          state.selectedDate
        )
    );


  $('btn-prev-period')
    ?.addEventListener(
      'click',
      () =>
        moveCalendar(-1)
    );


  $('btn-next-period')
    ?.addEventListener(
      'click',
      () =>
        moveCalendar(1)
    );


  $('btn-today')
    ?.addEventListener(
      'click',
      goToday
    );


  $('btn-notifications')
    ?.addEventListener(
      'click',
      requestNotificationPermission
    );


  $('btn-save-task')
    ?.addEventListener(
      'click',
      saveTask
    );


  $('btn-delete-task')
    ?.addEventListener(
      'click',
      requestDeleteTask
    );


  $('task-client-select')
    ?.addEventListener(
      'change',
      event => {

        setHidden(
          $('task-client-manual-field'),
          event.target.value !==
            'manual'
        );
      }
    );


  $('task-repeat-type')
    ?.addEventListener(
      'change',
      updateRepeatFieldsVisibility
    );


  $('task-date')
    ?.addEventListener(
      'change',
      () => {

        const repeat =
          $('task-repeat-type').value;

        const date =
          fromISODate(
            $('task-date').value
          );

        if (!date) return;


        if (
          repeat === 'weekly'
        ) {
          $('task-repeat-weekday').value =
            String(date.getDay());
        }


        if (
          repeat === 'monthly'
        ) {
          $('task-repeat-monthday').value =
            String(date.getDate());
        }
      }
    );


  $all(
    '.task-type-option'
  ).forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

          setTaskType(
            button.dataset.type
          );
        }
      );
    }
  );


  $all(
    '#calendar-view-switch button'
  ).forEach(
    button => {

      button.addEventListener(
        'click',
        () =>
          switchCalendarView(
            button.dataset.view
          )
      );
    }
  );


  $all(
    '.task-type-filter'
  ).forEach(
    checkbox => {

      checkbox.addEventListener(
        'change',
        () => {

          const type =
            checkbox.value;

          if (
            checkbox.checked
          ) {
            state.filters.types.add(
              type
            );
          } else {
            state.filters.types.delete(
              type
            );
          }

          renderCalendar();
          renderSelectedDay();
        }
      );
    }
  );


  $('filter-assignee')
    ?.addEventListener(
      'change',
      event => {

        state.filters.assignee =
          event.target.value;

        renderCalendar();
        renderSelectedDay();
      }
    );


  $('filter-status')
    ?.addEventListener(
      'change',
      event => {

        state.filters.status =
          event.target.value;

        renderCalendar();
        renderSelectedDay();
      }
    );


  $all(
    '[data-close-modal]'
  ).forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

          closeModal(
            button.dataset.closeModal
          );
        }
      );
    }
  );


  $all(
    '.modal-backdrop'
  ).forEach(
    backdrop => {

      backdrop.addEventListener(
        'click',
        event => {

          if (
            event.target ===
            backdrop
          ) {
            closeModal(
              backdrop.id
            );
          }
        }
      );
    }
  );


  document.addEventListener(
    'keydown',
    event => {

      if (
        event.key === 'Escape'
      ) {

        const open =
          $all(
            '.modal-backdrop.active'
          );

        if (open.length) {
          closeModal(
            open[
              open.length - 1
            ].id
          );
        }
      }
    }
  );


  bindFileDropEvents();
}


/* ============================================================
   FILE DROP EVENTS
   ============================================================ */

function bindFileDropEvents() {
  const drop =
    $('task-file-drop');

  const input =
    $('task-file-input');

  if (
    !drop ||
    !input
  ) {
    return;
  }


  drop.addEventListener(
    'click',
    () =>
      input.click()
  );


  drop.addEventListener(
    'keydown',
    event => {

      if (
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        event.preventDefault();
        input.click();
      }
    }
  );


  input.addEventListener(
    'change',
    event => {

      handleFilesSelected(
        event.target.files
      );

      input.value = '';
    }
  );


  [
    'dragenter',
    'dragover'
  ].forEach(
    eventName => {

      drop.addEventListener(
        eventName,
        event => {

          event.preventDefault();

          drop.classList.add(
            'dragover'
          );
        }
      );
    }
  );


  [
    'dragleave',
    'drop'
  ].forEach(
    eventName => {

      drop.addEventListener(
        eventName,
        event => {

          event.preventDefault();

          drop.classList.remove(
            'dragover'
          );
        }
      );
    }
  );


  drop.addEventListener(
    'drop',
    event => {

      handleFilesSelected(
        event.dataTransfer?.files
      );
    }
  );
}


/* ============================================================
   AUTH STATE
   ============================================================ */

function listenAuthChanges() {
  if (
    !state.supabase?.auth
  ) {
    return;
  }


  state.supabase.auth.onAuthStateChange(
    async (
      event,
      session
    ) => {

      if (
        event === 'SIGNED_OUT'
      ) {
        state.user = null;
        state.profile = null;

        toast(
          'Сессия завершена.',
          'warn'
        );

        return;
      }


      if (
        session?.user &&
        (
          !state.user ||
          state.user.id !==
            session.user.id
        )
      ) {
        state.user =
          session.user;

        try {
          await loadCurrentProfile();
          await loadProfiles();
          await loadTasks();
        } catch (error) {
          console.error(error);
        }
      }
    }
  );
}


/* ============================================================
   INITIAL STATE
   ============================================================ */

function prepareInitialUI() {
  state.cursorDate =
    startOfDay(
      new Date()
    );

  state.selectedDate =
    startOfDay(
      new Date()
    );

  renderCalendarPeriodTitle();
  renderSelectedDay();
}


/* ============================================================
   INIT
   ============================================================ */

async function initTaskManager() {
  if (
    state.initialized
  ) {
    return;
  }


  state.initialized = true;

  bindUIEvents();

  prepareInitialUI();

  setLoading(true);


  try {

    state.supabase =
      await resolveSupabaseClient();


    await loadCurrentUser();

    await Promise.all([
      loadCurrentProfile(),
      loadProfiles(),
      loadClients()
    ]);


    await loadTasks();


    listenAuthChanges();

    startRealtime();

    startNotificationWatcher();


    toast(
      `Задачник готов${
        state.profile
          ? ` — ${profileDisplayName(state.profile)}`
          : ''
      }`,
      'ok'
    );


  } catch (error) {

    console.error(
      'Не удалось запустить Задачник:',
      error
    );


    toast(
      friendlyError(error),
      'err'
    );


    const root =
      $('calendar-root');


    if (root) {
      root.innerHTML = `
        <div
          style="
            padding:40px 24px;
            max-width:760px;
            margin:auto;
          "
        >

          <div
            style="
              font-size:20px;
              font-weight:800;
              margin-bottom:10px;
            "
          >
            Не удалось подключить Задачник
          </div>

          <div
            style="
              color:#667085;
              line-height:1.6;
              font-size:13px;
            "
          >
            ${escapeHtml(
              friendlyError(error)
            )}
          </div>

        </div>
      `;
    }

  } finally {

    setLoading(false);
  }
}


/* ============================================================
   START
   ============================================================ */

document.addEventListener(
  'DOMContentLoaded',
  initTaskManager
);