(function () {
  'use strict';

  const TASK_URL = './tools/task-manager.html';
  const CHECKLIST_URL = './tools/quarterly-checklists.html';
  const STYLE_ID = 'today-dashboard-styles';
  const PANEL_ID = 'todayPanel';
  let loading = false;
  let lastLoadedAt = 0;
  let selectedChecklistPeriod = null;

  const QUARTER_NAMES = ['I', 'II', 'III', 'IV'];

  function defaultChecklistPeriod(today) {
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    if (month === 10 && day <= 25) {
      return { year: year, quarter: 3 };
    }
    return { year: year, quarter: Math.floor(today.getMonth() / 3) + 1 };
  }

  function quarterLabel(period) {
    return (QUARTER_NAMES[period.quarter - 1] || period.quarter) +
      ' квартал ' + period.year;
  }

  function quarterOptions(period) {
    return QUARTER_NAMES.map(function (name, index) {
      const quarter = index + 1;
      const value = period.year + '-' + quarter;
      return '<option value="' + value + '"' +
        (quarter === period.quarter ? ' selected' : '') + '>' +
        name + ' квартал ' + period.year + '</option>';
    }).join('');
  }

  function checklistHeader(period) {
    return '<div class="todaySubhead"><h3>Чек-листы за ' + quarterLabel(period) + '</h3>' +
      '<div class="todayChecklistControls">' +
      '<select class="todayQuarterSelect" id="todayQuarterSelect" aria-label="Выбрать квартал для чек-листов">' +
      quarterOptions(period) +
      '</select><a class="todayTextLink" href="' + CHECKLIST_URL + '">Все списки →</a>' +
      '</div></div>';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function localDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function parseDate(value) {
    if (!value) return null;
    const parts = String(value).slice(0, 10).split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function dayStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, count) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    result.setDate(result.getDate() + count);
    return result;
  }

  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function monthsBetween(a, b) {
    return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  }

  function taskDate(task) {
    if (task.due_date) return parseDate(task.due_date);
    if (task.start_at) {
      const date = new Date(task.start_at);
      if (!Number.isNaN(date.getTime())) return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }
    return null;
  }

  function configOf(task) {
    if (task.recurrence_config && typeof task.recurrence_config === 'object') return task.recurrence_config;
    if (typeof task.recurrence_config === 'string') {
      try { return JSON.parse(task.recurrence_config) || {}; } catch (_) { return {}; }
    }
    return {};
  }

  function occursOn(task, date) {
    const first = taskDate(task);
    const target = dayStart(date);
    if (!first || target < dayStart(first)) return false;

    const until = parseDate(task.recurrence_end_date);
    if (until && target > dayStart(until)) return false;

    const type = task.recurrence_type || 'once';
    if (type === 'weekly') {
      const weekdayValue = task.recurrence_weekday;
      const weekday = weekdayValue !== null && weekdayValue !== undefined && weekdayValue !== '' && Number.isInteger(Number(weekdayValue))
        ? Number(weekdayValue) : first.getDay();
      return target.getDay() === weekday;
    }

    if (type === 'monthly') {
      const wanted = Number(task.recurrence_monthday) || first.getDate();
      return target.getDate() === Math.min(wanted, daysInMonth(target.getFullYear(), target.getMonth()));
    }

    if (type === 'quarterly' || type === 'halfyear' || type === 'semiannual' || type === 'interval_months') {
      const interval = type === 'quarterly' ? 3
        : (type === 'halfyear' || type === 'semiannual' ? 6 : Number(task.recurrence_interval_months));
      if (!interval || interval < 1 || monthsBetween(first, target) % interval !== 0) return false;
      const wanted = Number(task.recurrence_monthday) || first.getDate();
      return target.getDate() === Math.min(wanted, daysInMonth(target.getFullYear(), target.getMonth()));
    }

    if (type === 'daily') {
      return true;
    }

    return localDate(first) === localDate(target);
  }

  function statusOn(task, date) {
    const config = configOf(task);
    const statuses = config.occurrence_statuses || {};
    const override = statuses[localDate(date)];
    if (typeof override === 'string') return override;
    return override && override.status ? override.status : (task.status || 'pending');
  }

  function taskOccurrences(rows, today) {
    const todayStart = dayStart(today);
    const todayISO = localDate(todayStart);
    const overdue = [];
    const dueToday = [];
    const upcoming = [];

    rows.forEach(function (task) {
      const first = taskDate(task);
      if (!first) return;

      let cursor = dayStart(first);
      while (cursor < todayStart) {
        if (occursOn(task, cursor) && statusOn(task, cursor) === 'pending') {
          overdue.push(Object.assign({}, task, { occurrenceDate: localDate(cursor) }));
        }
        cursor = addDays(cursor, 1);
      }

      if (occursOn(task, todayStart) && statusOn(task, todayStart) === 'pending') {
        dueToday.push(Object.assign({}, task, { occurrenceDate: todayISO }));
      }

      for (let offset = 1; offset <= 7; offset += 1) {
        const date = addDays(todayStart, offset);
        if (occursOn(task, date) && statusOn(task, date) === 'pending') {
          upcoming.push(Object.assign({}, task, { occurrenceDate: localDate(date) }));
        }
      }
    });

    overdue.sort(function (a, b) {
      return a.occurrenceDate.localeCompare(b.occurrenceDate) || String(a.title).localeCompare(String(b.title), 'ru');
    });
    dueToday.sort(function (a, b) {
      return String(a.due_time || '').localeCompare(String(b.due_time || '')) || String(a.title).localeCompare(String(b.title), 'ru');
    });
    upcoming.sort(function (a, b) {
      return a.occurrenceDate.localeCompare(b.occurrenceDate)
        || String(a.due_time || '').localeCompare(String(b.due_time || ''))
        || String(a.title).localeCompare(String(b.title), 'ru');
    });

    return { overdue: overdue, dueToday: dueToday, upcoming: upcoming };
  }

  function formatLongDate(date) {
    return date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function formatTaskRow(task, overdue) {
    const parts = [];
    const client = task.client_name_manual || task.client_name;
    if (client) parts.push(client);
    if (task.due_time) parts.push(String(task.due_time).slice(0, 5));
    const dateText = overdue
      ? 'Просрочено · ' + parseDate(task.occurrenceDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
      : parts.join(' · ');
    return '<a class="todayTaskRow" href="' + TASK_URL + '">' +
      '<span class="todayTaskMark' + (overdue ? ' isOverdue' : '') + '"></span>' +
      '<span class="todayTaskCopy"><strong>' + escapeHtml(task.title || 'Без названия') + '</strong>' +
      (client ? '<small>' + escapeHtml(client) + (task.due_time ? ' · ' + escapeHtml(String(task.due_time).slice(0, 5)) : '') + '</small>' : '') +
      '</span><span class="todayTaskMeta' + (overdue ? ' isOverdue' : '') + '">' + escapeHtml(dateText) + '</span></a>';
  }

  function taskList(title, tasks, overdue, emptyText) {
    const visible = tasks.slice(0, 6);
    const remaining = tasks.length - visible.length;
    return '<section class="todayListSection"><div class="todaySubhead"><h3>' + title +
      '</h3><span>' + tasks.length + '</span></div>' +
      (visible.length ? visible.map(function (task) { return formatTaskRow(task, overdue); }).join('') :
        '<p class="todayEmpty">' + emptyText + '</p>') +
      (remaining > 0 ? '<p class="todayMore">И ещё ' + remaining + '</p>' : '') +
      '</section>';
  }

  async function loadChecklists(db, year, quarter) {
    const result = await db.from('quarterly_checklists')
      .select('id,client_id,template_name')
      .eq('year', year)
      .eq('quarter', quarter);
    if (result.error) throw result.error;

    const lists = result.data || [];
    if (!lists.length) return [];

    const ids = lists.map(function (row) { return row.id; });
    const clientIds = Array.from(new Set(lists.map(function (row) { return row.client_id; })));
    const responses = await Promise.all([
      db.from('quarterly_checklist_items').select('checklist_id,completed_at').in('checklist_id', ids),
      db.from('clients').select('id,client_name').in('id', clientIds)
    ]);
    if (responses[0].error) throw responses[0].error;
    if (responses[1].error) throw responses[1].error;

    const items = responses[0].data || [];
    const clients = new Map((responses[1].data || []).map(function (row) { return [row.id, row.client_name || 'Клиент']; }));
    return lists.map(function (row) {
      const ownItems = items.filter(function (item) { return item.checklist_id === row.id; });
      const done = ownItems.filter(function (item) { return !!item.completed_at; }).length;
      return {
        client: clients.get(row.client_id) || 'Клиент',
        template: row.template_name || '',
        total: ownItems.length,
        done: done,
        percent: ownItems.length ? Math.round(done / ownItems.length * 100) : 0
      };
    }).sort(function (a, b) { return a.client.localeCompare(b.client, 'ru'); });
  }

  function renderChecklistSummary(lists, error, period) {
    const header = checklistHeader(period);
    if (error) {
      return '<section class="todayListSection">' + header +
        '<p class="todayEmpty">Не удалось загрузить чек-листы. Попробуйте обновить панель.</p></section>';
    }
    if (!lists.length) {
      return '<section class="todayListSection">' + header +
        '<p class="todayEmpty">Пока нет созданных списков за ' + quarterLabel(period) + '.</p>' +
        '<a class="todayTextLink" href="' + CHECKLIST_URL + '">Открыть чек-листы →</a></section>';
    }
    return '<section class="todayListSection">' + header +
      lists.slice(0, 5).map(function (list) {
        return '<div class="todayChecklistRow"><div class="todayChecklistTop"><strong>' + escapeHtml(list.client) +
          '</strong><span>' + list.done + ' из ' + list.total + '</span></div>' +
          '<div class="todayProgress"><i style="width:' + list.percent + '%"></i></div></div>';
      }).join('') +
      (lists.length > 5 ? '<p class="todayMore">Ещё ' + (lists.length - 5) + ' списков</p>' : '') +
      '</section>';
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.todayPanel{margin:0 0 17px;padding:20px;border:1px solid #e2e7ee;border-top:4px solid #f99303;border-radius:21px;background:#fff;box-shadow:0 12px 34px rgba(30,41,59,.08)}' +
      '.todayHeader{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:17px}' +
      '.todayEyebrow{margin:0 0 4px;color:#a85c00;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}' +
      '.todayTitle{margin:0;color:#172033;font-size:22px;font-weight:950}' +
      '.todayDate{margin:5px 0 0;color:#748094;font-size:12px;text-transform:capitalize}' +
      '.todayRefresh{flex:0 0 auto;min-height:36px;padding:7px 11px;border:1px solid #efbd75;border-radius:11px;color:#a85c00;background:#fff;font:inherit;font-size:11px;font-weight:800;cursor:pointer}' +
      '.todayRefresh:hover{background:#fff8ee}.todayRefresh:disabled{opacity:.6;cursor:wait}' +
      '.todayStats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}' +
      '.todayStat{padding:12px 14px;border:1px solid #e8ebf0;border-radius:14px;background:#fafbfc}' +
      '.todayStatLabel{display:block;color:#748094;font-size:10px;font-weight:700}' +
      '.todayStatValue{display:block;margin-top:5px;color:#172033;font-size:21px;font-weight:950;line-height:1}' +
      '.todayStat.isLate{border-color:#f0cac6;background:#fff7f6}.todayStat.isLate .todayStatValue{color:#b7352d}' +
      '.todayColumns{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(270px,.85fr);gap:14px}' +
      '.todayColumn{min-width:0}.todayListSection{padding:13px 0;border-top:1px solid #edf0f3}.todayColumn .todayListSection:first-child{border-top:0;padding-top:0}' +
      '.todaySubhead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}' +
      '.todaySubhead h3{margin:0;color:#263246;font-size:13px;font-weight:900}' +
      '.todaySubhead>span{display:inline-flex;min-width:22px;height:22px;align-items:center;justify-content:center;padding:0 6px;border-radius:99px;color:#596579;background:#eef1f4;font-size:10px;font-weight:900}' +
      '.todayChecklistControls{display:flex;align-items:center;gap:9px}.todayQuarterSelect{max-width:155px;height:31px;padding:0 8px;border:1px solid #e2e7ee;border-radius:9px;background:#fff;color:#4b5563;font:inherit;font-size:10px;font-weight:800}.todayQuarterSelect:focus{outline:2px solid rgba(249,147,3,.22);border-color:#f99303}' +
      '.todayTaskRow{display:flex;align-items:center;gap:9px;padding:9px 4px;color:inherit;text-decoration:none;border-radius:10px}.todayTaskRow:hover{background:#f8f9fb}' +
      '.todayTaskMark{width:9px;height:9px;flex:0 0 auto;border:2px solid #f99303;border-radius:50%}.todayTaskMark.isOverdue{border-color:#c83a32;background:#c83a32}' +
      '.todayTaskCopy{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}.todayTaskCopy strong{overflow:hidden;color:#263246;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.todayTaskCopy small{overflow:hidden;color:#8791a0;font-size:10px;text-overflow:ellipsis;white-space:nowrap}' +
      '.todayTaskMeta{flex:0 0 auto;color:#657186;font-size:10px}.todayTaskMeta.isOverdue{color:#b7352d;font-weight:800}' +
      '.todayEmpty{margin:7px 0 3px;color:#8791a0;font-size:11px;line-height:1.45}.todayMore{margin:7px 0 0;color:#8791a0;font-size:10px}' +
      '.todayTextLink{color:#a85c00;font-size:10px;font-weight:800;text-decoration:none;white-space:nowrap}.todayTextLink:hover{text-decoration:underline}' +
      '.todayChecklistRow{padding:9px 0}.todayChecklistTop{display:flex;justify-content:space-between;gap:10px;color:#334155;font-size:10px}.todayChecklistTop span{color:#748094;white-space:nowrap}' +
      '.todayProgress{height:6px;margin-top:6px;overflow:hidden;border-radius:99px;background:#edf0f3}.todayProgress i{display:block;height:100%;border-radius:inherit;background:#f99303}' +
      '.todayLoading{padding:13px;color:#748094;font-size:11px}.todayError{padding:11px;border:1px solid #efc7c3;border-radius:11px;color:#8b3c35;background:#fff5f4;font-size:11px}' +
      '@media(max-width:760px){.todayColumns{grid-template-columns:1fr}.todayStats{gap:7px}.todayStat{padding:10px}.todayStatValue{font-size:19px}}' +
      '@media(max-width:480px){.todayPanel{padding:15px;border-radius:17px}.todayHeader{align-items:flex-start}.todayTitle{font-size:20px}.todayDate{font-size:11px}.todayRefresh{font-size:10px;padding:7px 9px}.todayStats{grid-template-columns:repeat(3,minmax(0,1fr))}.todayStatLabel{font-size:9px}.todayStatValue{font-size:18px}.todayTaskMeta{max-width:85px;text-align:right;white-space:normal}}';
    document.head.appendChild(style);
  }

  function panel() {
    return document.getElementById(PANEL_ID);
  }

  async function loadDashboard(force) {
    const root = panel();
    const db = window.supabaseClient;
    if (!root || !db || loading) return;
    if (!force && Date.now() - lastLoadedAt < 30000) return;

    loading = true;
    const refresh = document.getElementById('todayRefresh');
    const content = document.getElementById('todayContent');
    if (refresh) refresh.disabled = true;
    if (content) content.innerHTML = '<div class="todayLoading">Обновляю задачи и чек-листы…</div>';

    try {
      const now = new Date();
      const today = dayStart(now);
      if (!selectedChecklistPeriod || selectedChecklistPeriod.year !== today.getFullYear()) {
        selectedChecklistPeriod = defaultChecklistPeriod(today);
      }
      const checklistPeriod = { year: selectedChecklistPeriod.year, quarter: selectedChecklistPeriod.quarter };
      const tasksResult = await db.from('tasks').select('*');
      if (tasksResult.error) throw tasksResult.error;

      const periods = taskOccurrences(tasksResult.data || [], today);
      let lists = [];
      let checklistError = false;
      try {
        lists = await loadChecklists(db, checklistPeriod.year, checklistPeriod.quarter);
      } catch (error) {
        console.warn('Не удалось загрузить квартальные чек-листы на главной:', error);
        checklistError = true;
      }

      const quarterItems = lists.reduce(function (sum, list) { return sum + list.total; }, 0);
      const quarterDone = lists.reduce(function (sum, list) { return sum + list.done; }, 0);
      const quarterValue = quarterItems ? quarterDone + '/' + quarterItems : '—';

      document.getElementById('todayDate').textContent = formatLongDate(today);
      document.getElementById('todayStats').innerHTML =
        '<div class="todayStat"><span class="todayStatLabel">На сегодня</span><strong class="todayStatValue">' + periods.dueToday.length + '</strong></div>' +
        '<div class="todayStat isLate"><span class="todayStatLabel">Просрочено</span><strong class="todayStatValue">' + periods.overdue.length + '</strong></div>' +
        '<div class="todayStat"><span class="todayStatLabel">Чек-листы · ' + QUARTER_NAMES[checklistPeriod.quarter - 1] + ' квартал</span><strong class="todayStatValue">' + quarterValue + '</strong></div>';

      document.getElementById('todayContent').innerHTML =
        '<div class="todayColumns"><div class="todayColumn">' +
        taskList('Просроченные задачи', periods.overdue, true, 'Просроченных задач нет.') +
        taskList('Задачи на сегодня', periods.dueToday, false, 'На сегодня задач нет.') +
        taskList('Ближайшие 7 дней', periods.upcoming, false, 'На ближайшую неделю задач нет.') +
        '<a class="todayTextLink" href="' + TASK_URL + '">Открыть задачник →</a>' +
        '</div><div class="todayColumn">' +
        renderChecklistSummary(lists, checklistError, checklistPeriod) +
        '</div></div>';

      bindChecklistControls();

      lastLoadedAt = Date.now();
    } catch (error) {
      console.error('Не удалось загрузить панель «На сегодня»:', error);
      document.getElementById('todayContent').innerHTML =
        '<div class="todayError">Не удалось загрузить задачи. Обновите панель или откройте <a class="todayTextLink" href="' + TASK_URL + '">Задачник</a>.</div>';
    } finally {
      loading = false;
      if (refresh) refresh.disabled = false;
    }
  }

  function bindChecklistControls() {
    const select = document.getElementById('todayQuarterSelect');
    if (!select) return;
    select.addEventListener('change', function () {
      const parts = select.value.split('-').map(Number);
      if (parts.length !== 2 || !Number.isFinite(parts[0]) ||
          !Number.isInteger(parts[1]) || parts[1] < 1 || parts[1] > 4) {
        return;
      }
      selectedChecklistPeriod = { year: parts[0], quarter: parts[1] };
      loadDashboard(true);
    });
  }

  function initialize() {
    const app = document.getElementById('appShell');
    if (!app || !panel()) return;
    ensureStyles();

    const refresh = document.getElementById('todayRefresh');
    if (refresh) refresh.addEventListener('click', function () { loadDashboard(true); });

    const observer = new MutationObserver(function () {
      if (app.classList.contains('show')) {
        loadDashboard(true);
      } else {
        lastLoadedAt = 0;
        const content = document.getElementById('todayContent');
        if (content) content.innerHTML = '<div class="todayLoading">Загружаю задачи и чек-листы…</div>';
      }
    });
    observer.observe(app, { attributes: true, attributeFilter: ['class'] });
    if (app.classList.contains('show')) loadDashboard(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();