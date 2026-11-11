// A cópia local evita que o site dependa do GitHub para iniciar.
const SOURCE_URL='source-snapshot.html';
const STORAGE_KEY='roteiro-7-passos-v2';
const VARIABLE_KEY='roteiro-7-passos-variaveis';
const $=s=>document.querySelector(s);
const content=$('#content'), motivation=$('#motivationContent'), nav=$('#stepNav');
let editing=false, saveTimer, published={revision:'original',snapshot:null}, hasDraft=false, publishing=false, publishedAvailable=false, draftBaseRevision='original';

const cleanText=s=>s.replace(/\s+/g,' ').trim();
const slug=s=>cleanText(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const editable=el=>{el.dataset.editable='';el.setAttribute('contenteditable',editing?'true':'false');el.setAttribute('spellcheck','true');};

function variableKey(label){const value=label.toLowerCase();if(value.includes('quem indicou'))return'referrer';if(value.includes('seu nome'))return'seller';return'person'}
function wrapVariables(root){
  const nodes=[];
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){return node.parentElement?.closest('.variable-value,script,style')?NodeFilter.FILTER_REJECT:/\((nome da pessoa|nome de quem indicou|seu nome)\)/i.test(node.data)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}});
  while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{const fragment=document.createDocumentFragment();let last=0,match;const regex=/\((nome da pessoa|nome de quem indicou|seu nome)\)/gi;while((match=regex.exec(node.data))){fragment.append(node.data.slice(last,match.index));const span=document.createElement('span');span.className='variable-value';span.dataset.variable=variableKey(match[1]);span.dataset.placeholder=match[0];span.contentEditable='false';fragment.append(span);last=regex.lastIndex}fragment.append(node.data.slice(last));node.replaceWith(fragment)});
}
function getVariables(){try{return JSON.parse(localStorage.getItem(VARIABLE_KEY)||'{}')}catch{return{}}}
function applyVariables(){const values={person:$('#personName').value.trim(),referrer:$('#referrerName').value.trim(),seller:$('#sellerName').value.trim()};document.querySelectorAll('.variable-value').forEach(span=>{const value=values[span.dataset.variable];span.textContent=value||span.dataset.placeholder;span.classList.toggle('empty',!value)});try{localStorage.setItem(VARIABLE_KEY,JSON.stringify(values))}catch{}}
function initializeVariables(){wrapVariables(motivation);wrapVariables(content);const values=getVariables();$('#personName').value=values.person||'';$('#referrerName').value=values.referrer||'';$('#sellerName').value=values.seller||'';applyVariables()}

async function load(){
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch(error){console.warn('Rascunho local indisponível.',error)}
  try{published=await SharedContent.read();publishedAvailable=true;draftBaseRevision=published.revision}catch(error){toast(error.message)}
  if(saved&&saved.draft!==false){
    try{renderSaved(SharedContent.normalize(saved));hasDraft=true;draftBaseRevision=saved.baseRevision||published.revision;updateSaveStatus();return}catch(error){console.warn('Rascunho incompatível; preservado no armazenamento.',error)}
  }
  if(published.snapshot){renderSaved(published.snapshot);hasDraft=false;updateSaveStatus();return}
  if(saved&&saved.draft===false&&!publishedAvailable){
    try{renderSaved(SharedContent.normalize(saved));updateSaveStatus();return}catch(error){console.warn(error)}
  }
  const encoded=$('#sourceSnapshot')?.textContent.trim();
  if(!encoded)throw new Error('Conteúdo incorporado não encontrado');
  const bytes=Uint8Array.from(atob(encoded),char=>char.charCodeAt(0));
  const doc=new DOMParser().parseFromString(new TextDecoder('utf-8').decode(bytes),'text/html');
  buildFromSource(doc.body);hasDraft=false;updateSaveStatus();
}
function updateSaveStatus(){
  $('#saveStatus').textContent=hasDraft?'Rascunho salvo neste navegador':published.snapshot?'Conteúdo publicado':'Conteúdo original';
  $('#viewPublished').hidden=!(hasDraft&&publishedAvailable);
}
function showPublished(){
  clearTimeout(saveTimer);
  // Keep a separate recovery copy before switching to the public version.
  try{const draft=localStorage.getItem(STORAGE_KEY);if(draft)localStorage.setItem(STORAGE_KEY+'-recovery',draft);localStorage.removeItem(STORAGE_KEY)}catch{toast('Não foi possível guardar o rascunho. Exporte um backup antes de continuar.');return}
  location.reload();
}

function buildFromSource(body){
  const children=[...body.children].filter(el=>el.tagName!=='SCRIPT'&&el.tagName!=='BR');
  const firstStep=children.findIndex(el=>el.matches('h2')&&/^1\s*-/.test(cleanText(el.textContent)));
  const intro=children.slice(0,firstStep);
  motivation.innerHTML='';
  intro.filter(el=>el.matches('p')).forEach(el=>{const p=document.createElement('p');p.innerHTML=el.innerHTML;editable(p);motivation.append(p)});
  const groups=[];let current=null;
  children.slice(firstStep).forEach(el=>{
    if(el.matches('h2')&&/^\d\s*-/.test(cleanText(el.textContent))){current={title:cleanText(el.textContent),nodes:[]};groups.push(current)}
    else if(current)current.nodes.push(el);
  });
  content.innerHTML=''; groups.forEach((g,i)=>content.append(makeCard(g,i+1)));
  finishRender();
}

function makeCard(group,num){
  const card=document.createElement('article');card.className='step-card';card.id='passo-'+num;
  const title=group.title.replace(/^\d\s*-\s*/, '');
  card.innerHTML=`<button class="step-header" type="button"><span class="step-number">${String(num).padStart(2,'0')}</span><span><h2 data-editable>${title}</h2><small>Etapa ${num} do roteiro</small></span><span class="chevron">⌄</span></button><div class="step-body"></div>`;
  const body=card.querySelector('.step-body');
  group.nodes.forEach(node=>body.append(transformNode(node)));
  card.querySelector('.step-header').addEventListener('click',e=>{if(editing&&e.target.closest('[data-editable]'))return;card.classList.toggle('collapsed')});
  return card;
}

function transformNode(source){
  if(source.classList.contains('collapsible')){
    const wrap=document.createElement('div');wrap.className='sub-collapse';
    const button=document.createElement('button');button.innerHTML=source.innerHTML;editable(button);
    const panel=document.createElement('div');panel.className='sub-collapse-content';
    const sibling=source.nextElementSibling;
    if(sibling?.classList.contains('content'))[...sibling.children].forEach(n=>{if(n.tagName!=='HR')panel.append(transformNode(n))});
    button.addEventListener('click',()=>{if(!editing)panel.hidden=!panel.hidden});wrap.append(button,panel);return wrap;
  }
  if(source.classList.contains('content'))return document.createDocumentFragment();
  const el=document.createElement(source.tagName.toLowerCase());el.innerHTML=source.innerHTML;
  if(source.matches('p,h3,h4,h5,li'))editable(el);
  if(/fundo-azul-1/.test(source.className))el.classList.add('callout');
  if(/fundo-amarelo/.test(source.className))el.classList.add('callout','yellow');
  if(/fundo-laranja/.test(source.className))el.classList.add('callout','orange');
  if(/fundo-vermelho/.test(source.className))el.classList.add('callout','red');
  return el;
}

function finishRender(){
  $('#loading').hidden=true;content.querySelectorAll('p,h2,h3,h4,h5,li').forEach(editable);initializeVariables();buildNav();setEditing(false);observeSteps();
  document.querySelectorAll('[data-editable]').forEach(el=>el.addEventListener('input',()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>save(true),450)}));
}
function buildNav(){nav.innerHTML='';document.querySelectorAll('.step-card').forEach((card,i)=>{const a=document.createElement('a');a.href='#'+card.id;a.innerHTML=`<span>${i+1}</span>${card.querySelector('h2').textContent}`;nav.append(a)})}
function observeSteps(){const links=[...nav.querySelectorAll('a')];new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){links.forEach(a=>a.classList.toggle('active',a.hash==='#'+e.target.id))}}),{rootMargin:'-30% 0px -60%'}).observe;document.querySelectorAll('.step-card').forEach(card=>{new IntersectionObserver(es=>{if(es[0].isIntersecting)links.forEach(a=>a.classList.toggle('active',a.hash==='#'+card.id))},{rootMargin:'-30% 0px -60%'}).observe(card)})}
function snapshot(){return SharedContent.normalize({motivation:motivation.innerHTML,motivationTitle:$('.motivation-title strong').innerHTML,content:content.innerHTML,updated:new Date().toISOString()})}
function save(show=true){
  if(!hasDraft)draftBaseRevision=published.revision;
  hasDraft=true;
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify({...snapshot(),draft:true,baseRevision:draftBaseRevision}));updateSaveStatus();if(show)toast('Rascunho salvo neste navegador')}catch(error){console.warn('Não foi possível salvar localmente.',error);$('#saveStatus').textContent='Falha ao salvar rascunho';toast('Não foi possível salvar. Exporte um backup antes de sair.')}
}

function renderSaved(data){$('.motivation-title strong').innerHTML=data.motivationTitle||'Seja ousado!';motivation.innerHTML=data.motivation;content.innerHTML=data.content;content.querySelectorAll('.step-card').forEach(card=>card.querySelector('.step-header').addEventListener('click',e=>{if(editing&&e.target.closest('[data-editable]'))return;card.classList.toggle('collapsed')}));content.querySelectorAll('.sub-collapse>button').forEach(b=>b.addEventListener('click',()=>{if(!editing)b.nextElementSibling.hidden=!b.nextElementSibling.hidden}));finishRender()}
function setEditing(value){if(value)$('#sidebar').classList.remove('open');editing=value;document.body.classList.toggle('editing',value);document.querySelectorAll('[data-editable]').forEach(el=>el.setAttribute('contenteditable',value));$('#editor').classList.toggle('open',value);$('#editor').setAttribute('aria-hidden',!value);if(value){document.querySelectorAll('.step-card').forEach(c=>c.classList.remove('collapsed'));setTimeout(()=>document.querySelector('.step-card [data-editable]')?.focus(),250)}}
function toast(text){const t=$('#toast');t.textContent=text;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}

$('#editToggleSide').onclick=()=>setEditing(true);$('#closeEditor').onclick=$('#finishEditing').onclick=()=>{save(false);buildNav();setEditing(false);toast('Rascunho salvo. Use Publicar no site para compartilhar.')};
$('#menuToggle').onclick=()=>$('#sidebar').classList.toggle('open');
function setFocusMode(active){
  if(active&&editing){save(false);buildNav();setEditing(false)}
  document.body.classList.toggle('focus',active);
  $('#focusToggle').textContent=active?'Sair do foco':'Modo foco';
  $('#focusToggle').setAttribute('aria-pressed',String(active));
}
$('#focusToggle').onclick=()=>setFocusMode(!document.body.classList.contains('focus'));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('focus'))setFocusMode(false)});

['personName','referrerName','sellerName'].forEach(id=>$('#'+id).addEventListener('input',applyVariables));
$('#clearVariables').onclick=()=>{['personName','referrerName','sellerName'].forEach(id=>$('#'+id).value='');applyVariables();$('#personName').focus()};
document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('mousedown',event=>{event.preventDefault();document.execCommand(button.dataset.command,false,null);save(false)}));
$('#blockFormat').addEventListener('change',event=>{document.execCommand('formatBlock',false,event.target.value);save(false)});
$('#textColor').addEventListener('input',event=>{document.execCommand('foreColor',false,event.target.value);save(false)});
$('#addParagraph').onclick=()=>{const active=document.activeElement.closest?.('[data-editable]')||document.querySelector('.step-body [data-editable]');const p=document.createElement('p');p.dataset.editable='';p.contentEditable='true';p.innerHTML='Novo parágrafo';active.after(p);p.focus();const selection=getSelection(),range=document.createRange();range.selectNodeContents(p);selection.removeAllRanges();selection.addRange(range);p.addEventListener('input',()=>save(true))};
$('#deleteBlock').onclick=()=>{const block=document.activeElement.closest?.('[data-editable]');if(block&&confirm('Excluir este bloco de texto?')){block.remove();save(true)}};
$('#exportContent').onclick=()=>{const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='backup-7-passos.json';a.click();URL.revokeObjectURL(a.href)};
$('#importContent').onchange=async e=>{try{const data=SharedContent.normalize(JSON.parse(await e.target.files[0].text()));localStorage.setItem(STORAGE_KEY,JSON.stringify({...data,draft:true,baseRevision:published.revision}));location.reload()}catch{toast('Arquivo de backup inválido')}};
$('#resetContent').onclick=()=>{if(confirm('Descartar este rascunho e abrir a versão publicada? Uma cópia ficará disponível em Recuperar rascunho.'))showPublished()};
async function start(){try{await load()}catch(error){
  console.error('Falha inesperada ao iniciar o site:',error);
  $('#loading').hidden=false;
  $('#loading').innerHTML=`<div><p><strong>O roteiro não conseguiu iniciar.</strong></p><p>${error.message||'Erro desconhecido'}</p><button class="button primary" id="retryLoad" type="button">Limpar dados e tentar novamente</button></div>`;
  $('#retryLoad').onclick=()=>{try{localStorage.removeItem(STORAGE_KEY)}catch{}location.reload()};
}}
start();

$('#viewPublished').onclick=()=>{if(confirm('Abrir o conteúdo publicado? Seu rascunho será guardado como cópia de recuperação neste navegador.'))showPublished()};
$('#recoverDraft').onclick=()=>{
  try{const recovery=localStorage.getItem(STORAGE_KEY+'-recovery');if(!recovery){toast('Nenhum rascunho anterior para recuperar');return}const recovered=JSON.parse(recovery);const data=SharedContent.normalize(recovered);localStorage.setItem(STORAGE_KEY,JSON.stringify({...data,draft:true,baseRevision:recovered.baseRevision}));location.reload()}catch{toast('Não foi possível recuperar o rascunho')}
};
$('#publishContent').onclick=()=>{save(false);$('#publishMessage').textContent='';$('#publishFallback').open=false;$('#publishDialog').showModal();$('#githubToken').focus()};
$('#cancelPublish').onclick=()=>$('#publishDialog').close();
$('#publishDialog').addEventListener('close',()=>{$('#githubToken').value=''});
$('#publishDialog').addEventListener('cancel',event=>{if(publishing)event.preventDefault()});
$('#publishForm').addEventListener('submit',async event=>{
  event.preventDefault();if(publishing)return;
  let token=$('#githubToken').value.trim();$('#githubToken').value='';
  if(!token){$('#publishMessage').textContent='Informe a credencial do GitHub.';return}
  publishing=true;$('#confirmPublish').disabled=true;$('#cancelPublish').disabled=true;$('#publishMessage').textContent='Publicando no GitHub...';
  try{
    const data=snapshot();
    const result=await SharedContent.publish(data,token,draftBaseRevision);
    published=result;publishedAvailable=true;draftBaseRevision=result.revision;
    clearTimeout(saveTimer);
    const changed=JSON.stringify(snapshot().content)!==JSON.stringify(data.content)||snapshot().motivation!==data.motivation||snapshot().motivationTitle!==data.motivationTitle;
    hasDraft=changed;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify({...(changed?snapshot():result.snapshot),draft:changed,baseRevision:result.revision}))}catch{console.warn('Publicado, mas sem cache local')}
    updateSaveStatus();$('#publishDialog').close();
    if(!changed){buildNav();setEditing(false)}
    toast('Publicado! O texto já esta disponível ao abrir o site em outro navegador.');
  }catch(error){$('#publishFallback').open=true;$('#publishMessage').textContent=error.message||'Falha de conexão. Seu rascunho foi preservado. Verifique a versão publicada antes de tentar novamente.'}
  finally{token='';publishing=false;$('#confirmPublish').disabled=false;$('#cancelPublish').disabled=false}
});

new ResizeObserver(entries=>{document.documentElement.style.setProperty('--editor-height',entries[0].target.getBoundingClientRect().height+'px')}).observe($('#editor'));

$('#downloadPublication').onclick=()=>{
  try{
    save(false);
    const file=SharedContent.publicationFile(snapshot());
    const url=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)+'\n'],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='published-content.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('#publishMessage').textContent='Arquivo preparado. Agora envie published-content.json no GitHub e confirme em Commit changes para publicar.';
  }catch(error){$('#publishMessage').textContent=error.message}
};
