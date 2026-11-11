// Publicação autenticada no GitHub; nenhuma credencial e armazenada.
const SharedContent=(()=>{
  const repository='leandrofreire13/7-passos-matricula';
  const path='published-content.json';
  const api=`https://api.github.com/repos/${repository}/contents/${path}`;
  const raw=`https://raw.githubusercontent.com/${repository}/main/${path}`;
  const classes=new Set('step-card step-header step-number step-body chevron sub-collapse sub-collapse-content callout yellow orange red variable-value empty'.split(' '));
  const tags=new Set('ARTICLE DIV SECTION P H2 H3 H4 H5 UL OL LI STRONG B EM I U S STRIKE SPAN BR BLOCKQUOTE BUTTON A SUB SUP CODE PRE HR'.split(' '));
  const forbidden='script,style,iframe,object,embed,svg,math,form,input,textarea,select,link,meta,base';
  function cleanHTML(html){
    const template=document.createElement('template');template.innerHTML=html;
    template.content.querySelectorAll(forbidden).forEach(el=>el.remove());
    [...template.content.querySelectorAll('*')].reverse().forEach(el=>{
      if(!tags.has(el.tagName)){el.replaceWith(...el.childNodes);return}
      const safeClasses=[...el.classList].filter(name=>classes.has(name)&&name!=='empty');
      const style=el.style;
      const safeStyle=['color','background-color','font-weight','font-style','text-decoration','text-align','font-size'].map(key=>[key,style.getPropertyValue(key)]).filter(([,value])=>value&&!/url|expression|var\(/i.test(value));
      for(const attr of [...el.attributes]){
        const name=attr.name;
        const safe=name==='data-editable'||(name==='data-variable'&&['person','referrer','seller'].includes(attr.value))||(name==='data-placeholder'&&attr.value.length<100)||(name==='id'&&/^passo-\d+$/.test(attr.value))||(name==='href'&&/^(https?:|mailto:|#)/i.test(attr.value));
        if(!safe)el.removeAttribute(name);
      }
      if(safeClasses.length)el.className=safeClasses.join(' ');
      safeStyle.forEach(([key,value])=>el.style.setProperty(key,value));
    });
    return template.innerHTML;
  }
  function normalizeHTML(html){
    const cleaned=document.createElement('template');cleaned.innerHTML=cleanHTML(html);
    cleaned.content.querySelectorAll('[data-variable]').forEach(el=>{el.className='variable-value empty';el.textContent=el.dataset.placeholder||({person:'(nome da pessoa)',referrer:'(nome de quem indicou)',seller:'(SEU NOME)'})[el.dataset.variable];el.contentEditable='false'});
    return cleaned.innerHTML;
  }
  function normalize(data){
    if(!data||typeof data.content!=='string'||typeof data.motivation!=='string'||data.content.length+data.motivation.length>700000)throw new Error('Arquivo de roteiro inválido ou muito grande.');
    const result={content:normalizeHTML(data.content),motivation:normalizeHTML(data.motivation),motivationTitle:normalizeHTML(data.motivationTitle||'Seja ousado!'),updated:data.updated||new Date().toISOString()};
    const template=document.createElement('template');template.innerHTML=result.content;
    if(!template.content.querySelector('.step-card h2')||!template.content.querySelector('.step-body'))throw new Error('O roteiro precisa conter etapas e textos.');
    return result;
  }
  function envelope(data){
    if(data?.version!==1||typeof data.revision!=='string')throw new Error('Versão publicada inválida.');
    return {...data,snapshot:data.snapshot===null?null:normalize(data.snapshot)};
  }
  async function read(){
    for(const url of [raw+'?t='+Date.now(),path+'?t='+Date.now()]){
      try{const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(8000)});if(response.ok)return envelope(await response.json())}catch(error){console.warn('Fonte publicada indisponível.',error.message)}
    }
    throw new Error('Não foi possível consultar a versão publicada. Seu rascunho local foi preservado.');
  }
  function decode(value){return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\s/g,'')),char=>char.charCodeAt(0)))}
  function encode(value){const bytes=new TextEncoder().encode(value);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary)}
  async function publish(snapshot,token,baseRevision){
    const headers={Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2026-03-10'};
    const current=await fetch(api+'?ref=main',{headers,cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!current.ok)throw new Error(current.status===401?'Credencial inválida ou expirada.':'Não foi possível acessar o repositório. Verifique a permissão Contents: Read and write.');
    const file=await current.json();const previous=envelope(JSON.parse(decode(file.content)));
    if(previous.revision!==baseRevision)throw new Error('Há uma nova versão publicada. Feche esta janela e use Ver publicado antes de editar e publicar novamente. Seu rascunho continua salvo neste navegador.');
    const data={version:1,revision:crypto.randomUUID(),snapshot:normalize(snapshot)};
    const response=await fetch(api,{method:'PUT',headers,signal:AbortSignal.timeout(20000),body:JSON.stringify({message:'Publica roteiro editado pelo site',branch:'main',sha:file.sha,content:encode(JSON.stringify(data,null,2)+'\n')})});
    if(!response.ok)throw new Error(response.status===409?'Outra publicação aconteceu ao mesmo tempo. Recarregue a versão publicada antes de tentar novamente.':'O GitHub recusou a publicação. Verifique a credencial e a permissão de escrita no repositório.');
    return data;
  }
  return {normalize,read,publish};
})();
