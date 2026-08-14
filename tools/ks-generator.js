'use strict';

/* ============================================================
   ДЖЕМБАЛАНС — ГЕНЕРАТОР КС-2 / КС-3

   Структура файлов:

   tools/
     ks-generator.html
     ks-generator.js
     jszip.min.js
     xlsx.full.min.js

     templates/
       KS-2.xlsx
       KS-3.xlsx

   ВАЖНО:
   Excel экспортируется НЕ пересозданием книги.
   Исходный XLSX патчится через JSZip, поэтому оформление
   оригинального шаблона сохраняется максимально полно.
   ============================================================ */


/* ============================================================
   КОНСТАНТЫ
   ============================================================ */

const STORAGE_KEY = 'jembalance_db_v1';

const TEMPLATE_PATHS = {
  ks2: './templates/KS-2.xlsx',
  ks3: './templates/KS-3.xlsx'
};


/* ============================================================
   СОСТОЯНИЕ
   ============================================================ */

let DB = {
  contractors: [],
  customers: [],
  archive: []
};

let currentDoc = {
  id: null,
  type: 'ks2',
  rows: [],
  linkedKs2Ids: []
};


/* ============================================================
   ОБЩИЕ УТИЛИТЫ
   ============================================================ */

function uid() {
  return (
    'id_' +
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 9)
  );
}


function byId(id) {
  return document.getElementById(id);
}


function safeValue(id) {
  const el = byId(id);
  return el ? el.value : '';
}


function num(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value)
    .replace(/\s/g, '')
    .replace(',', '.');

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}


function round2(value) {
  return Math.round((num(value) + Number.EPSILON) * 100) / 100;
}


function fmtMoney(value) {
  return num(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' ₽';
}


function fmtMoneyPlain(value) {
  return num(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}


function fmtNumber(value) {
  return num(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4
  });
}


function fmtDate(iso) {
  if (!iso) {
    return '—';
  }

  const parts = String(iso).split('-');

  if (parts.length !== 3) {
    return String(iso);
  }

  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}


function parseISODate(iso) {
  if (!iso) {
    return null;
  }

  const parts = String(iso).split('-');

  if (parts.length !== 3) {
    return null;
  }

  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);

  if (!y || !m || !d) {
    return null;
  }

  return new Date(Date.UTC(y, m - 1, d));
}


function excelSerialFromISO(iso) {
  const date = parseISODate(iso);

  if (!date) {
    return null;
  }

  const excelEpoch = Date.UTC(1899, 11, 30);

  return Math.floor(
    (date.getTime() - excelEpoch) / 86400000
  );
}


function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


function escapeXml(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}


function normalizeText(value) {
  return String(value || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е');
}


function downloadBlob(content, filename, mime) {
  const blob =
    content instanceof Blob
      ? content
      : new Blob([content], {
          type: mime || 'application/octet-stream'
        });

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}


/* ============================================================
   ХРАНИЛИЩЕ
   ============================================================ */

function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);

    DB.contractors = Array.isArray(parsed.contractors)
      ? parsed.contractors
      : [];

    DB.customers = Array.isArray(parsed.customers)
      ? parsed.customers
      : [];

    DB.archive = Array.isArray(parsed.archive)
      ? parsed.archive
      : [];

  } catch (error) {
    console.warn('Ошибка загрузки базы:', error);
  }
}


function saveDB() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(DB)
    );
  } catch (error) {
    console.error(error);
    toast(
      'Не удалось сохранить данные в браузере.',
      'err'
    );
  }
}


/* ============================================================
   ТОСТЫ
   ============================================================ */

function toast(text, kind) {
  const stack = byId('toast-stack');

  if (!stack) {
    return;
  }

  const item = document.createElement('div');

  item.className = 'toast ' + (kind || '');
  item.textContent = text;

  stack.appendChild(item);

  setTimeout(() => {
    item.style.transition =
      'opacity .25s ease, transform .25s ease';

    item.style.opacity = '0';
    item.style.transform = 'translateX(16px)';

    setTimeout(() => {
      item.remove();
    }, 280);

  }, 3200);
}


/* ============================================================
   МОДАЛЬНЫЕ ОКНА
   ============================================================ */

function openModal(id) {
  const el = byId(id);

  if (el) {
    el.classList.add('active');
  }
}


function closeModal(id) {
  const el = byId(id);

  if (el) {
    el.classList.remove('active');
  }
}


function confirmDialog(title, text, onOk) {
  byId('confirm-title').textContent = title;
  byId('confirm-text').textContent = text;

  const oldButton = byId('confirm-ok-btn');
  const newButton = oldButton.cloneNode(true);

  oldButton.parentNode.replaceChild(
    newButton,
    oldButton
  );

  newButton.addEventListener('click', () => {
    closeModal('modal-confirm');
    onOk();
  });

  openModal('modal-confirm');
}


/* ============================================================
   НАВИГАЦИЯ
   ============================================================ */

function switchTab(name) {
  document
    .querySelectorAll('.tab')
    .forEach(el => el.classList.remove('active'));

  document
    .querySelectorAll('.view')
    .forEach(el => el.classList.remove('active'));

  const tab = byId('tab-' + name);
  const view = byId('view-' + name);

  if (tab) {
    tab.classList.add('active');
  }

  if (view) {
    view.classList.add('active');
  }

  if (name === 'contractors') {
    renderContractors();
  }

  if (name === 'customers') {
    renderCustomers();
  }

  if (name === 'archive') {
    renderArchive();
  }
}


/* ============================================================
   ТИП ДОКУМЕНТА
   ============================================================ */

function setDocType(type) {
  if (type !== 'ks2' && type !== 'ks3') {
    return;
  }

  currentDoc.type = type;

  byId('dtype-ks2').classList.toggle(
    'active',
    type === 'ks2'
  );

  byId('dtype-ks3').classList.toggle(
    'active',
    type === 'ks3'
  );

  byId('section-works').classList.toggle(
    'hidden',
    type !== 'ks2'
  );

  byId('section-ks2-link').classList.toggle(
    'hidden',
    type !== 'ks3'
  );

  if (type === 'ks3') {
    renderKs2PickList();
  }

  renderTotals();
  renderPreview();
}


/* ============================================================
   ПОДРЯДЧИКИ
   ============================================================ */

function openContractorModal(id) {
  const fields = [
    'name',
    'inn',
    'kpp',
    'ogrn',
    'okpo',
    'addr',
    'boss-pos',
    'boss-name',
    'phone',
    'email',
    'rs',
    'bank',
    'bik',
    'ks'
  ];

  fields.forEach(field => {
    const el = byId('mc-' + field);

    if (el) {
      el.value = '';
    }
  });

  byId('mc-id').value = '';
  byId('modal-contractor-title').textContent =
    'Новый подрядчик';

  if (id) {
    const c = DB.contractors.find(
      item => item.id === id
    );

    if (c) {
      byId('mc-id').value = c.id;
      byId('mc-name').value = c.name || '';
      byId('mc-inn').value = c.inn || '';
      byId('mc-kpp').value = c.kpp || '';
      byId('mc-ogrn').value = c.ogrn || '';
      byId('mc-okpo').value = c.okpo || '';
      byId('mc-addr').value = c.addr || '';
      byId('mc-boss-pos').value =
        c.bossPos || '';
      byId('mc-boss-name').value =
        c.bossName || '';
      byId('mc-phone').value =
        c.phone || '';
      byId('mc-email').value =
        c.email || '';
      byId('mc-rs').value = c.rs || '';
      byId('mc-bank').value = c.bank || '';
      byId('mc-bik').value = c.bik || '';
      byId('mc-ks').value = c.ks || '';

      byId(
        'modal-contractor-title'
      ).textContent =
        'Редактирование: ' + c.name;
    }
  }

  openModal('modal-contractor');
}


function saveContractor() {
  const name = safeValue('mc-name').trim();
  const inn = safeValue('mc-inn').trim();

  if (!name) {
    toast('Укажите наименование подрядчика.', 'err');
    return;
  }

  if (!inn) {
    toast('Укажите ИНН подрядчика.', 'err');
    return;
  }

  const existingId = safeValue('mc-id');

  const data = {
    id: existingId || uid(),

    name,
    inn,

    kpp: safeValue('mc-kpp').trim(),
    ogrn: safeValue('mc-ogrn').trim(),
    okpo: safeValue('mc-okpo').trim(),
    addr: safeValue('mc-addr').trim(),

    bossPos:
      safeValue('mc-boss-pos').trim(),

    bossName:
      safeValue('mc-boss-name').trim(),

    phone:
      safeValue('mc-phone').trim(),

    email:
      safeValue('mc-email').trim(),

    rs:
      safeValue('mc-rs').trim(),

    bank:
      safeValue('mc-bank').trim(),

    bik:
      safeValue('mc-bik').trim(),

    ks:
      safeValue('mc-ks').trim()
  };

  if (existingId) {
    const index = DB.contractors.findIndex(
      item => item.id === existingId
    );

    if (index >= 0) {
      DB.contractors[index] = data;
    }
  } else {
    DB.contractors.push(data);
  }

  saveDB();

  closeModal('modal-contractor');

  renderContractors();
  refreshContractorSelect();
  renderPreview();

  toast('Подрядчик сохранён.', 'ok');
}


function deleteContractor(id) {
  const contractor = DB.contractors.find(
    item => item.id === id
  );

  if (!contractor) {
    return;
  }

  confirmDialog(
    'Удалить подрядчика?',
    `Подрядчик «${contractor.name}» будет удалён. Документы архива останутся без изменений.`,
    () => {
      DB.contractors =
        DB.contractors.filter(
          item => item.id !== id
        );

      saveDB();
      renderContractors();
      refreshContractorSelect();
      renderPreview();

      toast('Подрядчик удалён.', 'ok');
    }
  );
}


function renderContractors() {
  const input = byId('search-contractors');

  const query = normalizeText(
    input ? input.value : ''
  );

  const list = DB.contractors.filter(c => {
    if (!query) {
      return true;
    }

    return normalizeText([
      c.name,
      c.inn,
      c.kpp,
      c.bossName,
      c.phone,
      c.email
    ].join(' ')).includes(query);
  });

  const badge = byId('badge-contractors');

  if (badge) {
    badge.textContent =
      String(DB.contractors.length);
  }

  const tbody = byId('contractors-tbody');

  if (!tbody) {
    return;
  }

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            <div class="empty-state-title">
              ${
                query
                  ? 'Ничего не найдено'
                  : 'Список подрядчиков пуст'
              }
            </div>

            <div class="empty-state-text">
              ${
                query
                  ? 'Попробуйте изменить поисковый запрос.'
                  : 'Добавьте первого подрядчика.'
              }
            </div>

            ${
              query
                ? ''
                : `
                  <button
                    class="btn btn-primary btn-sm"
                    onclick="openContractorModal()"
                  >
                    Добавить подрядчика
                  </button>
                `
            }
          </div>
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr>

      <td class="cell-name">
        ${escapeHtml(c.name)}

        <div class="cell-muted">
          ${escapeHtml(c.addr || '')}
        </div>
      </td>

      <td>
        ${escapeHtml(c.inn)}
        ${
          c.kpp
            ? ' / ' + escapeHtml(c.kpp)
            : ''
        }
      </td>

      <td>
        ${escapeHtml(c.bossName || '—')}

        <div class="cell-muted">
          ${escapeHtml(c.bossPos || '')}
        </div>
      </td>

      <td>
        ${escapeHtml(c.phone || '—')}

        <div class="cell-muted">
          ${escapeHtml(c.email || '')}
        </div>
      </td>

      <td class="cell-actions">

        <button
          class="btn btn-ghost btn-sm"
          onclick="openContractorModal('${c.id}')"
          title="Редактировать"
        >
          <svg class="icon" viewBox="0 0 16 16">
            <path d="M11 2l3 3-8 8H3v-3l8-8z"/>
          </svg>
        </button>

        <button
          class="btn btn-ghost btn-sm"
          onclick="deleteContractor('${c.id}')"
          title="Удалить"
        >
          <svg class="icon" viewBox="0 0 16 16">
            <path d="M2 4h12"/>
            <path d="M5 4V2h6v2"/>
            <path d="M6 7v5M10 7v5"/>
            <path d="M3 4l1 10h8l1-10"/>
          </svg>
        </button>

      </td>

    </tr>
  `).join('');
}


function refreshContractorSelect() {
  const select = byId('f-contractor');

  if (!select) {
    return;
  }

  const previous = select.value;

  select.innerHTML =
    '<option value="">— выберите из базы —</option>' +
    DB.contractors
      .map(c => `
        <option value="${escapeHtml(c.id)}">
          ${escapeHtml(c.name)}
          (ИНН ${escapeHtml(c.inn)})
        </option>
      `)
      .join('');

  select.value = previous;
}


/* ============================================================
   ЗАКАЗЧИКИ
   ============================================================ */

function openCustomerModal(id) {
  const fields = [
    'name',
    'inn',
    'kpp',
    'ogrn',
    'okpo',
    'addr',
    'boss-pos',
    'boss-name',
    'phone',
    'email'
  ];

  fields.forEach(field => {
    const el = byId('mcu-' + field);

    if (el) {
      el.value = '';
    }
  });

  byId('mcu-id').value = '';
  byId('modal-customer-title').textContent =
    'Новый заказчик';

  if (id) {
    const c = DB.customers.find(
      item => item.id === id
    );

    if (c) {
      byId('mcu-id').value = c.id;
      byId('mcu-name').value = c.name || '';
      byId('mcu-inn').value = c.inn || '';
      byId('mcu-kpp').value = c.kpp || '';
      byId('mcu-ogrn').value = c.ogrn || '';
      byId('mcu-okpo').value = c.okpo || '';
      byId('mcu-addr').value = c.addr || '';

      byId('mcu-boss-pos').value =
        c.bossPos || '';

      byId('mcu-boss-name').value =
        c.bossName || '';

      byId('mcu-phone').value =
        c.phone || '';

      byId('mcu-email').value =
        c.email || '';

      byId(
        'modal-customer-title'
      ).textContent =
        'Редактирование: ' + c.name;
    }
  }

  openModal('modal-customer');
}


function saveCustomer() {
  const name =
    safeValue('mcu-name').trim();

  const inn =
    safeValue('mcu-inn').trim();

  if (!name) {
    toast('Укажите наименование заказчика.', 'err');
    return;
  }

  if (!inn) {
    toast('Укажите ИНН заказчика.', 'err');
    return;
  }

  const existingId =
    safeValue('mcu-id');

  const data = {
    id: existingId || uid(),

    name,
    inn,

    kpp:
      safeValue('mcu-kpp').trim(),

    ogrn:
      safeValue('mcu-ogrn').trim(),

    okpo:
      safeValue('mcu-okpo').trim(),

    addr:
      safeValue('mcu-addr').trim(),

    bossPos:
      safeValue('mcu-boss-pos').trim(),

    bossName:
      safeValue('mcu-boss-name').trim(),

    phone:
      safeValue('mcu-phone').trim(),

    email:
      safeValue('mcu-email').trim()
  };

  if (existingId) {
    const index =
      DB.customers.findIndex(
        item => item.id === existingId
      );

    if (index >= 0) {
      DB.customers[index] = data;
    }
  } else {
    DB.customers.push(data);
  }

  saveDB();

  closeModal('modal-customer');

  renderCustomers();
  refreshCustomerSelect();
  renderPreview();

  toast('Заказчик сохранён.', 'ok');
}


function deleteCustomer(id) {
  const customer =
    DB.customers.find(
      item => item.id === id
    );

  if (!customer) {
    return;
  }

  confirmDialog(
    'Удалить заказчика?',
    `Заказчик «${customer.name}» будет удалён. Документы архива останутся без изменений.`,
    () => {
      DB.customers =
        DB.customers.filter(
          item => item.id !== id
        );

      saveDB();
      renderCustomers();
      refreshCustomerSelect();
      renderPreview();

      toast('Заказчик удалён.', 'ok');
    }
  );
}


function renderCustomers() {
  const input = byId('search-customers');

  const query = normalizeText(
    input ? input.value : ''
  );

  const list = DB.customers.filter(c => {
    if (!query) {
      return true;
    }

    return normalizeText([
      c.name,
      c.inn,
      c.kpp,
      c.bossName,
      c.phone,
      c.email
    ].join(' ')).includes(query);
  });

  const badge = byId('badge-customers');

  if (badge) {
    badge.textContent =
      String(DB.customers.length);
  }

  const tbody = byId('customers-tbody');

  if (!tbody) {
    return;
  }

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">

            <div class="empty-state-title">
              ${
                query
                  ? 'Ничего не найдено'
                  : 'Список заказчиков пуст'
              }
            </div>

            <div class="empty-state-text">
              ${
                query
                  ? 'Попробуйте изменить поисковый запрос.'
                  : 'Добавьте первого заказчика.'
              }
            </div>

            ${
              query
                ? ''
                : `
                  <button
                    class="btn btn-primary btn-sm"
                    onclick="openCustomerModal()"
                  >
                    Добавить заказчика
                  </button>
                `
            }

          </div>
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr>

      <td class="cell-name">
        ${escapeHtml(c.name)}

        <div class="cell-muted">
          ${escapeHtml(c.addr || '')}
        </div>
      </td>

      <td>
        ${escapeHtml(c.inn)}
        ${
          c.kpp
            ? ' / ' + escapeHtml(c.kpp)
            : ''
        }
      </td>

      <td>
        ${escapeHtml(c.bossName || '—')}

        <div class="cell-muted">
          ${escapeHtml(c.bossPos || '')}
        </div>
      </td>

      <td>
        ${escapeHtml(c.phone || '—')}

        <div class="cell-muted">
          ${escapeHtml(c.email || '')}
        </div>
      </td>

      <td class="cell-actions">

        <button
          class="btn btn-ghost btn-sm"
          onclick="openCustomerModal('${c.id}')"
          title="Редактировать"
        >
          <svg class="icon" viewBox="0 0 16 16">
            <path d="M11 2l3 3-8 8H3v-3l8-8z"/>
          </svg>
        </button>

        <button
          class="btn btn-ghost btn-sm"
          onclick="deleteCustomer('${c.id}')"
          title="Удалить"
        >
          <svg class="icon" viewBox="0 0 16 16">
            <path d="M2 4h12"/>
            <path d="M5 4V2h6v2"/>
            <path d="M6 7v5M10 7v5"/>
            <path d="M3 4l1 10h8l1-10"/>
          </svg>
        </button>

      </td>

    </tr>
  `).join('');
}


function refreshCustomerSelect() {
  const select = byId('f-customer');

  if (!select) {
    return;
  }

  const previous = select.value;

  select.innerHTML =
    '<option value="">— выберите из базы —</option>' +
    DB.customers
      .map(c => `
        <option value="${escapeHtml(c.id)}">
          ${escapeHtml(c.name)}
          (ИНН ${escapeHtml(c.inn)})
        </option>
      `)
      .join('');

  select.value = previous;
}


function onContractorSelect() {
  renderPreview();
}


function onCustomerSelect() {
  renderPreview();
}


/* ============================================================
   СТРОКИ РАБОТ
   ============================================================ */

function addWorkRow(data) {
  const source = data || {
    estimatePos: '',
    name: '',
    unitRateNumber: '',
    unit: '',
    qty: '',
    price: ''
  };

  currentDoc.rows.push({
    uid: uid(),

    estimatePos:
      source.estimatePos || '',

    name:
      source.name || '',

    unitRateNumber:
      source.unitRateNumber || '',

    unit:
      source.unit || '',

    qty:
      source.qty ?? '',

    price:
      source.price ?? ''
  });

  renderWorkRows();
  renderTotals();
  renderPreview();
}


function deleteWorkRow(rowUid) {
  currentDoc.rows =
    currentDoc.rows.filter(
      row => row.uid !== rowUid
    );

  renderWorkRows();
  renderTotals();
  renderPreview();
}


function updateWorkRow(
  rowUid,
  field,
  value
) {
  const row = currentDoc.rows.find(
    item => item.uid === rowUid
  );

  if (!row) {
    return;
  }

  row[field] = value;

  renderTotals();
  renderPreview();
}


function renderWorkRows() {
  const tbody = byId('works-tbody');

  if (!tbody) {
    return;
  }

  if (!currentDoc.rows.length) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="7"
          style="
            text-align:center;
            padding:18px;
            color:var(--ink-mute);
            font-size:12px;
            font-style:italic;
          "
        >
          Нет строк. Нажмите «Добавить строку».
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    currentDoc.rows
      .map((row, index) => {
        const quantity = num(row.qty);
        const price = num(row.price);

        const sum =
          round2(quantity * price);

        return `
          <tr>

            <td class="col-num">
              ${index + 1}
            </td>

            <td>
              <input
                class="input"
                type="text"
                value="${escapeHtml(row.name)}"
                placeholder="Наименование работ"
                oninput="
                  updateWorkRow(
                    '${row.uid}',
                    'name',
                    this.value
                  )
                "
              >
            </td>

            <td>
              <input
                class="input"
                type="text"
                value="${escapeHtml(row.unit)}"
                placeholder="м²"
                oninput="
                  updateWorkRow(
                    '${row.uid}',
                    'unit',
                    this.value
                  )
                "
              >
            </td>

            <td>
              <input
                class="input"
                type="number"
                step="0.0001"
                value="${escapeHtml(row.qty)}"
                placeholder="0"
                oninput="
                  updateWorkRow(
                    '${row.uid}',
                    'qty',
                    this.value
                  )
                "
              >
            </td>

            <td>
              <input
                class="input"
                type="number"
                step="0.01"
                value="${escapeHtml(row.price)}"
                placeholder="0,00"
                oninput="
                  updateWorkRow(
                    '${row.uid}',
                    'price',
                    this.value
                  )
                "
              >
            </td>

            <td
              style="
                text-align:right;
                padding-top:12px;
                font-family:var(--mono);
                font-size:12px;
              "
            >
              ${fmtMoneyPlain(sum)}
            </td>

            <td class="col-del">

              <button
                class="row-del-btn"
                onclick="
                  deleteWorkRow('${row.uid}')
                "
                title="Удалить строку"
              >
                <svg class="icon" viewBox="0 0 16 16">
                  <path d="M2 4h12"/>
                  <path d="M5 4V2h6v2"/>
                  <path d="M6 7v5M10 7v5"/>
                  <path d="M3 4l1 10h8l1-10"/>
                </svg>
              </button>

            </td>

          </tr>
        `;
      })
      .join('');
}


/* ============================================================
   НДС И ИТОГИ
   ============================================================ */

function onVatRateChange() {
  const value =
    safeValue('f-vat-rate');

  byId('vat-custom-field')
    .classList
    .toggle(
      'hidden',
      value !== 'custom'
    );

  renderTotals();
  renderPreview();
}


function getVatRate() {
  const value =
    safeValue('f-vat-rate');

  if (value === 'none') {
    return null;
  }

  if (value === 'custom') {
    return num(
      safeValue('f-vat-custom')
    );
  }

  return num(value);
}


function calcDocBase() {
  if (currentDoc.type === 'ks2') {
    return round2(
      currentDoc.rows.reduce(
        (total, row) => {
          return (
            total +
            num(row.qty) *
            num(row.price)
          );
        },
        0
      )
    );
  }

  return round2(
    currentDoc.linkedKs2Ids.reduce(
      (total, id) => {
        const doc = DB.archive.find(
          item => item.id === id
        );

        return (
          total +
          (
            doc &&
            doc.totals
              ? num(doc.totals.base)
              : 0
          )
        );
      },
      0
    )
  );
}


function calcTotals() {
  const base = calcDocBase();
  const vatRate = getVatRate();

  const vat =
    vatRate === null
      ? 0
      : round2(
          base * vatRate / 100
        );

  return {
    base,
    vatRate,
    vat,
    gross: round2(base + vat)
  };
}


function renderTotals() {
  const totals = calcTotals();

  const base = byId('total-base');
  const vat = byId('total-vat');
  const gross = byId('total-gross');

  if (base) {
    base.textContent =
      fmtMoney(totals.base);
  }

  if (vat) {
    vat.textContent =
      totals.vatRate === null
        ? 'без НДС'
        : `${fmtMoney(totals.vat)} (${totals.vatRate} %)`;
  }

  if (gross) {
    gross.textContent =
      fmtMoney(totals.gross);
  }
}


/* ============================================================
   СВЯЗКА КС-2 → КС-3
   ============================================================ */

function renderKs2PickList() {
  const box = byId('ks2-pick-list');

  if (!box) {
    return;
  }

  const list =
    DB.archive.filter(
      doc => doc.type === 'ks2'
    );

  if (!list.length) {
    box.innerHTML = `
      <div class="ks2-pick-empty">
        Нет сохранённых актов КС-2.
        Сначала создайте и сохраните КС-2.
      </div>
    `;

    return;
  }

  box.innerHTML = list.map(doc => {
    const checked =
      currentDoc
        .linkedKs2Ids
        .includes(doc.id);

    return `
      <label
        class="
          ks2-pick-item
          ${checked ? 'checked' : ''}
        "
      >

        <input
          type="checkbox"
          ${checked ? 'checked' : ''}
          onchange="
            toggleKs2Link(
              '${doc.id}',
              this.checked
            )
          "
        >

        <div class="ks2-pick-info">

          <div class="ks2-pick-title">
            КС-2 №
            ${escapeHtml(doc.num)}
            от
            ${fmtDate(doc.date)}
          </div>

          <div class="ks2-pick-meta">
            ${
              escapeHtml(
                doc.objectName || '—'
              )
            }
          </div>

        </div>

        <div class="ks2-pick-sum">
          ${
            fmtMoneyPlain(
              doc.totals?.gross || 0
            )
          }
        </div>

      </label>
    `;
  }).join('');
}


function toggleKs2Link(id, enabled) {
  if (enabled) {
    if (
      !currentDoc
        .linkedKs2Ids
        .includes(id)
    ) {
      currentDoc.linkedKs2Ids.push(id);
    }
  } else {
    currentDoc.linkedKs2Ids =
      currentDoc
        .linkedKs2Ids
        .filter(item => item !== id);
  }

  renderKs2PickList();
  renderTotals();
  renderPreview();
}


/* ============================================================
   СНИМОК ФОРМЫ
   ============================================================ */

function getFormSnapshot() {
  const contractor =
    DB.contractors.find(
      c =>
        c.id ===
        safeValue('f-contractor')
    ) || null;

  const customer =
    DB.customers.find(
      c =>
        c.id ===
        safeValue('f-customer')
    ) || null;

  return {
    type: currentDoc.type,

    num:
      safeValue('f-docnum').trim(),

    date:
      safeValue('f-docdate'),

    period:
      safeValue('f-period').trim(),

    dateFrom:
      safeValue('f-date-from'),

    dateTo:
      safeValue('f-date-to'),

    contractor,
    customer,

    investor:
      safeValue('f-investor').trim(),

    contractNum:
      safeValue(
        'f-contract-num'
      ).trim(),

    contractDate:
      safeValue('f-contract-date'),

    objectName:
      safeValue('f-object').trim(),

    objectAddr:
      safeValue(
        'f-object-addr'
      ).trim(),

    rows:
      currentDoc.rows.map(
        row => ({ ...row })
      ),

    linkedKs2Ids:
      currentDoc
        .linkedKs2Ids
        .slice(),

    totals:
      calcTotals()
  };
}


/* ============================================================
   ПРЕВЬЮ
   ============================================================ */

function renderPreview() {
  const box = byId('preview-paper');

  if (!box) {
    return;
  }

  const data = getFormSnapshot();

  box.innerHTML =
    data.type === 'ks2'
      ? buildKs2Preview(data)
      : buildKs3Preview(data);
}


function buildPartyBlock(label, party) {
  if (!party) {
    return `
      <div>
        <div class="paper-label">
          ${escapeHtml(label)}
        </div>

        <div class="paper-value muted">
          — не выбрано —
        </div>
      </div>
    `;
  }

  return `
    <div>

      <div class="paper-label">
        ${escapeHtml(label)}
      </div>

      <div class="paper-value">
        <strong>
          ${escapeHtml(party.name)}
        </strong>
      </div>

      <div class="paper-value">
        ИНН ${escapeHtml(party.inn)}
        ${
          party.kpp
            ? ', КПП ' +
              escapeHtml(party.kpp)
            : ''
        }
      </div>

      ${
        party.addr
          ? `
            <div class="paper-value">
              ${escapeHtml(party.addr)}
            </div>
          `
          : ''
      }

      ${
        party.phone || party.email
          ? `
            <div class="paper-value muted">
              ${
                escapeHtml(
                  [
                    party.phone,
                    party.email
                  ]
                    .filter(Boolean)
                    .join(' • ')
                )
              }
            </div>
          `
          : ''
      }

    </div>
  `;
}


function buildKs2Preview(data) {
  const rows =
    data.rows.map((row, index) => {
      const quantity = num(row.qty);
      const price = num(row.price);

      return `
        <tr>
          <td>${index + 1}</td>

          <td>
            ${escapeHtml(row.name || '—')}
          </td>

          <td>
            ${escapeHtml(row.unit || '—')}
          </td>

          <td style="text-align:right;">
            ${fmtNumber(quantity)}
          </td>

          <td style="text-align:right;">
            ${fmtMoneyPlain(price)}
          </td>

          <td style="text-align:right;">
            <strong>
              ${
                fmtMoneyPlain(
                  quantity * price
                )
              }
            </strong>
          </td>
        </tr>
      `;
    }).join('');

  const vatLine =
    data.totals.vatRate === null
      ? `
        <tr>
          <td
            colspan="5"
            style="text-align:right;"
          >
            НДС:
          </td>

          <td style="text-align:right;">
            без НДС
          </td>
        </tr>
      `
      : `
        <tr>
          <td
            colspan="5"
            style="text-align:right;"
          >
            НДС
            (${data.totals.vatRate} %):
          </td>

          <td style="text-align:right;">
            ${
              fmtMoneyPlain(
                data.totals.vat
              )
            }
          </td>
        </tr>
      `;

  return `
    <div class="paper">

      <div class="paper-stamp">
        Унифицированная форма № КС-2
      </div>

      <h1 class="paper-title">
        Акт о приёмке выполненных работ
      </h1>

      <div class="paper-subtitle">
        № ${escapeHtml(data.num || '___')}
        от ${fmtDate(data.date)}

        ${
          data.period
            ? ' • Отчётный период: ' +
              escapeHtml(data.period)
            : ''
        }
      </div>

      <div
        class="paper-grid cols-2"
        style="margin-top:14px;"
      >
        ${
          buildPartyBlock(
            'Подрядчик (исполнитель)',
            data.contractor
          )
        }

        ${
          buildPartyBlock(
            'Заказчик',
            data.customer
          )
        }
      </div>

      ${
        data.investor
          ? `
            <div style="margin-top:10px;">
              <div class="paper-label">
                Инвестор
              </div>

              <div class="paper-value">
                ${escapeHtml(data.investor)}
              </div>
            </div>
          `
          : ''
      }

      <div
        class="paper-grid cols-3"
        style="margin-top:12px;"
      >

        <div>
          <div class="paper-label">
            Договор подряда
          </div>

          <div class="paper-value">
            ${
              data.contractNum
                ? '№ ' +
                  escapeHtml(
                    data.contractNum
                  )
                : '—'
            }

            ${
              data.contractDate
                ? ' от ' +
                  fmtDate(
                    data.contractDate
                  )
                : ''
            }
          </div>
        </div>

        <div>
          <div class="paper-label">
            Дата начала работ
          </div>

          <div class="paper-value">
            ${fmtDate(data.dateFrom)}
          </div>
        </div>

        <div>
          <div class="paper-label">
            Дата окончания работ
          </div>

          <div class="paper-value">
            ${fmtDate(data.dateTo)}
          </div>
        </div>

      </div>

      <div style="margin-top:10px;">

        <div class="paper-label">
          Объект
        </div>

        <div class="paper-value">
          <strong>
            ${
              escapeHtml(
                data.objectName || '—'
              )
            }
          </strong>
        </div>

        ${
          data.objectAddr
            ? `
              <div class="paper-value muted">
                ${
                  escapeHtml(
                    data.objectAddr
                  )
                }
              </div>
            `
            : ''
        }

      </div>

      <table
        class="paper-table"
        style="margin-top:14px;"
      >

        <thead>
          <tr>
            <th style="width:30px;">
              №
            </th>

            <th>
              Наименование работ
            </th>

            <th style="width:50px;">
              Ед.
            </th>

            <th
              style="
                width:70px;
                text-align:right;
              "
            >
              Кол-во
            </th>

            <th
              style="
                width:90px;
                text-align:right;
              "
            >
              Цена, ₽
            </th>

            <th
              style="
                width:100px;
                text-align:right;
              "
            >
              Сумма, ₽
            </th>
          </tr>
        </thead>

        <tbody>
          ${
            rows ||
            `
              <tr>
                <td
                  colspan="6"
                  style="
                    text-align:center;
                    color:#999;
                    font-style:italic;
                    padding:14px;
                  "
                >
                  — нет строк —
                </td>
              </tr>
            `
          }
        </tbody>

        <tfoot>

          <tr>
            <td
              colspan="5"
              style="text-align:right;"
            >
              Итого без НДС:
            </td>

            <td style="text-align:right;">
              ${
                fmtMoneyPlain(
                  data.totals.base
                )
              }
            </td>
          </tr>

          ${vatLine}

          <tr
            style="
              font-weight:700;
              background:#f5f5f5;
            "
          >
            <td
              colspan="5"
              style="text-align:right;"
            >
              ВСЕГО:
            </td>

            <td style="text-align:right;">
              ${
                fmtMoneyPlain(
                  data.totals.gross
                )
              } ₽
            </td>
          </tr>

        </tfoot>

      </table>

      <div class="paper-signs">

        <div class="paper-sign">

          <div class="paper-label">
            Сдал (подрядчик)
          </div>

          <div class="paper-sign-line"></div>

          <div class="paper-value">
            ${
              escapeHtml(
                data.contractor?.bossPos ||
                'Руководитель'
              )
            }
            /
            ${
              escapeHtml(
                data.contractor?.bossName ||
                '________________'
              )
            }
          </div>

        </div>

        <div class="paper-sign">

          <div class="paper-label">
            Принял (заказчик)
          </div>

          <div class="paper-sign-line"></div>

          <div class="paper-value">
            ${
              escapeHtml(
                data.customer?.bossPos ||
                'Руководитель'
              )
            }
            /
            ${
              escapeHtml(
                data.customer?.bossName ||
                '________________'
              )
            }
          </div>

        </div>

      </div>

    </div>
  `;
}


function buildKs3Preview(data) {
  const linked =
    data.linkedKs2Ids
      .map(id =>
        DB.archive.find(
          doc => doc.id === id
        )
      )
      .filter(Boolean);

  const rows =
    linked.length
      ? linked.map(
          (doc, index) => `
            <tr>

              <td>
                ${index + 1}
              </td>

              <td>
                КС-2 №
                ${escapeHtml(doc.num)}
                от
                ${fmtDate(doc.date)}
              </td>

              <td>
                ${
                  escapeHtml(
                    doc.objectName || '—'
                  )
                }
              </td>

              <td style="text-align:right;">
                ${
                  fmtMoneyPlain(
                    doc.totals?.base || 0
                  )
                }
              </td>

              <td style="text-align:right;">
                ${
                  doc.totals?.vatRate === null
                    ? 'без НДС'
                    : fmtMoneyPlain(
                        doc.totals?.vat || 0
                      )
                }
              </td>

              <td style="text-align:right;">
                <strong>
                  ${
                    fmtMoneyPlain(
                      doc.totals?.gross || 0
                    )
                  }
                </strong>
              </td>

            </tr>
          `
        ).join('')
      : `
        <tr>
          <td
            colspan="6"
            style="
              text-align:center;
              color:#999;
              font-style:italic;
              padding:14px;
            "
          >
            — не выбрано ни одного акта КС-2 —
          </td>
        </tr>
      `;

  return `
    <div class="paper">

      <div class="paper-stamp">
        Унифицированная форма № КС-3
      </div>

      <h1 class="paper-title">
        Справка о стоимости
        выполненных работ и затрат
      </h1>

      <div class="paper-subtitle">
        № ${escapeHtml(data.num || '___')}
        от ${fmtDate(data.date)}
      </div>

      <div
        class="paper-grid cols-2"
        style="margin-top:14px;"
      >

        ${
          buildPartyBlock(
            'Подрядчик (исполнитель)',
            data.contractor
          )
        }

        ${
          buildPartyBlock(
            'Заказчик',
            data.customer
          )
        }

      </div>

      <div style="margin-top:12px;">

        <div class="paper-label">
          Объект
        </div>

        <div class="paper-value">
          ${
            escapeHtml(
              data.objectName || '—'
            )
          }
        </div>

      </div>

      <table
        class="paper-table"
        style="margin-top:14px;"
      >

        <thead>
          <tr>
            <th>№</th>
            <th>Акт КС-2</th>
            <th>Объект</th>
            <th>Без НДС</th>
            <th>НДС</th>
            <th>С НДС</th>
          </tr>
        </thead>

        <tbody>
          ${rows}
        </tbody>

      </table>

    </div>
  `;
}


/* ============================================================
   СОХРАНЕНИЕ ДОКУМЕНТА
   ============================================================ */

function validateDocument(data) {
  if (!data.num) {
    return 'Укажите номер документа.';
  }

  if (!data.date) {
    return 'Укажите дату документа.';
  }

  if (!data.contractor) {
    return 'Выберите подрядчика.';
  }

  if (!data.customer) {
    return 'Выберите заказчика.';
  }

  if (!data.objectName) {
    return 'Укажите наименование объекта.';
  }

  if (
    data.type === 'ks2' &&
    !data.rows.length
  ) {
    return 'Добавьте хотя бы одну строку работ.';
  }

  if (
    data.type === 'ks3' &&
    !data.linkedKs2Ids.length
  ) {
    return 'Выберите хотя бы один акт КС-2.';
  }

  return '';
}


function saveDocument() {
  const data = getFormSnapshot();

  const validation =
    validateDocument(data);

  if (validation) {
    toast(validation, 'err');
    return;
  }

  const record = {
    id:
      currentDoc.id || uid(),

    createdAt:
      new Date().toISOString(),

    ...data
  };

  if (currentDoc.id) {
    const index =
      DB.archive.findIndex(
        doc =>
          doc.id === currentDoc.id
      );

    if (index >= 0) {
      DB.archive[index] = record;
    } else {
      DB.archive.push(record);
    }

    toast(
      'Документ обновлён.',
      'ok'
    );

  } else {
    DB.archive.push(record);
    currentDoc.id = record.id;

    toast(
      'Документ сохранён в архив.',
      'ok'
    );
  }

  saveDB();
  renderArchive();
}


/* ============================================================
   АРХИВ
   ============================================================ */

function renderArchive() {
  const searchEl =
    byId('search-archive');

  const typeEl =
    byId('filter-archive-type');

  const query =
    normalizeText(
      searchEl ? searchEl.value : ''
    );

  const type =
    typeEl ? typeEl.value : '';

  let list =
    DB.archive
      .slice()
      .sort((a, b) =>
        String(b.createdAt || '')
          .localeCompare(
            String(a.createdAt || '')
          )
      );

  if (type) {
    list =
      list.filter(
        doc => doc.type === type
      );
  }

  if (query) {
    list =
      list.filter(doc => {
        return normalizeText([
          doc.num,
          doc.objectName,
          doc.objectAddr,
          doc.contractor?.name,
          doc.customer?.name
        ].join(' ')).includes(query);
      });
  }

  const badge = byId('badge-archive');

  if (badge) {
    badge.textContent =
      String(DB.archive.length);
  }

  const tbody =
    byId('archive-tbody');

  if (!tbody) {
    return;
  }

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">

          <div class="empty-state">

            <div class="empty-state-title">
              ${
                query || type
                  ? 'Ничего не найдено'
                  : 'Архив пуст'
              }
            </div>

            <div class="empty-state-text">
              ${
                query || type
                  ? 'Измените параметры поиска.'
                  : 'Сохранённые документы появятся здесь.'
              }
            </div>

          </div>

        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    list.map(doc => `
      <tr>

        <td>
          <span class="tag ${doc.type}">
            ${doc.type.toUpperCase()}
          </span>
        </td>

        <td class="cell-name">
          № ${escapeHtml(doc.num)}
        </td>

        <td>
          ${fmtDate(doc.date)}
        </td>

        <td>
          ${
            escapeHtml(
              doc.contractor?.name || '—'
            )
          }
        </td>

        <td>
          ${
            escapeHtml(
              doc.customer?.name || '—'
            )
          }
        </td>

        <td>
          ${
            escapeHtml(
              doc.objectName || '—'
            )
          }

          <div class="cell-muted">
            ${
              escapeHtml(
                doc.objectAddr || ''
              )
            }
          </div>
        </td>

        <td class="text-right mono">
          ${
            fmtMoneyPlain(
              doc.totals?.gross || 0
            )
          } ₽
        </td>

        <td class="cell-actions">

          <button
            class="btn btn-ghost btn-sm"
            onclick="
              loadFromArchive('${doc.id}')
            "
            title="Открыть"
          >
            <svg class="icon" viewBox="0 0 16 16">
              <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z"/>
              <circle cx="8" cy="8" r="2"/>
            </svg>
          </button>

          <button
            class="btn btn-ghost btn-sm"
            onclick="
              exportXLSXById('${doc.id}')
            "
            title="Скачать Excel"
          >
            <svg class="icon" viewBox="0 0 16 16">
              <path d="M2 10v4h12v-4"/>
              <path d="M8 2v8"/>
              <path d="M5 7l3 3 3-3"/>
            </svg>
          </button>

          <button
            class="btn btn-ghost btn-sm"
            onclick="
              deleteArchive('${doc.id}')
            "
            title="Удалить"
          >
            <svg class="icon" viewBox="0 0 16 16">
              <path d="M2 4h12"/>
              <path d="M5 4V2h6v2"/>
              <path d="M6 7v5M10 7v5"/>
              <path d="M3 4l1 10h8l1-10"/>
            </svg>
          </button>

        </td>

      </tr>
    `).join('');
}


function loadFromArchive(id) {
  const doc =
    DB.archive.find(
      item => item.id === id
    );

  if (!doc) {
    return;
  }

  currentDoc.id = doc.id;
  currentDoc.type = doc.type;

  currentDoc.rows =
    (doc.rows || []).map(row => ({
      ...row,
      uid: uid()
    }));

  currentDoc.linkedKs2Ids =
    (doc.linkedKs2Ids || []).slice();

  setDocType(doc.type);

  byId('f-docnum').value =
    doc.num || '';

  byId('f-docdate').value =
    doc.date || '';

  byId('f-period').value =
    doc.period || '';

  byId('f-date-from').value =
    doc.dateFrom || '';

  byId('f-date-to').value =
    doc.dateTo || '';

  byId('f-investor').value =
    doc.investor || '';

  byId('f-contract-num').value =
    doc.contractNum || '';

  byId('f-contract-date').value =
    doc.contractDate || '';

  byId('f-object').value =
    doc.objectName || '';

  byId('f-object-addr').value =
    doc.objectAddr || '';

  byId('f-contractor').value =
    doc.contractor?.id || '';

  byId('f-customer').value =
    doc.customer?.id || '';

  const rate =
    doc.totals?.vatRate;

  if (rate === null) {
    byId('f-vat-rate').value =
      'none';

  } else if (
    [5, 10, 20, 22].includes(
      Number(rate)
    )
  ) {
    byId('f-vat-rate').value =
      String(rate);

  } else {
    byId('f-vat-rate').value =
      'custom';

    byId('f-vat-custom').value =
      rate ?? '';
  }

  onVatRateChange();

  renderWorkRows();

  if (doc.type === 'ks3') {
    renderKs2PickList();
  }

  renderTotals();
  renderPreview();

  switchTab('docs');

  toast(
    'Документ загружен в форму.',
    'ok'
  );
}


function deleteArchive(id) {
  const doc =
    DB.archive.find(
      item => item.id === id
    );

  if (!doc) {
    return;
  }

  confirmDialog(
    'Удалить документ?',
    `${doc.type.toUpperCase()} № ${doc.num} от ${fmtDate(doc.date)} будет удалён из архива.`,
    () => {
      DB.archive =
        DB.archive.filter(
          item => item.id !== id
        );

      if (currentDoc.id === id) {
        currentDoc.id = null;
      }

      currentDoc.linkedKs2Ids =
        currentDoc
          .linkedKs2Ids
          .filter(linkedId => linkedId !== id);

      saveDB();

      renderArchive();

      if (currentDoc.type === 'ks3') {
        renderKs2PickList();
      }

      toast(
        'Документ удалён.',
        'ok'
      );
    }
  );
}


function clearArchive() {
  if (!DB.archive.length) {
    toast(
      'Архив уже пуст.',
      'err'
    );

    return;
  }

  confirmDialog(
    'Очистить весь архив?',
    `Будут удалены все документы: ${DB.archive.length}.`,
    () => {
      DB.archive = [];
      currentDoc.id = null;
      currentDoc.linkedKs2Ids = [];

      saveDB();

      renderArchive();

      if (currentDoc.type === 'ks3') {
        renderKs2PickList();
      }

      toast(
        'Архив очищен.',
        'ok'
      );
    }
  );
}


/* ============================================================
   ЭКСПОРТ / ИМПОРТ БАЗЫ
   ============================================================ */

function exportAllData() {
  const payload = {
    version: 2,
    exportedAt:
      new Date().toISOString(),

    data: DB
  };

  const filename =
    'jembalance_backup_' +
    new Date()
      .toISOString()
      .slice(0, 10) +
    '.json';

  downloadBlob(
    JSON.stringify(
      payload,
      null,
      2
    ),
    filename,
    'application/json;charset=utf-8'
  );

  toast(
    'База экспортирована.',
    'ok'
  );
}


function importData() {
  const input =
    document.createElement('input');

  input.type = 'file';
  input.accept =
    '.json,application/json';

  input.addEventListener(
    'change',
    event => {
      const file =
        event.target.files?.[0];

      if (!file) {
        return;
      }

      const reader =
        new FileReader();

      reader.onload = ev => {
        try {
          const parsed =
            JSON.parse(
              ev.target.result
            );

          const incoming =
            parsed.data || parsed;

          if (
            !incoming.contractors &&
            !incoming.customers &&
            !incoming.archive
          ) {
            toast(
              'Неподходящий формат файла.',
              'err'
            );

            return;
          }

          confirmDialog(
            'Импортировать данные?',
            `Будут заменены подрядчики, заказчики и архив текущей базы.`,
            () => {
              DB.contractors =
                Array.isArray(
                  incoming.contractors
                )
                  ? incoming.contractors
                  : [];

              DB.customers =
                Array.isArray(
                  incoming.customers
                )
                  ? incoming.customers
                  : [];

              DB.archive =
                Array.isArray(
                  incoming.archive
                )
                  ? incoming.archive
                  : [];

              saveDB();

              refreshContractorSelect();
              refreshCustomerSelect();

              renderContractors();
              renderCustomers();
              renderArchive();
              renderPreview();

              toast(
                'База импортирована.',
                'ok'
              );
            }
          );

        } catch (error) {
          toast(
            'Ошибка чтения файла: ' +
              error.message,
            'err'
          );
        }
      };

      reader.readAsText(file);
    }
  );

  input.click();
}


/* ============================================================
   ОЧИСТКА ФОРМЫ
   ============================================================ */

function clearForm() {
  confirmDialog(
    'Очистить форму?',
    'Все введённые данные документа будут сброшены. Архив и справочники не пострадают.',
    () => {
      currentDoc.id = null;
      currentDoc.rows = [];
      currentDoc.linkedKs2Ids = [];

      [
        'f-docnum',
        'f-period',
        'f-date-from',
        'f-date-to',
        'f-investor',
        'f-contract-num',
        'f-contract-date',
        'f-object',
        'f-object-addr',
        'f-vat-custom'
      ].forEach(id => {
        const el = byId(id);

        if (el) {
          el.value = '';
        }
      });

      byId('f-docdate').value =
        new Date()
          .toISOString()
          .slice(0, 10);

      byId('f-contractor').value = '';
      byId('f-customer').value = '';
      byId('f-vat-rate').value = '20';

      setDocType('ks2');

      renderWorkRows();
      renderTotals();
      renderPreview();

      toast(
        'Форма очищена.',
        'ok'
      );
    }
  );
}


/* ============================================================
   XLSX — ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ============================================================ */

/*
  SheetJS здесь используется ТОЛЬКО для чтения координат
  ячеек и объединений исходной книги.

  Запись обратно выполняется через JSZip напрямую в XML.
  Таким образом мы не пересобираем книгу SheetJS-ом.
*/


function assertExcelLibraries() {
  if (
    typeof JSZip === 'undefined'
  ) {
    throw new Error(
      'Библиотека JSZip не загружена.'
    );
  }

  if (
    typeof XLSX === 'undefined'
  ) {
    throw new Error(
      'Библиотека SheetJS не загружена.'
    );
  }
}


async function fetchTemplate(type) {
  const path =
    TEMPLATE_PATHS[type];

  if (!path) {
    throw new Error(
      'Неизвестный тип шаблона.'
    );
  }

  const response =
    await fetch(
      path,
      {
        cache: 'no-store'
      }
    );

  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить шаблон ${path}. HTTP ${response.status}`
    );
  }

  return await response.arrayBuffer();
}


function getFirstSheetInfo(arrayBuffer) {
  const workbook =
    XLSX.read(
      arrayBuffer,
      {
        type: 'array',
        cellStyles: true,
        cellDates: false,
        cellFormula: true
      }
    );

  const sheetName =
    workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error(
      'В шаблоне не найден рабочий лист.'
    );
  }

  const sheet =
    workbook.Sheets[sheetName];

  return {
    workbook,
    sheetName,
    sheet
  };
}


function cellAddress(row, col) {
  return XLSX.utils.encode_cell({
    r: row,
    c: col
  });
}


function decodeAddress(address) {
  return XLSX.utils.decode_cell(
    address
  );
}


function getSheetCellText(
  sheet,
  address
) {
  const cell =
    sheet[address];

  if (!cell) {
    return '';
  }

  if (
    cell.w !== undefined &&
    cell.w !== null
  ) {
    return String(cell.w);
  }

  if (
    cell.v !== undefined &&
    cell.v !== null
  ) {
    return String(cell.v);
  }

  return '';
}


function listSheetCells(sheet) {
  const cells = [];

  Object.keys(sheet).forEach(key => {
    if (key.startsWith('!')) {
      return;
    }

    const pos =
      decodeAddress(key);

    cells.push({
      address: key,
      row: pos.r,
      col: pos.c,
      text:
        getSheetCellText(
          sheet,
          key
        ),

      normalized:
        normalizeText(
          getSheetCellText(
            sheet,
            key
          )
        )
    });
  });

  return cells;
}


function findCellByText(
  sheet,
  patterns,
  options = {}
) {
  const cells =
    listSheetCells(sheet);

  const normalizedPatterns =
    (Array.isArray(patterns)
      ? patterns
      : [patterns]
    ).map(normalizeText);

  const exact =
    options.exact === true;

  const minRow =
    options.minRow ?? -Infinity;

  const maxRow =
    options.maxRow ?? Infinity;

  const minCol =
    options.minCol ?? -Infinity;

  const maxCol =
    options.maxCol ?? Infinity;

  const result =
    cells.find(cell => {
      if (
        cell.row < minRow ||
        cell.row > maxRow ||
        cell.col < minCol ||
        cell.col > maxCol
      ) {
        return false;
      }

      return normalizedPatterns.some(
        pattern => {
          if (exact) {
            return (
              cell.normalized === pattern
            );
          }

          return (
            cell.normalized.includes(
              pattern
            )
          );
        }
      );
    });

  return result || null;
}


function findCellsByText(
  sheet,
  patterns,
  options = {}
) {
  const cells =
    listSheetCells(sheet);

  const normalizedPatterns =
    (Array.isArray(patterns)
      ? patterns
      : [patterns]
    ).map(normalizeText);

  return cells.filter(cell => {
    if (
      options.minRow !== undefined &&
      cell.row < options.minRow
    ) {
      return false;
    }

    if (
      options.maxRow !== undefined &&
      cell.row > options.maxRow
    ) {
      return false;
    }

    if (
      options.minCol !== undefined &&
      cell.col < options.minCol
    ) {
      return false;
    }

    if (
      options.maxCol !== undefined &&
      cell.col > options.maxCol
    ) {
      return false;
    }

    return normalizedPatterns.some(
      pattern => {
        if (options.exact) {
          return (
            cell.normalized === pattern
          );
        }

        return (
          cell.normalized.includes(
            pattern
          )
        );
      }
    );
  });
}


function getMergedRangeForCell(
  sheet,
  row,
  col
) {
  const merges =
    sheet['!merges'] || [];

  return (
    merges.find(range => {
      return (
        row >= range.s.r &&
        row <= range.e.r &&
        col >= range.s.c &&
        col <= range.e.c
      );
    }) || null
  );
}


function topLeftOfMergedRange(
  sheet,
  row,
  col
) {
  const merge =
    getMergedRangeForCell(
      sheet,
      row,
      col
    );

  if (!merge) {
    return {
      row,
      col
    };
  }

  return {
    row: merge.s.r,
    col: merge.s.c
  };
}


function nextLogicalCellToRight(
  sheet,
  row,
  col,
  maxDistance = 40
) {
  const originMerge =
    getMergedRangeForCell(
      sheet,
      row,
      col
    );

  let startCol =
    originMerge
      ? originMerge.e.c + 1
      : col + 1;

  const merges =
    sheet['!merges'] || [];

  const candidateMerges =
    merges
      .filter(range => {
        return (
          row >= range.s.r &&
          row <= range.e.r &&
          range.s.c >= startCol
        );
      })
      .sort(
        (a, b) =>
          a.s.c - b.s.c
      );

  if (candidateMerges.length) {
    const first =
      candidateMerges[0];

    if (
      first.s.c - startCol <=
      maxDistance
    ) {
      return {
        row: first.s.r,
        col: first.s.c
      };
    }
  }

  return {
    row,
    col: startCol
  };
}


function logicalCellBelow(
  sheet,
  row,
  col,
  rowOffset = 1
) {
  const targetRow =
    row + rowOffset;

  return topLeftOfMergedRange(
    sheet,
    targetRow,
    col
  );
}


function findNumberingRow(
  sheet,
  maxColumnNumber
) {
  const cells =
    listSheetCells(sheet);

  const grouped =
    new Map();

  cells.forEach(cell => {
    const text =
      String(cell.text).trim();

    if (
      !/^\d+$/.test(text)
    ) {
      return;
    }

    const value =
      Number(text);

    if (
      value < 1 ||
      value > maxColumnNumber
    ) {
      return;
    }

    if (
      !grouped.has(cell.row)
    ) {
      grouped.set(
        cell.row,
        []
      );
    }

    grouped
      .get(cell.row)
      .push({
        value,
        col: cell.col
      });
  });

  let best = null;

  for (
    const [row, values]
    of grouped.entries()
  ) {
    const unique =
      new Map();

    values.forEach(item => {
      if (
        !unique.has(item.value)
      ) {
        unique.set(
          item.value,
          item.col
        );
      }
    });

    let matched = 0;

    for (
      let i = 1;
      i <= maxColumnNumber;
      i++
    ) {
      if (unique.has(i)) {
        matched++;
      }
    }

    if (
      matched >=
      Math.min(
        maxColumnNumber,
        5
      )
    ) {
      if (
        !best ||
        matched > best.matched
      ) {
        best = {
          row,
          matched,
          columns: unique
        };
      }
    }
  }

  return best;
}


function findLikelyTotalsRow(
  sheet,
  startRow
) {
  const candidates =
    findCellsByText(
      sheet,
      [
        'итого',
        'всего',
        'ндс'
      ],
      {
        minRow: startRow
      }
    );

  if (!candidates.length) {
    return null;
  }

  candidates.sort(
    (a, b) =>
      a.row - b.row
  );

  return candidates[0].row;
}


function buildCompanyLine(company) {
  if (!company) {
    return '';
  }

  return [
    company.name,
    company.addr,
    company.phone,
    company.email
  ]
    .filter(Boolean)
    .join(', ');
}


/* ============================================================
   XLSX — РАБОТА С XML
   ============================================================ */

function xmlParse(text) {
  return new DOMParser()
    .parseFromString(
      text,
      'application/xml'
    );
}


function xmlSerialize(doc) {
  return new XMLSerializer()
    .serializeToString(doc);
}


function ensureWorksheetRow(
  worksheetDoc,
  rowNumber
) {
  const ns =
    worksheetDoc
      .documentElement
      .namespaceURI;

  const sheetData =
    worksheetDoc
      .getElementsByTagNameNS(
        ns,
        'sheetData'
      )[0];

  if (!sheetData) {
    throw new Error(
      'В XML листа отсутствует sheetData.'
    );
  }

  let row =
    Array.from(
      sheetData
        .getElementsByTagNameNS(
          ns,
          'row'
        )
    ).find(
      element =>
        Number(
          element.getAttribute('r')
        ) === rowNumber
    );

  if (row) {
    return row;
  }

  row =
    worksheetDoc.createElementNS(
      ns,
      'row'
    );

  row.setAttribute(
    'r',
    String(rowNumber)
  );

  const rows =
    Array.from(
      sheetData.children
    );

  const next =
    rows.find(
      element =>
        Number(
          element.getAttribute('r')
        ) > rowNumber
    );

  if (next) {
    sheetData.insertBefore(
      row,
      next
    );
  } else {
    sheetData.appendChild(row);
  }

  return row;
}


function ensureWorksheetCell(
  worksheetDoc,
  address
) {
  const ns =
    worksheetDoc
      .documentElement
      .namespaceURI;

  const pos =
    XLSX.utils.decode_cell(
      address
    );

  const rowNumber =
    pos.r + 1;

  const row =
    ensureWorksheetRow(
      worksheetDoc,
      rowNumber
    );

  let cell =
    Array.from(
      row.getElementsByTagNameNS(
        ns,
        'c'
      )
    ).find(
      el =>
        el.getAttribute('r') ===
        address
    );

  if (cell) {
    return cell;
  }

  cell =
    worksheetDoc.createElementNS(
      ns,
      'c'
    );

  cell.setAttribute(
    'r',
    address
  );

  const targetCol =
    pos.c;

  const cells =
    Array.from(
      row.children
    );

  const next =
    cells.find(el => {
      if (
        el.localName !== 'c'
      ) {
        return false;
      }

      const ref =
        el.getAttribute('r');

      if (!ref) {
        return false;
      }

      return (
        XLSX.utils
          .decode_cell(ref)
          .c >
        targetCol
      );
    });

  if (next) {
    row.insertBefore(
      cell,
      next
    );
  } else {
    row.appendChild(cell);
  }

  return cell;
}


function clearCellValue(cell) {
  Array.from(
    cell.childNodes
  ).forEach(node => {
    if (
      node.nodeType === 1 &&
      (
        node.localName === 'v' ||
        node.localName === 'is' ||
        node.localName === 'f'
      )
    ) {
      cell.removeChild(node);
    }
  });

  cell.removeAttribute('t');
}


function setInlineStringCell(
  worksheetDoc,
  address,
  value
) {
  const ns =
    worksheetDoc
      .documentElement
      .namespaceURI;

  const cell =
    ensureWorksheetCell(
      worksheetDoc,
      address
    );

  /*
    ВАЖНО:
    атрибут стиля "s" не трогаем.
  */
  clearCellValue(cell);

  cell.setAttribute(
    't',
    'inlineStr'
  );

  const is =
    worksheetDoc.createElementNS(
      ns,
      'is'
    );

  const t =
    worksheetDoc.createElementNS(
      ns,
      't'
    );

  const stringValue =
    String(
      value ?? ''
    );

  if (
    /^\s|\s$/.test(
      stringValue
    )
  ) {
    t.setAttributeNS(
      'http://www.w3.org/XML/1998/namespace',
      'xml:space',
      'preserve'
    );
  }

  t.textContent =
    stringValue;

  is.appendChild(t);
  cell.appendChild(is);
}


function setNumberCell(
  worksheetDoc,
  address,
  value
) {
  const ns =
    worksheetDoc
      .documentElement
      .namespaceURI;

  const cell =
    ensureWorksheetCell(
      worksheetDoc,
      address
    );

  clearCellValue(cell);

  const v =
    worksheetDoc.createElementNS(
      ns,
      'v'
    );

  v.textContent =
    String(num(value));

  cell.appendChild(v);
}


function setDateCell(
  worksheetDoc,
  address,
  iso
) {
  const serial =
    excelSerialFromISO(iso);

  if (serial === null) {
    setInlineStringCell(
      worksheetDoc,
      address,
      ''
    );

    return;
  }

  setNumberCell(
    worksheetDoc,
    address,
    serial
  );
}


/* ============================================================
   XLSX — ПОИСК ПЕРВОГО ЛИСТА В ZIP
   ============================================================ */

async function getFirstWorksheetZipPath(
  zip
) {
  const workbookXml =
    await zip
      .file(
        'xl/workbook.xml'
      )
      ?.async('string');

  const relsXml =
    await zip
      .file(
        'xl/_rels/workbook.xml.rels'
      )
      ?.async('string');

  if (
    !workbookXml ||
    !relsXml
  ) {
    throw new Error(
      'Повреждённая структура XLSX.'
    );
  }

  const workbookDoc =
    xmlParse(workbookXml);

  const relsDoc =
    xmlParse(relsXml);

  const sheet =
    Array.from(
      workbookDoc
        .getElementsByTagName('*')
    ).find(
      el =>
        el.localName === 'sheet'
    );

  if (!sheet) {
    throw new Error(
      'Не найден лист книги.'
    );
  }

  const relId =
    sheet.getAttribute(
      'r:id'
    ) ||
    sheet.getAttributeNS(
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'id'
    );

  const relationship =
    Array.from(
      relsDoc
        .getElementsByTagName('*')
    ).find(el => {
      return (
        el.localName ===
          'Relationship' &&
        el.getAttribute('Id') ===
          relId
      );
    });

  if (!relationship) {
    throw new Error(
      'Не удалось определить XML листа.'
    );
  }

  let target =
    relationship
      .getAttribute('Target');

  target =
    target.replace(
      /^\/+/,
      ''
    );

  if (
    !target.startsWith('xl/')
  ) {
    target =
      'xl/' + target;
  }

  target =
    target.replace(
      /\\/g,
      '/'
    );

  return target;
}


/* ============================================================
   XLSX — ПОИСК ЦЕЛЕВОЙ ЯЧЕЙКИ ПО ПОДПИСИ
   ============================================================ */

function getTargetRightOfLabel(
  sheet,
  patterns,
  options = {}
) {
  const label =
    findCellByText(
      sheet,
      patterns,
      options
    );

  if (!label) {
    return null;
  }

  const target =
    nextLogicalCellToRight(
      sheet,
      label.row,
      label.col,
      options.maxDistance || 60
    );

  return cellAddress(
    target.row,
    target.col
  );
}


function getTargetBelowLabel(
  sheet,
  patterns,
  rowOffset = 1,
  options = {}
) {
  const label =
    findCellByText(
      sheet,
      patterns,
      options
    );

  if (!label) {
    return null;
  }

  const target =
    logicalCellBelow(
      sheet,
      label.row,
      label.col,
      rowOffset
    );

  return cellAddress(
    target.row,
    target.col
  );
}


function writeIfAddress(
  worksheetDoc,
  address,
  value,
  type = 'text'
) {
  if (!address) {
    return false;
  }

  if (type === 'number') {
    setNumberCell(
      worksheetDoc,
      address,
      value
    );

  } else if (type === 'date') {
    setDateCell(
      worksheetDoc,
      address,
      value
    );

  } else {
    setInlineStringCell(
      worksheetDoc,
      address,
      value ?? ''
    );
  }

  return true;
}


/* ============================================================
   XLSX — ОБЩИЕ РЕКВИЗИТЫ
   ============================================================ */

function patchCommonFields(
  sheet,
  worksheetDoc,
  data
) {
  /*
    Инвестор
  */
  writeIfAddress(
    worksheetDoc,
    getTargetRightOfLabel(
      sheet,
      ['инвестор']
    ),
    data.investor || ''
  );


  /*
    Заказчик
  */
  writeIfAddress(
    worksheetDoc,
    getTargetRightOfLabel(
      sheet,
      [
        'заказчик (генподрядчик)',
        'заказчик'
      ]
    ),
    buildCompanyLine(
      data.customer
    )
  );


  /*
    Подрядчик
  */
  writeIfAddress(
    worksheetDoc,
    getTargetRightOfLabel(
      sheet,
      [
        'подрядчик (субподрядчик)',
        'подрядчик'
      ]
    ),
    buildCompanyLine(
      data.contractor
    )
  );


  /*
    Стройка — указываем объект + адрес
  */
  writeIfAddress(
    worksheetDoc,
    getTargetRightOfLabel(
      sheet,
      ['стройка']
    ),
    [
      data.objectName,
      data.objectAddr
    ]
      .filter(Boolean)
      .join(', ')
  );


  /*
    Объект
  */
  writeIfAddress(
    worksheetDoc,
    getTargetRightOfLabel(
      sheet,
      ['объект']
    ),
    data.objectName || ''
  );


  /*
    Номер документа
  */
  writeIfAddress(
    worksheetDoc,
    getTargetBelowLabel(
      sheet,
      [
        'номер документа'
      ]
    ),
    data.num || ''
  );


  /*
    Дата составления
  */
  writeIfAddress(
    worksheetDoc,
    getTargetBelowLabel(
      sheet,
      [
        'дата составления'
      ]
    ),
    data.date,
    'date'
  );


  /*
    Договор
  */
  const contractLabel =
    findCellByText(
      sheet,
      [
        'договор подряда (контракт)',
        'договор подряда'
      ]
    );

  if (contractLabel) {
    const numberLabel =
      findCellByText(
        sheet,
        ['номер'],
        {
          exact: true,
          minRow:
            contractLabel.row - 1,
          maxRow:
            contractLabel.row + 2,
          minCol:
            contractLabel.col,
          maxCol:
            contractLabel.col + 40
        }
      );

    if (numberLabel) {
      const target =
        nextLogicalCellToRight(
          sheet,
          numberLabel.row,
          numberLabel.col
        );

      writeIfAddress(
        worksheetDoc,
        cellAddress(
          target.row,
          target.col
        ),
        data.contractNum || ''
      );
    }

    const dateLabel =
      findCellByText(
        sheet,
        ['дата'],
        {
          exact: true,
          minRow:
            contractLabel.row - 1,
          maxRow:
            contractLabel.row + 4,
          minCol:
            contractLabel.col,
          maxCol:
            contractLabel.col + 40
        }
      );

    if (dateLabel) {
      const target =
        nextLogicalCellToRight(
          sheet,
          dateLabel.row,
          dateLabel.col
        );

      writeIfAddress(
        worksheetDoc,
        cellAddress(
          target.row,
          target.col
        ),
        data.contractDate,
        'date'
      );
    }
  }


  /*
    Отчётный период.
    Ищем подписи "с" и "по" рядом с блоком.
  */
  const periodLabel =
    findCellByText(
      sheet,
      [
        'отчетный период',
        'отчётный период'
      ]
    );

  if (periodLabel) {
    const fromLabel =
      findCellByText(
        sheet,
        ['с'],
        {
          exact: true,
          minRow:
            periodLabel.row,
          maxRow:
            periodLabel.row + 4,
          minCol:
            periodLabel.col - 2,
          maxCol:
            periodLabel.col + 30
        }
      );

    const toLabel =
      findCellByText(
        sheet,
        ['по'],
        {
          exact: true,
          minRow:
            periodLabel.row,
          maxRow:
            periodLabel.row + 4,
          minCol:
            periodLabel.col - 2,
          maxCol:
            periodLabel.col + 30
        }
      );

    if (fromLabel) {
      const target =
        logicalCellBelow(
          sheet,
          fromLabel.row,
          fromLabel.col
        );

      writeIfAddress(
        worksheetDoc,
        cellAddress(
          target.row,
          target.col
        ),
        data.dateFrom,
        'date'
      );
    }

    if (toLabel) {
      const target =
        logicalCellBelow(
          sheet,
          toLabel.row,
          toLabel.col
        );

      writeIfAddress(
        worksheetDoc,
        cellAddress(
          target.row,
          target.col
        ),
        data.dateTo,
        'date'
      );
    }
  }
}


/* ============================================================
   XLSX — КС-2
   ============================================================ */

function patchKs2(
  sheet,
  worksheetDoc,
  data
) {
  patchCommonFields(
    sheet,
    worksheetDoc,
    data
  );

  /*
    В официальной КС-2 логические колонки
    подписаны цифрами 1–8.

    1 — № п/п
    2 — позиция по смете
    3 — наименование работ
    4 — номер единичной расценки
    5 — единица измерения
    6 — количество
    7 — цена за единицу
    8 — стоимость
  */

  const numbering =
    findNumberingRow(
      sheet,
      8
    );

  if (!numbering) {
    throw new Error(
      'В шаблоне КС-2 не удалось определить строку с номерами колонок 1–8.'
    );
  }

  const startRow =
    numbering.row + 1;

  let totalsRow =
    findLikelyTotalsRow(
      sheet,
      startRow
    );

  /*
    Если подпись "Итого" не найдена,
    используем разумный запас строк.
  */
  if (
    totalsRow === null ||
    totalsRow <= startRow
  ) {
    totalsRow =
      startRow + 40;
  }

  const availableRows =
    totalsRow - startRow;

  if (
    data.rows.length >
    availableRows
  ) {
    throw new Error(
      `В шаблоне КС-2 доступно строк работ: ${availableRows}, а заполнено: ${data.rows.length}.`
    );
  }

  const col = n => {
    const c =
      numbering
        .columns
        .get(n);

    if (
      c === undefined
    ) {
      throw new Error(
        `В шаблоне КС-2 не найдена колонка № ${n}.`
      );
    }

    return c;
  };


  /*
    Очищаем доступную область работ,
    чтобы старые значения шаблона не оставались.
  */
  for (
    let r = startRow;
    r < totalsRow;
    r++
  ) {
    for (
      let logical = 1;
      logical <= 8;
      logical++
    ) {
      const c =
        col(logical);

      const target =
        topLeftOfMergedRange(
          sheet,
          r,
          c
        );

      setInlineStringCell(
        worksheetDoc,
        cellAddress(
          target.row,
          target.col
        ),
        ''
      );
    }
  }


  /*
    Заполняем работы.
  */
  data.rows.forEach(
    (row, index) => {
      const targetRow =
        startRow + index;

      const values = {
        1: index + 1,

        2:
          row.estimatePos || '',

        3:
          row.name || '',

        4:
          row.unitRateNumber || '',

        5:
          row.unit || '',

        6:
          num(row.qty),

        7:
          round2(row.price),

        8:
          round2(
            num(row.qty) *
            num(row.price)
          )
      };

      Object.entries(values)
        .forEach(
          ([logicalString, value]) => {
            const logical =
              Number(logicalString);

            const target =
              topLeftOfMergedRange(
                sheet,
                targetRow,
                col(logical)
              );

            const address =
              cellAddress(
                target.row,
                target.col
              );

            if (
              [1, 6, 7, 8]
                .includes(logical)
            ) {
              setNumberCell(
                worksheetDoc,
                address,
                value
              );
            } else {
              setInlineStringCell(
                worksheetDoc,
                address,
                value
              );
            }
          }
        );
    }
  );


  patchTotals(
    sheet,
    worksheetDoc,
    data.totals,
    startRow
  );
}


/* ============================================================
   XLSX — КС-3
   ============================================================ */

function patchKs3(
  sheet,
  worksheetDoc,
  data
) {
  patchCommonFields(
    sheet,
    worksheetDoc,
    data
  );

  /*
    В КС-3 ищем логические колонки 1–6.
  */
  const numbering =
    findNumberingRow(
      sheet,
      6
    );

  if (!numbering) {
    throw new Error(
      'В шаблоне КС-3 не удалось определить строку с номерами колонок.'
    );
  }

  const startRow =
    numbering.row + 1;

  let totalsRow =
    findLikelyTotalsRow(
      sheet,
      startRow
    );

  if (
    totalsRow === null ||
    totalsRow <= startRow
  ) {
    totalsRow =
      startRow + 25;
  }

  const linked =
    data.linkedKs2Ids
      .map(id =>
        DB.archive.find(
          doc => doc.id === id
        )
      )
      .filter(Boolean);

  const availableRows =
    totalsRow - startRow;

  if (
    linked.length >
    availableRows
  ) {
    throw new Error(
      `В шаблоне КС-3 доступно строк: ${availableRows}, выбрано актов КС-2: ${linked.length}.`
    );
  }

  const col = n => {
    const c =
      numbering.columns.get(n);

    if (
      c === undefined
    ) {
      return null;
    }

    return c;
  };


  /*
    Очищаем рабочую область.
  */
  for (
    let r = startRow;
    r < totalsRow;
    r++
  ) {
    for (
      let logical = 1;
      logical <= 6;
      logical++
    ) {
      const c = col(logical);

      if (c === null) {
        continue;
      }

      const target =
        topLeftOfMergedRange(
          sheet,
          r,
          c
        );

      setInlineStringCell(
        worksheetDoc,
        cellAddress(
          target.row,
          target.col
        ),
        ''
      );
    }
  }


  /*
    Типовая КС-3:

    1 — №
    2 — наименование
    3 — код
    4 — с начала проведения работ
    5 — с начала года
    6 — за отчётный период

    Для текущей логики генератора:
    каждый связанный КС-2 становится отдельной строкой.
  */
  linked.forEach(
    (doc, index) => {
      const targetRow =
        startRow + index;

      const name =
        [
          `КС-2 № ${doc.num} от ${fmtDate(doc.date)}`,
          doc.objectName
        ]
          .filter(Boolean)
          .join(' — ');

      const base =
        round2(
          doc.totals?.base || 0
        );

      const values = {
        1: index + 1,
        2: name,
        3: '',
        4: base,
        5: base,
        6: base
      };

      Object.entries(values)
        .forEach(
          ([logicalString, value]) => {
            const logical =
              Number(logicalString);

            const c =
              col(logical);

            if (c === null) {
              return;
            }

            const target =
              topLeftOfMergedRange(
                sheet,
                targetRow,
                c
              );

            const address =
              cellAddress(
                target.row,
                target.col
              );

            if (
              logical === 1 ||
              logical >= 4
            ) {
              setNumberCell(
                worksheetDoc,
                address,
                value
              );
            } else {
              setInlineStringCell(
                worksheetDoc,
                address,
                value
              );
            }
          }
        );
    }
  );


  patchTotals(
    sheet,
    worksheetDoc,
    data.totals,
    startRow
  );
}


/* ============================================================
   XLSX — ИТОГИ
   ============================================================ */

function findRightmostCellOnRow(
  sheet,
  row
) {
  const cells =
    listSheetCells(sheet)
      .filter(
        cell => cell.row === row
      );

  if (!cells.length) {
    const range =
      sheet['!ref']
        ? XLSX.utils
            .decode_range(
              sheet['!ref']
            )
        : null;

    return range
      ? range.e.c
      : 10;
  }

  return Math.max(
    ...cells.map(
      cell => cell.col
    )
  );
}


function getValueCellRightOfText(
  sheet,
  cell
) {
  const target =
    nextLogicalCellToRight(
      sheet,
      cell.row,
      cell.col,
      80
    );

  return cellAddress(
    target.row,
    target.col
  );
}


function patchTotals(
  sheet,
  worksheetDoc,
  totals,
  minRow
) {
  const totalCandidates =
    findCellsByText(
      sheet,
      [
        'итого',
        'всего'
      ],
      {
        minRow
      }
    );

  /*
    Итого без НДС:
    берём первую подходящую строку "Итого".
  */
  if (totalCandidates.length) {
    totalCandidates.sort(
      (a, b) =>
        a.row - b.row
    );

    const first =
      totalCandidates[0];

    const address =
      getValueCellRightOfText(
        sheet,
        first
      );

    writeIfAddress(
      worksheetDoc,
      address,
      totals.base,
      'number'
    );
  }


  /*
    НДС.
  */
  const vatCells =
    findCellsByText(
      sheet,
      ['ндс'],
      {
        minRow
      }
    );

  if (vatCells.length) {
    vatCells.sort(
      (a, b) =>
        a.row - b.row
    );

    const vatCell =
      vatCells[0];

    const address =
      getValueCellRightOfText(
        sheet,
        vatCell
      );

    if (
      totals.vatRate === null
    ) {
      writeIfAddress(
        worksheetDoc,
        address,
        'Без НДС'
      );
    } else {
      writeIfAddress(
        worksheetDoc,
        address,
        totals.vat,
        'number'
      );
    }
  }


  /*
    Последняя строка "Всего" —
    сумма с НДС.
  */
  if (totalCandidates.length) {
    const last =
      totalCandidates[
        totalCandidates.length - 1
      ];

    const address =
      getValueCellRightOfText(
        sheet,
        last
      );

    writeIfAddress(
      worksheetDoc,
      address,
      totals.gross,
      'number'
    );
  }
}


/* ============================================================
   XLSX — ОСНОВНАЯ ГЕНЕРАЦИЯ
   ============================================================ */

async function generateXlsxFromTemplate(data) {
  assertExcelLibraries();

  /*
    Получаем настоящий исходный шаблон.
  */
  const templateBuffer =
    await fetchTemplate(
      data.type
    );


  /*
    SheetJS читает координаты ячеек.
    Сам XLSX им НЕ записываем.
  */
  const {
    sheet
  } =
    getFirstSheetInfo(
      templateBuffer
    );


  /*
    JSZip открывает исходный XLSX.
  */
  const zip =
    await JSZip.loadAsync(
      templateBuffer
    );


  const worksheetPath =
    await getFirstWorksheetZipPath(
      zip
    );


  const worksheetFile =
    zip.file(
      worksheetPath
    );

  if (!worksheetFile) {
    throw new Error(
      `В шаблоне не найден ${worksheetPath}.`
    );
  }


  const worksheetXml =
    await worksheetFile.async(
      'string'
    );


  const worksheetDoc =
    xmlParse(
      worksheetXml
    );


  /*
    Подставляем данные.
  */
  if (data.type === 'ks2') {
    patchKs2(
      sheet,
      worksheetDoc,
      data
    );

  } else {
    patchKs3(
      sheet,
      worksheetDoc,
      data
    );
  }


  /*
    Возвращаем изменённый XML листа
    обратно в исходную книгу.
  */
  zip.file(
    worksheetPath,
    xmlSerialize(
      worksheetDoc
    )
  );


  /*
    XLSX собирается тем же ZIP-пакетом.
    Все остальные файлы книги остаются нетронутыми:
    styles.xml,
    merged cells,
    relationships,
    drawings,
    pageSetup,
    printArea и т.д.
  */
  return await zip.generateAsync({
    type: 'blob',

    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

    compression:
      'DEFLATE',

    compressionOptions: {
      level: 6
    }
  });
}


/* ============================================================
   XLSX — ЭКСПОРТ ТЕКУЩЕГО ДОКУМЕНТА
   ============================================================ */

async function exportXLSX() {
  try {
    const data =
      getFormSnapshot();

    const validation =
      validateDocument(data);

    if (validation) {
      toast(
        validation,
        'err'
      );

      return;
    }

    toast(
      'Формирую Excel по оригинальному шаблону…'
    );

    const blob =
      await generateXlsxFromTemplate(
        data
      );

    const cleanNumber =
      String(data.num)
        .replace(
          /[\\/:*?"<>|]+/g,
          '-'
        );

    const filename =
      `${data.type.toUpperCase()}_${cleanNumber}_${data.date}.xlsx`;

    downloadBlob(
      blob,
      filename,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    toast(
      'Excel сформирован по шаблону.',
      'ok'
    );

  } catch (error) {
    console.error(
      'Ошибка XLSX:',
      error
    );

    toast(
      'Ошибка Excel: ' +
        error.message,
      'err'
    );
  }
}


/* ============================================================
   XLSX — ЭКСПОРТ ИЗ АРХИВА
   ============================================================ */

async function exportXLSXById(id) {
  try {
    const data =
      DB.archive.find(
        doc => doc.id === id
      );

    if (!data) {
      throw new Error(
        'Документ не найден.'
      );
    }

    toast(
      'Формирую Excel по оригинальному шаблону…'
    );

    const blob =
      await generateXlsxFromTemplate(
        data
      );

    const cleanNumber =
      String(data.num)
        .replace(
          /[\\/:*?"<>|]+/g,
          '-'
        );

    const filename =
      `${data.type.toUpperCase()}_${cleanNumber}_${data.date}.xlsx`;

    downloadBlob(
      blob,
      filename,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    toast(
      'Excel сформирован по шаблону.',
      'ok'
    );

  } catch (error) {
    console.error(error);

    toast(
      'Ошибка Excel: ' +
        error.message,
      'err'
    );
  }
}


/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */

function init() {
  loadDB();

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  if (
    byId('f-docdate') &&
    !byId('f-docdate').value
  ) {
    byId('f-docdate').value =
      today;
  }

  refreshContractorSelect();
  refreshCustomerSelect();

  if (byId('badge-contractors')) {
    byId(
      'badge-contractors'
    ).textContent =
      String(
        DB.contractors.length
      );
  }

  if (byId('badge-customers')) {
    byId(
      'badge-customers'
    ).textContent =
      String(
        DB.customers.length
      );
  }

  if (byId('badge-archive')) {
    byId(
      'badge-archive'
    ).textContent =
      String(
        DB.archive.length
      );
  }

  renderWorkRows();
  renderTotals();
  renderPreview();


  /*
    Закрытие модалки по клику
    на затемнённый фон.
  */
  document
    .querySelectorAll(
      '.modal-backdrop'
    )
    .forEach(backdrop => {
      backdrop.addEventListener(
        'click',
        event => {
          if (
            event.target ===
            backdrop
          ) {
            backdrop
              .classList
              .remove('active');
          }
        }
      );
    });


  /*
    Escape.
  */
  document.addEventListener(
    'keydown',
    event => {
      if (
        event.key === 'Escape'
      ) {
        document
          .querySelectorAll(
            '.modal-backdrop.active'
          )
          .forEach(
            backdrop =>
              backdrop
                .classList
                .remove('active')
          );
      }
    }
  );


  /*
    Проверяем наличие библиотек.
    Не блокируем приложение,
    если Excel пока не нужен.
  */
  if (
    typeof JSZip === 'undefined'
  ) {
    console.warn(
      'JSZip не загружен.'
    );
  }

  if (
    typeof XLSX === 'undefined'
  ) {
    console.warn(
      'SheetJS не загружен.'
    );
  }
}


document.addEventListener(
  'DOMContentLoaded',
  init
);