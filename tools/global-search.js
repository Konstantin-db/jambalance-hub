(function () {
  'use strict';

  const ROOT_ID = 'globalSearch';
  const RESULTS_ID = 'globalSearchResults';
  const CLIENTS_URL = './tools/clients.html';
  const TASKS_URL = './tools/task-manager.html';
  const CONTRACTS_URL = './tools/DB_dogovornoi-centr.html';
  const CHECKLISTS_URL = './tools/quarterly-checklists.html';
  let timer = null;
  let requestNumber = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function cleanTerm(value) {
    return String(value || '')
      .replace(/[,%_()'"\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
  }

  function pattern(term) {
    return '%' + term + '%';
  }

  function orFilter(fields, term) {
    const match = pattern(term);
    return fields.map(function (field) { return field + '.ilike.' + match; }).join(',');
  }

  function dateLabel(value) {
    if (!value) return '';
    const date = new Date(String(value).slice(0, 10) + 'T00:00:00');
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function quarterLabel(year, quarter) {
    const names = ['I', 'II', 'III', 'IV'];
    return (names[Number(quarter) - 1] || quarter) + ' квартал ' + year;
  }

  async function searchClients(db, term) {
    const result = await db.from('clients')
      .select('id,client_name,short_name,inn,phone,email,service_contract_number,org_form,status')
      .or(orFilter(['client_name', 'short_name', 'inn', 'phone', 'email', 'service_contract_number'], term))
      .order('client_name', { ascending: true })
      .limit(6);
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function searchTasks(db, term) {
    const result = await db.from('tasks')
      .select('id,title,description,client_name,client_name_manual,due_date,due_time,status,task_type')
      .or(orFilter(['title', 'description', 'client_name', 'client_name_manual'], term))
      .order('due_date', { ascending: false })
      .limit(6);
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function searchDocuments(db, term) {
    const result = await db.from('client_documents')
      .select('id,client_name,client_inn,document_number,doc_type_label,doc_date,status,record_type')
      .or(orFilter(['document_number', 'client_name', 'client_inn', 'doc_type_label', 'status'], term))
      .order('doc_date', { ascending: false })
      .limit(6);
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function searchChecklists(db, term, matchedClients) {
    const itemResult = await db.from('quarterly_checklist_items')
      .select('checklist_id,title')
      .ilike('title', pattern(term))
      .limit(8);
    if (itemResult.error) throw itemResult.error;

    const clientIds = matchedClients.map(function (client) { return client.id; }).filter(Boolean);
    const checklistIds = (itemResult.data || []).map(function (item) { return item.checklist_id; }).filter(Boolean);
    const [byClient, byItem] = await Promise.all([
      clientIds.length
        ? db.from('quarterly_checklists').select('id,client_id,year,quarter,template_name').in('client_id', clientIds).order('year', { ascending: false }).order('quarter', { ascending: false }).limit(8)
        : Promise.resolve({ data: [], error: null }),
      checklistIds.length
        ? db.from('quarterly_checklists').select('id,client_id,year,quarter,template_name').in('id', checklistIds)
        : Promise.resolve({ data: [], error: null })
    ]);
    if (byClient.error) throw byClient.error;
    if (byItem.error) throw byItem.error;

    const listMap = new Map();
    (byClient.data || []).concat(byItem.data || []).forEach(function (list) {
      listMap.set(list.id, list);
    });
    if (!listMap.size) return [];

    const knownClients = new Map(matchedClients.map(function (client) {
      return [client.id, client.client_name || client.short_name || 'Клиент'];
    }));
    const missingIds = Array.from(new Set(Array.from(listMap.values())
      .map(function (list) { return list.client_id; })
      .filter(function (id) { return id && !knownClients.has(id); })));
    if (missingIds.length) {
      const clients = await db.from('clients').select('id,client_name,short_name').in('id', missingIds);
      if (clients.error) throw clients.error;
      (clients.data || []).forEach(function (client) {
        knownClients.set(client.id, client.client_name || client.short_name || 'Клиент');
      });
    }

    const itemByList = new Map();
    (itemResult.data || []).forEach(function (item) {
      if (!itemByList.has(item.checklist_id)) itemByList.set(item.checklist_id, []);
      itemByList.get(item.checklist_id).push(item.title);
    });

    return Array.from(listMap.values()).map(function (list) {
      return {
        id: list.id,
        client: knownClients.get(list.client_id) || 'Клиент',
        year: list.year,
        quarter: list.quarter,
        template: list.template_name || '',
        itemTitles: itemByList.get(list.id) || []
      };
    }).sort(function (a, b) {
      return Number(b.year) - Number(a.year) || Number(b.quarter) - Number(a.quarter) || a.client.localeCompare(b.client, 'ru');
    }).slice(0, 6);
  }

  function resultRow(type, title, detail, url, meta) {
    return '<a class="globalResult" href="' + url + '">' +
      '<span class="globalResultIcon ' + type + '">' + meta.icon + '</span>' +
      '<span class="globalResultCopy"><strong>' + escapeHtml(title) + '</strong>' +
      '<small>' + escapeHtml(detail || '') + '</small></span>' +
      '<span class="globalResultType">' + meta.label + '</span></a>';
  }

  function renderGroup(title, rows) {
    if (!rows.length) return '';
    return '<section class="globalResultGroup"><h3>' + title + '</h3>' + rows.join('') + '</section>';
  }

  function renderResults(term, data, errors) {
    const groups = [];

    groups.push(renderGroup('Клиенты', data.clients.map(function (client) {
      const name = client.client_name || client.short_name || 'Без названия';
      const detail = [client.inn ? 'ИНН ' + client.inn : '', client.service_contract_number ? 'договор ' + client.service_contract_number : '', client.status === 'active' ? '' : 'неактивен'].filter(Boolean).join(' · ');
      return resultRow('client', name, detail || client.org_form || '', CLIENTS_URL, { icon: 'КЛ', label: 'Клиент' });
    })));

    groups.push(renderGroup('Задачи', data.tasks.map(function (task) {
      const client = task.client_name_manual || task.client_name || '';
      const date = dateLabel(task.due_date);
      const detail = [client, date, task.due_time ? String(task.due_time).slice(0, 5) : '', task.status === 'done' ? 'выполнена' : 'открыта'].filter(Boolean).join(' · ');
      return resultRow('task', task.title || 'Без названия', detail || task.description || '', TASKS_URL, { icon: 'ЗД', label: 'Задача' });
    })));

    groups.push(renderGroup('Договоры и допсоглашения', data.documents.map(function (doc) {
      const number = doc.document_number ? '№ ' + doc.document_number : '';
      const detail = [doc.client_inn ? 'ИНН ' + doc.client_inn : '', dateLabel(doc.doc_date), doc.status].filter(Boolean).join(' · ');
      return resultRow('document', (doc.doc_type_label || 'Документ') + (number ? ' · ' + number : ''), [doc.client_name, detail].filter(Boolean).join(' · '), CONTRACTS_URL, { icon: 'ДО', label: 'Документ' });
    })));

    groups.push(renderGroup('Квартальные чек-листы', data.checklists.map(function (list) {
      const item = list.itemTitles.length ? 'Пункт: ' + list.itemTitles[0] : list.template;
      return resultRow('checklist', list.client + ' · ' + quarterLabel(list.year, list.quarter), item, CHECKLISTS_URL, { icon: 'ЧЛ', label: 'Чек-лист' });
    })));

    const html = groups.filter(Boolean).join('');
    const resultRoot = $(RESULTS_ID);
    if (!html) {
      resultRoot.innerHTML = '<div class="globalSearchEmpty">' +
        (errors.length ? 'Не удалось выполнить поиск в некоторых разделах. Проверьте подключение и попробуйте ещё раз.' : 'Ничего не найдено по запросу «' + escapeHtml(term) + '».') +
        '</div>';
    } else {
      resultRoot.innerHTML = html + (errors.length ? '<p class="globalSearchNotice">Некоторые разделы временно не ответили.</p>' : '');
    }
    resultRoot.hidden = false;
  }

  async function runSearch() {
    const input = $('globalSearchInput');
    const resultRoot = $(RESULTS_ID);
    const db = window.supabaseClient;
    if (!input || !resultRoot) return;

    const term = cleanTerm(input.value);
    if (term.length < 2) {
      resultRoot.innerHTML = '<div class="globalSearchEmpty">Введите не меньше двух символов.</div>';
      resultRoot.hidden = false;
      return;
    }
    if (!db || !document.getElementById('appShell')?.classList.contains('show')) return;

    const currentRequest = ++requestNumber;
    resultRoot.innerHTML = '<div class="globalSearchLoading"><span class="globalSearchSpinner"></span>Ищу в Рабочей Станции…</div>';
    resultRoot.hidden = false;

    const queries = await Promise.all([
      searchClients(db, term).then(function (data) { return { key: 'clients', data: data }; }).catch(function (error) { return { key: 'clients', error: error }; }),
      searchTasks(db, term).then(function (data) { return { key: 'tasks', data: data }; }).catch(function (error) { return { key: 'tasks', error: error }; }),
      searchDocuments(db, term).then(function (data) { return { key: 'documents', data: data }; }).catch(function (error) { return { key: 'documents', error: error }; })
    ]);
    if (currentRequest !== requestNumber) return;

    const data = { clients: [], tasks: [], documents: [], checklists: [] };
    const errors = [];
    queries.forEach(function (result) {
      if (result.error) errors.push(result.error);
      else data[result.key] = result.data;
    });

    try {
      data.checklists = await searchChecklists(db, term, data.clients);
    } catch (error) {
      errors.push(error);
      console.warn('Поиск по чек-листам не сработал:', error);
    }
    if (currentRequest !== requestNumber) return;

    renderResults(term, data, errors);
  }

  function ensureStyles() {
    if ($('globalSearchStyles')) return;
    const style = document.createElement('style');
    style.id = 'globalSearchStyles';
    style.textContent =
      '.globalSearchBox{position:relative;display:flex;align-items:center;gap:11px;margin:0 0 15px;padding:7px 14px;border:1px solid #e0e5eb;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(30,41,59,.06)}' +
      '.globalSearchIcon{color:#8a95a4;font-size:19px;line-height:1}' +
      '.globalSearchInput{width:100%;min-width:0;height:39px;border:0;outline:0;color:#172033;background:transparent;font:inherit;font-size:13px}' +
      '.globalSearchInput::placeholder{color:#8993a1}' +
      '.globalSearchShortcut{flex:0 0 auto;padding:4px 7px;border:1px solid #e2e7ee;border-radius:7px;color:#748094;background:#fafbfc;font-size:9px;font-weight:800}' +
      '.globalSearchResults{position:relative;z-index:5;margin:-6px 0 17px;overflow:hidden;border:1px solid #e2e7ee;border-radius:15px;background:#fff;box-shadow:0 14px 35px rgba(30,41,59,.11)}' +
      '.globalSearchResults[hidden]{display:none}' +
      '.globalResultGroup{padding:10px 12px;border-top:1px solid #edf0f3}.globalResultGroup:first-child{border-top:0}' +
      '.globalResultGroup h3{margin:0 0 5px;color:#748094;font-size:9px;font-weight:900;letter-spacing:.05em;text-transform:uppercase}' +
      '.globalResult{display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:10px;color:inherit;text-decoration:none}.globalResult:hover,.globalResult:focus{outline:0;background:#fff8ee}' +
      '.globalResultIcon{display:flex;width:34px;height:34px;flex:0 0 auto;align-items:center;justify-content:center;border-radius:10px;color:#a85c00;background:#fff1dd;font-size:9px;font-weight:950}' +
      '.globalResultIcon.task{color:#2d5ca7;background:#eaf2ff}.globalResultIcon.document{color:#774ba5;background:#f4edff}.globalResultIcon.checklist{color:#167769;background:#e8f7f2}' +
      '.globalResultCopy{display:flex;min-width:0;flex:1;flex-direction:column;gap:3px}.globalResultCopy strong{overflow:hidden;color:#263246;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.globalResultCopy small{overflow:hidden;color:#7b8696;font-size:10px;text-overflow:ellipsis;white-space:nowrap}' +
      '.globalResultType{flex:0 0 auto;color:#9aa3af;font-size:9px}.globalSearchEmpty,.globalSearchLoading{display:flex;align-items:center;gap:9px;padding:14px;color:#748094;font-size:11px}.globalSearchNotice{margin:0;padding:0 14px 11px;color:#8993a1;font-size:10px}' +
      '.globalSearchSpinner{width:14px;height:14px;border:2px solid #ffe0b7;border-top-color:#f99303;border-radius:50%;animation:globalSpin .75s linear infinite}@keyframes globalSpin{to{transform:rotate(360deg)}}' +
      '@media(max-width:520px){.globalSearchBox{gap:8px;padding:6px 11px}.globalSearchInput{font-size:12px}.globalSearchShortcut{font-size:8px}.globalResultType{display:none}.globalResult{gap:8px}}';
    document.head.appendChild(style);
  }

  function init() {
    const input = $('globalSearchInput');
    const results = $(RESULTS_ID);
    if (!input || !results) return;
    ensureStyles();

    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(runSearch, 260);
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        input.value = '';
        results.hidden = true;
        requestNumber += 1;
      }
      if (event.key === 'Enter' && !results.hidden) {
        const first = results.querySelector('.globalResult');
        if (first) first.click();
      }
    });

    document.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        if (!document.getElementById('appShell')?.classList.contains('show')) return;
        event.preventDefault();
        input.focus();
        input.select();
      }
      if (event.key === 'Escape' && document.activeElement !== input) {
        results.hidden = true;
      }
    });

    document.addEventListener('click', function (event) {
      if (!event.target.closest('#' + ROOT_ID) && !event.target.closest('#' + RESULTS_ID)) {
        results.hidden = true;
      }
    });

    input.addEventListener('focus', function () {
      if (input.value.trim().length >= 2 && results.innerHTML) results.hidden = false;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();