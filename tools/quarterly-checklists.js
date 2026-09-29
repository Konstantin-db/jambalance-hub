'use strict';

const SUPABASE_URL = 'https://fqcltmxiarohfpfnghjn.supabase.co';
const KEY = 'sb_publishable_PqjH12Cbf7Fw9CWxvTPHaQ_MYYq7HQT';
const $ = id => document.getElementById(id);
const db = window.supabase.createClient(SUPABASE_URL, KEY, {auth:{persistSession:true,autoRefreshToken:true}});
const state = {user:null, clients:[], templates:[], checklists:[], items:[], selectedClient:null, selectedTemplate:null, year:0, quarter:0, busy:false};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function message(text, error=false) {
  $('message').textContent = text;
  $('message').classList.toggle('error', error);
}
function check({data,error}) { if (error) throw error; return data; }
function clientName(client) { return client.client_name || client.name || 'Без названия'; }
function period() { return `${['','I','II','III','IV'][state.quarter]} квартал ${state.year}`; }
function currentChecklist() { return state.checklists.find(row => row.client_id === state.selectedClient) || null; }
function currentItems() { const list=currentChecklist(); return list ? state.items.filter(item => item.checklist_id === list.id) : []; }
function progress(items) { return items.length ? Math.round(items.filter(item => item.completed_at).length / items.length * 100) : 0; }
function formatUser(id) { return id === state.user.id ? 'Вы' : (state.profiles?.find(p => p.id === id)?.full_name || 'Сотрудник'); }

async function loadBase() {
  const [clients,templates,profiles] = await Promise.all([
    db.from('clients').select('id,client_name,inn,status').eq('status','active').order('client_name'),
    db.from('quarterly_templates').select('*').order('name'),
    db.from('profiles').select('id,full_name').eq('is_active',true)
  ]);
  state.clients=check(clients) || [];
  state.templates=check(templates) || [];
  state.profiles=check(profiles) || [];
  renderClients(); renderTemplates();
}
async function loadQuarter() {
  state.checklists=check(await db.from('quarterly_checklists').select('*').eq('year',state.year).eq('quarter',state.quarter)) || [];
  const ids=state.checklists.map(row => row.id);
  state.items=ids.length ? check(await db.from('quarterly_checklist_items').select('*').in('checklist_id',ids).order('sort_order').order('created_at')) || [] : [];
  renderClients(); renderChecklist();
}
function renderClients() {
  const needle=$('client-search').value.trim().toLocaleLowerCase('ru');
  const clients=state.clients.filter(client => (clientName(client)+' '+(client.inn||'')).toLocaleLowerCase('ru').includes(needle));
  $('client-count').textContent=`Клиентов: ${clients.length} · ${period()}`;
  $('client-list').innerHTML=clients.map(client => {
    const list=state.checklists.find(row => row.client_id===client.id);
    const items=list ? state.items.filter(item => item.checklist_id===list.id) : [];
    const done=items.filter(item => item.completed_at).length;
    return `<button class="list-item ${state.selectedClient===client.id?'active':''}" data-client="${client.id}"><strong>${escapeHtml(clientName(client))}</strong><span class="muted">${list ? `${done} из ${items.length} выполнено` : 'Список ещё не создан'}</span>${list ? `<div class="progress"><i style="width:${progress(items)}%"></i></div>` : ''}</button>`;
  }).join('') || '<p class="muted">Клиенты не найдены.</p>';
}
function itemTree(items, mode) {
  const roots=items.filter(item => !item.parent_id);
  if (!roots.length) return '<p class="muted">Пунктов пока нет. Добавьте первый пункт ниже.</p>';
  const make=item => {
    const children=items.filter(child => child.parent_id===item.id);
    const isDone=!!item.completed_at;
    return `<div class="item ${item.parent_id?'child':''}"><div class="item-line">
      ${mode==='checklist' ? `<input type="checkbox" data-toggle="${item.id}" ${isDone?'checked':''} aria-label="${escapeHtml(item.title)}">` : ''}
      <span class="title ${isDone?'done':''}">${escapeHtml(item.title)}</span>
      <button class="icon-btn" data-edit-item="${item.id}" title="Переименовать" aria-label="Переименовать ${escapeHtml(item.title)}">✎</button>
      <button class="icon-btn" data-delete-item="${item.id}" title="Удалить" aria-label="Удалить ${escapeHtml(item.title)}">×</button>
    </div>${isDone&&mode==='checklist'?`<div class="small">Отметил(а): ${escapeHtml(formatUser(item.completed_by))} · ${new Date(item.completed_at).toLocaleString('ru-RU')}</div>`:''}
    ${children.map(make).join('')}
    <form class="row add-child" data-parent="${item.id}"><input type="text" maxlength="300" required placeholder="Добавить подпункт"><button class="btn">＋</button></form></div>`;
  };
  return roots.map(make).join('');
}
function renderChecklist() {
  const client=state.clients.find(row => row.id===state.selectedClient);
  $('checklist-heading').textContent=client ? `${clientName(client)} · ${period()}` : 'Выберите клиента';
  const box=$('checklist-content');
  if (!client) {box.className='empty';box.textContent='Выберите клиента слева, чтобы увидеть задачи на квартал.';return;}
  box.className='';
  const list=currentChecklist();
  if (!list) {
    box.innerHTML=`<p class="muted">Списка на этот квартал пока нет. Выберите шаблон: его пункты можно будет менять для этого клиента отдельно.</p>
      <form id="create-checklist"><label for="template-select">Шаблон</label><select id="template-select" required><option value="">Выберите шаблон</option>${state.templates.map(t=>`<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select><p><button class="btn primary" ${state.templates.length?'':'disabled'}>Создать список</button></p></form>
      ${state.templates.length?'':'<p class="muted">Сначала создайте шаблон на соседней вкладке.</p>'}`;
    return;
  }
  const items=currentItems(), done=items.filter(item => item.completed_at).length;
  box.innerHTML=`<p class="muted">Основа: ${escapeHtml(list.template_name)} · выполнено ${done} из ${items.length}. Изменения здесь относятся только к этому клиенту и кварталу.</p>
    <div class="progress"><i style="width:${progress(items)}%"></i></div><div class="item-list" data-mode="checklist">${itemTree(items,'checklist')}</div>
    <h3>Новый пункт</h3><form class="row add-root"><input type="text" maxlength="300" required placeholder="Что нужно сделать"><button class="btn primary">Добавить</button></form>
    <p><button class="btn" id="refresh-checklist" type="button">Обновить отметки коллег</button></p>`;
}
function renderTemplates() {
  $('template-list').innerHTML=state.templates.map(t=>`<button class="list-item ${state.selectedTemplate===t.id?'active':''}" data-template="${t.id}"><strong>${escapeHtml(t.name)}</strong></button>`).join('') || '<p class="muted">Шаблонов пока нет.</p>';
  renderTemplate();
}
async function selectTemplate(id) {
  state.selectedTemplate=id;
  const result=await db.from('quarterly_template_items').select('*').eq('template_id',id).order('sort_order').order('created_at');
  state.templateItems=check(result)||[];
  renderTemplates();
}
function renderTemplate() {
  const template=state.templates.find(t=>t.id===state.selectedTemplate);
  $('template-heading').textContent=template?.name || 'Выберите шаблон';
  const box=$('template-content');
  if (!template) {box.className='empty';box.textContent='Выберите шаблон слева. Его изменения затронут только новые списки.';return;}
  box.className='';
  box.innerHTML=`<p class="muted">Редактирование шаблона не меняет уже созданные квартальные списки.</p>
    <div class="row"><button class="btn" id="rename-template">Переименовать</button><button class="btn" id="delete-template">Удалить шаблон</button></div>
    <div class="item-list" data-mode="template">${itemTree(state.templateItems||[],'template')}</div>
    <h3>Новый пункт шаблона</h3><form class="row add-root"><input type="text" maxlength="300" required placeholder="Название задачи"><button class="btn primary">Добавить</button></form>`;
}
async function updateUI(action) {
  if (state.busy) return;
  state.busy=true; message('');
  try {await action();}
  catch(error) {console.error(error);message(error?.message || 'Не удалось сохранить изменения.',true);renderChecklist();renderTemplate();}
  finally {state.busy=false;}
}
async function refresh(mode) {
  if (mode==='template') await selectTemplate(state.selectedTemplate);
  else await loadQuarter();
}
async function addItem(mode,title,parentId) {
  const template=mode==='template', table=template?'quarterly_template_items':'quarterly_checklist_items';
  const items=template?state.templateItems:currentItems();
  check(await db.from(table).insert({[template?'template_id':'checklist_id']:template?state.selectedTemplate:currentChecklist().id,parent_id:parentId||null,title:title.trim(),sort_order:items.length}));
  await refresh(mode);
}
async function handleItemClick(button, mode) {
  const id=button.dataset.editItem || button.dataset.deleteItem || button.dataset.toggle;
  const items=mode==='template'?state.templateItems:currentItems();
  const item=items.find(row=>row.id===id);
  if (!item) return;
  const table=mode==='template'?'quarterly_template_items':'quarterly_checklist_items';
  if (button.dataset.toggle) {
    const next=item.completed_at ? {completed_at:null,completed_by:null} : {completed_at:new Date().toISOString(),completed_by:state.user.id};
    let query=db.from(table).update(next).eq('id',id).select('id');
    query=item.completed_at ? query.eq('completed_at',item.completed_at) : query.is('completed_at',null);
    const changed=check(await query);
    if (!changed?.length) throw new Error('Коллега уже изменил эту отметку. Обновите список.');
  } else if (button.dataset.editItem) {
    const title=prompt('Название пункта:',item.title)?.trim();
    if (!title || title===item.title) return;
    if(title.length>300) throw new Error('Название слишком длинное (максимум 300 символов).');
    check(await db.from(table).update({title}).eq('id',id));
  } else {
    const childCount=items.filter(row=>row.parent_id===id).length;
    if(!confirm(`Удалить пункт «${item.title}»${childCount ? ` и его подпункты (${childCount})` : ''}?`)) return;
    check(await db.from(table).delete().eq('id',id));
  }
  await refresh(mode);
}

document.addEventListener('click', event => {
  const tab=event.target.closest('[data-tab]');
  if(tab){document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active',el===tab));$('checklists-view').hidden=tab.dataset.tab!=='checklists';$('templates-view').hidden=tab.dataset.tab!=='templates';return;}
  const client=event.target.closest('[data-client]');
  if(client){state.selectedClient=client.dataset.client;renderClients();renderChecklist();return;}
  const template=event.target.closest('[data-template]');
  if(template){updateUI(()=>selectTemplate(template.dataset.template));return;}
  const item=event.target.closest('[data-edit-item],[data-delete-item],[data-toggle]');
  if(item){updateUI(()=>handleItemClick(item,item.closest('[data-mode]').dataset.mode));return;}
  if(event.target.id==='refresh-checklist') updateUI(()=>loadQuarter());
  if(event.target.id==='rename-template') updateUI(async()=>{
    const row=state.templates.find(t=>t.id===state.selectedTemplate);
    const name=prompt('Новое название шаблона:',row.name)?.trim();
    if(!name||name===row.name)return;
    check(await db.from('quarterly_templates').update({name}).eq('id',row.id));await loadBase();
  });
  if(event.target.id==='delete-template') updateUI(async()=>{
    const row=state.templates.find(t=>t.id===state.selectedTemplate);
    if(!confirm(`Удалить шаблон «${row.name}»? Ранее созданные списки останутся.`))return;
    check(await db.from('quarterly_templates').delete().eq('id',row.id));state.selectedTemplate=null;await loadBase();
  });
});
document.addEventListener('submit',event=>{
  const form=event.target;
  if(!form.matches('#create-checklist,#new-template-form,.add-root,.add-child'))return;
  event.preventDefault();
  updateUI(async()=>{
    if(form.id==='create-checklist'){
      const templateId=$('template-select').value;
      if(!templateId)throw new Error('Выберите шаблон.');
      check(await db.rpc('create_quarterly_checklist',{p_client_id:state.selectedClient,p_year:state.year,p_quarter:state.quarter,p_template_id:templateId}));
      await loadQuarter();
    }else if(form.id==='new-template-form'){
      const name=$('new-template-name').value.trim();
      if(!name)return;
      const rows=check(await db.from('quarterly_templates').insert({name,created_by:state.user.id}).select('id'));
      $('new-template-name').value='';await loadBase();await selectTemplate(rows[0].id);
    }else{
      const mode=form.closest('[data-mode]')?.dataset.mode || (form.closest('#templates-view')?'template':'checklist');
      const input=form.querySelector('input');
      const title=input.value.trim();if(!title)return;
      await addItem(mode,title,form.dataset.parent||null);
    }
  });
});
document.addEventListener('change',event=>{
  if(event.target.id==='year'||event.target.id==='quarter'){
    const year=Number($('year').value),quarter=Number($('quarter').value);
    if(year<2000||year>2100)return;
    state.year=year;state.quarter=quarter;updateUI(()=>loadQuarter());
  }
});
$('client-search').addEventListener('input',renderClients);

async function init(){
  const now=new Date();state.year=now.getFullYear();state.quarter=Math.floor(now.getMonth()/3)+1;
  $('year').value=state.year;$('quarter').value=state.quarter;
  try{
    const {data,error}=await db.auth.getUser();if(error||!data?.user){location.replace('../index.html');return;}
    state.user=data.user;
    const profile=check(await db.from('profiles').select('id,is_active').eq('id',state.user.id).maybeSingle());
    if(!profile?.is_active)throw new Error('Учётная запись сотрудника неактивна.');
    await loadBase();await loadQuarter();
    db.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')location.replace('../index.html');});
  }catch(error){console.error(error);message('Не удалось загрузить квартальные списки. Проверьте, применена ли миграция базы: '+(error?.message||'Ошибка подключения'),true);}
}
init();
