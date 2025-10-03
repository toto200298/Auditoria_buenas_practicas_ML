/* =====================================================
 * Diagnóstico de Buenas Prácticas de ML + Charts (Chart.js)
 * - KPIs en vivo + cruzados
 * - Umbrales configurables (débil/sólido)
 * - Resumen ejecutivo y hallazgos dinámicos
 * - Etiquetas de impacto + Prompt GPT con fallback de copiado
 * - Gráficas: Radar (dominios), Barras (KPIs cruzados), Dona (respuestas)
 * ===================================================== */

// Dominios y pesos
const DOMINIOS = {
  Gob:   { label: "Gobernanza",       peso: 0.20 },
  Datos: { label: "Datos",            peso: 0.20 },
  Modelo:{ label: "Modelo",           peso: 0.25 },
  Op:    { label: "Operación",        peso: 0.20 },
  Val:   { label: "Valor/FinOps",     peso: 0.10 },
  Etica: { label: "Ética & Seguridad",peso: 0.05 }
};

/* Banco de preguntas (24) con explicación no técnica */
const PREGUNTAS = [
  // Gobernanza
  {id:1, dom:'Gob', txt:'¿El modelo está versionado (código, datos, artefactos) con lineage reproducible?', hint:'MLflow/UC/Git', tag:'versionado',
    exp:'Permite saber exactamente qué versión del modelo y de los datos se usó. Así, si algo sale mal, puedes repetir el proceso y entender qué cambió.'},
  {id:2, dom:'Gob', txt:'¿Existe plan de rollback documentado y validado en los últimos 90 días?', hint:'Runbook', tag:'rollback',
    exp:'Si una actualización falla, el plan de reversa evita interrupciones largas. Es como un “deshacer” rápido y seguro.'},
  {id:3, dom:'Gob', txt:'¿Hay aprobación formal (change/peer review) para promociones a prod?', hint:'PRs/Tickets', tag:'aprobacion',
    exp:'Implica que otra persona revisa antes de publicar cambios importantes, reduciendo errores por descuidos.'},
  {id:4, dom:'Gob', txt:'¿Se mantienen Model/Data Cards por versión?', hint:'Docs por release', tag:'cards',
    exp:'Son fichas simples que explican qué hace cada versión, con qué datos, limitaciones y responsables.'},

  // Datos
  {id:5, dom:'Datos', txt:'¿Hay contratos de datos con validaciones automáticas (esquema/rangos/cardinalidad)?', hint:'Great Expectations', tag:'contratos',
    exp:'Son “reglas de calidad” para detectar datos raros o incorrectos antes de que afecten al modelo.'},
  {id:6, dom:'Datos', txt:'¿Se monitorea drift de features con umbrales y alertas?', hint:'PSI/JSD/Evidently', tag:'drift',
    exp:'Detecta si los datos reales se alejan de los usados al entrenar. Señal temprana de pérdida de precisión.'},
  {id:7, dom:'Datos', txt:'¿Serving features alineados a training (feature parity)?', hint:'Feature Store', tag:'parity',
    exp:'Garantiza que las variables en producción se calculan igual que en entrenamiento.'},
  {id:8, dom:'Datos', txt:'¿Política de retención y PII tagging aplicada?', hint:'Policy tags', tag:'pii',
    exp:'Define cuánto tiempo se guardan datos y marca los datos personales. Reduce riesgos legales.'},

  // Modelo
  {id:9, dom:'Modelo', txt:'¿Métricas de desempeño recientes en prod o proxies válidos?', hint:'AUC/F1/MAE/PR', tag:'metricas',
    exp:'Indica si el modelo sigue funcionando bien hoy, no solo en pruebas antiguas.'},
  {id:10, dom:'Modelo', txt:'¿Evaluación de calibración periódica?', hint:'Brier/ACE', tag:'calibracion',
    exp:'Comprueba que las probabilidades del modelo coinciden con la realidad.'},
  {id:11, dom:'Modelo', txt:'¿Canary/AB antes de promover?', hint:'Experimentación', tag:'canary',
    exp:'Probar con un pequeño porcentaje de usuarios reduce el riesgo del despliegue.'},
  {id:12, dom:'Modelo', txt:'¿Tests de fuga (data leakage) en entrenamiento?', hint:'Separación temporal', tag:'leakage',
    exp:'Evita usar información del futuro o externa que no estará disponible en producción.'},

  // Operación
  {id:13, dom:'Op', txt:'¿SLIs/SLOs de latencia P95/P99 y tasa de errores monitoreados?', hint:'Dash + umbrales', tag:'latencia',
    exp:'Asegura que el sistema responde rápido y sin muchas fallas.'},
  {id:14, dom:'Op', txt:'¿Runbooks por alerta prioritaria y responsables definidos?', hint:'On-call', tag:'runbooks',
    exp:'Guías paso a paso para arreglar problemas. Reducen el tiempo de respuesta.'},
  {id:15, dom:'Op', txt:'¿Pruebas de resiliencia (timeouts/retries/circuit breaker)?', hint:'Chaos testing', tag:'resiliencia',
    exp:'Verifica que el sistema aguanta fallos parciales sin caerse.'},
  {id:16, dom:'Op', txt:'¿Pipeline orquestado (dependencias/retry/idempotencia)?', hint:'Airflow/Workflows', tag:'orquestacion',
    exp:'Asegura que las tareas se ejecuten en orden y sin duplicar resultados.'},

  // Valor/FinOps
  {id:17, dom:'Val', txt:'¿Baseline de negocio y comparación de uplift en canary?', hint:'KPIs de valor', tag:'baseline',
    exp:'Permite saber si el modelo aporta valor frente a la situación previa.'},
  {id:18, dom:'Val', txt:'¿Costo por 1k predicciones con objetivos/alertas?', hint:'FinOps dashboards', tag:'costo',
    exp:'Controla el gasto y ayuda a evaluar costo/beneficio.'},
  {id:19, dom:'Val', txt:'¿Optimizaciones medidas (batching/cachés/vectorización)?', hint:'Evidencia de mejoras', tag:'optimizaciones',
    exp:'Técnicas que reducen tiempo y costo; medirlas confirma su impacto.'},

  // Ética & Seguridad
  {id:20, dom:'Etica', txt:'¿Evaluación de sesgo por grupos relevantes y mitigación?', hint:'Métricas de equidad', tag:'sesgo',
    exp:'Busca que el modelo sea justo entre grupos de personas.'},
  {id:21, dom:'Etica', txt:'¿Explicaciones registradas (SHAP/attrib) para auditoría?', hint:'Explicabilidad', tag:'shap',
    exp:'Ayuda a entender por qué el modelo decide algo; clave para confianza y cumplimiento.'},
  {id:22, dom:'Etica', txt:'¿Gestión de secretos (KMS/Vault) y rotación programada vigente?', hint:'Secret stores', tag:'secretos',
    exp:'Protege contraseñas y claves. La rotación reduce riesgos.'},
  {id:23, dom:'Etica', txt:'¿Monitoreo de amenazas (poisoning/model stealing) con controles?', hint:'Threat modeling', tag:'amenazas',
    exp:'Vigila ataques específicos a modelos de IA y define cómo responder.'},
  {id:24, dom:'Etica', txt:'¿Consentimiento y uso de datos conforme al caso de uso?', hint:'Políticas/consentimiento', tag:'consentimiento',
    exp:'Asegura que el uso de datos respeta reglas y expectativas.'}
];

const VALORES = { 'Si':1, 'Parcial':0.5, 'No':0, 'N/A':null };

// Helpers DOM
const byId = (id)=>document.getElementById(id);
const el = (tag, cls)=>{ const e=document.createElement(tag); if(cls) e.className=cls; return e; };

// Estado umbrales (configurable)
let THRESHOLDS = { low: 0.60, high: 0.85 };

// Charts (Chart.js)
let charts = { radar:null, bars:null, doughnut:null };

// Render inicial
window.addEventListener('DOMContentLoaded',()=>{
  cargarFiltroDominios();
  renderPreguntas();
  bindUI();
  createCharts();        // inicializar gráficos
  updateLiveKPIs();      // pintar cifras iniciales y refrescar gráficos
});

function cargarFiltroDominios(){
  const sel = byId('filterDomain');
  const DOMS = { Gob:'Gobernanza', Datos:'Datos', Modelo:'Modelo', Op:'Operación', Val:'Valor/FinOps', Etica:'Ética & Seguridad' };
  Object.entries(DOMS).forEach(([k,v])=>{
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = v; sel.appendChild(opt);
  });
}

function renderPreguntas(){
  const wrap = byId('questions');
  wrap.innerHTML = '';
  const domFiltro = byId('filterDomain').value;
  const soloClaves = byId('onlyMust').checked;

  // “Claves” = preguntas más influyentes en KPIs cruzados
  const CLAVES = new Set([2,6,7,9,11,13,14,17,18,22,24]);

  PREGUNTAS.forEach(q=>{
    if(domFiltro !== 'all' && q.dom !== domFiltro) return;
    if(soloClaves && !CLAVES.has(q.id)) return;

    const item = el('div','q'); item.dataset.id = q.id;

    const header = el('div','q-header');
    const h4 = el('h4'); h4.textContent = `${q.id}. ${q.txt}`;
    const badges = el('div','q-badges');
    const bDom = el('span','badge dom'); bDom.textContent = DOMINIOS[q.dom].label;
    badges.append(bDom);
    header.append(h4,badges);

    const body = el('div','q-body');

    const hint = el('div'); hint.className='hint'; hint.textContent = q.hint;
    const explain = el('div','explain'); explain.textContent = q.exp;

    const radios = el('div','radios');
    ['Si','Parcial','No','N/A'].forEach(v=>{
      const pill = el('label','radio-pill');
      const r = document.createElement('input'); r.type='radio'; r.name=`r_${q.id}`; r.value=v;
      pill.append(r, document.createTextNode(v));
      radios.appendChild(pill);
    });

    body.append(hint, explain, radios);
    header.addEventListener('click',()=> item.classList.toggle('open'));
    body.addEventListener('change', updateLiveKPIs);

    item.append(header, body);
    wrap.appendChild(item);
  });
}

function safeBind(id, event, handler){
  const node = byId(id);
  if(node) node.addEventListener(event, handler);
}

function bindUI(){
  safeBind('filterDomain', 'change', ()=>{ renderPreguntas(); updateLiveKPIs(); });
  safeBind('onlyMust', 'change', ()=>{ renderPreguntas(); updateLiveKPIs(); });
  safeBind('btnExpand', 'click', ()=>{document.querySelectorAll('.q').forEach(q=>q.classList.add('open'));});
  safeBind('btnCollapse', 'click', ()=>{document.querySelectorAll('.q').forEach(q=>q.classList.remove('open'));});

  safeBind('btnCalcular', 'click', calcularDiagnostico);
  safeBind('btnExportJSON', 'click', exportarJSON);
  safeBind('btnPDF', 'click', ()=> window.print());
  safeBind('btnReset', 'click', ()=>{ localStorage.removeItem('diag_ml'); location.reload(); });

  safeBind('btnApplyThresholds', 'click', ()=>{
    const low = Math.max(0, Math.min(100, Number(byId('thLow').value||60)));
    const high = Math.max(0, Math.min(100, Number(byId('thHigh').value||85)));
    THRESHOLDS.low = low/100;
    THRESHOLDS.high = high/100;
    alert(`Umbrales aplicados: Débil < ${low}% · Sólido ≥ ${high}%`);
  });

  safeBind('btnCopyFindings', 'click', copiarHallazgos);
  safeBind('btnCopyPrompt', 'click', copiarPrompt);
}

function leerRespuestas(){
  return PREGUNTAS.map(q=>{
    const val = (document.querySelector(`input[name="r_${q.id}"]:checked`)||{}).value || null;
    return { id:q.id, dom:q.dom, resp:val, tag:q.tag };
  });
}

function calcularDominios(respuestas){
  const colec = { Gob:[], Datos:[], Modelo:[], Op:[], Val:[], Etica:[] };
  respuestas.forEach(r=>{
    const v = VALORES[r.resp ?? 'N/A'];
    if(v !== null && v !== undefined) colec[r.dom].push(v);
  });
  const scoreDom = {};
  Object.keys(colec).forEach(k=>{
    const arr = colec[k];
    scoreDom[k] = arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
  });
  return scoreDom;
}

/* ===== KPIs cruzados (derivados) ===== */
function kpiCross(res){
  const byTag = Object.fromEntries(res.map(r=>[r.tag, VALORES[r.resp ?? 'N/A']]));
  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;

  const prep = avg([byTag['rollback'], byTag['canary'], byTag['runbooks']]);           // preparación de despliegue
  const obs  = avg([byTag['latencia'], byTag['runbooks']]);                             // observabilidad operable
  const comp = avg([byTag['consentimiento'], byTag['pii']]);                            // cumplimiento
  const exp  = avg([byTag['metricas'], byTag['canary'], byTag['calibracion']]);        // experimentación
  const data = avg([byTag['contratos'], byTag['drift'], byTag['parity']]);              // salud de datos
  const sec  = avg([byTag['secretos'], byTag['amenazas']]);                             // seguridad ML

  return { prep, obs, comp, exp, data, sec };
}

/* ===== Etiquetas de impacto por regla ===== */
function impactoPorRegla(idRegla){
  const map = {
    R1: ['Operativo', 'Valor'],
    R2: ['Operativo'],
    R3: ['Operativo', 'Reputacional'],
    R4: ['Valor'],
    R5: ['Legal', 'Privacidad/Reputacional'],
    R6: ['Operativo'],
    R7: ['Legal', 'Reputacional']
  };
  return map[idRegla] || [];
}

/* ===== Reglas basadas en respuestas (dinámicas) ===== */
function aplicarReglas(res){
  const byTag = Object.fromEntries(res.map(r=>[r.tag, r.resp]));
  const activas = [];

  if(byTag['drift']==='No' && byTag['metricas']==='No'){
    activas.push({id:'R1', txt:'R1: Sin monitoreo de drift ni métricas recientes ⇒ Ceguera operacional.'});
  }
  if(byTag['parity']!=='Si' && byTag['latencia']!=='Si'){
    activas.push({id:'R2', txt:'R2: Paridad de features dudosa + latencia elevada ⇒ revisar pipeline de serving.'});
  }
  if(byTag['rollback']!=='Si' || byTag['canary']!=='Si'){
    activas.push({id:'R3', txt:'R3: Preparación de despliegue incompleta (rollback/canary).'});
  }
  if(byTag['baseline']!=='Si' || byTag['costo']!=='Si'){
    activas.push({id:'R4', txt:'R4: Valor de negocio/costo no medidos ⇒ priorizar instrumentación.'});
  }
  if(byTag['consentimiento']!=='Si'){
    activas.push({id:'R5', txt:'R5: Riesgo de compliance (consentimiento/uso de datos).'});
  }
  if(byTag['runbooks']!=='Si'){
    activas.push({id:'R6', txt:'R6: Alertas sin runbooks claros ⇒ operatividad limitada.'});
  }
  if(byTag['sesgo']!=='Si' || byTag['shap']!=='Si'){
    activas.push({id:'R7', txt:'R7: Opacidad (sesgo/explicabilidad insuficiente).'});
  }
  return activas;
}

/* ===== Hallazgos por cruce extendidos (dinámicos) ===== */
function hallazgosExtendidos(res, scoreDom, cross, thresholds){
  const out = [];
  const { low, high } = thresholds;

  const lowList = [];
  if(cross.prep < low) lowList.push('Preparación de despliegue');
  if(cross.obs  < low) lowList.push('Observabilidad');
  if(cross.comp < low) lowList.push('Compliance');
  if(cross.exp  < low) lowList.push('Experimentación');
  if(cross.data < low) lowList.push('Salud de datos');
  if(cross.sec  < low) lowList.push('Seguridad ML');
  if(lowList.length){
    out.push({txt:`Cruce débil en: ${lowList.join(', ')}.`, cls:'weak',
      note:`Valores < ${Math.round(low*100)}% señalan brechas prioritarias.`,
      tags:['Operativo','Valor','Legal'].filter(t => lowList.some(x => ({Compliance:'Legal'}[x] === 'Legal')) || t !== 'Legal')});
  }

  const highList = [];
  if(cross.prep >= high) highList.push('Preparación de despliegue');
  if(cross.obs  >= high) highList.push('Observabilidad');
  if(cross.comp >= high) highList.push('Compliance');
  if(cross.exp  >= high) highList.push('Experimentación');
  if(cross.data >= high) highList.push('Salud de datos');
  if(cross.sec  >= high) highList.push('Seguridad ML');
  if(highList.length){
    out.push({txt:`Cruce sólido en: ${highList.join(', ')}.`, cls:'strong',
      note:`≥ ${Math.round(high*100)}% indica prácticas consistentes.`,
      tags:['Madurez']});
  }

  Object.entries(scoreDom).forEach(([k,v])=>{
    if(v < 0.5){
      out.push({txt:`Dominio débil: ${DOMINIOS[k].label}.`, cls:'weak',
        note:'<50% sugiere riesgo estructural en este frente.',
        tags:['Operativo']});
    }
  });

  Object.entries(scoreDom).forEach(([k,v])=>{
    if(v >= high){
      out.push({txt:`Dominio destacado: ${DOMINIOS[k].label}.`, cls:'strong',
        note:`≥ ${Math.round(high*100)}% muestra madurez operativa.`,
        tags:['Madurez']});
    }
  });

  const {naTotal, naPorDom} = contarNA(res);
  if(naTotal > 0){
    const detalle = Object.entries(naPorDom)
      .filter(([_,c])=>c>0)
      .map(([k,c])=>`${DOMINIOS[k].label}: ${c}`)
      .join(' · ');
    const texto = `N/A: ${naTotal} de ${PREGUNTAS.length}. No suma ni resta, pero un uso elevado puede ocultar riesgos.`;
    const nota  = detalle ? `Distribución N/A — ${detalle}.` : 'Usar N/A solo cuando la pregunta realmente no aplica.';
    out.push({txt:texto, cls:'', note:nota, tags:['Gobernanza']});
  }

  return out;
}

function contarNA(res){
  const naPorDom = { Gob:0, Datos:0, Modelo:0, Op:0, Val:0, Etica:0 };
  let naTotal = 0;
  res.forEach(r=>{
    if(r.resp === 'N/A'){ naTotal += 1; naPorDom[r.dom] += 1; }
  });
  return { naTotal, naPorDom };
}

function dictamen(scoreGlobal){
  if(scoreGlobal>=85) return 'Optimizado';
  if(scoreGlobal>=70) return 'Estable';
  if(scoreGlobal>=40) return 'En Progreso';
  return 'En Riesgo';
}

function pintarBar(id, val){
  const bar = byId(id); if(!bar) return;
  bar.innerHTML = '';
  const f = document.createElement('div');
  f.style.position='absolute'; f.style.top=0; f.style.left=0; f.style.bottom=0;
  f.style.width=`${Math.round(val*100)}%`;
  f.style.background='linear-gradient(90deg, var(--bad), var(--warn), var(--good))';
  bar.appendChild(f);
}

function updateLiveKPIs(){
  const respuestas = leerRespuestas();
  const respondidas = respuestas.filter(r=>r.resp!==null).length;
  const avancePct = Math.round((respondidas / PREGUNTAS.length) * 100);

  const scoreDom = calcularDominios(respuestas);
  let scoreGlobal = Object.entries(DOMINIOS).reduce((acc,[k,v])=> acc + (scoreDom[k]||0)*v.peso, 0) * 100;
  const nivel = (respondidas>0) ? dictamen(Math.round(scoreGlobal)) : '—';

  const cross = kpiCross(respuestas);
  const { prep, obs, comp } = cross;

  byId('kpiAvance').textContent = `${avancePct}%`;
  byId('kpiAvanceSub').textContent = `${respondidas} / ${PREGUNTAS.length}`;
  byId('kpiPrep').textContent = `${Math.round(prep*100)}%`;
  byId('kpiObs').textContent  = `${Math.round(obs*100)}%`;
  byId('kpiComp').textContent = `${Math.round(comp*100)}%`;
  byId('kpiScoreLive').textContent = (respondidas>0) ? `${Math.round(scoreGlobal)}` : '—';
  byId('kpiNivelLive').textContent = nivel;

  pintarBar('barGob',   scoreDom.Gob||0);
  pintarBar('barDatos', scoreDom.Datos||0);
  pintarBar('barModelo',scoreDom.Modelo||0);
  pintarBar('barOp',    scoreDom.Op||0);
  pintarBar('barVal',   scoreDom.Val||0);
  pintarBar('barEtica', scoreDom.Etica||0);

  // Refrescar gráficos en vivo
  updateCharts(scoreDom, cross, respuestas);
}

function calcularDiagnostico(){
  const respuestas = leerRespuestas();

  const scoreDom = calcularDominios(respuestas);
  let scoreGlobal = Object.entries(DOMINIOS).reduce((acc,[k,v])=> acc + (scoreDom[k]||0)*v.peso, 0) * 100;

  const cross = kpiCross(respuestas);
  byId('kpiPrepFinal').textContent = `${Math.round(cross.prep*100)}%`;
  byId('kpiObsFinal').textContent  = `${Math.round(cross.obs*100)}%`;
  byId('kpiCompFinal').textContent = `${Math.round(cross.comp*100)}%`;
  byId('kpiExpFinal').textContent  = `${Math.round(cross.exp*100)}%`;
  byId('kpiDataFinal').textContent = `${Math.round(cross.data*100)}%`;
  byId('kpiSecFinal').textContent  = `${Math.round(cross.sec*100)}%`;

  const reglasActivas = aplicarReglas(respuestas);
  const extendidos = hallazgosExtendidos(respuestas, scoreDom, cross, THRESHOLDS);

  const acciones = [];
  if(reglasActivas.some(r=>r.id==='R1')) acciones.push('Instrumentar métricas recientes y monitoreo de drift con umbrales.');
  if(reglasActivas.some(r=>r.id==='R2')) acciones.push('Alinear transformaciones training/serving; revisar SLIs de latencia.');
  if(reglasActivas.some(r=>r.id==='R3')) acciones.push('Completar plan de rollback y canary antes de promover.');
  if(reglasActivas.some(r=>r.id==='R4')) acciones.push('Medir uplift y costo por predicción con objetivos claros.');
  if(reglasActivas.some(r=>r.id==='R5')) acciones.push('Asegurar consentimiento y políticas de uso de datos aplicadas.');
  if(reglasActivas.some(r=>r.id==='R6')) acciones.push('Crear/actualizar runbooks y responsables por alerta.');
  if(reglasActivas.some(r=>r.id==='R7')) acciones.push('Evaluar sesgo y registrar explicaciones por versión.');
  if(acciones.length===0) acciones.push('Mantener vigilancia: revisar calibración, resiliencia y backlog de mejoras.');

  const payload = {
    meta: { fecha: new Date().toISOString().slice(0,10) },
    respuestas, scoreDom, scoreGlobal: Math.round(scoreGlobal),
    reglas: reglasActivas.map(r=>r.txt), cruce: cross, thresholds: THRESHOLDS
  };
  localStorage.setItem('diag_ml', JSON.stringify(payload));

  byId('kpiScore').textContent = `${Math.round(scoreGlobal)} / 100`;
  byId('kpiNivel').textContent = dictamen(Math.round(scoreGlobal));

  pintarBar('kpiGob',   scoreDom.Gob||0);
  pintarBar('kpiDatos', scoreDom.Datos||0);
  pintarBar('kpiModelo',scoreDom.Modelo||0);
  pintarBar('kpiOp',    scoreDom.Op||0);
  pintarBar('kpiVal',   scoreDom.Val||0);
  pintarBar('kpiEtica', scoreDom.Etica||0);

  const resumen = buildExecutiveSummary(scoreDom, cross, THRESHOLDS);
  pintarLista('resumenEjecutivo', resumen.map(r => renderFindingItem(r.txt, r.cls, r.note, r.tags)), true);

  const reglasConTags = reglasActivas.map(r => ({
    txt: r.txt,
    cls: 'weak',
    note: '',
    tags: impactoPorRegla(r.id)
  }));
  const hallazgos = [...reglasConTags, ...extendidos];
  pintarLista('reglas', hallazgos.map(h => renderFindingItem(h.txt, h.cls, h.note, h.tags)), true);

  pintarLista('acciones', acciones.map(t => renderFindingItem(t,'','',[])), true);

  const prompt = buildGPTPrompt(payload, hallazgos, acciones, resumen);
  byId('promptGPT').value = prompt;

  // Refrescar gráficos con los datos finales
  updateCharts(scoreDom, cross, respuestas);

  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderFindingItem(txt, cls='', note='', tags=[]){
  const li = document.createElement('li');
  if(cls) li.classList.add(cls);
  li.textContent = txt;
  if(tags && tags.length){
    tags.forEach(t=>{
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = t;
      li.appendChild(span);
    });
  }
  if(note){
    const span = document.createElement('span');
    span.className = 'note';
    span.textContent = note;
    li.appendChild(span);
  }
  return li;
}

function pintarLista(id, nodes, clear=false){
  const ul = byId(id);
  if(clear) ul.innerHTML='';
  nodes.forEach(n=> ul.appendChild(n));
}

function buildExecutiveSummary(scoreDom, cross, thresholds){
  const domArray = Object.entries(scoreDom).map(([k,v])=>({k, label:DOMINIOS[k].label, v}));
  domArray.sort((a,b)=>b.v-a.v);
  const topDom = domArray.slice(0,3).filter(d=>d.v>=thresholds.high)
    .map(d=>({txt:`Fortaleza de dominio: ${d.label} (${Math.round(d.v*100)}%)`, cls:'strong', note:'', tags:['Madurez']}));
  const weakDom = domArray.reverse().slice(0,3).filter(d=>d.v<thresholds.low)
    .map(d=>({txt:`Riesgo de dominio: ${d.label} (${Math.round(d.v*100)}%)`, cls:'weak', note:'', tags:['Operativo']}));

  const crossMap = [
    {k:'prep', label:'Preparación de despliegue', v:cross.prep},
    {k:'obs',  label:'Observabilidad',            v:cross.obs},
    {k:'comp', label:'Compliance',                v:cross.comp},
    {k:'exp',  label:'Experimentación',           v:cross.exp},
    {k:'data', label:'Salud de datos',            v:cross.data},
    {k:'sec',  label:'Seguridad ML',              v:cross.sec},
  ];
  const topCross = [...crossMap].sort((a,b)=>b.v-a.v).slice(0,3).filter(x=>x.v>=thresholds.high)
    .map(x=>({txt:`Cruce sólido: ${x.label} (${Math.round(x.v*100)}%)`, cls:'strong', note:'', tags:['Madurez']}));
  const weakCross = [...crossMap].sort((a,b)=>a.v-b.v).slice(0,3).filter(x=>x.v<thresholds.low)
    .map(x=>({txt:`Cruce débil: ${x.label} (${Math.round(x.v*100)}%)`, cls:'weak', note:'', tags: x.label==='Compliance' ? ['Legal'] : ['Operativo']}));

  const fortalezas = [...topDom, ...topCross].slice(0,3);
  const riesgos    = [...weakDom, ...weakCross].slice(0,3);

  return [...fortalezas, ...riesgos];
}

function buildGPTPrompt(payload, hallazgos, acciones, resumen){
  const obj = {
    tarea: "Generar un reporte ejecutivo (200-300 palabras) del estado de un sistema ML.",
    definiciones: {
      valores: {Si:1, Parcial:0.5, No:0, "N/A": null},
      dominios: Object.fromEntries(Object.entries(DOMINIOS).map(([k,v])=>[k,v.label])),
      kpis_cruzados: {
        prep: "rollback + canary + runbooks",
        obs:  "latencia + runbooks",
        comp: "consentimiento + pii",
        exp:  "metricas + canary + calibracion",
        data: "contratos + drift + parity",
        sec:  "secretos + amenazas"
      }
    },
    umbrales: {
      debil_menor_que: Math.round(payload.thresholds.low*100),
      solido_desde: Math.round(payload.thresholds.high*100)
    },
    resultados: {
      fecha: payload.meta.fecha,
      score_global: payload.scoreGlobal,
      score_dominios: Object.fromEntries(Object.entries(payload.scoreDom).map(([k,v])=>[DOMINIOS[k].label, Math.round(v*100)])),
      kpis_cruzados: Object.fromEntries(Object.entries(payload.cruce).map(([k,v])=>[k, Math.round(v*100)])),
      reglas: payload.reglas,
      resumen: resumen.map(x=>x.txt),
      hallazgos: hallazgos.map(x=>x.txt),
      acciones: acciones
    },
    pide: "Devuelve: 1) diagnóstico global y nivel, 2) 3 fortalezas y 3 riesgos con etiquetas de impacto si se infiere, 3) 5 acciones priorizadas, 4) nota sobre N/A si aplica, 5) una frase de riesgo residual."
  };

  return JSON.stringify(obj);
}

/* ===== Charts ===== */
function createCharts(){
  if(!window.Chart) return;

  const domLabels = Object.values(DOMINIOS).map(d=>d.label);

  // Radar dominios
  const ctxRadar = byId('chartRadarDom')?.getContext('2d');
  if(ctxRadar){
    charts.radar = new Chart(ctxRadar, {
      type: 'radar',
      data: {
        labels: domLabels,
        datasets: [{ label:'% por dominio', data:[0,0,0,0,0,0] }]
      },
      options: {
        responsive:true,
        scales:{ r:{ beginAtZero:true, max:100, ticks:{ stepSize:20 } } },
        plugins:{ legend:{ display:false } }
      }
    });
  }

  // Barras KPIs cruzados
  const ctxBars = byId('chartBarsCross')?.getContext('2d');
  if(ctxBars){
    charts.bars = new Chart(ctxBars, {
      type: 'bar',
      data: {
        labels: ['Prep','Obs','Comp','Exp','Data','Sec'],
        datasets: [{ label:'% KPI', data:[0,0,0,0,0,0] }]
      },
      options: {
        responsive:true,
        scales:{ y:{ beginAtZero:true, max:100 } },
        plugins:{ legend:{ display:false } }
      }
    });
  }

  // Dona distribución de respuestas
  const ctxDough = byId('chartDoughnutRes')?.getContext('2d');
  if(ctxDough){
    charts.doughnut = new Chart(ctxDough, {
      type: 'doughnut',
      data: {
        labels: ['Sí','Parcial','No','N/A'],
        datasets: [{ label:'Respuestas', data:[0,0,0,0] }]
      },
      options: { responsive:true, plugins:{ legend:{ position:'bottom' } } }
    });
  }
}

function updateCharts(scoreDom, cross, respuestas){
  if(!window.Chart) return;

  // Radar dominios
  if(charts.radar){
    const domVals = ['Gob','Datos','Modelo','Op','Val','Etica'].map(k => Math.round((scoreDom[k]||0)*100));
    charts.radar.data.datasets[0].data = domVals;
    charts.radar.update();
  }

  // Barras KPIs cruzados
  if(charts.bars){
    const vals = [cross.prep, cross.obs, cross.comp, cross.exp, cross.data, cross.sec].map(v=>Math.round((v||0)*100));
    charts.bars.data.datasets[0].data = vals;
    charts.bars.update();
  }

  // Dona distribución
  if(charts.doughnut){
    const counts = { 'Si':0, 'Parcial':0, 'No':0, 'N/A':0 };
    respuestas.forEach(r => { if(r.resp) counts[r.resp] += 1; });
    charts.doughnut.data.datasets[0].data = [counts['Si'], counts['Parcial'], counts['No'], counts['N/A']];
    charts.doughnut.update();
  }
}

/* ===== Copiar al portapapeles ===== */
function copiarHallazgos(){
  const reglasUL = byId('reglas');
  const accionesUL = byId('acciones');
  const txt = (reglasUL ? Array.from(reglasUL.children).map(li=>li.innerText).join('\n') : '')
    + '\n\nAcciones:\n'
    + (accionesUL ? Array.from(accionesUL.children).map(li=>li.innerText).join('\n') : '');
  copiarTexto(txt, 'Hallazgos copiados al portapapeles.');
}

function copiarPrompt(){
  const area = byId('promptGPT');
  const txt = area ? (area.value || '') : '';
  if(!txt){ alert('Primero calcula el diagnóstico para generar el prompt.'); return; }
  copiarTexto(txt, 'Prompt GPT copiado al portapapeles.');
}

function copiarTexto(texto, mensajeOk){
  try{
    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(texto).then(()=> alert(mensajeOk)).catch(()=> fallbackCopy(texto, mensajeOk));
    } else {
      fallbackCopy(texto, mensajeOk);
    }
  } catch (_){
    fallbackCopy(texto, mensajeOk);
  }
}

function fallbackCopy(texto, mensajeOk){
  const ta = document.createElement('textarea');
  ta.value = texto;
  ta.setAttribute('readonly','');
  ta.style.position = 'fixed';
  ta.style.top = '-1000px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try{
    const ok = document.execCommand('copy');
    if(ok) alert(mensajeOk); else alert('No se pudo copiar. Selecciona y copia manualmente.');
  } finally {
    document.body.removeChild(ta);
  }
}

/* ===== Utilidades varias ===== */
function exportarJSON(){
  const data = localStorage.getItem('diag_ml');
  if(!data){ alert('Primero calcula el diagnóstico.'); return; }
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `diagnostico_ml_${Date.now()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
