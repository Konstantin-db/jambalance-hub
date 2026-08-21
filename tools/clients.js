/* ============================================================
   JamBalance — Клиенты
   clients.js

   Использует:
   - public.clients
   - public.profiles
   - public.client_activities
   - public.client_contacts
   - public.client_bank_accounts
   - public.client_reporting_periods
   - public.client_communication_items

   Защищённые доступы:
   - Edge Function: client-secrets

   ВАЖНО:
   client_secrets напрямую из браузера НЕ читается.
   ============================================================ */

(() => {
  'use strict';


  /* ============================================================
     SUPABASE
     ============================================================ */

  const SUPABASE_URL =
    'https://fqcltmxiarohfpfnghjn.supabase.co';

  const SUPABASE_PUBLISHABLE_KEY =
    'sb_publishable_PqjH12Cbf7Fw9CWxvTPHaQ_MYYq7HQT';


  /* ============================================================
     CONFIG
     ============================================================ */

  const CONFIG = {
    edgeFunction: 'client-secrets',

    ecpDefaultWarningDays: 7,

    oneCWarningDays: 7,

    notificationCheckInterval:
      5 * 60 * 1000,

    tables: {
      clients:
        'clients',

      profiles:
        'profiles',

      activities:
        'client_activities',

      groups:
        'client_groups',

      taxSystems:
        'client_tax_systems',

      contacts:
        'client_contacts',

      bankAccounts:
        'client_bank_accounts',

      reports:
        'client_reporting_periods',

      documents:
        'client_documents',

      communication:
        'client_communication_items'
    }
  };


  /* ============================================================
     STATE
     ============================================================ */

  const state = {
    supabase: null,

    user: null,
    profile: null,

    clients: [],
    profiles: [],

    activities: [],
    reports: [],
    clientGroups: [],
    taxSystems: [],
    clientDocuments: [],

    currentClientId: null,

    currentClientTaxSystems: [],
    currentClientContacts: [],
    currentClientBanks: [],
    currentClientReports: [],
    currentClientCommunication: [],

    currentSecrets: [],
    currentSecretAudit: [],

    editingActivityId: null,
    editingContactId: null,
    editingBankId: null,
    editingReportId: null,
    editingCommunicationId: null,
    editingSecretId: null,

    filters: {
      query: '',
      status: '',
      orgForm: '',
      taxSystem: '',
      responsible: ''
    },

    sort: 'name_asc',
    viewMode: 'list',

    notificationTimer: null,

    initialized: false
  };


  /* ============================================================
     DOM
     ============================================================ */

  function $(id) {
    return document.getElementById(id);
  }


  function $all(selector, root = document) {
    return Array.from(
      root.querySelectorAll(selector)
    );
  }


  function setHidden(element, hidden) {
    if (!element) return;

    element.classList.toggle(
      'hidden',
      Boolean(hidden)
    );
  }


  /* ============================================================
     BASIC UTILS
     ============================================================ */

  function escapeHtml(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return '';
    }

    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }


  function nullableText(value) {
    const text =
      String(
        value ?? ''
      ).trim();

    return text || null;
  }


  function numberOrNull(value) {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return null;
    }

    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : null;
  }


  function createId() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === 'function'
    ) {
      return window.crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
      .replace(
        /[xy]/g,
        character => {
          const random =
            Math.floor(
              Math.random() * 16
            );

          const value =
            character === 'x'
              ? random
              : (random & 0x3) | 0x8;

          return value.toString(16);
        }
      );
  }


  function debounce(fn, wait = 250) {
    let timer = null;

    return (...args) => {
      clearTimeout(timer);

      timer =
        setTimeout(
          () => fn(...args),
          wait
        );
    };
  }


  /* ============================================================
     DATE UTILS
     ============================================================ */

  function todayDate() {
    const now =
      new Date();

    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
  }


  function fromISODate(value) {
    if (!value) {
      return null;
    }

    const [
      year,
      month,
      day
    ] =
      String(value)
        .slice(0, 10)
        .split('-')
        .map(Number);

    if (
      !year ||
      !month ||
      !day
    ) {
      return null;
    }

    return new Date(
      year,
      month - 1,
      day
    );
  }


  function toISODate(date) {
    if (!date) return '';

    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, '0');

    const day =
      String(
        date.getDate()
      ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }


  function formatDate(value) {
    if (!value) {
      return '—';
    }

    const date =
      typeof value === 'string'
        ? fromISODate(value)
        : value;

    if (!date) {
      return '—';
    }

    return date.toLocaleDateString(
      'ru-RU'
    );
  }


  function formatDateTime(value) {
    if (!value) {
      return '—';
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '—';
    }

    return date.toLocaleString(
      'ru-RU',
      {
        dateStyle: 'short',
        timeStyle: 'short'
      }
    );
  }


  function daysUntil(value) {
    const date =
      fromISODate(value);

    if (!date) {
      return null;
    }

    const today =
      todayDate();

    return Math.ceil(
      (
        date.getTime() -
        today.getTime()
      ) /
      86400000
    );
  }


  /* ============================================================
     MONEY
     ============================================================ */

  function formatMoney(value) {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return '—';
    }

    const number =
      Number(value);

    if (
      !Number.isFinite(number)
    ) {
      return '—';
    }

    return (
      number.toLocaleString(
        'ru-RU',
        {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      ) +
      ' ₽'
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

    if (!stack) {
      return;
    }

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
          () => element.remove(),
          280
        );
      },
      3200
    );
  }


  /* ============================================================
     ERROR
     ============================================================ */

  function friendlyError(error) {
    if (!error) {
      return 'Неизвестная ошибка.';
    }

    const message =
      error.message ||
      error.error ||
      String(error);

    if (
      message.includes(
        'duplicate key'
      )
    ) {
      return (
        'Запись с такими данными уже существует.'
      );
    }

    if (
      message.includes(
        'clients_inn_unique_idx'
      )
    ) {
      return (
        'Клиент с таким ИНН уже существует.'
      );
    }

    if (
      message.includes(
        'row-level security'
      )
    ) {
      return (
        'Supabase отклонил операцию политикой доступа.'
      );
    }

    if (
      message.includes(
        'JWT'
      )
    ) {
      return (
        'Сессия авторизации истекла. Перезайдите в Рабочую станцию.'
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
    busyText = 'Сохраняем…'
  ) {
    if (!button) {
      return;
    }

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
     SUPABASE CLIENT
     ============================================================ */

  function resolveSupabaseClient() {
    if (
      window.supabaseClient &&
      window.supabaseClient.auth
    ) {
      return window.supabaseClient;
    }

    if (
      !window.supabase ||
      typeof window.supabase.createClient !==
        'function'
    ) {
      throw new Error(
        'Библиотека Supabase не загружена.'
      );
    }

    const client =
      window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
      );

    window.supabaseClient =
      client;

    return client;
  }


  /* ============================================================
     AUTH
     ============================================================ */

  async function loadCurrentUser() {
    const {
      data,
      error
    } =
      await state.supabase
        .auth
        .getUser();

    if (error) {
      throw error;
    }

    if (!data?.user) {
      throw new Error(
        'Пользователь не авторизован в Рабочей станции.'
      );
    }

    state.user =
      data.user;
  }


  async function loadCurrentProfile() {
    const {
      data,
      error
    } =
      await state.supabase
        .from(
          CONFIG.tables.profiles
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

    state.profile =
      data || null;
  }


  function isManager() {
    return (
      state.profile?.role ===
      'manager'
    );
  }


  /* ============================================================
     LOAD PROFILES
     ============================================================ */

  async function loadProfiles() {
    const {
      data,
      error
    } =
      await state.supabase
        .from(
          CONFIG.tables.profiles
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

    renderProfileSelects();
  }


  function profileName(profile) {
    if (!profile) {
      return '';
    }

    return (
      profile.full_name ||
      profile.email ||
      profile.position ||
      'Сотрудник'
    );
  }


  function getProfile(id) {
    return (
      state.profiles.find(
        profile =>
          profile.id === id
      ) ||
      null
    );
  }


  function renderProfileSelects() {
    const options =
      state.profiles
        .map(
          profile => `
            <option
              value="${escapeHtml(profile.id)}"
            >
              ${escapeHtml(profileName(profile))}
              ${
                profile.position
                  ? ` — ${escapeHtml(profile.position)}`
                  : ''
              }
            </option>
          `
        )
        .join('');


    const responsible =
      $('client-responsible');

    if (responsible) {
      const old =
        responsible.value;

      responsible.innerHTML =
        '<option value="">— выбрать сотрудника —</option>' +
        options;

      responsible.value =
        old || '';
    }


    const filter =
      $('filter-responsible');

    if (filter) {
      const old =
        filter.value;

      filter.innerHTML =
        '<option value="">Все сотрудники</option>' +
        options;

      filter.value =
        old || '';
    }


    const communication =
      $('communication-responsible');

    if (communication) {
      const old =
        communication.value;

      communication.innerHTML =
        '<option value="">— выбрать —</option>' +
        options;

      communication.value =
        old || '';
    }
  }

  function getClientGroup(id) {
    if (!id) {
      return null;
    }

    return (
      state.clientGroups.find(
        group =>
          group.id === id
      ) ||
      null
    );
  }


  function renderClientGroupSelect(
    selectedValue = null
  ) {
    const select =
      $('client-group');

    if (!select) {
      return;
    }

    const value =
      selectedValue === null
        ? select.value
        : selectedValue;

    const options =
      state.clientGroups
        .slice()
        .sort(
          (a, b) =>
            String(
              a.group_name || ''
            ).localeCompare(
              String(
                b.group_name || ''
              ),
              'ru'
            )
        )
        .map(
          group =>
            '<option value="' +
            escapeHtml(group.id) +
            '">' +
            escapeHtml(group.group_name) +
            '</option>'
        )
        .join('');

    select.innerHTML =
      '<option value="">— без группы —</option>' +
      options;

    select.value =
      value || '';
  }


  const TAX_SYSTEM_OPTIONS = [
    ['ОСНО', 'ОСНО'],
    ['УСН Доходы', 'УСН «Доходы»'],
    [
      'УСН Доходы-Расходы',
      'УСН «Доходы минус расходы»'
    ],
    ['ПСН', 'ПСН'],
    ['ЕСХН', 'ЕСХН'],
    ['НПД', 'НПД'],
    ['Другое', 'Другое']
  ];


  const TAX_RATE_OPTIONS = [
    ['', '—'],
    ['5', '5%'],
    ['6', '6%'],
    ['7', '7%'],
    ['10', '10%'],
    ['12', '12%'],
    ['15', '15%'],
    ['20', '20%'],
    ['22', '22%'],
    ['other', 'Другое']
  ];


  /* ============================================================
     LOAD MAIN DATA
     ============================================================ */

  async function loadClients() {
    showClientsState(
      'loading'
    );

    try {
      const [
        clientsResult,
        activitiesResult,
        reportsResult,
        groupsResult,
        taxSystemsResult,
        documentsResult
      ] =
        await Promise.all([
          state.supabase
            .from(
              CONFIG.tables.clients
            )
            .select('*'),

          state.supabase
            .from(
              CONFIG.tables.activities
            )
            .select('*'),

          state.supabase
            .from(
              CONFIG.tables.reports
            )
            .select('*'),

          state.supabase
            .from(
              CONFIG.tables.groups
            )
            .select('*')
            .order(
              'group_name',
              {
                ascending: true
              }
            ),

          state.supabase
            .from(
              CONFIG.tables.taxSystems
            )
            .select('*')
            .order(
              'sort_order',
              {
                ascending: true
              }
            ),

          state.supabase
            .from(
              CONFIG.tables.documents
            )
            .select(
              'id, client_id'
            )
        ]);


      if (clientsResult.error) {
        throw clientsResult.error;
      }

      if (activitiesResult.error) {
        throw activitiesResult.error;
      }

      if (reportsResult.error) {
        throw reportsResult.error;
      }

      if (groupsResult.error) {
        throw groupsResult.error;
      }

      if (taxSystemsResult.error) {
        throw taxSystemsResult.error;
      }

      if (documentsResult.error) {
        throw documentsResult.error;
      }


      state.clients =
        clientsResult.data || [];

      state.activities =
        activitiesResult.data || [];

      state.reports =
        reportsResult.data || [];

      state.clientGroups =
        groupsResult.data || [];

      state.taxSystems =
        taxSystemsResult.data || [];

      state.clientDocuments =
        documentsResult.data || [];


      renderClientGroupSelect();
      renderFilterOptions();
      renderClients();
      renderOverview();

      $('overview-updated-at').textContent =
        `Обновлено ${new Date().toLocaleTimeString(
          'ru-RU',
          {
            hour: '2-digit',
            minute: '2-digit'
          }
        )}`;

      checkClientNotifications();

    } catch (error) {
      console.error(
        'Ошибка загрузки клиентов:',
        error
      );

      showClientsState(
        'error',
        friendlyError(error)
      );
    }
  }


  /* ============================================================
     CLIENT STATE UI
     ============================================================ */

  function showClientsState(
    stateName,
    errorText = ''
  ) {
    setHidden(
      $('clients-loading'),
      stateName !== 'loading'
    );

    setHidden(
      $('clients-error'),
      stateName !== 'error'
    );

    setHidden(
      $('clients-empty'),
      stateName !== 'empty'
    );

    setHidden(
      $('clients-grid'),
      stateName !== 'grid'
    );

    if (
      stateName === 'error'
    ) {
      $('clients-error-text').textContent =
        errorText;
    }
  }


  /* ============================================================
     FILTER OPTIONS
     ============================================================ */

  function uniqueTextValues(
    values
  ) {
    return Array.from(
      new Set(
        values
          .map(
            value =>
              String(
                value || ''
              ).trim()
          )
          .filter(Boolean)
      )
    ).sort(
      (a, b) =>
        a.localeCompare(
          b,
          'ru'
        )
    );
  }


  function fillFilterSelect(
    id,
    values,
    firstText
  ) {
    const select =
      $(id);

    if (!select) {
      return;
    }

    const old =
      select.value;

    select.innerHTML =
      `<option value="">${escapeHtml(firstText)}</option>` +
      values
        .map(
          value => `
            <option value="${escapeHtml(value)}">
              ${escapeHtml(value)}
            </option>
          `
        )
        .join('');

    select.value =
      values.includes(old)
        ? old
        : '';
  }


  function renderFilterOptions() {
    fillFilterSelect(
      'filter-org-form',
      uniqueTextValues(
        state.clients.map(
          client =>
            client.org_form
        )
      ),
      'Все'
    );

    fillFilterSelect(
      'filter-tax-system',
      uniqueTextValues(
        state.taxSystems.map(
          item =>
            item.tax_system
        )
      ),
      'Все'
    );
  }

  function getTaxSystemsForClient(
    clientId
  ) {
    return state.taxSystems
      .filter(
        item =>
          item.client_id ===
          clientId
      )
      .sort(
        (a, b) =>
          Number(a.sort_order || 0) -
          Number(b.sort_order || 0)
      );
  }


  function taxRateLabel(item) {
    if (!item) {
      return '';
    }

    if (
      item.rate_code === 'other'
    ) {
      return item.custom_rate || 'Другое';
    }

    return item.rate_code
      ? item.rate_code + '%'
      : '';
  }


  function taxSystemLabel(item) {
    if (!item) {
      return '';
    }

    const rate =
      taxRateLabel(item);

    return (
      item.tax_system +
      (
        rate
          ? ' — ' + rate
          : ''
      )
    );
  }


  function taxSystemsTextForClient(
    client
  ) {
    const items =
      getTaxSystemsForClient(
        client.id
      );

    if (items.length) {
      return items
        .map(taxSystemLabel)
        .join(', ');
    }

    return client.tax_system || '';
  }


  function selectOptionsHtml(
    options,
    selected,
    emptyLabel = null
  ) {
    const empty =
      emptyLabel === null
        ? ''
        : (
            '<option value="">' +
            escapeHtml(emptyLabel) +
            '</option>'
          );

    return (
      empty +
      options
        .map(
          option => {
            const value =
              option[0];

            return (
              '<option value="' +
              escapeHtml(value) +
              '"' +
              (
                value === selected
                  ? ' selected'
                  : ''
              ) +
              '>' +
              escapeHtml(option[1]) +
              '</option>'
            );
          }
        )
        .join('')
    );
  }


  function renderTaxSystemsEditor() {
    const box =
      $('client-tax-systems-list');

    if (!box) {
      return;
    }

    if (
      !state.currentClientTaxSystems.length
    ) {
      box.innerHTML =
        '<div class="tax-system-empty">' +
        'Системы налогообложения не добавлены.' +
        '</div>';

      return;
    }

    box.innerHTML =
      state.currentClientTaxSystems
        .map(
          item => {
            const localId =
              item.local_id ||
              item.id ||
              createId();

            item.local_id =
              localId;

            const customHidden =
              item.rate_code === 'other'
                ? ''
                : ' hidden';

            return (
              '<div class="tax-system-row"' +
              ' data-tax-system-row="' +
              escapeHtml(localId) +
              '"' +
              ' data-tax-record-id="' +
              escapeHtml(item.id || '') +
              '">' +
                '<div class="field">' +
                  '<label class="field-label">Система</label>' +
                  '<select class="select tax-system-select">' +
                    selectOptionsHtml(
                      TAX_SYSTEM_OPTIONS,
                      item.tax_system || '',
                      '— выбрать —'
                    ) +
                  '</select>' +
                '</div>' +
                '<div class="field">' +
                  '<label class="field-label">Ставка</label>' +
                  '<select class="select tax-rate-select">' +
                    selectOptionsHtml(
                      TAX_RATE_OPTIONS,
                      item.rate_code || ''
                    ) +
                  '</select>' +
                '</div>' +
                '<div class="field tax-custom-rate-field' +
                  customHidden +
                '">' +
                  '<label class="field-label">Другая ставка</label>' +
                  '<input class="input tax-custom-rate"' +
                    ' type="text"' +
                    ' value="' +
                    escapeHtml(item.custom_rate || '') +
                    '"' +
                    ' placeholder="Например, 4% или по патенту">' +
                '</div>' +
                '<button class="btn btn-ghost btn-sm"' +
                  ' type="button"' +
                  ' data-remove-tax-system="' +
                  escapeHtml(localId) +
                  '"' +
                  ' aria-label="Удалить систему">' +
                  '×' +
                '</button>' +
              '</div>'
            );
          }
        )
        .join('');

    bindTaxSystemRows();
  }


  function bindTaxSystemRows() {
    $all(
      '[data-remove-tax-system]'
    ).forEach(
      button => {
        button.addEventListener(
          'click',
          () =>
            removeTaxSystemRow(
              button.dataset.removeTaxSystem
            )
        );
      }
    );

    $all(
      '.tax-rate-select',
      $('client-tax-systems-list')
    ).forEach(
      select => {
        select.addEventListener(
          'change',
          () => {
            const row =
              select.closest(
                '[data-tax-system-row]'
              );

            setHidden(
              row.querySelector(
                '.tax-custom-rate-field'
              ),
              select.value !== 'other'
            );
          }
        );
      }
    );
  }


  function collectTaxSystemsFromForm(
    validate = false
  ) {
    return $all(
      '[data-tax-system-row]',
      $('client-tax-systems-list')
    )
      .map(
        (row, index) => {
          const taxSystem =
            row.querySelector(
              '.tax-system-select'
            ).value;

          const rateCode =
            row.querySelector(
              '.tax-rate-select'
            ).value;

          const customRate =
            nullableText(
              row.querySelector(
                '.tax-custom-rate'
              ).value
            );

          if (
            !taxSystem &&
            !rateCode &&
            !customRate
          ) {
            return null;
          }

          if (
            validate &&
            !taxSystem
          ) {
            throw new Error(
              'Выберите систему налогообложения.'
            );
          }

          if (
            validate &&
            rateCode === 'other' &&
            !customRate
          ) {
            throw new Error(
              'Укажите собственное значение ставки.'
            );
          }

          const id =
            row.dataset.taxRecordId ||
            null;

          const existing =
            state.currentClientTaxSystems
              .find(
                item =>
                  item.id === id
              );

          return {
            id,
            local_id:
              row.dataset.taxSystemRow,
            tax_system:
              taxSystem,
            rate_code:
              rateCode,
            custom_rate:
              rateCode === 'other'
                ? customRate
                : null,
            sort_order:
              index,
            created_by:
              existing?.created_by ||
              null
          };
        }
      )
      .filter(Boolean);
  }


  function syncTaxSystemDrafts() {
    state.currentClientTaxSystems =
      collectTaxSystemsFromForm();
  }


  function addTaxSystemRow() {
    syncTaxSystemDrafts();

    state.currentClientTaxSystems
      .push({
        id: null,
        local_id:
          createId(),
        tax_system: '',
        rate_code: '',
        custom_rate: null,
        sort_order:
          state.currentClientTaxSystems
            .length
      });

    renderTaxSystemsEditor();
  }


  function removeTaxSystemRow(
    localId
  ) {
    syncTaxSystemDrafts();

    state.currentClientTaxSystems =
      state.currentClientTaxSystems
        .filter(
          item =>
            item.local_id !==
            localId
        );

    renderTaxSystemsEditor();
  }


  async function saveClientTaxSystems(
    clientId,
    items
  ) {
    const existingIds =
      getTaxSystemsForClient(
        clientId
      )
        .map(item => item.id)
        .filter(Boolean);

    const keptIds =
      items
        .map(item => item.id)
        .filter(Boolean);

    const removedIds =
      existingIds.filter(
        id =>
          !keptIds.includes(id)
      );

    if (removedIds.length) {
      const {
        error
      } =
        await state.supabase
          .from(
            CONFIG.tables.taxSystems
          )
          .delete()
          .in(
            'id',
            removedIds
          );

      if (error) {
        throw error;
      }
    }

    if (!items.length) {
      state.currentClientTaxSystems = [];
      return;
    }

    const payload =
      items.map(
        (item, index) => ({
          id:
            item.id ||
            createId(),
          client_id:
            clientId,
          tax_system:
            item.tax_system,
          rate_code:
            item.rate_code || '',
          custom_rate:
            item.rate_code === 'other'
              ? item.custom_rate
              : null,
          sort_order:
            index,
          created_by:
            item.created_by ||
            state.user.id,
          updated_by:
            state.user.id,
          updated_at:
            new Date().toISOString()
        })
      );

    const {
      data,
      error
    } =
      await state.supabase
        .from(
          CONFIG.tables.taxSystems
        )
        .upsert(
          payload,
          {
            onConflict: 'id'
          }
        )
        .select('*');

    if (error) {
      throw error;
    }

    state.currentClientTaxSystems =
      data || [];
  }

  function openClientGroupModal() {
    $('client-group-name').value =
      '';

    openModal(
      'client-group-modal'
    );

    setTimeout(
      () =>
        $('client-group-name')
          ?.focus(),
      70
    );
  }


  async function saveClientGroup() {
    const name =
      $('client-group-name')
        .value
        .trim();

    if (!name) {
      toast(
        'Укажите название группы',
        'err'
      );

      return;
    }

    const button =
      $('btn-save-client-group');

    try {
      setButtonBusy(
        button,
        true,
        'Создаём…'
      );

      const {
        data,
        error
      } =
        await state.supabase
          .from(
            CONFIG.tables.groups
          )
          .insert({
            group_name:
              name,
            created_by:
              state.user.id,
            updated_by:
              state.user.id
          })
          .select('*')
          .single();

      if (error) {
        throw error;
      }

      state.clientGroups
        .push(data);

      renderClientGroupSelect(
        data.id
      );

      closeModal(
        'client-group-modal'
      );

      renderClients();

      toast(
        'Группа создана',
        'ok'
      );

    } catch (error) {
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
     ACTIVITIES HELPERS
     ============================================================ */

  function getActivitiesForClient(
    clientId
  ) {
    return state.activities
      .filter(
        item =>
          item.client_id ===
          clientId
      )
      .sort(
        (a, b) =>
          a.activity_name.localeCompare(
            b.activity_name,
            'ru'
          )
      );
  }


  function activityTextForClient(
    client
  ) {
    const activities =
      getActivitiesForClient(
        client.id
      );

    if (
      activities.length
    ) {
      return activities
        .map(
          item =>
            item.activity_name
        )
        .join(' ');
    }

    return client.activity || '';
  }


  /* ============================================================
     REPORTING HELPERS
     ============================================================ */

  function isReportOverdue(
    report
  ) {
    if (
      !report?.due_date
    ) {
      return false;
    }

    if (
      report.status ===
        'submitted' ||
      report.status ===
        'not_required'
    ) {
      return false;
    }

    const due =
      fromISODate(
        report.due_date
      );

    if (!due) {
      return false;
    }

    return (
      due.getTime() <
      todayDate().getTime()
    );
  }


  function getReportsForClient(
    clientId
  ) {
    return state.reports
      .filter(
        report =>
          report.client_id ===
          clientId
      );
  }


  function getLatestReport(
    clientId
  ) {
    const reports =
      getReportsForClient(
        clientId
      );

    if (!reports.length) {
      return null;
    }

    return reports
      .slice()
      .sort(
        (a, b) => {
          const dueA =
            a.due_date ||
            `${a.report_year}-01-01`;

          const dueB =
            b.due_date ||
            `${b.report_year}-01-01`;

          return dueB.localeCompare(
            dueA
          );
        }
      )[0];
  }


  /* ============================================================
     WARNING HELPERS
     ============================================================ */

  function getEcpState(client) {
    if (!client.ecp_expires_at) {
      return {
        level: 'none',
        days: null
      };
    }

    const days =
      daysUntil(
        client.ecp_expires_at
      );

    if (days === null) {
      return {
        level: 'none',
        days: null
      };
    }

    if (days < 0) {
      return {
        level: 'danger',
        days
      };
    }

    const threshold =
      Number(
        client.ecp_reminder_days
      ) ||
      CONFIG.ecpDefaultWarningDays;

    if (
      client.ecp_reminder_enabled !==
        false &&
      days <= threshold
    ) {
      return {
        level: 'warning',
        days
      };
    }

    return {
      level: 'ok',
      days
    };
  }


  function getOneCState(client) {
    if (!client.one_c_expires_at) {
      return {
        level: 'none',
        days: null
      };
    }

    const days =
      daysUntil(
        client.one_c_expires_at
      );

    if (days === null) {
      return {
        level: 'none',
        days: null
      };
    }

    if (days < 0) {
      return {
        level: 'danger',
        days
      };
    }

    if (
      days <=
      CONFIG.oneCWarningDays
    ) {
      return {
        level: 'warning',
        days
      };
    }

    return {
      level: 'ok',
      days
    };
  }


  function formatExpiryMessage(
    label,
    info
  ) {
    if (
      info.level === 'danger'
    ) {
      return (
        `${label} истекла ` +
        `${Math.abs(info.days)} дн. назад`
      );
    }

    if (
      info.level === 'warning'
    ) {
      if (info.days === 0) {
        return `${label} истекает сегодня`;
      }

      return (
        `${label}: осталось ${info.days} дн.`
      );
    }

    return '';
  }


  /* ============================================================
     CLIENT FILTERING
     ============================================================ */

  function getVisibleClients() {
    let list =
      state.clients
        .slice();


    const query =
      state.filters.query
        .toLowerCase()
        .trim();


    if (query) {
      list =
        list.filter(
          client => {
            const activity =
              activityTextForClient(
                client
              );

            const taxSystems =
              taxSystemsTextForClient(
                client
              );

            const group =
              getClientGroup(
                client.client_group_id
              );

            const blob =
              [
                client.client_name,
                client.short_name,
                client.inn,
                client.phone,
                client.email,
                activity,
                client.service_contract_number,
                client.org_form,
                taxSystems,
                group?.group_name,
                client.edo_identifier
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return blob.includes(
              query
            );
          }
        );
    }


    if (
      state.filters.status
    ) {
      list =
        list.filter(
          client =>
            client.status ===
            state.filters.status
        );
    }


    if (
      state.filters.orgForm
    ) {
      list =
        list.filter(
          client =>
            client.org_form ===
            state.filters.orgForm
        );
    }


    if (
      state.filters.taxSystem
    ) {
      list =
        list.filter(
          client =>
            getTaxSystemsForClient(
              client.id
            ).some(
              item =>
                item.tax_system ===
                state.filters.taxSystem
            ) ||
            (
              !getTaxSystemsForClient(
                client.id
              ).length &&
              client.tax_system ===
                state.filters.taxSystem
            )
        );
    }


    if (
      state.filters.responsible
    ) {
      list =
        list.filter(
          client =>
            client.responsible_user ===
            state.filters.responsible
        );
    }


    sortClients(list);

    return list;
  }


  function sortClients(list) {
    switch (state.sort) {

      case 'name_desc':
        list.sort(
          (a, b) =>
            String(
              b.client_name || ''
            ).localeCompare(
              String(
                a.client_name || ''
              ),
              'ru'
            )
        );
        break;


      case 'contract':
        list.sort(
          (a, b) =>
            String(
              a.service_contract_number ||
              ''
            ).localeCompare(
              String(
                b.service_contract_number ||
                ''
              ),
              'ru',
              {
                numeric: true
              }
            )
        );
        break;


      case 'org_form':
        list.sort(
          (a, b) =>
            String(
              a.org_form || ''
            ).localeCompare(
              String(
                b.org_form || ''
              ),
              'ru'
            )
        );
        break;


      case 'tax_system':
        list.sort(
          (a, b) =>
            taxSystemsTextForClient(a)
              .localeCompare(
              taxSystemsTextForClient(b),
              'ru'
            )
        );
        break;


      case 'activity':
        list.sort(
          (a, b) =>
            activityTextForClient(a)
              .localeCompare(
                activityTextForClient(b),
                'ru'
              )
        );
        break;


      case 'name_asc':
      default:
        list.sort(
          (a, b) =>
            String(
              a.client_name || ''
            ).localeCompare(
              String(
                b.client_name || ''
              ),
              'ru'
            )
        );
    }
  }


  /* ============================================================
     CLIENT CARDS
     ============================================================ */

  function renderClients() {
    const grid =
      $('clients-grid');

    const list =
      getVisibleClients();


    if (
      !state.clients.length
    ) {
      showClientsState(
        'empty'
      );

      return;
    }


    showClientsState(
      'grid'
    );


    if (!list.length) {
      grid.innerHTML = `
        <div
          class="state-box"
          style="grid-column:1/-1;"
        >
          <div>
            <div class="state-icon">
              ?
            </div>

            <div class="state-title">
              Ничего не найдено
            </div>

            <div class="state-text">
              Попробуйте изменить поиск или фильтры.
            </div>
          </div>
        </div>
      `;

      return;
    }


    if (
      state.viewMode === 'groups'
    ) {
      renderGroupedClients(
        grid,
        list
      );

    } else {
      grid.innerHTML =
        list
          .map(
            buildClientCard
          )
          .join('');
    }


    bindClientCards();
  }

  function bindClientCards() {
    $all(
      '[data-client-card]'
    ).forEach(
      card => {
        card.addEventListener(
          'click',
          () =>
            openClient(
              card.dataset.clientCard
            )
        );
      }
    );

    $all(
      '[data-client-documents]'
    ).forEach(
      link => {
        link.addEventListener(
          'click',
          event => {
            event.stopPropagation();
          }
        );
      }
    );
  }


  function renderGroupedClients(
    grid,
    clients
  ) {
    const sections =
      new Map();

    for (
      const client
      of clients
    ) {
      const group =
        getClientGroup(
          client.client_group_id
        );

      const key =
        group?.id ||
        '__ungrouped__';

      if (!sections.has(key)) {
        sections.set(
          key,
          {
            name:
              group?.group_name ||
              'Без группы',
            ungrouped:
              !group,
            clients: []
          }
        );
      }

      sections.get(key)
        .clients
        .push(client);
    }

    const ordered =
      Array.from(
        sections.values()
      )
        .sort(
          (a, b) => {
            if (
              a.ungrouped !==
              b.ungrouped
            ) {
              return a.ungrouped
                ? 1
                : -1;
            }

            return a.name
              .localeCompare(
                b.name,
                'ru'
              );
          }
        );

    grid.innerHTML =
      ordered
        .map(
          section =>
            '<section class="client-group-section">' +
              '<div class="client-group-head">' +
                '<div class="client-group-title">' +
                  escapeHtml(section.name) +
                '</div>' +
                '<div class="client-group-count">' +
                  section.clients.length +
                  ' ' +
                  (
                    section.clients.length === 1
                      ? 'клиент'
                      : 'клиентов'
                  ) +
                '</div>' +
              '</div>' +
              '<div class="client-group-grid">' +
                section.clients
                  .map(
                    buildClientCard
                  )
                  .join('') +
              '</div>' +
            '</section>'
        )
        .join('');
  }


  function buildClientCard(client) {
    const profile =
      getProfile(
        client.responsible_user
      );

    const activities =
      getActivitiesForClient(
        client.id
      );

    const taxSystems =
      taxSystemsTextForClient(
        client
      );

    const group =
      getClientGroup(
        client.client_group_id
      );

    const ecp =
      getEcpState(client);

    const documentsCount =
      state.clientDocuments.filter(
        item =>
          item.client_id === client.id
      ).length;

    let warningClass = '';

    if (
      ecp.level === 'danger'
    ) {
      warningClass =
        'ecp-danger';

    } else if (
      ecp.level === 'warning'
    ) {
      warningClass =
        'ecp-warning';
    }


    let warningHtml = '';

    if (
      ecp.level === 'warning' ||
      ecp.level === 'danger'
    ) {
      warningHtml = `
        <div
          class="client-warning
          ${
            ecp.level === 'danger'
              ? 'danger'
              : ''
          }"
        >
          <span class="warning-symbol">
            !
          </span>

          ${escapeHtml(
            formatExpiryMessage(
              'ЭЦП',
              ecp
            )
          )}
        </div>
      `;
    }


    const tags =
      activities.length
        ? activities
        : (
            client.activity
              ? [
                  {
                    activity_name:
                      client.activity
                  }
                ]
              : []
          );


    return `
      <article
        class="client-card ${warningClass}"
        data-client-card="${escapeHtml(client.id)}"
      >

        <div class="client-card-head">

          <div class="client-name">
            ${escapeHtml(client.client_name)}
          </div>

          <span
            class="client-status
              ${
                client.status === 'active'
                  ? ''
                  : 'inactive'
              }"
          >
            ${
              client.status === 'active'
                ? 'Активный'
                : client.status === 'archived'
                  ? 'Архив'
                  : 'Неактивный'
            }
          </span>

        </div>


        <div class="client-meta">

          <div class="client-meta-row">
            <strong>ИНН:</strong>
            ${escapeHtml(client.inn || '—')}
          </div>

          <div class="client-meta-row">
            <strong>Тел.:</strong>
            ${escapeHtml(client.phone || '—')}
          </div>

          <div class="client-meta-row">
            <strong>Налоги:</strong>
            ${escapeHtml(taxSystems || '—')}
          </div>

          ${
            client.vat_enabled === true
              ? `
                <div class="client-meta-row">
                  <strong>НДС:</strong>
                  ${escapeHtml(
                    client.vat_rate !== null &&
                    client.vat_rate !== undefined &&
                    client.vat_rate !== ''
                      ? String(client.vat_rate) + '%'
                      : 'ставка не указана'
                  )}
                </div>
              `
              : ''
          }

          ${
            profile
              ? `
                <div class="client-meta-row">
                  <strong>Ответственный:</strong>
                  ${escapeHtml(profileName(profile))}
                </div>
              `
              : ''
          }

        </div>


        ${
          group
            ? `
              <div class="group-badge">
                Связан с: ${escapeHtml(group.group_name)}
              </div>
            `
            : ''
        }


        ${
          tags.length
            ? `
              <div class="client-tags">
                ${tags
                  .slice(0, 3)
                  .map(
                    item => `
                      <span class="tag">
                        ${escapeHtml(item.activity_name)}
                      </span>
                    `
                  )
                  .join('')}

                ${
                  tags.length > 3
                    ? `
                      <span class="tag">
                        +${tags.length - 3}
                      </span>
                    `
                    : ''
                }
              </div>
            `
            : ''
        }


        ${warningHtml}

        <div class="client-document-actions">
          <a
            class="client-document-link"
            data-client-documents="${escapeHtml(client.id)}"
            href="DB_dogovornoi-centr.html?client=${encodeURIComponent(client.id)}&view=journal"
          >
            Документы · ${documentsCount}
          </a>
        </div>

      </article>
    `;
  }


  /* ============================================================
     OVERVIEW
     ============================================================ */

  function renderOverview() {
    const activeClients =
      state.clients.filter(
        client =>
          client.status === 'active'
      );

    $('metric-active-clients').textContent =
      String(
        activeClients.length
      );


    const overdueReports =
      state.reports.filter(
        isReportOverdue
      );

    $('metric-reporting-ok').textContent =
      String(
        overdueReports.length
      );


    const reportingCard =
      $('metric-reporting-card');

    reportingCard.classList.remove(
      'success',
      'danger',
      'warning'
    );


    if (
      overdueReports.length
    ) {
      reportingCard.classList.add(
        'danger'
      );

      $('metric-reporting-note').textContent =
        `Просрочено: ${overdueReports.length}`;

    } else {
      reportingCard.classList.add(
        'success'
      );

      $('metric-reporting-note').textContent =
        'Без просроченных отчётов';
    }


    const ecpWarnings =
      activeClients.filter(
        client => {
          const info =
            getEcpState(client);

          return (
            info.level === 'warning' ||
            info.level === 'danger'
          );
        }
      );

    $('metric-ecp-warning').textContent =
      String(
        ecpWarnings.length
      );


    const ecpCard =
      $('metric-ecp-card');

    ecpCard.classList.remove(
      'warning',
      'danger'
    );


    if (
      ecpWarnings.some(
        client =>
          getEcpState(client)
            .level ===
          'danger'
      )
    ) {
      ecpCard.classList.add(
        'danger'
      );

    } else if (
      ecpWarnings.length
    ) {
      ecpCard.classList.add(
        'warning'
      );
    }


    const oneCWarnings =
      activeClients.filter(
        client => {
          const info =
            getOneCState(client);

          return (
            info.level === 'warning' ||
            info.level === 'danger'
          );
        }
      );


    $('metric-1c-warning').textContent =
      String(
        oneCWarnings.length
      );


    const oneCCard =
      $('metric-1c-card');

    oneCCard.classList.remove(
      'warning',
      'danger'
    );


    if (
      oneCWarnings.some(
        client =>
          getOneCState(client)
            .level ===
          'danger'
      )
    ) {
      oneCCard.classList.add(
        'danger'
      );

    } else if (
      oneCWarnings.length
    ) {
      oneCCard.classList.add(
        'warning'
      );
    }
  }


  /* ============================================================
     DRAWER
     ============================================================ */

  function openDrawer() {
    $('client-drawer')
      .classList.add(
        'active'
      );

    $('client-drawer-backdrop')
      .classList.add(
        'active'
      );

    $('client-drawer')
      .setAttribute(
        'aria-hidden',
        'false'
      );

    document.body.style.overflow =
      'hidden';
  }


  function closeDrawer() {
    $('client-drawer')
      .classList.remove(
        'active'
      );

    $('client-drawer-backdrop')
      .classList.remove(
        'active'
      );

    $('client-drawer')
      .setAttribute(
        'aria-hidden',
        'true'
      );

    document.body.style.overflow =
      '';
  }


  /* ============================================================
     RESET CLIENT FORM
     ============================================================ */

  function resetClientForm() {
    state.currentClientId =
      null;

    state.currentClientTaxSystems = [];
    state.currentClientContacts = [];
    state.currentClientBanks = [];
    state.currentClientReports = [];
    state.currentClientCommunication = [];

    state.currentSecrets = [];
    state.currentSecretAudit = [];


    const valueIds = [
      'client-id',
      'client-name',
      'client-short-name',
      'client-inn',
      'client-kpp',
      'client-ogrn',
      'client-phone',
      'client-email',
      'client-folder-url',
      'client-legal-address',
      'client-actual-address',
      'client-location',
      'client-contract-number',
      'client-contract-date',
      'client-cooperation-format',
      'client-service-price',
      'client-discounts',
      'client-vat-rate',
      'client-edo-operator',
      'client-edo-identifier',
      'client-ecp-expires',
      'client-1c-expires',
      'client-employees-count',
      'client-salary-dates',
      'client-reporting-channel',
      'client-notes'
    ];


    valueIds.forEach(
      id => {
        const element =
          $(id);

        if (element) {
          element.value = '';
        }
      }
    );


    $('client-org-form').value =
      '';

    $('client-communication-method').value =
      '';

    $('client-responsible').value =
      state.user?.id || '';

    $('client-status').value =
      'active';

    renderClientGroupSelect(
      ''
    );

    $('client-vat-enabled').checked =
      false;

    $('client-edo-enabled').checked =
      false;

    $('client-ecp-reminder-enabled').checked =
      true;

    $('client-ecp-reminder-days').value =
      '7';


    setHidden(
      $('vat-rate-field'),
      true
    );

    setHidden(
      $('edo-operator-field'),
      true
    );

    setHidden(
      $('edo-identifier-field'),
      true
    );


    setHidden(
      $('btn-delete-client'),
      true
    );

    setHidden(
      $('btn-open-client-folder'),
      true
    );


    $('drawer-client-title').textContent =
      'Новый клиент';

    $('drawer-client-subtitle').textContent =
      'Заполните основные данные';


    renderCurrentActivities();
    renderTaxSystemsEditor();
    renderContacts();
    renderBankAccounts();
    renderReports();
    renderCommunication();
    renderSecretsPlaceholder();
    renderAuditPlaceholder();

    renderQuickPanel(null);

    switchClientTab(
      'main'
    );
  }


  /* ============================================================
     OPEN CLIENT
     ============================================================ */

  async function openClient(
    clientId
  ) {
    const client =
      state.clients.find(
        item =>
          item.id === clientId
      );

    if (!client) {
      toast(
        'Клиент не найден',
        'err'
      );

      return;
    }


    resetClientForm();

    state.currentClientId =
      client.id;


    fillClientForm(client);

    openDrawer();


    try {
      await loadClientDetails(
        client.id
      );

      renderQuickPanel(
        client
      );

    } catch (error) {
      console.error(error);

      toast(
        friendlyError(error),
        'err'
      );
    }
  }


  /* ============================================================
     NEW CLIENT
     ============================================================ */

  function openNewClient() {
    resetClientForm();
    openDrawer();

    setTimeout(
      () =>
        $('client-name')
          ?.focus(),
      80
    );
  }


  /* ============================================================
     FILL CLIENT FORM
     ============================================================ */

  function fillClientForm(client) {
    $('client-id').value =
      client.id;

    $('client-name').value =
      client.client_name || '';

    $('client-short-name').value =
      client.short_name || '';

    $('client-org-form').value =
      client.org_form || '';

    $('client-inn').value =
      client.inn || '';

    $('client-kpp').value =
      client.kpp || '';

    $('client-ogrn').value =
      client.ogrn || '';

    $('client-phone').value =
      client.phone || '';

    $('client-email').value =
      client.email || '';

    $('client-communication-method').value =
      client.preferred_communication_method ||
      '';

    $('client-responsible').value =
      client.responsible_user ||
      '';

    renderClientGroupSelect(
      client.client_group_id ||
      ''
    );

    $('client-folder-url').value =
      client.folder_url || '';

    $('client-legal-address').value =
      client.legal_address || '';

    $('client-actual-address').value =
      client.actual_address || '';

    $('client-location').value =
      client.location || '';

    $('client-contract-number').value =
      client.service_contract_number ||
      '';

    $('client-contract-date').value =
      client.service_contract_date ||
      '';

    $('client-cooperation-format').value =
      client.cooperation_format ||
      '';

    $('client-service-price').value =
      client.service_price ??
      '';

    $('client-discounts').value =
      client.discounts_promotions ||
      '';

    $('client-status').value =
      client.status || 'active';

    state.currentClientTaxSystems =
      getTaxSystemsForClient(
        client.id
      )
        .map(
          item => ({
            ...item,
            local_id:
              item.id
          })
        );

    renderTaxSystemsEditor();

    $('client-vat-enabled').checked =
      client.vat_enabled === true;

    $('client-vat-rate').value =
      client.vat_rate ??
      '';

    $('client-edo-enabled').checked =
      client.edo_enabled === true;

    $('client-edo-operator').value =
      client.edo_operator || '';

    $('client-edo-identifier').value =
      client.edo_identifier || '';

    $('client-ecp-expires').value =
      client.ecp_expires_at || '';

    $('client-ecp-reminder-enabled').checked =
      client.ecp_reminder_enabled !==
      false;

    $('client-ecp-reminder-days').value =
      client.ecp_reminder_days ??
      7;

    $('client-1c-expires').value =
      client.one_c_expires_at ||
      '';

    $('client-employees-count').value =
      client.employees_count ??
      '';

    $('client-salary-dates').value =
      formatSalaryDatesInput(
        client.salary_payment_dates
      );

    $('client-reporting-channel').value =
      client.reporting_channel ||
      '';

    $('client-notes').value =
      client.notes || '';


    setHidden(
      $('vat-rate-field'),
      !client.vat_enabled
    );

    setHidden(
      $('edo-operator-field'),
      !client.edo_enabled
    );

    setHidden(
      $('edo-identifier-field'),
      !client.edo_enabled
    );


    $('drawer-client-title').textContent =
      client.client_name;

    $('drawer-client-subtitle').textContent =
      [
        client.inn
          ? `ИНН ${client.inn}`
          : '',
        taxSystemsTextForClient(
          client
        )
      ]
        .filter(Boolean)
        .join(' • ') ||
      'Карточка клиента';


    setHidden(
      $('btn-delete-client'),
      false
    );


    updateFolderLink(
      client.folder_url
    );
  }


  /* ============================================================
     FOLDER LINK
     ============================================================ */

  function updateFolderLink(url) {
    const button =
      $('btn-open-client-folder');

    if (!button) {
      return;
    }

    if (!url) {
      setHidden(
        button,
        true
      );

      button.removeAttribute(
        'href'
      );

      return;
    }

    try {
      const parsed =
        new URL(url);

      if (
        parsed.protocol !== 'https:' &&
        parsed.protocol !== 'http:'
      ) {
        throw new Error();
      }

      button.href =
        parsed.href;

      setHidden(
        button,
        false
      );

    } catch {
      setHidden(
        button,
        true
      );
    }
  }


  /* ============================================================
     SALARY DATES
     ============================================================ */

  function parseSalaryDates(value) {
    const text =
      String(
        value || ''
      ).trim();

    if (!text) {
      return [];
    }

    return Array.from(
      new Set(
        text
          .split(/[,\s;]+/)
          .map(Number)
          .filter(
            day =>
              Number.isInteger(day) &&
              day >= 1 &&
              day <= 31
          )
      )
    ).sort(
      (a, b) =>
        a - b
    );
  }


  function formatSalaryDatesInput(value) {
    if (!Array.isArray(value)) {
      return '';
    }

    return value
      .map(
        item => {
          if (
            typeof item ===
            'number'
          ) {
            return item;
          }

          return item?.day;
        }
      )
      .filter(Boolean)
      .join(', ');
  }


  /* ============================================================
     BUILD CLIENT PAYLOAD
     ============================================================ */

  function buildClientPayload(
    taxSystems = []
  ) {
    const name =
      $('client-name')
        .value
        .trim();

    if (!name) {
      throw new Error(
        'Укажите название клиента.'
      );
    }


    const vatEnabled =
      $('client-vat-enabled')
        .checked;

    const edoEnabled =
      $('client-edo-enabled')
        .checked;


    return {
      client_name:
        name,

      short_name:
        nullableText(
          $('client-short-name').value
        ),

      org_form:
        nullableText(
          $('client-org-form').value
        ),

      inn:
        nullableText(
          $('client-inn').value
        ),

      kpp:
        nullableText(
          $('client-kpp').value
        ),

      ogrn:
        nullableText(
          $('client-ogrn').value
        ),

      phone:
        nullableText(
          $('client-phone').value
        ),

      email:
        nullableText(
          $('client-email').value
        ),

      preferred_communication_method:
        nullableText(
          $('client-communication-method')
            .value
        ),

      legal_address:
        nullableText(
          $('client-legal-address').value
        ),

      actual_address:
        nullableText(
          $('client-actual-address').value
        ),

      status:
        $('client-status').value ||
        'active',

      notes:
        nullableText(
          $('client-notes').value
        ),

      responsible_user:
        nullableText(
          $('client-responsible').value
        ),

      client_group_id:
        nullableText(
          $('client-group').value
        ),

      folder_url:
        nullableText(
          $('client-folder-url').value
        ),

      service_contract_number:
        nullableText(
          $('client-contract-number').value
        ),

      service_contract_date:
        nullableText(
          $('client-contract-date').value
        ),

      cooperation_format:
        nullableText(
          $('client-cooperation-format').value
        ),

      service_price:
        numberOrNull(
          $('client-service-price').value
        ),

      discounts_promotions:
        nullableText(
          $('client-discounts').value
        ),

      tax_system:
        taxSystems[0]
          ?.tax_system ||
        null,

      vat_enabled:
        vatEnabled,

      vat_rate:
        vatEnabled
          ? numberOrNull(
              $('client-vat-rate').value
            )
          : null,

      edo_enabled:
        edoEnabled,

      edo_operator:
        edoEnabled
          ? nullableText(
              $('client-edo-operator').value
            )
          : null,

      edo_identifier:
        edoEnabled
          ? nullableText(
              $('client-edo-identifier').value
            )
          : null,

      ecp_expires_at:
        nullableText(
          $('client-ecp-expires').value
        ),

      ecp_reminder_enabled:
        $('client-ecp-reminder-enabled')
          .checked,

      ecp_reminder_days:
        Number(
          $('client-ecp-reminder-days')
            .value || 7
        ),

      one_c_expires_at:
        nullableText(
          $('client-1c-expires').value
        ),

      employees_count:
        numberOrNull(
          $('client-employees-count').value
        ),

      salary_payment_dates:
        parseSalaryDates(
          $('client-salary-dates').value
        ),

      location:
        nullableText(
          $('client-location').value
        ),

      reporting_channel:
        nullableText(
          $('client-reporting-channel').value
        ),

      updated_by:
        state.user.id
    };
  }


  /* ============================================================
     SAVE CLIENT
     ============================================================ */

  async function saveClient() {
    const button =
      $('btn-save-client');

    try {
      setButtonBusy(
        button,
        true
      );


      const taxSystems =
        collectTaxSystemsFromForm(
          true
        );

      const payload =
        buildClientPayload(
          taxSystems
        );


      let saved;


      if (
        state.currentClientId
      ) {
        const {
          data,
          error
        } =
          await state.supabase
            .from(
              CONFIG.tables.clients
            )
            .update(payload)
            .eq(
              'id',
              state.currentClientId
            )
            .select()
            .single();

        if (error) {
          throw error;
        }

        saved =
          data;

      } else {
        payload.created_by =
          state.user.id;

        const {
          data,
          error
        } =
          await state.supabase
            .from(
              CONFIG.tables.clients
            )
            .insert(payload)
            .select()
            .single();

        if (error) {
          throw error;
        }

        saved =
          data;

        state.currentClientId =
          saved.id;
      }


      await saveClientTaxSystems(
        saved.id,
        taxSystems
      );

      state.taxSystems = [
        ...state.taxSystems.filter(
          item =>
            item.client_id !==
            saved.id
        ),
        ...state.currentClientTaxSystems
      ];

      fillClientForm(saved);

      toast(
        'Клиент сохранён',
        'ok'
      );


      await loadClients();

      await loadClientDetails(
        saved.id
      );


    } catch (error) {
      console.error(
        'Ошибка сохранения клиента:',
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
     DELETE CLIENT
     ============================================================ */

  function requestDeleteClient() {
    if (
      !state.currentClientId
    ) {
      return;
    }

    const client =
      state.clients.find(
        item =>
          item.id ===
          state.currentClientId
      );


    confirmDialog(
      'Удалить клиента?',
      `Карточка «${
        client?.client_name ||
        'клиент'
      }» и связанные обычные данные будут удалены. Действие необратимо.`,
      deleteCurrentClient
    );
  }


  async function deleteCurrentClient() {
    if (
      !state.currentClientId
    ) {
      return;
    }


    try {
      /*
       * Защищённые секреты специально не удаляем
       * прямым SQL/API вызовом из браузера.
       *
       * Если у клиента существуют секреты,
       * сначала удаляем каждый через Edge Function,
       * чтобы сохранился аудит.
       */

      if (isManager()) {
        await loadSecrets();

        for (
          const secret
          of state.currentSecrets
        ) {
          await invokeSecrets({
            action: 'delete',
            secret_id:
              secret.id
          });
        }
      }


      const {
        error
      } =
        await state.supabase
          .from(
            CONFIG.tables.clients
          )
          .delete()
          .eq(
            'id',
            state.currentClientId
          );

      if (error) {
        throw error;
      }


      closeDrawer();

      toast(
        'Клиент удалён',
        'ok'
      );

      state.currentClientId =
        null;

      await loadClients();


    } catch (error) {
      console.error(error);

      toast(
        friendlyError(error),
        'err'
      );
    }
  }


  /* ============================================================
     CLIENT DETAILS
     ============================================================ */

  async function loadClientDetails(
    clientId
  ) {
    const [
      contacts,
      banks,
      reports,
      communication
    ] =
      await Promise.all([
        state.supabase
          .from(
            CONFIG.tables.contacts
          )
          .select('*')
          .eq(
            'client_id',
            clientId
          )
          .order(
            'is_primary',
            {
              ascending: false
            }
          ),

        state.supabase
          .from(
            CONFIG.tables.bankAccounts
          )
          .select('*')
          .eq(
            'client_id',
            clientId
          )
          .order(
            'bank_name',
            {
              ascending: true
            }
          ),

        state.supabase
          .from(
            CONFIG.tables.reports
          )
          .select('*')
          .eq(
            'client_id',
            clientId
          )
          .order(
            'report_year',
            {
              ascending: false
            }
          ),

        state.supabase
          .from(
            CONFIG.tables.communication
          )
          .select('*')
          .eq(
            'client_id',
            clientId
          )
          .order(
            'created_at',
            {
              ascending: false
            }
          )
      ]);


    for (
      const result
      of [
        contacts,
        banks,
        reports,
        communication
      ]
    ) {
      if (result.error) {
        throw result.error;
      }
    }


    state.currentClientContacts =
      contacts.data || [];

    state.currentClientBanks =
      banks.data || [];

    state.currentClientReports =
      reports.data || [];

    state.currentClientCommunication =
      communication.data || [];


    renderCurrentActivities();
    renderContacts();
    renderBankAccounts();
    renderReports();
    renderCommunication();


    if (isManager()) {
      await loadSecrets();

    } else {
      renderSecretsAccessDenied();
      renderAuditAccessDenied();
    }
  }


  /* ============================================================
     QUICK PANEL
     ============================================================ */

  function renderQuickPanel(
    client
  ) {
    if (!client) {
      [
        'quick-reporting',
        'quick-ecp',
        'quick-1c',
        'quick-edo'
      ].forEach(
        id => {
          const element =
            $(id);

          element.textContent =
            '—';

          element.className =
            'quick-value';
        }
      );

      return;
    }


    const reports =
      state.currentClientReports
        .length
        ? state.currentClientReports
        : getReportsForClient(
            client.id
          );


    const overdue =
      reports.filter(
        isReportOverdue
      );


    setQuickValue(
      'quick-reporting',
      overdue.length
        ? `Просрочено: ${overdue.length}`
        : (
            reports.some(
              report =>
                report.status ===
                'submitted'
            )
              ? '✓ Сдано'
              : 'Нет просрочки'
          ),
      overdue.length
        ? 'danger'
        : 'ok'
    );


    const ecp =
      getEcpState(
        client
      );

    if (
      ecp.level === 'none'
    ) {
      setQuickValue(
        'quick-ecp',
        'Не указано'
      );

    } else if (
      ecp.level === 'danger'
    ) {
      setQuickValue(
        'quick-ecp',
        `Истекла ${Math.abs(ecp.days)} дн. назад`,
        'danger'
      );

    } else if (
      ecp.level === 'warning'
    ) {
      setQuickValue(
        'quick-ecp',
        ecp.days === 0
          ? 'Истекает сегодня'
          : `Осталось ${ecp.days} дн.`,
        'warning'
      );

    } else {
      setQuickValue(
        'quick-ecp',
        `До ${formatDate(client.ecp_expires_at)}`,
        'ok'
      );
    }


    const oneC =
      getOneCState(
        client
      );

    if (
      oneC.level === 'none'
    ) {
      setQuickValue(
        'quick-1c',
        'Не указано'
      );

    } else if (
      oneC.level === 'danger'
    ) {
      setQuickValue(
        'quick-1c',
        `Истекла ${Math.abs(oneC.days)} дн. назад`,
        'danger'
      );

    } else if (
      oneC.level === 'warning'
    ) {
      setQuickValue(
        'quick-1c',
        oneC.days === 0
          ? 'Истекает сегодня'
          : `Осталось ${oneC.days} дн.`,
        'warning'
      );

    } else {
      setQuickValue(
        'quick-1c',
        `До ${formatDate(client.one_c_expires_at)}`,
        'ok'
      );
    }


    if (
      client.edo_enabled
    ) {
      const edoDetails = [
        client.edo_operator ||
          'Подключён',
        client.edo_identifier
          ? 'ID ' +
            client.edo_identifier
          : ''
      ]
        .filter(Boolean)
        .join(' · ');

      setQuickValue(
        'quick-edo',
        '✓ ' + edoDetails,
        'ok'
      );

    } else {
      setQuickValue(
        'quick-edo',
        'Не используется'
      );
    }
  }


  function setQuickValue(
    id,
    text,
    className = ''
  ) {
    const element =
      $(id);

    element.textContent =
      text;

    element.className =
      `quick-value ${className}`;
  }


  /* ============================================================
     TABS
     ============================================================ */

  function switchClientTab(
    name
  ) {
    $all(
      '[data-client-tab]'
    ).forEach(
      button => {
        button.classList.toggle(
          'active',
          button.dataset.clientTab ===
            name
        );
      }
    );


    $all(
      '[data-client-pane]'
    ).forEach(
      pane => {
        pane.classList.toggle(
          'active',
          pane.dataset.clientPane ===
            name
        );
      }
    );


    if (
      name === 'secrets' &&
      state.currentClientId &&
      isManager()
    ) {
      loadSecrets()
        .catch(
          error =>
            toast(
              friendlyError(error),
              'err'
            )
        );
    }
  }


  /* ============================================================
     REQUIRE CLIENT
     ============================================================ */

  function requireCurrentClient() {
    if (
      !state.currentClientId
    ) {
      toast(
        'Сначала сохраните основную карточку клиента.',
        'warn'
      );

      return false;
    }

    return true;
  }


  /* ============================================================
     ACTIVITIES
     ============================================================ */

  function renderCurrentActivities() {
    const box =
      $('client-activities-list');

    if (!box) return;


    if (
      !state.currentClientId
    ) {
      box.innerHTML = `
        <div class="muted">
          Сохраните клиента, чтобы добавить сферы деятельности.
        </div>
      `;

      return;
    }


    const list =
      getActivitiesForClient(
        state.currentClientId
      );


    if (!list.length) {
      box.innerHTML = `
        <div class="muted">
          Сферы деятельности не указаны.
        </div>
      `;

      return;
    }


    box.innerHTML =
      list
        .map(
          item => `
            <div class="list-item">

              <div class="list-item-main">
                <div class="list-item-title">
                  ${escapeHtml(item.activity_name)}
                </div>
              </div>

              <div class="list-item-actions">

                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  data-edit-activity="${escapeHtml(item.id)}"
                >
                  Изменить
                </button>

                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  data-delete-activity="${escapeHtml(item.id)}"
                >
                  ×
                </button>

              </div>

            </div>
          `
        )
        .join('');


    $all(
      '[data-edit-activity]',
      box
    ).forEach(
      button => {
        button.addEventListener(
          'click',
          () =>
            openActivityModal(
              button.dataset.editActivity
            )
        );
      }
    );


    $all(
      '[data-delete-activity]',
      box
    ).forEach(
      button => {
        button.addEventListener(
          'click',
          () =>
            deleteActivity(
              button.dataset.deleteActivity
            )
        );
      }
    );
  }


  function openActivityModal(
    id = null
  ) {
    if (
      !requireCurrentClient()
    ) {
      return;
    }


    state.editingActivityId =
      id;

    $('activity-id').value =
      id || '';

    $('activity-name').value =
      '';


    if (id) {
      const item =
        state.activities.find(
          activity =>
            activity.id === id
        );

      if (item) {
        $('activity-name').value =
          item.activity_name;
      }
    }


    openModal(
      'activity-modal'
    );

    setTimeout(
      () =>
        $('activity-name')
          ?.focus(),
      70
    );
  }


  async function saveActivity() {
    if (
      !requireCurrentClient()
    ) {
      return;
    }

    const name =
      $('activity-name')
        .value
        .trim();

    if (!name) {
      toast(
        'Укажите сферу деятельности',
        'err'
      );

      return;
    }


    try {
      if (
        state.editingActivityId
      ) {
        const {
          error
        } =
          await state.supabase
            .from(
              CONFIG.tables.activities
            )
            .update({
              activity_name:
                name
            })
            .eq(
              'id',
              state.editingActivityId
            );

        if (error) {
          throw error;
        }

      } else {
        const {
          error
        } =
          await state.supabase
            .from(
              CONFIG.tables.activities
            )
            .insert({
              client_id:
                state.currentClientId,

              activity_name:
                name
            });

        if (error) {
          throw error;
        }
      }


      closeModal(
        'activity-modal'
      );

      state.editingActivityId =
        null;

      await loadClients();

      renderCurrentActivities();

      toast(
        'Сфера деятельности сохранена',
        'ok'
      );

    } catch (error) {
      toast(
        friendlyError(error),
        'err'
      );
    }
  }


  function deleteActivity(id) {
    confirmDialog(
      'Удалить сферу деятельности?',
      'Запись будет удалена из карточки клиента.',
      async () => {
        const {
          error
        } =
          await state.supabase
            .from(
              CONFIG.tables.activities
            )
            .delete()
            .eq(
              'id',
              id
            );

        if (error) {
          throw error;
        }

        await loadClients();

        renderCurrentActivities();
      }
    );
  }


  /* ============================================================
     CONTACTS
     ============================================================ */

  function renderContacts() {
    const box =
      $('client-contacts-list');

    if (!box) return;


    if (
      !state.currentClientId
    ) {
      box.innerHTML = `
        <div class="muted">
          Сначала сохраните клиента.
        </div>
      `;

      return;
    }


    if (
      !state.currentClientContacts.length
    ) {
      box.innerHTML = `
        <div class="muted">
          Контактных лиц пока нет.
        </div>
      `;

      return;
    }


    box.innerHTML =
      state.currentClientContacts
        .map(
          item => `
            <div class="list-item">

              <div class="list-item-main">

                <div class="list-item-title">
                  ${escapeHtml(item.full_name)}

                  ${
                    item.is_primary
                      ? `
                        <span class="tag">
                          Основной
                        </span>
                      `
                      : ''
                  }
                </div>

                <div class="list-item-meta">
                  ${escapeHtml(
                    [
                      item.position,
                      item.phone,
                      item.email,
                      item.responsibility_area
                    ]
                      .filter(Boolean)
                      .join(' • ')
                  )}
                </div>

              </div>

              <div class="list-item-actions">

                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  data-edit-contact="${escapeHtml(item.id)}"
                >
                  Изменить
                </button>

                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  data-delete-contact="${escapeHtml(item.id)}"
                >
                  ×
                </button>

              </div>

            </div>
          `
        )
        .join('');


    bindListButtons(
      box,
      'edit-contact',
      openContactModal
    );

    bindListButtons(
      box,
      'delete-contact',
      deleteContact
    );
  }


  function openContactModal(
    id = null
  ) {
    if (
      !requireCurrentClient()
    ) {
      return;
    }


    state.editingContactId =
      id;


    [
      'contact-id',
      'contact-name',
      'contact-position',
      'contact-phone',
      'contact-email',
      'contact-messenger',
      'contact-messenger-value',
      'contact-responsibility',
      'contact-notes'
    ].forEach(
      field => {
        $(field).value =
          '';
      }
    );

    $('contact-primary').checked =
      false;


    if (id) {
      const item =
        state.currentClientContacts.find(
          contact =>
            contact.id === id
        );

      if (item) {
        $('contact-id').value =
          item.id;

        $('contact-name').value =
          item.full_name || '';

        $('contact-position').value =
          item.position || '';

        $('contact-phone').value =
          item.phone || '';

        $('contact-email').value =
          item.email || '';

        $('contact-messenger').value =
          item.messenger || '';

        $('contact-messenger-value').value =
          item.messenger_contact ||
          '';

        $('contact-responsibility').value =
          item.responsibility_area ||
          '';

        $('contact-primary').checked =
          item.is_primary === true;

        $('contact-notes').value =
          item.notes || '';
      }
    }


    openModal(
      'contact-modal'
    );
  }


  async function saveContact() {
    if (
      !requireCurrentClient()
    ) {
      return;
    }


    const fullName =
      $('contact-name')
        .value
        .trim();

    if (!fullName) {
      toast(
        'Укажите ФИО контактного лица',
        'err'
      );

      return;
    }


    const payload = {
      client_id:
        state.currentClientId,

      full_name:
        fullName,

      position:
        nullableText(
          $('contact-position').value
        ),

      phone:
        nullableText(
          $('contact-phone').value
        ),

      email:
        nullableText(
          $('contact-email').value
        ),

      messenger:
        nullableText(
          $('contact-messenger').value
        ),

      messenger_contact:
        nullableText(
          $('contact-messenger-value').value
        ),

      responsibility_area:
        nullableText(
          $('contact-responsibility').value
        ),

      is_primary:
        $('contact-primary').checked,

      notes:
        nullableText(
          $('contact-notes').value
        )
    };


    try {
      if (
        state.editingContactId
      ) {
        const {
          error
        } =
          await state.supabase
            .from(
              CONFIG.tables.contacts
            )
            .update(payload)
            .eq(
              'id',
              state.editingContactId
            );

        if (error) {
          throw error;
        }

      } else {
        const {
          error
        } =
          await state.supabase
            .from(
              CONFIG.tables.contacts
            )
            .insert(payload);

        if (error) {
          throw error;
        }
      }


      closeModal(
        'contact-modal'
      );

      await reloadCurrentContacts();

      toast(
        'Контакт сохранён',
        'ok'
      );

    } catch (error) {
      toast(
        friendlyError(error),
        'err'
      );
    }
  }


  async function reloadCurrentContacts() {
    const {
      data,
      error
    } =
      await state.supabase
        .from(
          CONFIG.tables.contacts
        )
        .select('*')
        .eq(
          'client_id',
          state.currentClientId
        )
        .order(
          'is_primary',
          {
            ascending: false
          }
        );

    if (error) {
      throw error;
    }

    state.currentClientContacts =
      data || [];

    renderContacts();
  }


  function deleteContact(id) {
    confirmDialog(
      'Удалить контакт?',
      'Контактное лицо будет удалено.',
      async () => {
        const {
          error
        } =
          await state.supabase
            .from(
              CONFIG.tables.contacts
            )
            .delete()
            .eq(
              'id',
              id
            );

        if (error) {
          throw error;
        }

        await reloadCurrentContacts();
      }
    );
  }


  /* ============================================================
     BANK ACCOUNTS
     ============================================================ */

  function renderBankAccounts() {
    const box =
      $('client-bank-accounts-list');

    if (!box) return;


    if (
      !state.currentClientId
    ) {
      box.innerHTML = `
        <div class="muted">
          Сначала сохраните клиента.
        </div>
      `;

      return;
    }


    if (
      !state.currentClientBanks.length
    ) {
      box.innerHTML = `
        <div class="muted">
          Расчётные счета не добавлены.
        </div>
      `;

      return;
    }


    box.innerHTML =
      state.currentClientBanks
        .map(
          item => `
            <div class="list-item">

              <div class="list-item-main">

                <div class="list-item-title">
                  ${escapeHtml(item.bank_name || 'Банк не указан')}
                </div>

                <div class="list-item-meta">
                  ${escapeHtml(item.account_number)}

                  ${
                    item.integration_enabled
                      ? ` • ${escapeHtml(item.integration_type || 'Интеграция подключена')}`
                      : ''
                  }
                </div>

              </div>

              <div class="list-item-actions">

                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  data-edit-bank="${escapeHtml(item.id)}"
                >
                  Изменить
                </button>

                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  data-delete-bank="${escapeHtml(item.id)}"
                >
                  ×
                </button>

              </div>

            </div>
          `
        )
        .join('');


    bindListButtons(
      box,
      'edit-bank',
      openBankModal
    );

    bindListButtons(
      box,
      'delete-bank',
      deleteBank
    );
  }


  function openBankModal(
    id = null
  ) {
    if (
      !requireCurrentClient()
    ) {
      return;
    }


    state.editingBankId =
      id;


    [
      'bank-account-id',
      'bank-name',
      'bank-account-number',
      'bank-bik',
      'bank-correspondent-account',
      'bank-integration-type',
      'bank-notes'
    ].forEach(
      field => {
        $(field).value =
          '';
      }
    );

    $('bank-integration-enabled').checked =
      false;


    if (id) {
      const item =
        state.currentClientBanks.find(
          bank =>
            bank.id === id
        );

      if (item) {
        $('bank-account-id').value =
          item.id;

        $('bank-name').value =
          item.bank_name || '';

        $('bank-account-number').value =
          item.account_number || '';

        $('bank-bik').value =
          item.bik || '';

        $('bank-correspondent-account').value =
          item.correspondent_account ||
          '';

        $('bank-integration-type').value =
          item.integration_type ||
          '';

        $('bank-integration-enabled').checked =
          item.integration_enabled ===
          true;

        $('bank-notes').value =
          item.notes || '';
      }
    }


    openModal(
      'bank-modal'
    );
  }


  async function saveBankAccount() {
    if (
      !requireCurrentClient()
    ) {
      return;
    }


    const accountNumber =
      $('bank-account-number')
        .value
        .trim();

    if (!accountNumber) {
      toast(
        'Укажите расчётный счёт',
        'err'
      );

      return;
    }


    const payload = {
      client_id:
        state.currentClientId,

      bank_name:
        nullableText(
          $('bank-name').value
        ),

      account_number:
        accountNumber,

      bik:
        nullableText(
          $('bank-bik').value
        ),

      correspondent_account:
        nullableText(
          $('bank-correspondent-account').value
        ),

      integration_type:
        nullableText(
          $('bank-integration-type').value
        ),

      integration_enabled:
        $('bank-integration-enabled')
          .checked,

      notes:
        nullableText(
          $('bank-notes').value
        )
    };


    try {
      if (
        state.editingBankId
      ) {
        const {
          error
        } =
          await state.supabase
            .from(
              CONFIG.tables.bankAccounts
            )
            .update(payload)
            .eq(
              'id',
              state.editingBankId
            );

        if (error) {
          throw error;
        }

      } else {
        const {
          error
        } =
          await state.supabase
            .from(
              CONFIG.tables.bankAccounts
            )
            .insert(payload);

        if (error) {
          throw error;
        }
      }


      closeModal(
        'bank-modal'
      );

      await reloadCurrentBanks();

      toast(
        'Расчётный счёт сохранён',
        'ok'
      );

    } catch (error) {
      toast(
        friendlyError(error),
        'err'
      );
    }
  }


  async function reloadCurrentBanks() {
    const {
      data,
      error
    } =
      await state.supabase
        .from(
          CONFIG.tables.bankAccounts
        )
        .select('*')
        .eq(
          'client_id',
          state.currentClientId
        )
        .order(
          'bank_name',
          {
            ascending: true
          }
        );

    if (error) {
      throw error;
    }

    state.currentClientBanks =
      data || [];

    renderBankAccounts();
  }


  function deleteBank(id) {
    confirmDialog(
      'Удалить расчётный счёт?',
      'Банковские реквизиты будут удалены.',
      async () => {
        const {
          error
        } =
          await state.supabase
            .from(
              CONFIG.tables.bankAccounts
            )
            .delete()
            .eq(
              'id',
              id
            );

        if (error) {
          throw error;
        }

        await reloadCurrentBanks();
      }
    );
  }


  /* ============================================================
     REPORTS
     ============================================================ */

  function reportDisplayStatus(
    report
  ) {
    if (
      isReportOverdue(report)
    ) {
      return {
        text: 'Просрочено',
        className: 'overdue'
      };
    }

    switch (
      report.status
    ) {
      case 'in_progress':
        return {
          text: 'В работе',
          className:
            'in-progress'
        };

      case 'submitted':
        return {
          text: 'Сдано',
          className:
            'submitted'
        };

      case 'not_required':
        return {
          text: 'Не требуется',
          className:
            'not-required'
        };

      case 'pending':
      default:
        return {
          text: 'Предстоит',
          className:
            'pending'
        };
    }
  }


  function renderReports() {
    const box =
      $('client-reporting-list');

    if (!box) return;


    if (
      !state.currentClientId
    ) {
      box.innerHTML = `
        <div class="muted">
          Сначала сохраните клиента.
        </div>
      `;

      return;
    }


    if (
      !state.currentClientReports.length
    ) {
      box.innerHTML = `
        <div class="muted">
          История отчётности пока пустая.
        </div>
      `;

      return;
    }


    const sorted =
      state.currentClientReports
        .slice()
        .sort(
          (a, b) => {
            if (
              a.report_year !==
              b.report_year
            ) {
              return (
                b.report_year -
                a.report_year
              );
            }

            return String(
              b.due_date || ''
            ).localeCompare(
              String(
                a.due_date || ''
              )
            );
          }
        );


    box.innerHTML =
      sorted
        .map(
          report => {
            const status =
              reportDisplayStatus(
                report
              );

            return `
              <div class="list-item">

                <div class="list-item-main">

                  <div class="list-item-title">

                    ${escapeHtml(report.report_kind)}

                    <span
                      class="report-status ${status.className}"
                    >
                      ${status.text}
                    </span>

                  </div>

                  <div class="list-item-meta">
                    ${escapeHtml(
                      [
                        report.report_year,
                        report.report_period,
                        report.tax_system,
                        report.due_date
                          ? `срок ${formatDate(report.due_date)}`
                          : '',
                        report.submitted_at
                          ? `сдано ${formatDateTime(report.submitted_at)}`
                          : ''
                      ]
                        .filter(Boolean)
                        .join(' • ')
                    )}
                  </div>

                </div>

                <div class="list-item-actions">

                  <button
                    class="btn btn-ghost btn-sm"
                    type="button"
                    data-edit-report="${escapeHtml(report.id)}"
                  >
                    Изменить
                  </button>

                  <button
                    class="btn btn-ghost btn-sm"
                    type="button"
                    data-delete-report="${escapeHtml(report.id)}"
                  >
                    ×
                  </button>

                </div>

              </div>
            `;
          }
        )
        .join('');


    bindListButtons(
      box,
      'edit-report',
      openReportModal
    );

    bindListButtons(
      box,
      'delete-report',
      deleteReport
    );
  }


  function openReportModal(
    id = null
  ) {
    if (
      !requireCurrentClient()
    ) {
      return;
    }


    state.editingReportId =
      id;


    $('report-id').value =
      '';

    $('report-year').value =
      new Date()
        .getFullYear();

    $('report-period-type').value =
      'quarter';

    $('report-period').value =
      '';

    $('report-kind').value =
      '';

    $('report-tax-system').value =
      state.currentClientTaxSystems[0]
        ?.tax_system ||
      '';

    $('report-status').value =
      'pending';

    $('report-due-date').value =
      '';

    $('report-submitted-at').value =
      '';

    $('report-comment').value =
      '';


    if (id) {
      const item =
        state.currentClientReports.find(
          report =>
            report.id === id
        );

      if (item) {
        $('report-id').value =
          item.id;

        $('report-year').value =
          item.report_year;

        $('report-period-type').value =
          item.report_period_type;

        $('report-period').value =
          item.report_period || '';

        $('report-kind').value =
          item.report_kind || '';

        $('report-tax-system').value =
          item.tax_system || '';

        $('report-status').value =
          item.status || 'pending';

        $('report-due-date').value =
          item.due_date || '';

        $('report-submitted-at').value =
          toDateTimeLocal(
            item.submitted_at
          );

        $('report-comment').value =
          item.comment || '';
      }
    }


    openModal(
      'report-modal'
    );
  }


  function toDateTimeLocal(value) {
    if (!value) {
      return '';
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '';
    }

    const local =
      new Date(
        date.getTime() -
        date.getTimezoneOffset() *
        60000
      );

    return local
      .toISOString()
      .slice(0, 16);
  }


  async function saveReport() {
    if (
      !requireCurrentClient()
    ) {
      return;
    }


    const kind =
      $('report-kind')
        .value
        .trim();

    if (!kind) {
      toast(
        'Укажите вид отчёта',
        'err'
      );

      return;
    }


    const year =
      Number(
        $('report-year').value
      );

    if (
      !year ||
      year < 2000 ||
      year > 2200
    ) {
      toast(
        'Укажите корректный год',
        'err'
      );

      return;
    }


    const payload = {
      client_id:
        state.currentClientId,

      report_year:
        year,

      report_period_type:
        $('report-period-type').value,

      report_period:
        nullableText(
          $('report-period').value
        ),

      report_kind:
        kind,

      tax_system:
        nullableText(
          $('report-tax-system').value
        ),

      status:
        $('report-status').value,

      due_date:
        nullableText(
          $('report-due-date').value
        ),

      submitted_at:
        $('report-submitted-at').value
          ? new Date(
              $('report-submitted-at').value
            ).toISOString()
          : null,

      comment:
        nullableText(
          $('report-comment').value
        ),

      updated_by:
        state.user.id
    };


    try {
      if (
        state.editingReportId
      ) {
        const {
          error
        } =
          await state.supabase
            .from(
              CONFIG.tables.reports
            )
            .update(payload)
            .eq(
              'id',
              state.editingReportId
            );

        if (error) {
          throw error;
        }

      } else {
        payload.created_by =
          state.user.id;

        const {
          error
        } =
          await state.supabase
            .from(
              CONFIG.tables.reports
            )
            .insert(payload);

        if (error) {
          throw error;
        }
      }


      closeModal(
        'report-modal'
      );

      await reloadCurrentReports();

      await loadClients();

      const client =
        state.clients.find(
          item =>
            item.id ===
            state.currentClientId
        );

      if (client) {
        renderQuickPanel(
          client
        );
      }


      toast(
        'Отчётность сохранена',
        'ok'
      );

    } catch (error) {
      toast(
        friendlyError(error),
        'err'
      );
    }
  }


  async function reloadCurrentReports() {
    const {
      data,
      error
    } =
      await state.supabase
        .from(
          CONFIG.tables.reports
        )
        .select('*')
        .eq(
          'client_id',
          state.currentClientId
        )
        .order(
          'report_year',
          {
            ascending: false
          }
        );

    if (error) {
      throw error;
    }

    state.currentClientReports =
      data || [];

    renderReports();
  }


  function deleteReport(id) {
    confirmDialog(
      'Удалить запись отчётности?',
      'Историческая запись будет удалена.',
      async () => {
        const {
          error
        } =
          await state.supabase
            .from(
              CONFIG.tables.reports
            )
            .delete()
            .eq(
              'id',
              id
            );

        if (error) {
          throw error;
        }

        await reloadCurrentReports();
        await loadClients();
      }
    );
  }


  /* ============================================================
     COMMUNICATION
     ============================================================ */

  function renderCommunication() {
    const box =
      $('client-communication-list');

    if (!box) return;


    if (
      !state.currentClientId
    ) {
      box.innerHTML = `
        <div class="muted">
          Сначала сохраните клиента.
        </div>
      `;

      return;
    }


    if (
      !state.currentClientCommunication.length
    ) {
      box.innerHTML = `
        <div class="muted">
          История общения пока пустая.
        </div>
      `;

      return;
    }


    box.innerHTML =
      state.currentClientCommunication
        .map(
          item => {
            const responsible =
              getProfile(
                item.responsible_user
              );

            return `
              <div class="list-item">

                <div class="list-item-main">

                  <div class="list-item-title">
                    ${escapeHtml(item.title)}
                  </div>

                  <div class="list-item-meta">
                    ${escapeHtml(
                      [
                        communicationTypeLabel(
                          item.item_type
                        ),
                        communicationStatusLabel(
                          item.status
                        ),
                        item.due_date
                          ? `до ${formatDate(item.due_date)}`
                          : '',
                        responsible
                          ? profileName(responsible)
                          : ''
                      ]
                        .filter(Boolean)
                        .join(' • ')
                    )}
                  </div>

                  ${
                    item.description
                      ? `
                        <div class="list-item-meta">
                          ${escapeHtml(item.description)}
                        </div>
                      `
                      : ''
                  }

                </div>

                <div class="list-item-actions">

                  <button
                    class="btn btn-ghost btn-sm"
                    type="button"
                    data-edit-communication="${escapeHtml(item.id)}"
                  >
                    Изменить
                  </button>

                  <button
                    class="btn btn-ghost btn-sm"
                    type="button"
                    data-delete-communication="${escapeHtml(item.id)}"
                  >
                    ×
                  </button>

                </div>

              </div>
            `;
          }
        )
        .join('');


    bindListButtons(
      box,
      'edit-communication',
      openCommunicationModal
    );

    bindListButtons(
      box,
      'delete-communication',
      deleteCommunication
    );
  }


  function communicationTypeLabel(
    value
  ) {
    const labels = {
      question:
        'Вопрос',

      agreement:
        'Договорённость',

      follow_up:
        'Продолжение',

      client_request:
        'Запрос клиента',

      internal_note:
        'Внутренняя заметка'
    };

    return labels[value] || value;
  }


  function communicationStatusLabel(
    value
  ) {
    const labels = {
      open:
        'Открыто',

      waiting:
        'Ожидаем',

      done:
        'Завершено',

      cancelled:
        'Отменено'
    };

    return labels[value] || value;
  }


  function openCommunicationModal(
    id = null
  ) {
    if (
      !requireCurrentClient()
    ) {
      return;
    }


    state.editingCommunicationId =
      id;


    $('communication-id').value =
      '';

    $('communication-type').value =
      'question';

    $('communication-status').value =
      'open';

    $('communication-title').value =
      '';

    $('communication-description').value =
      '';

    $('communication-due-date').value =
      '';

    $('communication-responsible').value =
      state.user?.id || '';


    if (id) {
      const item =
        state.currentClientCommunication.find(
          communication =>
            communication.id === id
        );

      if (item) {
        $('communication-id').value =
          item.id;

        $('communication-type').value =
          item.item_type;

        $('communication-status').value =
          item.status;

        $('communication-title').value =
          item.title || '';

        $('communication-description').value =
          item.description || '';

        $('communication-due-date').value =
          item.due_date || '';

        $('communication-responsible').value =
          item.responsible_user || '';
      }
    }


    openModal(
      'communication-modal'
    );
  }


  async function saveCommunication() {
    if (
      !requireCurrentClient()
    ) {
      return;
    }


    const title =
      $('communication-title')
        .value
        .trim();

    if (!title) {
      toast(
        'Укажите заголовок',
        'err'
      );

      return;
    }


    const payload = {
      client_id:
        state.currentClientId,

      item_type:
        $('communication-type').value,

      title,

      description:
        nullableText(
          $('communication-description').value
        ),

      status:
        $('communication-status').value,

      due_date:
        nullableText(
          $('communication-due-date').value
        ),

      responsible_user:
        nullableText(
          $('communication-responsible').value
        )
    };


    try {
      if (
        state.editingCommunicationId
      ) {
        const {
          error
        } =
          await state.supabase
            .from(
              CONFIG.tables.communication
            )
            .update(payload)
            .eq(
              'id',
              state.editingCommunicationId
            );

        if (error) {
          throw error;
        }

      } else {
        payload.created_by =
          state.user.id;

        const {
          error
        } =
          await state.supabase
            .from(
              CONFIG.tables.communication
            )
            .insert(payload);

        if (error) {
          throw error;
        }
      }


      closeModal(
        'communication-modal'
      );

      await reloadCurrentCommunication();

      toast(
        'Запись сохранена',
        'ok'
      );

    } catch (error) {
      toast(
        friendlyError(error),
        'err'
      );
    }
  }


  async function reloadCurrentCommunication() {
    const {
      data,
      error
    } =
      await state.supabase
        .from(
          CONFIG.tables.communication
        )
        .select('*')
        .eq(
          'client_id',
          state.currentClientId
        )
        .order(
          'created_at',
          {
            ascending: false
          }
        );

    if (error) {
      throw error;
    }

    state.currentClientCommunication =
      data || [];

    renderCommunication();
  }


  function deleteCommunication(id) {
    confirmDialog(
      'Удалить запись?',
      'Вопрос или договорённость будут удалены.',
      async () => {
        const {
          error
        } =
          await state.supabase
            .from(
              CONFIG.tables.communication
            )
            .delete()
            .eq(
              'id',
              id
            );

        if (error) {
          throw error;
        }

        await reloadCurrentCommunication();
      }
    );
  }


  /* ============================================================
     EDGE FUNCTION — SECRETS
     ============================================================ */

  async function invokeSecrets(
    body
  ) {
    const {
      data,
      error
    } =
      await state.supabase
        .functions
        .invoke(
          CONFIG.edgeFunction,
          {
            body
          }
        );


    if (error) {
      throw error;
    }


    if (
      data &&
      data.ok === false
    ) {
      throw new Error(
        data.error ||
        'Ошибка защищённого хранилища.'
      );
    }


    return data;
  }


  /* ============================================================
     SECRET LIST
     ============================================================ */

  async function loadSecrets() {
    if (
      !state.currentClientId
    ) {
      renderSecretsPlaceholder();
      return;
    }


    if (!isManager()) {
      renderSecretsAccessDenied();
      return;
    }


    const box =
      $('client-secrets-list');

    box.innerHTML = `
      <div class="muted">
        Загружаем защищённые доступы…
      </div>
    `;


    try {
      const data =
        await invokeSecrets({
          action: 'list',
          client_id:
            state.currentClientId
        });


      state.currentSecrets =
        data.items || [];


      renderSecrets();


    } catch (error) {
      console.error(error);

      box.innerHTML = `
        <div
          style="color:var(--danger);"
        >
          ${escapeHtml(friendlyError(error))}
        </div>
      `;
    }
  }


  function renderSecretsPlaceholder() {
    $('client-secrets-list').innerHTML = `
      <div class="muted">
        Сначала сохраните клиента.
      </div>
    `;
  }


  function renderSecretsAccessDenied() {
    $('client-secrets-list').innerHTML = `
      <div class="muted">
        У вашей учётной записи нет доступа
        к защищённым данным клиентов.
      </div>
    `;

    setHidden(
      $('btn-add-secret'),
      true
    );
  }


  function renderSecrets() {
    const box =
      $('client-secrets-list');


    setHidden(
      $('btn-add-secret'),
      false
    );


    if (
      !state.currentSecrets.length
    ) {
      box.innerHTML = `
        <div class="muted">
          Защищённые доступы не добавлены.
        </div>
      `;

      return;
    }


    box.innerHTML =
      state.currentSecrets
        .map(
          item => `
            <div
              class="secret-item"
              data-secret-item="${escapeHtml(item.id)}"
            >

              <div class="secret-head">

                <div>

                  <div class="secret-service">
                    ${escapeHtml(item.service_name)}
                  </div>

                  ${
                    item.service_url
                      ? `
                        <div class="secret-url">
                          ${escapeHtml(item.service_url)}
                        </div>
                      `
                      : ''
                  }

                </div>


                <div class="list-item-actions">

                  <button
                    class="btn btn-secondary btn-sm"
                    type="button"
                    data-view-secret="${escapeHtml(item.id)}"
                  >
                    Показать
                  </button>

                  <button
                    class="btn btn-ghost btn-sm"
                    type="button"
                    data-edit-secret="${escapeHtml(item.id)}"
                  >
                    Изменить
                  </button>

                  <button
                    class="btn btn-ghost btn-sm"
                    type="button"
                    data-delete-secret="${escapeHtml(item.id)}"
                  >
                    ×
                  </button>

                </div>

              </div>


              <div class="secret-values">

                <div class="secret-row">

                  <div class="secret-label">
                    Логин
                  </div>

                  <div class="secret-mask">
                    ••••••••••••
                  </div>

                </div>


                <div class="secret-row">

                  <div class="secret-label">
                    Пароль
                  </div>

                  <div class="secret-mask">
                    ••••••••••••
                  </div>

                </div>

              </div>

            </div>
          `
        )
        .join('');


    bindSecretButtons();
  }


  function bindSecretButtons() {
    $all(
      '[data-view-secret]'
    ).forEach(
      button => {
        button.addEventListener(
          'click',
          () =>
            revealSecret(
              button.dataset.viewSecret
            )
        );
      }
    );


    $all(
      '[data-edit-secret]'
    ).forEach(
      button => {
        button.addEventListener(
          'click',
          () =>
            openSecretModal(
              button.dataset.editSecret
            )
        );
      }
    );


    $all(
      '[data-delete-secret]'
    ).forEach(
      button => {
        button.addEventListener(
          'click',
          () =>
            requestDeleteSecret(
              button.dataset.deleteSecret
            )
        );
      }
    );
  }


  /* ============================================================
     SECRET VIEW
     ============================================================ */

  async function revealSecret(id) {
    try {
      const data =
        await invokeSecrets({
          action: 'view',
          secret_id:
            id
        });


      const item =
        data.item;


      const root =
        document.querySelector(
          `[data-secret-item="${CSS.escape(id)}"]`
        );

      if (!root) {
        return;
      }


      const values =
        root.querySelector(
          '.secret-values'
        );


      values.innerHTML = `

        <div class="secret-row">

          <div class="secret-label">
            Логин
          </div>

          <div
            class="mono"
            style="word-break:break-all;"
          >
            ${escapeHtml(item.login || '—')}
          </div>

          <div class="secret-actions">
            ${
              item.login
                ? `
                  <button
                    class="btn btn-secondary btn-sm"
                    type="button"
                    data-copy-secret-login="${escapeHtml(id)}"
                  >
                    Копировать
                  </button>
                `
                : ''
            }
          </div>

        </div>


        <div class="secret-row">

          <div class="secret-label">
            Пароль
          </div>

          <div
            class="mono"
            style="word-break:break-all;"
          >
            ${escapeHtml(item.secret)}
          </div>

          <div class="secret-actions">

            <button
              class="btn btn-secondary btn-sm"
              type="button"
              data-copy-secret-password="${escapeHtml(id)}"
            >
              Копировать
            </button>

          </div>

        </div>


        ${
          item.notes
            ? `
              <div
                style="
                  margin-top:8px;
                  padding:10px;
                  border-radius:9px;
                  background:var(--surface-soft);
                  color:var(--ink-soft);
                  white-space:pre-wrap;
                "
              >
                ${escapeHtml(item.notes)}
              </div>
            `
            : ''
        }
      `;


      const copyLogin =
        values.querySelector(
          '[data-copy-secret-login]'
        );

      copyLogin?.addEventListener(
        'click',
        () =>
          copySecretValue(
            id,
            'login',
            item.login
          )
      );


      const copyPassword =
        values.querySelector(
          '[data-copy-secret-password]'
        );

      copyPassword?.addEventListener(
        'click',
        () =>
          copySecretValue(
            id,
            'secret',
            item.secret
          )
      );


    } catch (error) {
      toast(
        friendlyError(error),
        'err'
      );
    }
  }


  async function copySecretValue(
    id,
    type,
    value
  ) {
    if (!value) {
      return;
    }


    try {
      await navigator.clipboard
        .writeText(
          value
        );


      await invokeSecrets({
        action:
          'log_copy',

        secret_id:
          id,

        copy_target:
          type
      });


      toast(
        type === 'login'
          ? 'Логин скопирован'
          : 'Пароль скопирован',
        'ok'
      );


    } catch (error) {
      toast(
        friendlyError(error),
        'err'
      );
    }
  }


  /* ============================================================
     SECRET CREATE / EDIT
     ============================================================ */

  async function openSecretModal(
    id = null
  ) {
    if (
      !requireCurrentClient()
    ) {
      return;
    }


    if (!isManager()) {
      toast(
        'Недостаточно прав',
        'err'
      );

      return;
    }


    state.editingSecretId =
      id;


    $('secret-id').value =
      '';

    $('secret-service-name').value =
      '';

    $('secret-service-url').value =
      '';

    $('secret-login').value =
      '';

    $('secret-password').value =
      '';

    $('secret-notes').value =
      '';


    if (id) {
      try {
        const data =
          await invokeSecrets({
            action: 'view',
            secret_id:
              id
          });

        const item =
          data.item;

        $('secret-id').value =
          item.id;

        $('secret-service-name').value =
          item.service_name || '';

        $('secret-service-url').value =
          item.service_url || '';

        $('secret-login').value =
          item.login || '';

        /*
         * Для редактирования пароль специально
         * оставляем пустым:
         * пустое поле = оставить старый пароль.
         */
        $('secret-password').value =
          '';

        $('secret-password').placeholder =
          'Оставьте пустым, чтобы не менять';

        $('secret-notes').value =
          item.notes || '';

      } catch (error) {
        toast(
          friendlyError(error),
          'err'
        );

        return;
      }

    } else {
      $('secret-password').placeholder =
        '';
    }


    openModal(
      'secret-modal'
    );
  }


  async function saveSecret() {
    if (
      !requireCurrentClient()
    ) {
      return;
    }


    const serviceName =
      $('secret-service-name')
        .value
        .trim();

    if (!serviceName) {
      toast(
        'Укажите название сервиса',
        'err'
      );

      return;
    }


    const password =
      $('secret-password').value;


    if (
      !state.editingSecretId &&
      !password
    ) {
      toast(
        'Укажите пароль',
        'err'
      );

      return;
    }


    try {
      if (
        state.editingSecretId
      ) {
        const body = {
          action:
            'update',

          secret_id:
            state.editingSecretId,

          service_name:
            serviceName,

          service_url:
            nullableText(
              $('secret-service-url').value
            ),

          login:
            nullableText(
              $('secret-login').value
            ),

          notes:
            nullableText(
              $('secret-notes').value
            )
        };


        if (password) {
          body.secret =
            password;
        }


        await invokeSecrets(
          body
        );

      } else {
        await invokeSecrets({
          action:
            'create',

          client_id:
            state.currentClientId,

          service_name:
            serviceName,

          service_url:
            nullableText(
              $('secret-service-url').value
            ),

          login:
            nullableText(
              $('secret-login').value
            ),

          secret:
            password,

          notes:
            nullableText(
              $('secret-notes').value
            )
        });
      }


      /*
       * Убираем plaintext из формы как можно скорее.
       */
      $('secret-login').value =
        '';

      $('secret-password').value =
        '';

      $('secret-notes').value =
        '';


      closeModal(
        'secret-modal'
      );


      state.editingSecretId =
        null;


      await loadSecrets();


      toast(
        'Защищённый доступ сохранён',
        'ok'
      );


    } catch (error) {
      toast(
        friendlyError(error),
        'err'
      );
    }
  }


  function requestDeleteSecret(id) {
    confirmDialog(
      'Удалить защищённый доступ?',
      'Доступ будет удалён. Событие сохранится в журнале безопасности.',
      async () => {
        await invokeSecrets({
          action:
            'delete',

          secret_id:
            id
        });

        await loadSecrets();

        toast(
          'Доступ удалён',
          'ok'
        );
      }
    );
  }


  /* ============================================================
     AUDIT
     ============================================================ */

  function renderAuditPlaceholder() {
    $('client-secret-audit-list').innerHTML = `
      <div class="muted">
        Сначала сохраните клиента.
      </div>
    `;
  }


  function renderAuditAccessDenied() {
    $('client-secret-audit-list').innerHTML = `
      <div class="muted">
        Журнал безопасности недоступен.
      </div>
    `;
  }


  async function loadSecretAudit() {
    if (
      !requireCurrentClient()
    ) {
      return;
    }


    if (!isManager()) {
      renderAuditAccessDenied();
      return;
    }


    const box =
      $('client-secret-audit-list');

    box.innerHTML = `
      <div class="muted">
        Загружаем журнал…
      </div>
    `;


    try {
      const data =
        await invokeSecrets({
          action:
            'audit_list',

          client_id:
            state.currentClientId
        });


      state.currentSecretAudit =
        data.items || [];


      renderSecretAudit();


    } catch (error) {
      box.innerHTML = `
        <div
          style="color:var(--danger);"
        >
          ${escapeHtml(friendlyError(error))}
        </div>
      `;
    }
  }


  function renderSecretAudit() {
    const box =
      $('client-secret-audit-list');


    if (
      !state.currentSecretAudit.length
    ) {
      box.innerHTML = `
        <div class="muted">
          Журнал пока пуст.
        </div>
      `;

      return;
    }


    box.innerHTML =
      state.currentSecretAudit
        .map(
          item => {
            const profile =
              getProfile(
                item.actor_user_id
              );

            return `
              <div class="list-item">

                <div class="list-item-main">

                  <div class="list-item-title">
                    ${escapeHtml(
                      auditActionLabel(
                        item.action
                      )
                    )}
                  </div>

                  <div class="list-item-meta">
                    ${escapeHtml(
                      [
                        item.service_name_snapshot,
                        profile
                          ? profileName(profile)
                          : item.actor_user_id,
                        formatDateTime(
                          item.created_at
                        )
                      ]
                        .filter(Boolean)
                        .join(' • ')
                    )}
                  </div>

                </div>

              </div>
            `;
          }
        )
        .join('');
  }


  function auditActionLabel(
    value
  ) {
    const labels = {
      list:
        'Получен список доступов',

      view:
        'Просмотрен защищённый доступ',

      create:
        'Создан защищённый доступ',

      update:
        'Изменён защищённый доступ',

      delete:
        'Удалён защищённый доступ',

      copy_login:
        'Скопирован логин',

      copy_secret:
        'Скопирован пароль'
    };

    return labels[value] || value;
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
  }


  function closeModal(id) {
    const modal =
      $(id);

    if (!modal) return;

    modal.classList.remove(
      'active'
    );


    /*
     * Очищаем открытые plaintext-данные
     * формы секретов при закрытии.
     */
    if (
      id === 'secret-modal'
    ) {
      $('secret-login').value =
        '';

      $('secret-password').value =
        '';

      $('secret-notes').value =
        '';
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


    const old =
      $('confirm-ok-btn');

    const replacement =
      old.cloneNode(true);

    old.parentNode
      .replaceChild(
        replacement,
        old
      );


    replacement.addEventListener(
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
     LIST BUTTON BINDER
     ============================================================ */

  function bindListButtons(
    root,
    attribute,
    callback
  ) {
    $all(
      `[data-${attribute}]`,
      root
    ).forEach(
      button => {
        button.addEventListener(
          'click',
          () =>
            callback(
              button.dataset[
                attribute.replace(
                  /-([a-z])/g,
                  (_, letter) =>
                    letter.toUpperCase()
                )
              ]
            )
        );
      }
    );
  }


  /* ============================================================
     NOTIFICATIONS
     ============================================================ */

  function startNotificationWatcher() {
    if (
      state.notificationTimer
    ) {
      clearInterval(
        state.notificationTimer
      );
    }


    checkClientNotifications();


    state.notificationTimer =
      setInterval(
        checkClientNotifications,
        CONFIG.notificationCheckInterval
      );
  }


  function checkClientNotifications() {
    if (
      !state.user ||
      !('Notification' in window) ||
      Notification.permission !==
        'granted'
    ) {
      return;
    }


    const today =
      toISODate(
        todayDate()
      );


    for (
      const client
      of state.clients
    ) {
      if (
        client.status !==
        'active'
      ) {
        continue;
      }


      if (
        client.responsible_user &&
        client.responsible_user !==
          state.user.id
      ) {
        continue;
      }


      const ecp =
        getEcpState(
          client
        );


      if (
        ecp.level !== 'warning' &&
        ecp.level !== 'danger'
      ) {
        continue;
      }


      const storageKey =
        `jambalance_ecp_notice_${client.id}_${today}`;


      if (
        localStorage.getItem(
          storageKey
        )
      ) {
        continue;
      }


      const notification =
        new Notification(
          `ЭЦП — ${client.client_name}`,
          {
            body:
              formatExpiryMessage(
                'ЭЦП',
                ecp
              ),

            tag:
              `jambalance-ecp-${client.id}`
          }
        );


      notification.onclick =
        () => {
          window.focus();

          openClient(
            client.id
          );

          notification.close();
        };


      localStorage.setItem(
        storageKey,
        '1'
      );
    }
  }


  /* ============================================================
     FILTER EVENTS
     ============================================================ */

  function resetFilters() {
    state.filters = {
      query: '',
      status: '',
      orgForm: '',
      taxSystem: '',
      responsible: ''
    };


    $('clients-search').value =
      '';

    $('filter-status').value =
      '';

    $('filter-org-form').value =
      '';

    $('filter-tax-system').value =
      '';

    $('filter-responsible').value =
      '';


    renderClients();
  }


  /* ============================================================
     EVENTS
     ============================================================ */

  function bindEvents() {
    $('btn-new-client')
      ?.addEventListener(
        'click',
        openNewClient
      );


    $('btn-empty-new-client')
      ?.addEventListener(
        'click',
        openNewClient
      );


    $('btn-refresh-clients')
      ?.addEventListener(
        'click',
        loadClients
      );


    $('btn-retry-clients')
      ?.addEventListener(
        'click',
        loadClients
      );


    $('btn-close-client')
      ?.addEventListener(
        'click',
        closeDrawer
      );


    $('btn-cancel-client')
      ?.addEventListener(
        'click',
        closeDrawer
      );


    $('client-drawer-backdrop')
      ?.addEventListener(
        'click',
        closeDrawer
      );


    $('btn-save-client')
      ?.addEventListener(
        'click',
        saveClient
      );


    $('btn-delete-client')
      ?.addEventListener(
        'click',
        requestDeleteClient
      );


    $('client-folder-url')
      ?.addEventListener(
        'input',
        event =>
          updateFolderLink(
            event.target.value
          )
      );


    $('client-vat-enabled')
      ?.addEventListener(
        'change',
        event =>
          setHidden(
            $('vat-rate-field'),
            !event.target.checked
          )
      );


    $('client-edo-enabled')
      ?.addEventListener(
        'change',
        event => {
          setHidden(
            $('edo-operator-field'),
            !event.target.checked
          );

          setHidden(
            $('edo-identifier-field'),
            !event.target.checked
          );
        }
      );

    $('btn-add-tax-system')
      ?.addEventListener(
        'click',
        addTaxSystemRow
      );

    $('btn-new-client-group')
      ?.addEventListener(
        'click',
        openClientGroupModal
      );

    $('btn-save-client-group')
      ?.addEventListener(
        'click',
        saveClientGroup
      );

    $all(
      '[data-clients-view]'
    ).forEach(
      button => {
        button.addEventListener(
          'click',
          () => {
            state.viewMode =
              button.dataset.clientsView;

            $all(
              '[data-clients-view]'
            ).forEach(
              item =>
                item.classList.toggle(
                  'active',
                  item === button
                )
            );

            renderClients();
          }
        );
      }
    );


    $all(
      '[data-client-tab]'
    ).forEach(
      button => {
        button.addEventListener(
          'click',
          () =>
            switchClientTab(
              button.dataset.clientTab
            )
        );
      }
    );


    $('btn-toggle-filters')
      ?.addEventListener(
        'click',
        () =>
          $('clients-filters')
            .classList.toggle(
              'active'
            )
      );


    $('clients-search')
      ?.addEventListener(
        'input',
        debounce(
          event => {
            state.filters.query =
              event.target.value;

            renderClients();
          },
          180
        )
      );


    $('clients-sort')
      ?.addEventListener(
        'change',
        event => {
          state.sort =
            event.target.value;

          renderClients();
        }
      );


    $('filter-status')
      ?.addEventListener(
        'change',
        event => {
          state.filters.status =
            event.target.value;

          renderClients();
        }
      );


    $('filter-org-form')
      ?.addEventListener(
        'change',
        event => {
          state.filters.orgForm =
            event.target.value;

          renderClients();
        }
      );


    $('filter-tax-system')
      ?.addEventListener(
        'change',
        event => {
          state.filters.taxSystem =
            event.target.value;

          renderClients();
        }
      );


    $('filter-responsible')
      ?.addEventListener(
        'change',
        event => {
          state.filters.responsible =
            event.target.value;

          renderClients();
        }
      );


    $('btn-reset-filters')
      ?.addEventListener(
        'click',
        resetFilters
      );


    /* Activities */

    $('btn-add-activity')
      ?.addEventListener(
        'click',
        () =>
          openActivityModal()
      );

    $('btn-save-activity')
      ?.addEventListener(
        'click',
        saveActivity
      );


    /* Contacts */

    $('btn-add-contact')
      ?.addEventListener(
        'click',
        () =>
          openContactModal()
      );

    $('btn-save-contact')
      ?.addEventListener(
        'click',
        saveContact
      );


    /* Banks */

    $('btn-add-bank-account')
      ?.addEventListener(
        'click',
        () =>
          openBankModal()
      );

    $('btn-save-bank-account')
      ?.addEventListener(
        'click',
        saveBankAccount
      );


    /* Reports */

    $('btn-add-report')
      ?.addEventListener(
        'click',
        () =>
          openReportModal()
      );

    $('btn-save-report')
      ?.addEventListener(
        'click',
        saveReport
      );


    /* Communication */

    $('btn-add-communication')
      ?.addEventListener(
        'click',
        () =>
          openCommunicationModal()
      );

    $('btn-save-communication')
      ?.addEventListener(
        'click',
        saveCommunication
      );


    /* Secrets */

    $('btn-add-secret')
      ?.addEventListener(
        'click',
        () =>
          openSecretModal()
      );

    $('btn-save-secret')
      ?.addEventListener(
        'click',
        saveSecret
      );

    $('btn-load-secret-audit')
      ?.addEventListener(
        'click',
        loadSecretAudit
      );


    /* Modal close buttons */

    $all(
      '[data-close-modal]'
    ).forEach(
      button => {
        button.addEventListener(
          'click',
          () =>
            closeModal(
              button.dataset.closeModal
            )
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
          event.key !== 'Escape'
        ) {
          return;
        }


        const modals =
          $all(
            '.modal-backdrop.active'
          );

        if (modals.length) {
          closeModal(
            modals[
              modals.length - 1
            ].id
          );

          return;
        }


        if (
          $('client-drawer')
            .classList
            .contains(
              'active'
            )
        ) {
          closeDrawer();
        }
      }
    );
  }


  /* ============================================================
     AUTH CHANGES
     ============================================================ */

  function listenAuthChanges() {
    state.supabase
      .auth
      .onAuthStateChange(
        async (
          event,
          session
        ) => {
          if (
            event ===
            'SIGNED_OUT'
          ) {
            state.user =
              null;

            state.profile =
              null;

            toast(
              'Сессия завершена',
              'warn'
            );

            return;
          }


          if (
            session?.user &&
            session.user.id !==
              state.user?.id
          ) {
            state.user =
              session.user;

            try {
              await loadCurrentProfile();
              await loadProfiles();
              await loadClients();

            } catch (error) {
              console.error(error);
            }
          }
        }
      );
  }


  /* ============================================================
     INIT
     ============================================================ */

  async function init() {
    if (
      state.initialized
    ) {
      return;
    }

    state.initialized =
      true;


    bindEvents();

    showClientsState(
      'loading'
    );


    try {
      state.supabase =
        resolveSupabaseClient();


      await loadCurrentUser();

      await Promise.all([
        loadCurrentProfile(),
        loadProfiles()
      ]);


      /*
       * У пользователя без manager
       * интерфейс секретов остаётся видимым,
       * но действия с ним недоступны.
       */
      if (!isManager()) {
        setHidden(
          $('btn-add-secret'),
          true
        );
      }


      await loadClients();

      const requestedClientId =
        new URLSearchParams(
          window.location.search
        ).get('client');

      if (
        requestedClientId &&
        state.clients.some(
          client =>
            client.id === requestedClientId
        )
      ) {
        await openClient(
          requestedClientId
        );
      }


      listenAuthChanges();

      startNotificationWatcher();


      toast(
        `Клиентская база готова${
          state.profile
            ? ` — ${profileName(state.profile)}`
            : ''
        }`,
        'ok'
      );


    } catch (error) {
      console.error(
        'Не удалось запустить модуль Клиенты:',
        error
      );

      showClientsState(
        'error',
        friendlyError(error)
      );

      toast(
        friendlyError(error),
        'err'
      );
    }
  }


  /* ============================================================
     START
     ============================================================ */

  document.addEventListener(
    'DOMContentLoaded',
    init
  );

})();
