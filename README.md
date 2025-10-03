# ML Ágil — Diagnóstico de Buenas Prácticas de ML

**ML Ágil** es una webapp ligera (HTML + CSS + JavaScript) para diagnosticar la madurez operativa de sistemas de Machine Learning. Reúne un cuestionario auditable, explica cada pregunta en lenguaje no técnico y calcula un **score global**, madurez por **dominio** y **KPIs cruzados** que facilitan decisiones rápidas y defendibles.

> Demo: https://analiticaverde.com/averde/proyects_/ml_agil/

---

## ¿Qué problema resuelve?
Los equipos suelen discutir “sensaciones” sobre estado del sistema ML. ML Ágil aterriza esas conversaciones en datos comparables: respuestas normalizadas, KPIs derivados y hallazgos con etiquetas de impacto (operativo, legal, reputacional y valor).

---

## Características
- **Cuestionario auditable** con 24 preguntas y explicación para no técnicos.  
- **Valores**: `Sí=1`, `Parcial=0.5`, `No=0`, `N/A=null` (no puntúa).  
- **Score global** ponderado por dominios: Gobernanza, Datos, Modelo, Operación, Valor/FinOps, Ética & Seguridad.  
- **KPIs cruzados** (derivados por cruce):  
  - `prep` = rollback + canary + runbooks  
  - `obs` = latencia + runbooks  
  - `comp` = consentimiento + PII  
  - `exp` = métricas + canary + calibración  
  - `data` = contratos + drift + parity  
  - `sec` = secretos + amenazas  
- **Hallazgos dinámicos** según respuestas (incluye nota de uso de N/A).  
- **Umbrales configurables** (p. ej. débil `<60%`, sólido `≥85%`).  
- **Visualizaciones** con Chart.js (radar por dominio, barras de KPIs, distribución de respuestas).  
- **Acciones sugeridas** y botones para **copiar hallazgos** y **copiar prompt**.  
- **Prompt compacto para ChatGPT** que genera un **reporte ejecutivo** claro y sustentado por los KPIs.  
- **UI de una sola columna**, accesible y fácil de imprimir.

---

## Cómo funciona (en breve)
- Cada respuesta se transforma a un valor y se promedia por **dominio**.  
- El **score global** = suma ponderada de dominios. Pesos de referencia:
  - Gobernanza `0.20`, Datos `0.20`, Modelo `0.25`, Operación `0.20`, Valor/FinOps `0.10`, Ética & Seguridad `0.05`.  
- Los **KPIs cruzados** se calculan como promedio simple de sus componentes (ver fórmulas arriba).  
- Las **reglas de hallazgo** activan mensajes de riesgo/fortaleza y etiquetas de impacto.

---

