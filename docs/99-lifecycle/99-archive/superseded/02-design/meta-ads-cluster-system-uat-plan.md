---
goal: Piano di User Acceptance Testing per il nuovo sistema cluster Meta Ads
version: 1.1
date_created: 2026-06-28
last_updated: 2026-07-11
last-reviewed: 2026-07-11
next-review-date: 2027-01-11
owner: Product Team
status: archived
tags: [uat, meta-ads, cluster-system, user-testing, archived]
archived_reason: Superseded by completed rollout. User acceptance testing was executed as part of the feature-meta-ads-cluster-system-evolution-1.md implementation (TASK-019 ✅ Completed, Sprint 8), rendering this standalone UAT plan document obsolete.
---

# User Acceptance Testing - Meta Ads Cluster System

## 1. Obiettivo

Validare il nuovo sistema cluster → angolo → awareness per Meta Ads tramite testing con utenti reali prima del rollout completo.

## 2. Target Utenti

### 2.1 Beta User Group
- **Dimensione**: 10-15 utenti
- **Profili**:
  - Marketing manager (3-5 utenti)
  - Copywriter freelance (3-5 utenti)
  - Agency owner (2-3 utenti)
  - In-house marketing team (2-3 utenti)

### 2.2 Criteri Selezione
- Utilizzo attivo del tool Meta Ads negli ultimi 30 giorni
- Esperienza con campagne Facebook/Instagram Ads
- Disponibilità a fornire feedback dettagliati
- Varietà di settori/industrie rappresentati

## 3. Scenari di Test

### 3.1 Scenario 1: Primo Utilizzo
**Obiettivo**: Verificare che l'utente comprenda il nuovo sistema senza training

**Steps**:
1. Aprire il tool Meta Ads
2. Caricare un briefing di esempio
3. Selezionare formato copy (Short/Medium/Long)
4. Avviare la generazione
5. Navigare nell'output generato

**Metriche**:
- Tempo per completare il workflow (target: <5 minuti)
- Tasso di completamento senza errori (target: >90%)
- Numero di richieste di aiuto (target: <2 per utente)

### 3.2 Scenario 2: Navigazione Output
**Obiettivo**: Verificare che l'utente trovi facilmente il copy desiderato

**Steps**:
1. Generare output con 2-3 cluster
2. Navigare tra cluster → angolo → awareness
3. Sezionare un copy specifico
4. Esportare il copy selezionato

**Metriche**:
- Tempo per trovare il copy desiderato (target: <2 minuti)
- Tasso di successo nell'esportazione (target: 100%)
- Soddisfazione per la navigazione (target: ≥4/5)

### 3.3 Scenario 3: Confronto Formati
**Obiettivo**: Verificare che l'utente comprenda le differenze tra formati

**Steps**:
1. Generare lo stesso briefing in tutti e 3 i formati
2. Confrontare i risultati
3. Selezionare il formato più appropriato per il proprio caso d'uso

**Metriche**:
- Capacità di identificare il formato corretto (target: >80%)
- Comprensione delle differenze (target: >90%)
- Soddisfazione per la varietà di formati (target: ≥4/5)

### 3.4 Scenario 4: Export e Utilizzo
**Obiettivo**: Verificare che l'output sia utilizzabile in contesto reale

**Steps**:
1. Esportare un copy in formato preferito
2. Utilizzarlo in una campagna reale (se possibile)
3. Monitorare le performance

**Metriche**:
- Tasso di utilizzo dell'output (target: >70%)
- Soddisfazione per la qualità del copy (target: ≥4/5)
- Intenzione di riutilizzo (target: >80%)

## 4. Metriche di Successo

### 4.1 KPI Primari
- **Task Completion Rate**: >90%
- **User Satisfaction Score**: ≥4.5/5
- **Time on Task**: <5 minuti per workflow completo
- **Error Rate**: <5%

### 4.2 KPI Secondari
- **Feature Adoption**: >80% degli utenti prova il nuovo sistema
- **Preference Rate**: >70% preferisce il nuovo sistema al legacy
- **Support Requests**: <2 per utente durante il testing
- **NPS (Net Promoter Score)**: >30

## 5. Processo di Raccolta Feedback

### 5.1 Metodi
- **Survey post-session**: Questionario strutturato (5-10 domande)
- **Think-aloud protocol**: Utente commenta ad alta voce durante il test
- **Session recording**: Registrazione video dello schermo (con consenso)
- **Follow-up interview**: Intervista di 15-20 minuti post-testing

### 5.2 Domande Chiave
1. Quanto è stato facile navigare nell'output generato?
2. I formati di copy (Short/Medium/Long) sono chiari?
3. L'output è utilizzabile per le tue campagne?
4. Cosa cambieresti nel sistema?
5. Consiglieresti questo tool a un collega?

### 5.3 Analisi Risultati
- **Quantitativa**: Statistiche descrittive, tassi di completamento, tempi
- **Qualitativa**: Thematic analysis dei feedback verbali e scritti
- **Comparativa**: Confronto con il sistema legacy

## 6. Timeline

### 6.1 Settimana 1: Preparazione
- [ ] Selezionare beta user group
- [ ] Preparare materiali di test (briefing di esempio, guide)
- [ ] Configurare ambiente di test
- [ ] Formare i facilitatori

### 6.2 Settimana 2-3: Esecuzione
- [ ] Sessioni di testing individuali (60-90 minuti ciascuna)
- [ ] Raccolta feedback in tempo reale
- [ ] Note di osservazione

### 6.3 Settimana 4: Analisi
- [ ] Analisi dati quantitativi
- [ ] Analisi feedback qualitativi
- [ ] Report finale con raccomandazioni

## 7. Criteri di Go/No-Go

### 7.1 Go (Rollout Completo)
- Task Completion Rate >90%
- User Satisfaction ≥4.5/5
- Nessun blocco critico identificato
- >70% degli utenti preferisce il nuovo sistema

### 7.2 No-Go (Ritardo/Rollback)
- Task Completion Rate <80%
- User Satisfaction <4/5
- Blocchi critici che impediscono l'utilizzo
- <50% degli utenti preferisce il nuovo sistema

### 7.3 Conditional Go (Rollout Parziale)
- Metriche intermedie (80-90% completion, 4-4.5 satisfaction)
- Blocchi minori risolvibili rapidamente
- Feedback misto ma tendente positivo

## 8. Rischi e Mitigazioni

### 8.1 Rischi Identificati
- **Rischio**: Utenti confusi dal nuovo sistema
  - **Mitigazione**: Guida introduttiva, onboarding semplificato

- **Rischio**: Performance degradate durante il testing
  - **Mitigazione**: Monitoraggio continuo, ambiente di test isolato

- **Rischio**: Feedback insufficiente
  - **Mitigazione**: Incentivi, follow-up proattivo

### 8.2 Piano di Contingenza
- Se <70% task completion: interrompere testing e riesaminare UX
- Se <4 satisfaction: raccogliere feedback dettagliati e iterare
- Se blocchi critici: fix immediati e re-test

## 9. Deliverables

### 9.1 Documenti
- [ ] Piano di testing approvato
- [ ] Materiali di test (briefing, guide, survey)
- [ ] Report finale con risultati e raccomandazioni
- [ ] Piano di azione per miglioramenti

### 9.2 Dati
- [ ] Dataset completo dei feedback
- [ ] Analisi statistica delle metriche
- [ ] Registrazioni delle sessioni (se autorizzate)
- [ ] Trascrizioni delle interviste

## 10. Prossimi Passi

Dopo il completamento dello UAT:
1. Analizzare i risultati e identificare aree di miglioramento
2. Implementare le modifiche prioritarie
3. Pianificare il rollout graduale
4. Preparare la documentazione utente finale
5. Formare il team di supporto
