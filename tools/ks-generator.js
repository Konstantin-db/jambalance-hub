'use strict';

/* ============================================================
   ДЖЕМБАЛАНС — ГЕНЕРАТОР КС-2 / КС-3
   ============================================================

   Ожидаемая структура:

   tools/
   ├── ks-generator.html
   ├── ks-generator.js
   ├── xlsx.full.min.js
   └── templates/
       ├── KS-2.xlsx
       └── KS-3.xlsx

   Экспорт XLSX:
   - загружает настоящий XLSX-шаблон;
   - не создаёт книгу с нуля;
   - заполняет найденные/настроенные ячейки;
   - сохраняет результат отдельным файлом.

   ============================================================ */


/* ============================================================
   КОНФИГУРАЦИЯ
   ============================================================ */

const STORAGE_KEY = 'jembalance_db_v2';

const TEMPLATE_PATHS = {
  ks2: './templates/KS-2.xlsx',
  ks3: './templates/KS-3.xlsx'
};

/*
  Основной блок настройки XLSX.

  Координаты здесь используются как fallback.
  Перед записью программа также пытается найти подписи
  непосредственно в листе шаблона.

  Для КС-2 зоны строк работ вынесены отдельно.
*/
const TEMPLATE_MAP = {
  ks2: {
    sheetIndex: 0,

    cells: {
      docNum: ['K13', 'L13', 'M13'],
      docDate: ['N13', 'O13', 'P13'],

      investor: ['A16', 'B16', 'C16'],
      customer: ['A18', 'B18', 'C18'],
      contractor: ['A20', 'B20', 'C20'],

      object: ['A23', 'B23', 'C23'],

      contractNum: ['K18', 'L18', 'M18'],
      contractDate: ['N18', 'O18', 'P18'],

      dateFrom: ['K20', 'L20'],
      dateTo: ['N20', 'O20'],

      totalBase: ['N45', 'O45', 'P45'],
      vat: ['N46', 'O46', 'P46'],
      totalGross: ['N47', 'O47', 'P47']
    },

    /*
      Строки таблицы работ.

      Эти строки соответствуют той структуре КС-2,
      которую мы ранее обсуждали: первая часть таблицы и
      продолжение на второй странице.

      При необходимости сюда просто добавляются номера строк.
    */
    workRows: [
      29, 30, 31,
      42, 43, 44
    ],

    /*
      Колонки строки КС-2.

      name — наименование;
      unit — единица;
      qty — количество;
      price — цена;
      sum — стоимость.
    */
    workColumns: {
      number: 'A',
      name: 'B',
      unit: 'J',
      qty: 'K',
      price: 'M',
      sum: 'O'
    }
  },

  ks3: {
    sheetIndex: 0,

    cells: {
      docNum: ['K13', 'L13', 'M13'],
      docDate: ['N13', 'O13', 'P13'],

      investor: ['A16', 'B16', 'C16'],
      customer: ['A18', 'B18', 'C18'],
      contractor: ['A20', 'B20', 'C20'],

      object: ['A22', 'B22', 'C22'],

      contractNum: ['K18', 'L18', 'M18'],
      contractDate: ['N18', 'O18', 'P18'],

      period: ['K20', 'L20', 'M20'],

      totalBase: ['M48', 'N48', 'O48'],
      vat: ['M49', 'N49', 'O49'],
      totalGross: ['M50', 'N50', 'O50']
    },

    /*
      Таблица КС-3.
      Ранее мы уже определили диапазон примерно 25–47.
    */
    workRows: Array.from(
      { length: 23 },
      (_, i) => 25 + i
    ),

    workColumns: {
      number: 'A',
      title: 'B',
      base: 'L',
      vat: 'N',
      gross: 'P'
    }
  }
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


function safeString(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}


function num(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value)
    .replace(/\s+/g, '')
    .replace(',', '.');

  const result = Number(normalized);

  return Number.isFinite(result) ? result : 0;
}


function roundMoney(value) {
  return Math.round((num(value) + Number.EPSILON) * 100) / 100;
}


function fmtMoney(value) {
  return (
    roundMoney(value).toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' ₽'
  );
}


function fmtMoneyPlain(value) {
  return roundMoney(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}


function fmtDate(iso) {
  if (!iso) return '—';

  const parts = String(iso).split('-');

  if (parts.length !== 3) return String(iso);

  const [y, m, d] = parts;

  return `${d}.${m}.${y}`;
}


function isoDateToExcelDate(iso) {
  if (!iso) return '';

  const parts = String(iso).split('-');

  if (parts.length !== 3) {
    return iso;
  }

  const [year, month, day] = parts.map(Number);

  if (!year || !month || !day) {
    return iso;
  }

  /*
    В XLSX можно записать Date.
    SheetJS сам сформирует числовое значение даты.
  */
  return new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0
  );
}


function escapeHtml(value) {
  return safeString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


function escapeXml(value) {
  return safeString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}


function normalizeSearch(value) {
  return safeString(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}


function deepClone(obj) {
  if (
    typeof structuredClone === 'function'
  ) {
    try {
      return structuredClone(obj);
    } catch (_) {
      /* fallback ниже */
    }
  }

  return JSON.parse(JSON.stringify(obj));
}


/* ============================================================
   LOCAL STORAGE
   ============================================================ */

function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      /*
        Миграция со старой версии, если пользователь уже
        работал с предыдущим генератором.
      */
      const legacyRaw =
        localStorage.getItem('jembalance_db_v1');

      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);

        DB.contractors =
          Array.isArray(legacy.contractors)
            ? legacy.contractors
            : [];

        DB.customers =
          Array.isArray(legacy.customers)
            ? legacy.customers
            : [];

        DB.archive =
          Array.isArray(legacy.archive)
            ? legacy.archive
            : [];

        saveDB();
      }

      return;
    }

    const parsed = JSON.parse(raw);

    DB.contractors =
      Array.isArray(parsed.contractors)
        ? parsed.contractors
        : [];

    DB.customers =
      Array.isArray(parsed.customers)
        ? parsed.customers
        : [];

    DB.archive =
      Array.isArray(parsed.archive)
        ? parsed.archive
        : [];

  } catch (error) {
    console.warn(
      'Не удалось загрузить базу:',
      error
    );
  }
}


function saveDB() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(DB)
    );
  } catch (error) {
    toast(
      'Ошибка сохранения базы: ' +
        error.message,
      'err'
    );
  }
}


/* ============================================================
   ТОСТЫ
   ============================================================ */

function toast(text, kind = '') {
  const stack =
    document.getElementById('toast-stack');

  if (!stack) return;

  const element =
    document.createElement('div');

  element.className =
    'toast ' + kind;

  element.textContent = text;

  stack.appendChild(element);

  window.setTimeout(() => {
    element.style.transition =
      'opacity .3s, transform .3s';

    element.style.opacity = '0';
    element.style.transform =
      'translateX(20px)';

    window.setTimeout(
      () => element.remove(),
      320
    );
  }, 3200);
}


/* ============================================================
   МОДАЛЬНЫЕ ОКНА
   ============================================================ */

function openModal(id) {
  const modal =
    document.getElementById(id);

  if (!modal) return;

  modal.classList.add('active');
}


function closeModal(id) {
  const modal =
    document.getElementById(id);

  if (!modal) return;

  modal.classList.remove('active');
}


function confirmDialog(
  title,
  text,
  onOk
) {
  const titleEl =
    document.getElementById(
      'confirm-title'
    );

  const textEl =
    document.getElementById(
      'confirm-text'
    );

  const oldButton =
    document.getElementById(
      'confirm-ok-btn'
    );

  if (
    !titleEl ||
    !textEl ||
    !oldButton
  ) {
    return;
  }

  titleEl.textContent = title;
  textEl.textContent = text;

  const newButton =
    oldButton.cloneNode(true);

  oldButton.parentNode.replaceChild(
    newButton,
    oldButton
  );

  newButton.addEventListener(
    'click',
    () => {
      closeModal(
        'modal-confirm'
      );

      onOk();
    }
  );

  openModal('modal-confirm');
}


/* ============================================================
   НАВИГАЦИЯ
   ============================================================ */

function switchTab(name) {
  document
    .querySelectorAll('.tab')
    .forEach((tab) => {
      tab.classList.remove('active');
    });

  document
    .querySelectorAll('.view')
    .forEach((view) => {
      view.classList.remove('active');
    });

  const tab =
    document.getElementById(
      'tab-' + name
    );

  const view =
    document.getElementById(
      'view-' + name
    );

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
  if (
    type !== 'ks2' &&
    type !== 'ks3'
  ) {
    return;
  }

  currentDoc.type = type;

  const ks2 =
    document.getElementById(
      'dtype-ks2'
    );

  const ks3 =
    document.getElementById(
      'dtype-ks3'
    );

  const works =
    document.getElementById(
      'section-works'
    );

  const link =
    document.getElementById(
      'section-ks2-link'
    );

  if (ks2) {
    ks2.classList.toggle(
      'active',
      type === 'ks2'
    );
  }

  if (ks3) {
    ks3.classList.toggle(
      'active',
      type === 'ks3'
    );
  }

  if (works) {
    works.classList.toggle(
      'hidden',
      type === 'ks3'
    );
  }

  if (link) {
    link.classList.toggle(
      'hidden',
      type === 'ks2'
    );
  }

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
  const fieldIds = [
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

  fieldIds.forEach((field) => {
    const input =
      document.getElementById(
        'mc-' + field
      );

    if (input) {
      input.value = '';
    }
  });

  document.getElementById(
    'mc-id'
  ).value = '';

  document.getElementById(
    'modal-contractor-title'
  ).textContent =
    'Новый подрядчик';

  if (id) {
    const c =
      DB.contractors.find(
        (item) => item.id === id
      );

    if (c) {
      document.getElementById(
        'mc-id'
      ).value = c.id;

      document.getElementById(
        'mc-name'
      ).value = c.name || '';

      document.getElementById(
        'mc-inn'
      ).value = c.inn || '';

      document.getElementById(
        'mc-kpp'
      ).value = c.kpp || '';

      document.getElementById(
        'mc-ogrn'
      ).value = c.ogrn || '';

      document.getElementById(
        'mc-okpo'
      ).value = c.okpo || '';

      document.getElementById(
        'mc-addr'
      ).value = c.addr || '';

      document.getElementById(
        'mc-boss-pos'
      ).value =
        c.bossPos || '';

      document.getElementById(
        'mc-boss-name'
      ).value =
        c.bossName || '';

      document.getElementById(
        'mc-phone'
      ).value =
        c.phone || '';

      document.getElementById(
        'mc-email'
      ).value =
        c.email || '';

      document.getElementById(
        'mc-rs'
      ).value =
        c.rs || '';

      document.getElementById(
        'mc-bank'
      ).value =
        c.bank || '';

      document.getElementById(
        'mc-bik'
      ).value =
        c.bik || '';

      document.getElementById(
        'mc-ks'
      ).value =
        c.ks || '';

      document.getElementById(
        'modal-contractor-title'
      ).textContent =
        'Редактирование: ' +
        c.name;
    }
  }

  openModal(
    'modal-contractor'
  );
}


function saveContractor() {
  const name =
    document
      .getElementById('mc-name')
      .value
      .trim();

  const inn =
    document
      .getElementById('mc-inn')
      .value
      .trim();

  if (!name) {
    return toast(
      'Укажите наименование',
      'err'
    );
  }

  if (!inn) {
    return toast(
      'Укажите ИНН',
      'err'
    );
  }

  const id =
    document.getElementById(
      'mc-id'
    ).value;

  const data = {
    id: id || uid(),
    name,
    inn,

    kpp:
      document
        .getElementById('mc-kpp')
        .value
        .trim(),

    ogrn:
      document
        .getElementById('mc-ogrn')
        .value
        .trim(),

    okpo:
      document
        .getElementById('mc-okpo')
        .value
        .trim(),

    addr:
      document
        .getElementById('mc-addr')
        .value
        .trim(),

    bossPos:
      document
        .getElementById(
          'mc-boss-pos'
        )
        .value
        .trim(),

    bossName:
      document
        .getElementById(
          'mc-boss-name'
        )
        .value
        .trim(),

    phone:
      document
        .getElementById('mc-phone')
        .value
        .trim(),

    email:
      document
        .getElementById('mc-email')
        .value
        .trim(),

    rs:
      document
        .getElementById('mc-rs')
        .value
        .trim(),

    bank:
      document
        .getElementById('mc-bank')
        .value
        .trim(),

    bik:
      document
        .getElementById('mc-bik')
        .value
        .trim(),

    ks:
      document
        .getElementById('mc-ks')
        .value
        .trim()
  };

  if (id) {
    const index =
      DB.contractors.findIndex(
        (item) => item.id === id
      );

    if (index >= 0) {
      DB.contractors[index] =
        data;
    }
  } else {
    DB.contractors.push(data);
  }

  saveDB();

  closeModal(
    'modal-contractor'
  );

  renderContractors();
  refreshContractorSelect();
  renderPreview();

  toast(
    'Подрядчик сохранён',
    'ok'
  );
}


function deleteContractor(id) {
  const contractor =
    DB.contractors.find(
      (item) => item.id === id
    );

  if (!contractor) return;

  confirmDialog(
    'Удалить подрядчика?',
    `Подрядчик «${contractor.name}» будет удалён. Сохранённые документы останутся в архиве.`,
    () => {
      DB.contractors =
        DB.contractors.filter(
          (item) =>
            item.id !== id
        );

      saveDB();
      renderContractors();
      refreshContractorSelect();
      renderPreview();

      toast(
        'Подрядчик удалён',
        'ok'
      );
    }
  );
}


function renderContractors() {
  const search =
    document.getElementById(
      'search-contractors'
    );

  const query =
    normalizeSearch(
      search ? search.value : ''
    );

  const list =
    DB.contractors.filter(
      (contractor) => {
        if (!query) return true;

        const blob =
          normalizeSearch(
            [
              contractor.name,
              contractor.inn,
              contractor.kpp,
              contractor.bossName,
              contractor.addr
            ].join(' ')
          );

        return blob.includes(
          query
        );
      }
    );

  const badge =
    document.getElementById(
      'badge-contractors'
    );

  if (badge) {
    badge.textContent =
      DB.contractors.length;
  }

  const tbody =
    document.getElementById(
      'contractors-tbody'
    );

  if (!tbody) return;

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
                  ? 'Попробуйте изменить поисковый запрос'
                  : 'Добавьте первого подрядчика, чтобы формировать документы'
              }
            </div>

            ${
              query
                ? ''
                : `
                  <button
                    class="btn btn-primary btn-sm"
                    type="button"
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

  tbody.innerHTML =
    list
      .map(
        (c) => `
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
                  ? ' / ' +
                    escapeHtml(c.kpp)
                  : ''
              }
            </td>

            <td>
              ${
                escapeHtml(
                  c.bossName || '—'
                )
              }

              <div class="cell-muted">
                ${escapeHtml(
                  c.bossPos || ''
                )}
              </div>
            </td>

            <td>
              ${escapeHtml(
                c.phone || '—'
              )}

              <div class="cell-muted">
                ${escapeHtml(
                  c.email || ''
                )}
              </div>
            </td>

            <td class="cell-actions">

              <button
                class="btn btn-ghost btn-sm"
                type="button"
                onclick="openContractorModal('${c.id}')"
                title="Редактировать"
              >
                <svg class="icon" viewBox="0 0 16 16">
                  <path d="M11 2l3 3-8 8H3v-3l8-8z"/>
                </svg>
              </button>

              <button
                class="btn btn-ghost btn-sm"
                type="button"
                onclick="deleteContractor('${c.id}')"
                title="Удалить"
              >
                <svg class="icon" viewBox="0 0 16 16">
                  <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/>
                </svg>
              </button>

            </td>
          </tr>
        `
      )
      .join('');
}


function refreshContractorSelect() {
  const select =
    document.getElementById(
      'f-contractor'
    );

  if (!select) return;

  const previous =
    select.value;

  select.innerHTML =
    '<option value="">— выберите из базы —</option>' +
    DB.contractors
      .map(
        (c) =>
          `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} (ИНН ${escapeHtml(c.inn)})</option>`
      )
      .join('');

  if (
    DB.contractors.some(
      (item) =>
        item.id === previous
    )
  ) {
    select.value = previous;
  }
}


/* ============================================================
   ЗАКАЗЧИКИ
   ============================================================ */

function openCustomerModal(id) {
  const fieldIds = [
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

  fieldIds.forEach(
    (field) => {
      const input =
        document.getElementById(
          'mcu-' + field
        );

      if (input) {
        input.value = '';
      }
    }
  );

  document.getElementById(
    'mcu-id'
  ).value = '';

  document.getElementById(
    'modal-customer-title'
  ).textContent =
    'Новый заказчик';

  if (id) {
    const c =
      DB.customers.find(
        (item) => item.id === id
      );

    if (c) {
      document.getElementById(
        'mcu-id'
      ).value = c.id;

      document.getElementById(
        'mcu-name'
      ).value = c.name || '';

      document.getElementById(
        'mcu-inn'
      ).value = c.inn || '';

      document.getElementById(
        'mcu-kpp'
      ).value = c.kpp || '';

      document.getElementById(
        'mcu-ogrn'
      ).value = c.ogrn || '';

      document.getElementById(
        'mcu-okpo'
      ).value = c.okpo || '';

      document.getElementById(
        'mcu-addr'
      ).value = c.addr || '';

      document.getElementById(
        'mcu-boss-pos'
      ).value =
        c.bossPos || '';

      document.getElementById(
        'mcu-boss-name'
      ).value =
        c.bossName || '';

      document.getElementById(
        'mcu-phone'
      ).value =
        c.phone || '';

      document.getElementById(
        'mcu-email'
      ).value =
        c.email || '';

      document.getElementById(
        'modal-customer-title'
      ).textContent =
        'Редактирование: ' +
        c.name;
    }
  }

  openModal('modal-customer');
}


function saveCustomer() {
  const name =
    document
      .getElementById('mcu-name')
      .value
      .trim();

  const inn =
    document
      .getElementById('mcu-inn')
      .value
      .trim();

  if (!name) {
    return toast(
      'Укажите наименование',
      'err'
    );
  }

  if (!inn) {
    return toast(
      'Укажите ИНН',
      'err'
    );
  }

  const id =
    document.getElementById(
      'mcu-id'
    ).value;

  const data = {
    id: id || uid(),

    name,
    inn,

    kpp:
      document
        .getElementById('mcu-kpp')
        .value
        .trim(),

    ogrn:
      document
        .getElementById('mcu-ogrn')
        .value
        .trim(),

    okpo:
      document
        .getElementById('mcu-okpo')
        .value
        .trim(),

    addr:
      document
        .getElementById('mcu-addr')
        .value
        .trim(),

    bossPos:
      document
        .getElementById(
          'mcu-boss-pos'
        )
        .value
        .trim(),

    bossName:
      document
        .getElementById(
          'mcu-boss-name'
        )
        .value
        .trim(),

    phone:
      document
        .getElementById(
          'mcu-phone'
        )
        .value
        .trim(),

    email:
      document
        .getElementById(
          'mcu-email'
        )
        .value
        .trim()
  };

  if (id) {
    const index =
      DB.customers.findIndex(
        (item) => item.id === id
      );

    if (index >= 0) {
      DB.customers[index] =
        data;
    }
  } else {
    DB.customers.push(data);
  }

  saveDB();

  closeModal(
    'modal-customer'
  );

  renderCustomers();
  refreshCustomerSelect();
  renderPreview();

  toast(
    'Заказчик сохранён',
    'ok'
  );
}


function deleteCustomer(id) {
  const customer =
    DB.customers.find(
      (item) => item.id === id
    );

  if (!customer) return;

  confirmDialog(
    'Удалить заказчика?',
    `Заказчик «${customer.name}» будет удалён. Сохранённые документы останутся в архиве.`,
    () => {
      DB.customers =
        DB.customers.filter(
          (item) =>
            item.id !== id
        );

      saveDB();
      renderCustomers();
      refreshCustomerSelect();
      renderPreview();

      toast(
        'Заказчик удалён',
        'ok'
      );
    }
  );
}


function renderCustomers() {
  const search =
    document.getElementById(
      'search-customers'
    );

  const query =
    normalizeSearch(
      search ? search.value : ''
    );

  const list =
    DB.customers.filter(
      (customer) => {
        if (!query) return true;

        const blob =
          normalizeSearch(
            [
              customer.name,
              customer.inn,
              customer.kpp,
              customer.bossName,
              customer.addr
            ].join(' ')
          );

        return blob.includes(
          query
        );
      }
    );

  const badge =
    document.getElementById(
      'badge-customers'
    );

  if (badge) {
    badge.textContent =
      DB.customers.length;
  }

  const tbody =
    document.getElementById(
      'customers-tbody'
    );

  if (!tbody) return;

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
                  ? 'Попробуйте изменить поисковый запрос'
                  : 'Добавьте первого заказчика для формирования документов'
              }
            </div>

            ${
              query
                ? ''
                : `
                  <button
                    class="btn btn-primary btn-sm"
                    type="button"
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

  tbody.innerHTML =
    list
      .map(
        (c) => `
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
                  ? ' / ' +
                    escapeHtml(c.kpp)
                  : ''
              }
            </td>

            <td>
              ${escapeHtml(
                c.bossName || '—'
              )}

              <div class="cell-muted">
                ${escapeHtml(
                  c.bossPos || ''
                )}
              </div>
            </td>

            <td>
              ${escapeHtml(
                c.phone || '—'
              )}

              <div class="cell-muted">
                ${escapeHtml(
                  c.email || ''
                )}
              </div>
            </td>

            <td class="cell-actions">

              <button
                class="btn btn-ghost btn-sm"
                type="button"
                onclick="openCustomerModal('${c.id}')"
                title="Редактировать"
              >
                <svg class="icon" viewBox="0 0 16 16">
                  <path d="M11 2l3 3-8 8H3v-3l8-8z"/>
                </svg>
              </button>

              <button
                class="btn btn-ghost btn-sm"
                type="button"
                onclick="deleteCustomer('${c.id}')"
                title="Удалить"
              >
                <svg class="icon" viewBox="0 0 16 16">
                  <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/>
                </svg>
              </button>

            </td>

          </tr>
        `
      )
      .join('');
}


function refreshCustomerSelect() {
  const select =
    document.getElementById(
      'f-customer'
    );

  if (!select) return;

  const previous =
    select.value;

  select.innerHTML =
    '<option value="">— выберите из базы —</option>' +
    DB.customers
      .map(
        (c) =>
          `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} (ИНН ${escapeHtml(c.inn)})</option>`
      )
      .join('');

  if (
    DB.customers.some(
      (item) =>
        item.id === previous
    )
  ) {
    select.value = previous;
  }
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
  const row = {
    name: '',
    unit: '',
    qty: '',
    price: '',
    ...(data || {}),
    uid: uid()
  };

  currentDoc.rows.push(row);

  renderWorkRows();
  renderTotals();
  renderPreview();
}


function deleteWorkRow(rowUid) {
  currentDoc.rows =
    currentDoc.rows.filter(
      (row) =>
        row.uid !== rowUid
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
  const row =
    currentDoc.rows.find(
      (item) =>
        item.uid === rowUid
    );

  if (!row) return;

  row[field] = value;

  renderTotals();
  renderPreview();

  /*
    Сумму строки показываем сразу,
    не перестраивая все input.
  */
  const amountCell =
    document.querySelector(
      `[data-work-sum="${CSS.escape(rowUid)}"]`
    );

  if (amountCell) {
    amountCell.textContent =
      fmtMoneyPlain(
        num(row.qty) *
        num(row.price)
      );
  }
}


function renderWorkRows() {
  const tbody =
    document.getElementById(
      'works-tbody'
    );

  if (!tbody) return;

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
          Нет строк. Нажмите «Добавить строку»
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    currentDoc.rows
      .map(
        (row, index) => {
          const amount =
            roundMoney(
              num(row.qty) *
              num(row.price)
            );

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
                  oninput="updateWorkRow('${row.uid}','name',this.value)"
                  placeholder="Наименование работ"
                >
              </td>

              <td>
                <input
                  class="input"
                  type="text"
                  value="${escapeHtml(row.unit)}"
                  oninput="updateWorkRow('${row.uid}','unit',this.value)"
                  placeholder="м²"
                >
              </td>

              <td>
                <input
                  class="input"
                  type="number"
                  step="0.001"
                  value="${escapeHtml(row.qty)}"
                  oninput="updateWorkRow('${row.uid}','qty',this.value)"
                  placeholder="0"
                >
              </td>

              <td>
                <input
                  class="input"
                  type="number"
                  step="0.01"
                  value="${escapeHtml(row.price)}"
                  oninput="updateWorkRow('${row.uid}','price',this.value)"
                  placeholder="0,00"
                >
              </td>

              <td
                data-work-sum="${escapeHtml(row.uid)}"
                style="
                  text-align:right;
                  padding-top:12px;
                  font-size:12px;
                  font-family:var(--mono);
                "
              >
                ${fmtMoneyPlain(amount)}
              </td>

              <td class="col-del">

                <button
                  class="row-del-btn"
                  type="button"
                  onclick="deleteWorkRow('${row.uid}')"
                  title="Удалить строку"
                >
                  <svg class="icon" viewBox="0 0 16 16">
                    <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/>
                  </svg>
                </button>

              </td>

            </tr>
          `;
        }
      )
      .join('');
}


/* ============================================================
   НДС
   ============================================================ */

function onVatRateChange() {
  const select =
    document.getElementById(
      'f-vat-rate'
    );

  const custom =
    document.getElementById(
      'vat-custom-field'
    );

  if (!select || !custom) return;

  custom.classList.toggle(
    'hidden',
    select.value !== 'custom'
  );

  renderTotals();
  renderPreview();
}


function getVatRate() {
  const select =
    document.getElementById(
      'f-vat-rate'
    );

  if (!select) {
    return 20;
  }

  const value =
    select.value;

  if (value === 'none') {
    return null;
  }

  if (value === 'custom') {
    const custom =
      document.getElementById(
        'f-vat-custom'
      );

    const rate =
      custom
        ? num(custom.value)
        : 0;

    return rate;
  }

  return num(value);
}


/* ============================================================
   ИТОГИ
   ============================================================ */

function calcDocBase() {
  if (
    currentDoc.type === 'ks2'
  ) {
    return roundMoney(
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

  /*
    Для КС-3 используем стоимость БЕЗ НДС
    связанных КС-2.
  */
  return roundMoney(
    currentDoc.linkedKs2Ids.reduce(
      (total, id) => {
        const doc =
          DB.archive.find(
            (item) =>
              item.id === id
          );

        if (!doc) {
          return total;
        }

        return (
          total +
          num(
            doc.totals &&
              doc.totals.base
          )
        );
      },
      0
    )
  );
}


function calcTotals() {
  const base =
    calcDocBase();

  const rate =
    getVatRate();

  const vat =
    rate === null
      ? 0
      : roundMoney(
          base *
            rate /
            100
        );

  const gross =
    roundMoney(
      base + vat
    );

  return {
    base,
    vatRate: rate,
    vat,
    gross
  };
}


function renderTotals() {
  const totals =
    calcTotals();

  const base =
    document.getElementById(
      'total-base'
    );

  const vat =
    document.getElementById(
      'total-vat'
    );

  const gross =
    document.getElementById(
      'total-gross'
    );

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
   КС-2 → КС-3
   ============================================================ */

function renderKs2PickList() {
  const container =
    document.getElementById(
      'ks2-pick-list'
    );

  if (!container) return;

  const list =
    DB.archive
      .filter(
        (doc) =>
          doc.type === 'ks2'
      )
      .sort((a, b) =>
        safeString(
          b.createdAt
        ).localeCompare(
          safeString(
            a.createdAt
          )
        )
      );

  if (!list.length) {
    container.innerHTML = `
      <div class="ks2-pick-empty">
        Нет сохранённых актов КС-2.
        Сначала создайте и сохраните КС-2.
      </div>
    `;

    return;
  }

  container.innerHTML =
    list
      .map(
        (doc) => {
          const checked =
            currentDoc
              .linkedKs2Ids
              .includes(doc.id);

          return `
            <label
              class="ks2-pick-item ${
                checked
                  ? 'checked'
                  : ''
              }"
            >

              <input
                type="checkbox"
                ${
                  checked
                    ? 'checked'
                    : ''
                }
                onchange="toggleKs2Link('${doc.id}', this.checked)"
              >

              <div class="ks2-pick-info">

                <div class="ks2-pick-title">
                  КС-2 №
                  ${escapeHtml(doc.num)}
                  от
                  ${fmtDate(doc.date)}
                </div>

                <div class="ks2-pick-meta">
                  ${escapeHtml(
                    doc.objectName ||
                    '—'
                  )}
                </div>

              </div>

              <div class="ks2-pick-sum">
                ${fmtMoneyPlain(
                  doc.totals
                    ? doc.totals.gross
                    : 0
                )}
              </div>

            </label>
          `;
        }
      )
      .join('');
}


function toggleKs2Link(
  id,
  enabled
) {
  if (enabled) {
    if (
      !currentDoc
        .linkedKs2Ids
        .includes(id)
    ) {
      currentDoc
        .linkedKs2Ids
        .push(id);
    }
  } else {
    currentDoc.linkedKs2Ids =
      currentDoc.linkedKs2Ids.filter(
        (item) =>
          item !== id
      );
  }

  renderKs2PickList();
  renderTotals();
  renderPreview();
}


/* ============================================================
   SNAPSHOT
   ============================================================ */

function getFormSnapshot() {
  const contractorId =
    document.getElementById(
      'f-contractor'
    )?.value || '';

  const customerId =
    document.getElementById(
      'f-customer'
    )?.value || '';

  const contractor =
    DB.contractors.find(
      (item) =>
        item.id === contractorId
    ) || null;

  const customer =
    DB.customers.find(
      (item) =>
        item.id === customerId
    ) || null;

  return {
    type:
      currentDoc.type,

    num:
      document
        .getElementById(
          'f-docnum'
        )
        ?.value
        .trim() || '',

    date:
      document.getElementById(
        'f-docdate'
      )?.value || '',

    period:
      document
        .getElementById(
          'f-period'
        )
        ?.value
        .trim() || '',

    dateFrom:
      document.getElementById(
        'f-date-from'
      )?.value || '',

    dateTo:
      document.getElementById(
        'f-date-to'
      )?.value || '',

    contractor:
      contractor
        ? deepClone(contractor)
        : null,

    customer:
      customer
        ? deepClone(customer)
        : null,

    investor:
      document
        .getElementById(
          'f-investor'
        )
        ?.value
        .trim() || '',

    contractNum:
      document
        .getElementById(
          'f-contract-num'
        )
        ?.value
        .trim() || '',

    contractDate:
      document.getElementById(
        'f-contract-date'
      )?.value || '',

    objectName:
      document
        .getElementById(
          'f-object'
        )
        ?.value
        .trim() || '',

    objectAddr:
      document
        .getElementById(
          'f-object-addr'
        )
        ?.value
        .trim() || '',

    rows:
      currentDoc.rows.map(
        (row) => ({
          name:
            row.name || '',

          unit:
            row.unit || '',

          qty:
            row.qty || '',

          price:
            row.price || ''
        })
      ),

    linkedKs2Ids:
      [
        ...currentDoc
          .linkedKs2Ids
      ],

    totals:
      calcTotals()
  };
}


/* ============================================================
   PREVIEW
   ============================================================ */

function renderPreview() {
  const container =
    document.getElementById(
      'preview-paper'
    );

  if (!container) return;

  const doc =
    getFormSnapshot();

  container.innerHTML =
    doc.type === 'ks2'
      ? buildKs2Preview(doc)
      : buildKs3Preview(doc);
}


function buildPartyBlock(
  label,
  party
) {
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
          ${escapeHtml(
            party.name
          )}
        </strong>
      </div>

      <div class="paper-value">
        ИНН
        ${escapeHtml(
          party.inn
        )}
        ${
          party.kpp
            ? ', КПП ' +
              escapeHtml(
                party.kpp
              )
            : ''
        }
      </div>

      ${
        party.addr
          ? `
            <div class="paper-value">
              ${escapeHtml(
                party.addr
              )}
            </div>
          `
          : ''
      }

      ${
        party.phone ||
        party.email
          ? `
            <div class="paper-value muted">
              ${escapeHtml(
                [
                  party.phone,
                  party.email
                ]
                  .filter(Boolean)
                  .join(' • ')
              )}
            </div>
          `
          : ''
      }

    </div>
  `;
}


function buildKs2Preview(doc) {
  const rows =
    doc.rows
      .map(
        (row, index) => {
          const qty =
            num(row.qty);

          const price =
            num(row.price);

          const amount =
            roundMoney(
              qty * price
            );

          return `
            <tr>
              <td>${index + 1}</td>

              <td>
                ${escapeHtml(
                  row.name || '—'
                )}
              </td>

              <td>
                ${escapeHtml(
                  row.unit || '—'
                )}
              </td>

              <td style="text-align:right;">
                ${
                  qty.toLocaleString(
                    'ru-RU'
                  )
                }
              </td>

              <td style="text-align:right;">
                ${fmtMoneyPlain(
                  price
                )}
              </td>

              <td style="text-align:right;">
                <strong>
                  ${fmtMoneyPlain(
                    amount
                  )}
                </strong>
              </td>
            </tr>
          `;
        }
      )
      .join('');

  const vatLine =
    doc.totals.vatRate === null
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
            (${doc.totals.vatRate} %):
          </td>

          <td style="text-align:right;">
            ${fmtMoneyPlain(
              doc.totals.vat
            )}
          </td>
        </tr>
      `;

  return `
    <div class="paper">

      <div class="paper-stamp">
        Унифицированная форма № КС-2
        · ОКУД 0322005
      </div>

      <h1 class="paper-title">
        Акт о приёмке выполненных работ
      </h1>

      <div class="paper-subtitle">
        №
        ${escapeHtml(
          doc.num || '___'
        )}
        от
        ${fmtDate(doc.date)}

        ${
          doc.period
            ? ' • Отчётный период: ' +
              escapeHtml(
                doc.period
              )
            : ''
        }
      </div>


      <div
        class="paper-grid cols-2"
        style="margin-top:14px;"
      >
        ${buildPartyBlock(
          'Подрядчик (исполнитель)',
          doc.contractor
        )}

        ${buildPartyBlock(
          'Заказчик',
          doc.customer
        )}
      </div>


      ${
        doc.investor
          ? `
            <div style="margin-top:10px;">
              <div class="paper-label">
                Инвестор
              </div>

              <div class="paper-value">
                ${escapeHtml(
                  doc.investor
                )}
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
              doc.contractNum
                ? '№ ' +
                  escapeHtml(
                    doc.contractNum
                  )
                : '—'
            }

            ${
              doc.contractDate
                ? ' от ' +
                  fmtDate(
                    doc.contractDate
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
            ${fmtDate(
              doc.dateFrom
            )}
          </div>
        </div>


        <div>
          <div class="paper-label">
            Дата окончания работ
          </div>

          <div class="paper-value">
            ${fmtDate(
              doc.dateTo
            )}
          </div>
        </div>

      </div>


      <div style="margin-top:10px;">

        <div class="paper-label">
          Объект
        </div>

        <div class="paper-value">
          <strong>
            ${escapeHtml(
              doc.objectName ||
              '—'
            )}
          </strong>
        </div>

        ${
          doc.objectAddr
            ? `
              <div class="paper-value muted">
                ${escapeHtml(
                  doc.objectAddr
                )}
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
              ${fmtMoneyPlain(
                doc.totals.base
              )}
            </td>
          </tr>

          ${vatLine}

          <tr
            style="
              font-weight:700;
              background:#f5f0e8;
            "
          >
            <td
              colspan="5"
              style="text-align:right;"
            >
              ВСЕГО к оплате:
            </td>

            <td style="text-align:right;">
              ${fmtMoneyPlain(
                doc.totals.gross
              )} ₽
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
            ${escapeHtml(
              doc.contractor?.bossPos ||
              'Руководитель'
            )}
            /
            ${escapeHtml(
              doc.contractor?.bossName ||
              '_________________'
            )}
          </div>

        </div>


        <div class="paper-sign">

          <div class="paper-label">
            Принял (заказчик)
          </div>

          <div class="paper-sign-line"></div>

          <div class="paper-value">
            ${escapeHtml(
              doc.customer?.bossPos ||
              'Руководитель'
            )}
            /
            ${escapeHtml(
              doc.customer?.bossName ||
              '_________________'
            )}
          </div>

        </div>

      </div>

    </div>
  `;
}


function buildKs3Preview(doc) {
  const linked =
    doc.linkedKs2Ids
      .map(
        (id) =>
          DB.archive.find(
            (item) =>
              item.id === id
          )
      )
      .filter(Boolean);

  const rows =
    linked.length
      ? linked
          .map(
            (source, index) => `
              <tr>

                <td>
                  ${index + 1}
                </td>

                <td>
                  КС-2 №
                  ${escapeHtml(
                    source.num
                  )}
                  от
                  ${fmtDate(
                    source.date
                  )}
                </td>

                <td>
                  ${escapeHtml(
                    source.objectName ||
                    '—'
                  )}
                </td>

                <td style="text-align:right;">
                  ${fmtMoneyPlain(
                    source.totals?.base ||
                    0
                  )}
                </td>

                <td style="text-align:right;">
                  ${
                    source.totals
                      ?.vatRate === null
                      ? 'без НДС'
                      : fmtMoneyPlain(
                          source.totals
                            ?.vat || 0
                        )
                  }
                </td>

                <td style="text-align:right;">
                  <strong>
                    ${fmtMoneyPlain(
                      source.totals
                        ?.gross || 0
                    )}
                  </strong>
                </td>

              </tr>
            `
          )
          .join('')
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

  const vatLine =
    doc.totals.vatRate === null
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
            (${doc.totals.vatRate} %):
          </td>

          <td style="text-align:right;">
            ${fmtMoneyPlain(
              doc.totals.vat
            )}
          </td>
        </tr>
      `;

  return `
    <div class="paper">

      <div class="paper-stamp">
        Унифицированная форма № КС-3
        · ОКУД 0322001
      </div>

      <h1 class="paper-title">
        Справка о стоимости выполненных работ и затрат
      </h1>

      <div class="paper-subtitle">
        №
        ${escapeHtml(
          doc.num || '___'
        )}
        от
        ${fmtDate(doc.date)}

        ${
          doc.period
            ? ' • Отчётный период: ' +
              escapeHtml(
                doc.period
              )
            : ''
        }
      </div>


      <div
        class="paper-grid cols-2"
        style="margin-top:14px;"
      >
        ${buildPartyBlock(
          'Подрядчик (исполнитель)',
          doc.contractor
        )}

        ${buildPartyBlock(
          'Заказчик',
          doc.customer
        )}
      </div>


      ${
        doc.investor
          ? `
            <div style="margin-top:10px;">
              <div class="paper-label">
                Инвестор
              </div>

              <div class="paper-value">
                ${escapeHtml(
                  doc.investor
                )}
              </div>
            </div>
          `
          : ''
      }


      <div
        class="paper-grid cols-2"
        style="margin-top:12px;"
      >

        <div>
          <div class="paper-label">
            Договор подряда
          </div>

          <div class="paper-value">
            ${
              doc.contractNum
                ? '№ ' +
                  escapeHtml(
                    doc.contractNum
                  )
                : '—'
            }

            ${
              doc.contractDate
                ? ' от ' +
                  fmtDate(
                    doc.contractDate
                  )
                : ''
            }
          </div>
        </div>


        <div>
          <div class="paper-label">
            Объект
          </div>

          <div class="paper-value">
            ${escapeHtml(
              doc.objectName ||
              '—'
            )}
          </div>
        </div>

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
              Акт КС-2
            </th>

            <th>
              Объект
            </th>

            <th
              style="
                width:100px;
                text-align:right;
              "
            >
              Без НДС, ₽
            </th>

            <th
              style="
                width:100px;
                text-align:right;
              "
            >
              НДС, ₽
            </th>

            <th
              style="
                width:110px;
                text-align:right;
              "
            >
              С НДС, ₽
            </th>

          </tr>
        </thead>

        <tbody>
          ${rows}
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
              ${fmtMoneyPlain(
                doc.totals.base
              )}
            </td>
          </tr>

          ${vatLine}

          <tr
            style="
              font-weight:700;
              background:#f5f0e8;
            "
          >
            <td
              colspan="5"
              style="text-align:right;"
            >
              ВСЕГО к оплате:
            </td>

            <td style="text-align:right;">
              ${fmtMoneyPlain(
                doc.totals.gross
              )} ₽
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
            ${escapeHtml(
              doc.contractor?.bossPos ||
              'Руководитель'
            )}
            /
            ${escapeHtml(
              doc.contractor?.bossName ||
              '_________________'
            )}
          </div>

        </div>


        <div class="paper-sign">

          <div class="paper-label">
            Принял (заказчик)
          </div>

          <div class="paper-sign-line"></div>

          <div class="paper-value">
            ${escapeHtml(
              doc.customer?.bossPos ||
              'Руководитель'
            )}
            /
            ${escapeHtml(
              doc.customer?.bossName ||
              '_________________'
            )}
          </div>

        </div>

      </div>

    </div>
  `;
}


/* ============================================================
   ВАЛИДАЦИЯ ДОКУМЕНТА
   ============================================================ */

function validateDocument(
  doc,
  options = {}
) {
  const {
    requireRows = true
  } = options;

  if (!doc.num) {
    toast(
      'Укажите номер документа',
      'err'
    );
    return false;
  }

  if (!doc.date) {
    toast(
      'Укажите дату документа',
      'err'
    );
    return false;
  }

  if (!doc.contractor) {
    toast(
      'Выберите подрядчика',
      'err'
    );
    return false;
  }

  if (!doc.customer) {
    toast(
      'Выберите заказчика',
      'err'
    );
    return false;
  }

  if (!doc.objectName) {
    toast(
      'Укажите наименование объекта',
      'err'
    );
    return false;
  }

  if (
    requireRows &&
    doc.type === 'ks2' &&
    !doc.rows.length
  ) {
    toast(
      'Добавьте хотя бы одну строку работ',
      'err'
    );
    return false;
  }

  if (
    requireRows &&
    doc.type === 'ks3' &&
    !doc.linkedKs2Ids.length
  ) {
    toast(
      'Выберите хотя бы один акт КС-2',
      'err'
    );
    return false;
  }

  return true;
}


/* ============================================================
   СОХРАНЕНИЕ
   ============================================================ */

function saveDocument() {
  const doc =
    getFormSnapshot();

  if (
    !validateDocument(doc)
  ) {
    return;
  }

  const existing =
    currentDoc.id
      ? DB.archive.find(
          (item) =>
            item.id ===
            currentDoc.id
        )
      : null;

  const record = {
    id:
      currentDoc.id ||
      uid(),

    createdAt:
      existing?.createdAt ||
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString(),

    ...doc
  };

  if (currentDoc.id) {
    const index =
      DB.archive.findIndex(
        (item) =>
          item.id ===
          currentDoc.id
      );

    if (index >= 0) {
      DB.archive[index] =
        record;
    } else {
      DB.archive.push(
        record
      );
    }

    toast(
      'Документ обновлён',
      'ok'
    );
  } else {
    DB.archive.push(record);

    currentDoc.id =
      record.id;

    toast(
      'Документ сохранён в архив',
      'ok'
    );
  }

  saveDB();
  renderArchive();

  if (
    currentDoc.type === 'ks3'
  ) {
    renderKs2PickList();
  }
}


/* ============================================================
   АРХИВ
   ============================================================ */

function renderArchive() {
  const search =
    document.getElementById(
      'search-archive'
    );

  const filter =
    document.getElementById(
      'filter-archive-type'
    );

  const query =
    normalizeSearch(
      search ? search.value : ''
    );

  const filterType =
    filter ? filter.value : '';

  let list =
    DB.archive
      .slice()
      .sort((a, b) =>
        safeString(
          b.updatedAt ||
          b.createdAt
        ).localeCompare(
          safeString(
            a.updatedAt ||
            a.createdAt
          )
        )
      );

  if (filterType) {
    list =
      list.filter(
        (doc) =>
          doc.type === filterType
      );
  }

  if (query) {
    list =
      list.filter(
        (doc) => {
          const blob =
            normalizeSearch(
              [
                doc.num,
                doc.objectName,
                doc.objectAddr,
                doc.contractor?.name,
                doc.customer?.name
              ].join(' ')
            );

          return blob.includes(
            query
          );
        }
      );
  }

  const badge =
    document.getElementById(
      'badge-archive'
    );

  if (badge) {
    badge.textContent =
      DB.archive.length;
  }

  const tbody =
    document.getElementById(
      'archive-tbody'
    );

  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">

            <div class="empty-state-title">
              ${
                query ||
                filterType
                  ? 'Ничего не найдено'
                  : 'Архив пуст'
              }
            </div>

            <div class="empty-state-text">
              ${
                query ||
                filterType
                  ? 'Измените параметры поиска'
                  : 'Сохранённые документы появятся здесь автоматически'
              }
            </div>

          </div>
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    list
      .map(
        (doc) => `
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
              ${escapeHtml(
                doc.contractor?.name ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                doc.customer?.name ||
                '—'
              )}
            </td>

            <td>
              ${escapeHtml(
                doc.objectName ||
                '—'
              )}

              <div class="cell-muted">
                ${escapeHtml(
                  doc.objectAddr ||
                  ''
                )}
              </div>
            </td>

            <td class="text-right mono">
              ${fmtMoneyPlain(
                doc.totals?.gross ||
                0
              )} ₽
            </td>

            <td class="cell-actions">

              <button
                class="btn btn-ghost btn-sm"
                type="button"
                onclick="loadFromArchive('${doc.id}')"
                title="Открыть"
              >
                <svg class="icon" viewBox="0 0 16 16">
                  <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z"/>
                  <circle cx="8" cy="8" r="2"/>
                </svg>
              </button>


              <button
                class="btn btn-ghost btn-sm"
                type="button"
                onclick="exportXLSXById('${doc.id}')"
                title="Скачать XLSX"
              >
                <svg class="icon" viewBox="0 0 16 16">
                  <path d="M2 10v4h12v-4M8 2v8M5 7l3 3 3-3"/>
                </svg>
              </button>


              <button
                class="btn btn-ghost btn-sm"
                type="button"
                onclick="deleteArchive('${doc.id}')"
                title="Удалить"
              >
                <svg class="icon" viewBox="0 0 16 16">
                  <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/>
                </svg>
              </button>

            </td>

          </tr>
        `
      )
      .join('');
}


function loadFromArchive(id) {
  const doc =
    DB.archive.find(
      (item) =>
        item.id === id
    );

  if (!doc) return;

  currentDoc.id =
    doc.id;

  currentDoc.type =
    doc.type;

  currentDoc.rows =
    (doc.rows || []).map(
      (row) => ({
        ...row,
        uid: uid()
      })
    );

  currentDoc.linkedKs2Ids =
    [
      ...(doc.linkedKs2Ids || [])
    ];

  setDocType(doc.type);

  setInputValue(
    'f-docnum',
    doc.num
  );

  setInputValue(
    'f-docdate',
    doc.date
  );

  setInputValue(
    'f-period',
    doc.period
  );

  setInputValue(
    'f-date-from',
    doc.dateFrom
  );

  setInputValue(
    'f-date-to',
    doc.dateTo
  );

  setInputValue(
    'f-investor',
    doc.investor
  );

  setInputValue(
    'f-contract-num',
    doc.contractNum
  );

  setInputValue(
    'f-contract-date',
    doc.contractDate
  );

  setInputValue(
    'f-object',
    doc.objectName
  );

  setInputValue(
    'f-object-addr',
    doc.objectAddr
  );

  setInputValue(
    'f-contractor',
    doc.contractor?.id || ''
  );

  setInputValue(
    'f-customer',
    doc.customer?.id || ''
  );

  const vatRate =
    doc.totals?.vatRate;

  const vatSelect =
    document.getElementById(
      'f-vat-rate'
    );

  if (vatSelect) {
    if (
      vatRate === null
    ) {
      vatSelect.value =
        'none';
    } else if (
      [5, 10, 20, 22].includes(
        Number(vatRate)
      )
    ) {
      vatSelect.value =
        String(vatRate);
    } else {
      vatSelect.value =
        'custom';

      setInputValue(
        'f-vat-custom',
        vatRate ?? ''
      );
    }
  }

  onVatRateChange();

  renderWorkRows();

  if (
    doc.type === 'ks3'
  ) {
    renderKs2PickList();
  }

  renderTotals();
  renderPreview();

  switchTab('docs');

  toast(
    'Документ загружен в форму',
    'ok'
  );
}


function setInputValue(
  id,
  value
) {
  const element =
    document.getElementById(id);

  if (!element) return;

  element.value =
    value ?? '';
}


function deleteArchive(id) {
  const doc =
    DB.archive.find(
      (item) =>
        item.id === id
    );

  if (!doc) return;

  confirmDialog(
    'Удалить документ?',
    `${doc.type.toUpperCase()} № ${doc.num} от ${fmtDate(doc.date)} будет удалён из архива.`,
    () => {
      DB.archive =
        DB.archive.filter(
          (item) =>
            item.id !== id
        );

      currentDoc
        .linkedKs2Ids =
        currentDoc
          .linkedKs2Ids
          .filter(
            (linkedId) =>
              linkedId !== id
          );

      if (
        currentDoc.id === id
      ) {
        currentDoc.id = null;
      }

      saveDB();
      renderArchive();

      if (
        currentDoc.type ===
        'ks3'
      ) {
        renderKs2PickList();
      }

      renderTotals();
      renderPreview();

      toast(
        'Документ удалён',
        'ok'
      );
    }
  );
}


function clearArchive() {
  if (!DB.archive.length) {
    return toast(
      'Архив и так пуст',
      'err'
    );
  }

  confirmDialog(
    'Очистить весь архив?',
    `Будут удалены все документы: ${DB.archive.length}. Действие необратимо.`,
    () => {
      DB.archive = [];

      currentDoc.id = null;
      currentDoc.linkedKs2Ids = [];

      saveDB();
      renderArchive();
      renderKs2PickList();
      renderTotals();
      renderPreview();

      toast(
        'Архив очищен',
        'ok'
      );
    }
  );
}


/* ============================================================
   XML
   ============================================================ */

function buildDocXML(doc) {
  const partyXml =
    (label, party) => {
      if (!party) {
        return `<${label}/>`;
      }

      return `
  <${label}>
    <Name>${escapeXml(party.name)}</Name>
    <INN>${escapeXml(party.inn)}</INN>
    <KPP>${escapeXml(party.kpp || '')}</KPP>
    <OGRN>${escapeXml(party.ogrn || '')}</OGRN>
    <Address>${escapeXml(party.addr || '')}</Address>
    <Boss position="${escapeXml(party.bossPos || '')}">${escapeXml(party.bossName || '')}</Boss>
  </${label}>`;
    };

  let body = '';

  if (doc.type === 'ks2') {
    body = `
  <Rows>
${doc.rows
  .map(
    (row, index) => {
      const qty =
        num(row.qty);

      const price =
        num(row.price);

      return `    <Row n="${index + 1}">
      <Name>${escapeXml(row.name || '')}</Name>
      <Unit>${escapeXml(row.unit || '')}</Unit>
      <Qty>${qty}</Qty>
      <Price>${price.toFixed(2)}</Price>
      <Sum>${roundMoney(qty * price).toFixed(2)}</Sum>
    </Row>`;
    }
  )
  .join('\n')}
  </Rows>`;
  } else {
    body = `
  <LinkedKS2>
${doc.linkedKs2Ids
  .map(
    (id) => {
      const source =
        DB.archive.find(
          (item) =>
            item.id === id
        );

      if (!source) {
        return '';
      }

      return `    <Doc id="${escapeXml(source.id)}" num="${escapeXml(source.num)}" date="${escapeXml(source.date)}" gross="${roundMoney(source.totals?.gross || 0).toFixed(2)}"/>`;
    }
  )
  .filter(Boolean)
  .join('\n')}
  </LinkedKS2>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document type="${doc.type.toUpperCase()}" number="${escapeXml(doc.num)}" date="${escapeXml(doc.date)}">
  <Period>${escapeXml(doc.period || '')}</Period>
  <WorkDates from="${escapeXml(doc.dateFrom || '')}" to="${escapeXml(doc.dateTo || '')}"/>
  <Contract number="${escapeXml(doc.contractNum || '')}" date="${escapeXml(doc.contractDate || '')}"/>
  <Object>
    <Name>${escapeXml(doc.objectName || '')}</Name>
    <Address>${escapeXml(doc.objectAddr || '')}</Address>
  </Object>
  <Investor>${escapeXml(doc.investor || '')}</Investor>
${partyXml('Contractor', doc.contractor)}
${partyXml('Customer', doc.customer)}
${body}
  <Totals>
    <Base>${roundMoney(doc.totals.base).toFixed(2)}</Base>
    <VATRate>${doc.totals.vatRate === null ? 'none' : doc.totals.vatRate}</VATRate>
    <VAT>${roundMoney(doc.totals.vat).toFixed(2)}</VAT>
    <Gross>${roundMoney(doc.totals.gross).toFixed(2)}</Gross>
  </Totals>
</Document>`;
}


function downloadXML() {
  const doc =
    getFormSnapshot();

  if (!doc.num || !doc.date) {
    return toast(
      'Заполните номер и дату документа',
      'err'
    );
  }

  const xml =
    buildDocXML(doc);

  const filename =
    `${doc.type.toUpperCase()}_${sanitizeFilename(doc.num)}_${doc.date}.xml`;

  downloadBlob(
    xml,
    filename,
    'application/xml;charset=utf-8'
  );

  toast(
    'XML сформирован',
    'ok'
  );
}


/* ============================================================
   XLSX — ПРОВЕРКИ
   ============================================================ */

function ensureXLSXAvailable() {
  if (
    typeof window.XLSX ===
      'undefined' ||
    !window.XLSX
  ) {
    toast(
      'Библиотека Excel не загружена. Проверьте файл xlsx.full.min.js рядом с ks-generator.html.',
      'err'
    );

    return false;
  }

  return true;
}


async function fetchTemplate(
  type
) {
  const path =
    TEMPLATE_PATHS[type];

  if (!path) {
    throw new Error(
      'Неизвестный тип шаблона'
    );
  }

  let response;

  try {
    response =
      await fetch(
        path,
        {
          cache: 'no-store'
        }
      );
  } catch (error) {
    throw new Error(
      `Не удалось загрузить шаблон ${path}. Если страница открыта через file://, запускайте её через GitHub Pages или локальный HTTP-сервер.`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Шаблон не найден: ${path} (HTTP ${response.status})`
    );
  }

  const buffer =
    await response.arrayBuffer();

  if (!buffer.byteLength) {
    throw new Error(
      `Шаблон ${path} пуст`
    );
  }

  return buffer;
}


/* ============================================================
   XLSX — ЯЧЕЙКИ
   ============================================================ */

function getWorksheet(
  workbook,
  type
) {
  const map =
    TEMPLATE_MAP[type];

  const sheetName =
    workbook.SheetNames[
      map.sheetIndex || 0
    ];

  if (!sheetName) {
    throw new Error(
      'В шаблоне не найден лист'
    );
  }

  const worksheet =
    workbook.Sheets[
      sheetName
    ];

  if (!worksheet) {
    throw new Error(
      'Не удалось открыть лист шаблона'
    );
  }

  return worksheet;
}


function isMergedCellSlave(
  worksheet,
  address
) {
  const range =
    worksheet['!merges'];

  if (!Array.isArray(range)) {
    return false;
  }

  const cell =
    XLSX.utils.decode_cell(
      address
    );

  for (const merge of range) {
    const inside =
      cell.r >= merge.s.r &&
      cell.r <= merge.e.r &&
      cell.c >= merge.s.c &&
      cell.c <= merge.e.c;

    if (!inside) continue;

    const isMaster =
      cell.r === merge.s.r &&
      cell.c === merge.s.c;

    return !isMaster;
  }

  return false;
}


function mergedCellMaster(
  worksheet,
  address
) {
  const merges =
    worksheet['!merges'];

  if (!Array.isArray(merges)) {
    return address;
  }

  const cell =
    XLSX.utils.decode_cell(
      address
    );

  for (const merge of merges) {
    const inside =
      cell.r >= merge.s.r &&
      cell.r <= merge.e.r &&
      cell.c >= merge.s.c &&
      cell.c <= merge.e.c;

    if (inside) {
      return XLSX.utils.encode_cell(
        merge.s
      );
    }
  }

  return address;
}


function writeCell(
  worksheet,
  address,
  value,
  options = {}
) {
  if (
    !worksheet ||
    !address
  ) {
    return;
  }

  const actualAddress =
    mergedCellMaster(
      worksheet,
      address
    );

  const existing =
    worksheet[
      actualAddress
    ] || {};

  let cellType =
    options.type;

  let cellValue =
    value;

  if (
    value instanceof Date
  ) {
    cellType = 'd';
    cellValue = value;
  } else if (
    typeof value ===
    'number'
  ) {
    cellType = 'n';
  } else if (
    typeof value ===
    'boolean'
  ) {
    cellType = 'b';
  } else {
    cellType = 's';
    cellValue =
      safeString(value);
  }

  worksheet[
    actualAddress
  ] = {
    ...existing,
    t: cellType,
    v: cellValue
  };

  if (
    options.numberFormat
  ) {
    worksheet[
      actualAddress
    ].z =
      options.numberFormat;
  }

  /*
    Дата.
  */
  if (
    value instanceof Date
  ) {
    worksheet[
      actualAddress
    ].z =
      options.numberFormat ||
      'dd.mm.yyyy';
  }
}


function writeToFirstExistingCell(
  worksheet,
  addresses,
  value,
  options = {}
) {
  if (
    !Array.isArray(addresses)
  ) {
    addresses = [addresses];
  }

  for (
    const address of addresses
  ) {
    if (
      worksheet[address] ||
      mergedCellMaster(
        worksheet,
        address
      ) !== address
    ) {
      writeCell(
        worksheet,
        address,
        value,
        options
      );

      return address;
    }
  }

  /*
    Если ни одной ячейки ещё нет, используем первый fallback.
  */
  if (addresses[0]) {
    writeCell(
      worksheet,
      addresses[0],
      value,
      options
    );

    return addresses[0];
  }

  return null;
}


/* ============================================================
   XLSX — ПОИСК ТЕКСТА В ШАБЛОНЕ
   ============================================================ */

function worksheetRange(
  worksheet
) {
  const ref =
    worksheet['!ref'];

  if (!ref) return null;

  return XLSX.utils.decode_range(
    ref
  );
}


function cellDisplayValue(cell) {
  if (!cell) return '';

  if (
    cell.w !== undefined &&
    cell.w !== null
  ) {
    return safeString(
      cell.w
    );
  }

  return safeString(
    cell.v
  );
}


function findCellsContaining(
  worksheet,
  searchTerms
) {
  const terms =
    (
      Array.isArray(
        searchTerms
      )
        ? searchTerms
        : [searchTerms]
    )
      .map(
        normalizeSearch
      )
      .filter(Boolean);

  if (!terms.length) {
    return [];
  }

  const result = [];

  const range =
    worksheetRange(
      worksheet
    );

  if (!range) {
    return result;
  }

  for (
    let row = range.s.r;
    row <= range.e.r;
    row++
  ) {
    for (
      let column = range.s.c;
      column <= range.e.c;
      column++
    ) {
      const address =
        XLSX.utils.encode_cell({
          r: row,
          c: column
        });

      const cell =
        worksheet[address];

      if (!cell) continue;

      const text =
        normalizeSearch(
          cellDisplayValue(
            cell
          )
        );

      if (!text) continue;

      const found =
        terms.some(
          (term) =>
            text.includes(term)
        );

      if (found) {
        result.push({
          address,
          row,
          column,
          text,
          value:
            cellDisplayValue(
              cell
            )
        });
      }
    }
  }

  return result;
}


function findFirstCellContaining(
  worksheet,
  searchTerms
) {
  return (
    findCellsContaining(
      worksheet,
      searchTerms
    )[0] || null
  );
}


function offsetAddress(
  address,
  columnOffset,
  rowOffset = 0
) {
  const decoded =
    XLSX.utils.decode_cell(
      address
    );

  return XLSX.utils.encode_cell({
    r:
      decoded.r +
      rowOffset,

    c:
      decoded.c +
      columnOffset
  });
}


function writeNextToLabel(
  worksheet,
  labels,
  value,
  options = {}
) {
  const found =
    findFirstCellContaining(
      worksheet,
      labels
    );

  if (!found) {
    return false;
  }

  const offsets =
    options.offsets ||
    [1, 2, 3, 4];

  for (
    const offset of offsets
  ) {
    const candidate =
      offsetAddress(
        found.address,
        offset,
        options.rowOffset || 0
      );

    const master =
      mergedCellMaster(
        worksheet,
        candidate
      );

    /*
      Не пишем поверх самой подписи,
      если merge возвращает исходную ячейку.
    */
    if (
      master ===
      mergedCellMaster(
        worksheet,
        found.address
      )
    ) {
      continue;
    }

    writeCell(
      worksheet,
      candidate,
      value,
      options
    );

    return true;
  }

  return false;
}


/* ============================================================
   XLSX — СОСТАВНЫЕ СТРОКИ СТОРОН
   ============================================================ */

function partyExcelText(
  party
) {
  if (!party) return '';

  const pieces = [];

  if (party.name) {
    pieces.push(
      party.name
    );
  }

  const tax = [];

  if (party.inn) {
    tax.push(
      'ИНН ' + party.inn
    );
  }

  if (party.kpp) {
    tax.push(
      'КПП ' + party.kpp
    );
  }

  if (tax.length) {
    pieces.push(
      tax.join(', ')
    );
  }

  if (party.addr) {
    pieces.push(
      party.addr
    );
  }

  return pieces.join(', ');
}


function objectExcelText(doc) {
  return [
    doc.objectName,
    doc.objectAddr
  ]
    .filter(Boolean)
    .join(', ');
}


/* ============================================================
   XLSX — ОБЩИЕ РЕКВИЗИТЫ
   ============================================================ */

function fillCommonTemplateFields(
  worksheet,
  doc,
  type
) {
  const map =
    TEMPLATE_MAP[type];

  /*
    Номер.
  */
  const numberFound =
    writeNextToLabel(
      worksheet,
      [
        'номер документа',
        'номер',
        '№ документа'
      ],
      doc.num,
      {
        offsets: [1, 2, 3]
      }
    );

  if (!numberFound) {
    writeToFirstExistingCell(
      worksheet,
      map.cells.docNum,
      doc.num
    );
  }

  /*
    Дата.
  */
  const excelDate =
    isoDateToExcelDate(
      doc.date
    );

  const dateFound =
    writeNextToLabel(
      worksheet,
      [
        'дата составления',
        'дата документа'
      ],
      excelDate,
      {
        offsets: [1, 2, 3],
        numberFormat:
          'dd.mm.yyyy'
      }
    );

  if (!dateFound) {
    writeToFirstExistingCell(
      worksheet,
      map.cells.docDate,
      excelDate,
      {
        numberFormat:
          'dd.mm.yyyy'
      }
    );
  }

  /*
    Инвестор.
  */
  if (doc.investor) {
    const investorFound =
      writeNextToLabel(
        worksheet,
        ['инвестор'],
        doc.investor,
        {
          offsets:
            [1, 2, 3, 4, 5]
        }
      );

    if (!investorFound) {
      writeToFirstExistingCell(
        worksheet,
        map.cells.investor,
        doc.investor
      );
    }
  }

  /*
    Заказчик.
  */
  const customerText =
    partyExcelText(
      doc.customer
    );

  const customerFound =
    writeNextToLabel(
      worksheet,
      [
        'заказчик',
        'заказчик (генподрядчик)'
      ],
      customerText,
      {
        offsets:
          [1, 2, 3, 4, 5]
      }
    );

  if (!customerFound) {
    writeToFirstExistingCell(
      worksheet,
      map.cells.customer,
      customerText
    );
  }

  /*
    Подрядчик.
  */
  const contractorText =
    partyExcelText(
      doc.contractor
    );

  const contractorFound =
    writeNextToLabel(
      worksheet,
      [
        'подрядчик',
        'подрядчик (субподрядчик)'
      ],
      contractorText,
      {
        offsets:
          [1, 2, 3, 4, 5]
      }
    );

  if (!contractorFound) {
    writeToFirstExistingCell(
      worksheet,
      map.cells.contractor,
      contractorText
    );
  }

  /*
    Объект.
  */
  const objectText =
    objectExcelText(doc);

  const objectFound =
    writeNextToLabel(
      worksheet,
      [
        'стройка',
        'объект'
      ],
      objectText,
      {
        offsets:
          [1, 2, 3, 4, 5]
      }
    );

  if (!objectFound) {
    writeToFirstExistingCell(
      worksheet,
      map.cells.object,
      objectText
    );
  }

  /*
    Договор.
  */
  if (doc.contractNum) {
    const contractNumberFound =
      writeNextToLabel(
        worksheet,
        [
          'номер договора',
          'договор подряда'
        ],
        doc.contractNum,
        {
          offsets:
            [1, 2, 3]
        }
      );

    if (!contractNumberFound) {
      writeToFirstExistingCell(
        worksheet,
        map.cells.contractNum,
        doc.contractNum
      );
    }
  }

  if (doc.contractDate) {
    writeToFirstExistingCell(
      worksheet,
      map.cells.contractDate,
      isoDateToExcelDate(
        doc.contractDate
      ),
      {
        numberFormat:
          'dd.mm.yyyy'
      }
    );
  }

  if (
    type === 'ks2'
  ) {
    if (doc.dateFrom) {
      writeToFirstExistingCell(
        worksheet,
        map.cells.dateFrom,
        isoDateToExcelDate(
          doc.dateFrom
        ),
        {
          numberFormat:
            'dd.mm.yyyy'
        }
      );
    }

    if (doc.dateTo) {
      writeToFirstExistingCell(
        worksheet,
        map.cells.dateTo,
        isoDateToExcelDate(
          doc.dateTo
        ),
        {
          numberFormat:
            'dd.mm.yyyy'
        }
      );
    }
  }

  if (
    type === 'ks3' &&
    doc.period
  ) {
    writeToFirstExistingCell(
      worksheet,
      map.cells.period,
      doc.period
    );
  }
}


/* ============================================================
   XLSX — КС-2
   ============================================================ */

function clearKs2WorkRows(
  worksheet
) {
  const config =
    TEMPLATE_MAP.ks2;

  for (
    const row of config.workRows
  ) {
    for (
      const column of Object.values(
        config.workColumns
      )
    ) {
      const address =
        `${column}${row}`;

      /*
        Не удаляем объект ячейки, потому что он может содержать
        стиль. Только очищаем значение.
      */
      if (
        worksheet[
          mergedCellMaster(
            worksheet,
            address
          )
        ]
      ) {
        writeCell(
          worksheet,
          address,
          ''
        );
      }
    }
  }
}


function fillKs2Template(
  worksheet,
  doc
) {
  fillCommonTemplateFields(
    worksheet,
    doc,
    'ks2'
  );

  clearKs2WorkRows(
    worksheet
  );

  const config =
    TEMPLATE_MAP.ks2;

  const availableRows =
    config.workRows;

  /*
    Реальный шаблон имеет фиксированное число визуальных строк.
    Если работ больше, чем строк в шаблоне, мы не должны молча
    потерять данные.
  */
  if (
    doc.rows.length >
    availableRows.length
  ) {
    throw new Error(
      `В шаблоне КС-2 сейчас настроено ${availableRows.length} строк работ, а в документе ${doc.rows.length}. Добавьте дополнительные строки в TEMPLATE_MAP.ks2.workRows.`
    );
  }

  doc.rows.forEach(
    (work, index) => {
      const row =
        availableRows[index];

      const qty =
        num(work.qty);

      const price =
        roundMoney(
          num(work.price)
        );

      const amount =
        roundMoney(
          qty * price
        );

      writeCell(
        worksheet,
        `${config.workColumns.number}${row}`,
        index + 1
      );

      writeCell(
        worksheet,
        `${config.workColumns.name}${row}`,
        work.name || ''
      );

      writeCell(
        worksheet,
        `${config.workColumns.unit}${row}`,
        work.unit || ''
      );

      writeCell(
        worksheet,
        `${config.workColumns.qty}${row}`,
        qty,
        {
          numberFormat:
            '0.###'
        }
      );

      writeCell(
        worksheet,
        `${config.workColumns.price}${row}`,
        price,
        {
          numberFormat:
            '#,##0.00'
        }
      );

      writeCell(
        worksheet,
        `${config.workColumns.sum}${row}`,
        amount,
        {
          numberFormat:
            '#,##0.00'
        }
      );
    }
  );

  /*
    Итоги.
  */
  writeToFirstExistingCell(
    worksheet,
    config.cells.totalBase,
    roundMoney(
      doc.totals.base
    ),
    {
      numberFormat:
        '#,##0.00'
    }
  );

  if (
    doc.totals.vatRate === null
  ) {
    writeToFirstExistingCell(
      worksheet,
      config.cells.vat,
      'Без НДС'
    );
  } else {
    writeToFirstExistingCell(
      worksheet,
      config.cells.vat,
      roundMoney(
        doc.totals.vat
      ),
      {
        numberFormat:
          '#,##0.00'
      }
    );
  }

  writeToFirstExistingCell(
    worksheet,
    config.cells.totalGross,
    roundMoney(
      doc.totals.gross
    ),
    {
      numberFormat:
        '#,##0.00'
    }
  );

  /*
    Дополнительно пробуем найти итоговые подписи,
    если шаблон отличается по координатам.
  */
  writeAmountNearLabel(
    worksheet,
    [
      'итого',
      'всего'
    ],
    doc.totals.base
  );
}


/* ============================================================
   XLSX — КС-3
   ============================================================ */

function clearKs3Rows(
  worksheet
) {
  const config =
    TEMPLATE_MAP.ks3;

  for (
    const row of config.workRows
  ) {
    for (
      const column of Object.values(
        config.workColumns
      )
    ) {
      const address =
        `${column}${row}`;

      if (
        worksheet[
          mergedCellMaster(
            worksheet,
            address
          )
        ]
      ) {
        writeCell(
          worksheet,
          address,
          ''
        );
      }
    }
  }
}


function fillKs3Template(
  worksheet,
  doc
) {
  fillCommonTemplateFields(
    worksheet,
    doc,
    'ks3'
  );

  clearKs3Rows(
    worksheet
  );

  const config =
    TEMPLATE_MAP.ks3;

  const linked =
    doc.linkedKs2Ids
      .map(
        (id) =>
          DB.archive.find(
            (item) =>
              item.id === id
          )
      )
      .filter(Boolean);

  if (
    linked.length >
    config.workRows.length
  ) {
    throw new Error(
      `В шаблоне КС-3 настроено ${config.workRows.length} строк, а выбрано ${linked.length} актов КС-2.`
    );
  }

  linked.forEach(
    (source, index) => {
      const row =
        config.workRows[
          index
        ];

      /*
        Строка КС-3.
        В настоящей форме в ней логично показать
        наименование объекта / акта.
      */
      const title = [
        source.objectName ||
          '',
        `КС-2 № ${source.num || ''} от ${fmtDate(source.date)}`
      ]
        .filter(Boolean)
        .join('. ');

      writeCell(
        worksheet,
        `${config.workColumns.number}${row}`,
        index + 1
      );

      writeCell(
        worksheet,
        `${config.workColumns.title}${row}`,
        title
      );

      writeCell(
        worksheet,
        `${config.workColumns.base}${row}`,
        roundMoney(
          source.totals?.base ||
          0
        ),
        {
          numberFormat:
            '#,##0.00'
        }
      );

      writeCell(
        worksheet,
        `${config.workColumns.vat}${row}`,
        roundMoney(
          source.totals?.vat ||
          0
        ),
        {
          numberFormat:
            '#,##0.00'
        }
      );

      writeCell(
        worksheet,
        `${config.workColumns.gross}${row}`,
        roundMoney(
          source.totals?.gross ||
          0
        ),
        {
          numberFormat:
            '#,##0.00'
        }
      );
    }
  );

  writeToFirstExistingCell(
    worksheet,
    config.cells.totalBase,
    roundMoney(
      doc.totals.base
    ),
    {
      numberFormat:
        '#,##0.00'
    }
  );

  if (
    doc.totals.vatRate === null
  ) {
    writeToFirstExistingCell(
      worksheet,
      config.cells.vat,
      'Без НДС'
    );
  } else {
    writeToFirstExistingCell(
      worksheet,
      config.cells.vat,
      roundMoney(
        doc.totals.vat
      ),
      {
        numberFormat:
          '#,##0.00'
      }
    );
  }

  writeToFirstExistingCell(
    worksheet,
    config.cells.totalGross,
    roundMoney(
      doc.totals.gross
    ),
    {
      numberFormat:
        '#,##0.00'
    }
  );
}


/* ============================================================
   XLSX — ПОИСК ИТОГОВ
   ============================================================ */

function writeAmountNearLabel(
  worksheet,
  labels,
  amount
) {
  const matches =
    findCellsContaining(
      worksheet,
      labels
    );

  if (!matches.length) {
    return false;
  }

  /*
    Используем последнюю найденную подпись "Итого"/"Всего":
    в стандартных формах итог находится ниже таблицы.
  */
  const match =
    matches[
      matches.length - 1
    ];

  const candidates =
    [1, 2, 3, 4, 5, 6]
      .map(
        (offset) =>
          offsetAddress(
            match.address,
            offset
          )
      );

  /*
    Ищем максимально правую существующую ячейку.
  */
  let target = null;

  for (
    let i =
      candidates.length - 1;
    i >= 0;
    i--
  ) {
    const candidate =
      candidates[i];

    if (
      worksheet[
        mergedCellMaster(
          worksheet,
          candidate
        )
      ]
    ) {
      target = candidate;
      break;
    }
  }

  if (!target) {
    return false;
  }

  writeCell(
    worksheet,
    target,
    roundMoney(amount),
    {
      numberFormat:
        '#,##0.00'
    }
  );

  return true;
}


/* ============================================================
   XLSX — МЕТАДАННЫЕ
   ============================================================ */

function updateWorkbookMetadata(
  workbook,
  doc
) {
  workbook.Props = {
    ...(workbook.Props || {}),

    Title:
      `${doc.type.toUpperCase()} № ${doc.num}`,

    Subject:
      doc.type === 'ks2'
        ? 'Акт о приёмке выполненных работ'
        : 'Справка о стоимости выполненных работ и затрат',

    Author:
      'ДжемБаланс',

    Company:
      doc.contractor?.name ||
      'ДжемБаланс',

    Comments:
      'Сформировано приложением ДжемБаланс'
  };
}


/* ============================================================
   XLSX — ОСНОВНОЙ ЭКСПОРТ
   ============================================================ */

async function exportXLSX(
  documentOverride = null
) {
  if (
    !ensureXLSXAvailable()
  ) {
    return;
  }

  const doc =
    documentOverride ||
    getFormSnapshot();

  if (
    !validateDocument(doc)
  ) {
    return;
  }

  const buttonList =
    document.querySelectorAll(
      '[onclick^="exportXLSX"]'
    );

  const originalButtonTexts =
    new Map();

  buttonList.forEach(
    (button) => {
      originalButtonTexts.set(
        button,
        button.innerHTML
      );

      button.disabled = true;
    }
  );

  try {
    toast(
      `Загружаю шаблон ${doc.type.toUpperCase()}…`
    );

    const buffer =
      await fetchTemplate(
        doc.type
      );

    /*
      cellStyles:true и bookFiles:true помогают сохранить
      максимум информации исходного шаблона при round-trip.
    */
    const workbook =
      XLSX.read(
        buffer,
        {
          type: 'array',
          cellStyles: true,
          cellDates: true,
          cellNF: true,
          cellText: true,
          bookFiles: true,
          bookVBA: true
        }
      );

    const worksheet =
      getWorksheet(
        workbook,
        doc.type
      );

    if (
      doc.type === 'ks2'
    ) {
      fillKs2Template(
        worksheet,
        doc
      );
    } else {
      fillKs3Template(
        worksheet,
        doc
      );
    }

    updateWorkbookMetadata(
      workbook,
      doc
    );

    const prefix =
      doc.type.toUpperCase();

    const filename =
      `${prefix}_${sanitizeFilename(doc.num)}_${doc.date}.xlsx`;

    /*
      ВАЖНО:
      Используем writeFile по книге, загруженной из шаблона.
      Не создаём book_new().
    */
    XLSX.writeFile(
      workbook,
      filename,
      {
        bookType: 'xlsx',
        cellStyles: true,
        compression: true
      }
    );

    toast(
      `${prefix} сформирован по шаблону`,
      'ok'
    );

  } catch (error) {
    console.error(
      'Ошибка XLSX:',
      error
    );

    toast(
      error.message ||
      'Не удалось сформировать XLSX',
      'err'
    );

  } finally {
    buttonList.forEach(
      (button) => {
        button.disabled = false;

        if (
          originalButtonTexts.has(
            button
          )
        ) {
          button.innerHTML =
            originalButtonTexts.get(
              button
            );
        }
      }
    );
  }
}


async function exportXLSXById(id) {
  const doc =
    DB.archive.find(
      (item) =>
        item.id === id
    );

  if (!doc) {
    return toast(
      'Документ не найден',
      'err'
    );
  }

  await exportXLSX(
    deepClone(doc)
  );
}


/* ============================================================
   ИМЯ ФАЙЛА
   ============================================================ */

function sanitizeFilename(
  value
) {
  const sanitized =
    safeString(value)
      .replace(
        /[\\/:*?"<>|]+/g,
        '_'
      )
      .replace(
        /\s+/g,
        '_'
      )
      .replace(
        /_+/g,
        '_'
      )
      .replace(
        /^_+|_+$/g,
        ''
      );

  return sanitized ||
    'document';
}


/* ============================================================
   DOWNLOAD
   ============================================================ */

function downloadBlob(
  content,
  filename,
  mime
) {
  const blob =
    content instanceof Blob
      ? content
      : new Blob(
          [content],
          { type: mime }
        );

  const url =
    URL.createObjectURL(
      blob
    );

  const anchor =
    document.createElement(
      'a'
    );

  anchor.href = url;
  anchor.download =
    filename;

  anchor.style.display =
    'none';

  document.body.appendChild(
    anchor
  );

  anchor.click();
  anchor.remove();

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
   ЭКСПОРТ / ИМПОРТ БАЗЫ
   ============================================================ */

function exportAllData() {
  const payload = {
    app:
      'ДжемБаланс КС',

    version:
      2,

    exportedAt:
      new Date().toISOString(),

    data:
      DB
  };

  const filename =
    `jembalance_ks_backup_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

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
    'База экспортирована',
    'ok'
  );
}


function importData() {
  const input =
    document.createElement(
      'input'
    );

  input.type = 'file';

  input.accept =
    'application/json,.json';

  input.addEventListener(
    'change',
    (event) => {
      const file =
        event.target.files?.[0];

      if (!file) return;

      const reader =
        new FileReader();

      reader.onload =
        (loadEvent) => {
          try {
            const parsed =
              JSON.parse(
                loadEvent
                  .target
                  .result
              );

            const incoming =
              parsed.data ||
              parsed;

            const contractors =
              Array.isArray(
                incoming.contractors
              )
                ? incoming.contractors
                : [];

            const customers =
              Array.isArray(
                incoming.customers
              )
                ? incoming.customers
                : [];

            const archive =
              Array.isArray(
                incoming.archive
              )
                ? incoming.archive
                : [];

            if (
              !(
                'contractors' in
                  incoming ||
                'customers' in
                  incoming ||
                'archive' in
                  incoming
              )
            ) {
              return toast(
                'Неподходящий формат файла',
                'err'
              );
            }

            confirmDialog(
              'Импортировать данные?',
              `Будут заменены: подрядчиков — ${contractors.length}, заказчиков — ${customers.length}, документов — ${archive.length}. Текущая база будет перезаписана.`,
              () => {
                DB.contractors =
                  contractors;

                DB.customers =
                  customers;

                DB.archive =
                  archive;

                currentDoc.id =
                  null;

                currentDoc
                  .linkedKs2Ids =
                  [];

                saveDB();

                refreshContractorSelect();
                refreshCustomerSelect();

                renderContractors();
                renderCustomers();
                renderArchive();

                renderTotals();
                renderPreview();

                toast(
                  'База импортирована',
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

      reader.onerror = () => {
        toast(
          'Не удалось прочитать файл',
          'err'
        );
      };

      reader.readAsText(
        file
      );
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
      currentDoc = {
        id: null,
        type: 'ks2',
        rows: [],
        linkedKs2Ids: []
      };

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
      ].forEach(
        (id) => {
          setInputValue(
            id,
            ''
          );
        }
      );

      setInputValue(
        'f-docdate',
        todayISO()
      );

      setInputValue(
        'f-contractor',
        ''
      );

      setInputValue(
        'f-customer',
        ''
      );

      setInputValue(
        'f-vat-rate',
        '20'
      );

      setDocType('ks2');

      onVatRateChange();
      renderWorkRows();
      renderTotals();
      renderPreview();

      toast(
        'Форма очищена',
        'ok'
      );
    }
  );
}


/* ============================================================
   ДАТА
   ============================================================ */

function todayISO() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      '0'
    );

  return `${year}-${month}-${day}`;
}


/* ============================================================
   ПРОВЕРКА ШАБЛОНОВ
   ============================================================ */

async function checkTemplateFiles() {
  const results = [];

  for (
    const type of
    ['ks2', 'ks3']
  ) {
    try {
      const response =
        await fetch(
          TEMPLATE_PATHS[type],
          {
            method: 'GET',
            cache: 'no-store'
          }
        );

      results.push({
        type,
        ok:
          response.ok
      });

    } catch (_) {
      results.push({
        type,
        ok: false
      });
    }
  }

  const broken =
    results.filter(
      (item) =>
        !item.ok
    );

  /*
    Не показываем ошибку при file://,
    потому что fetch в таком режиме всё равно не работает.
    Пользователь увидит точное сообщение при попытке экспорта.
  */
  if (
    broken.length &&
    location.protocol !==
      'file:'
  ) {
    console.warn(
      'Не найдены XLSX-шаблоны:',
      broken
    );
  }
}


/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */

function init() {
  loadDB();

  const docDate =
    document.getElementById(
      'f-docdate'
    );

  if (
    docDate &&
    !docDate.value
  ) {
    docDate.value =
      todayISO();
  }

  refreshContractorSelect();
  refreshCustomerSelect();

  const contractorsBadge =
    document.getElementById(
      'badge-contractors'
    );

  const customersBadge =
    document.getElementById(
      'badge-customers'
    );

  const archiveBadge =
    document.getElementById(
      'badge-archive'
    );

  if (contractorsBadge) {
    contractorsBadge.textContent =
      DB.contractors.length;
  }

  if (customersBadge) {
    customersBadge.textContent =
      DB.customers.length;
  }

  if (archiveBadge) {
    archiveBadge.textContent =
      DB.archive.length;
  }

  renderWorkRows();
  renderTotals();
  renderPreview();

  document
    .querySelectorAll(
      '.modal-backdrop'
    )
    .forEach(
      (backdrop) => {
        backdrop.addEventListener(
          'click',
          (event) => {
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
      }
    );

  document.addEventListener(
    'keydown',
    (event) => {
      if (
        event.key ===
        'Escape'
      ) {
        document
          .querySelectorAll(
            '.modal-backdrop.active'
          )
          .forEach(
            (backdrop) =>
              backdrop
                .classList
                .remove('active')
          );
      }
    }
  );

  /*
    Проверка локального SheetJS.
  */
  if (
    typeof window.XLSX ===
    'undefined'
  ) {
    console.warn(
      'XLSX пока не найден. Проверьте xlsx.full.min.js.'
    );
  }

  checkTemplateFiles();
}


document.addEventListener(
  'DOMContentLoaded',
  init
);