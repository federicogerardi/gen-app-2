---
goal: Guida utente per il nuovo sistema cluster Meta Ads
version: 1.0
date_created: 2026-06-28
last_updated: 2026-06-28
last-reviewed: 2026-06-28
next-review-date: 2026-07-28
owner: Product Team
status: draft
tags: [documentation, meta-ads, cluster-system, user-guide]
---

# Guida Utente - Sistema Cluster Meta Ads

## 1. Introduzione

### 1.1 Cos'è il Sistema Cluster
Il nuovo sistema cluster per Meta Ads organizza i copy pubblicitari in una struttura gerarchica:
- **Cluster**: Macro-categorie di target (es. "Persona Funzionale Insoddisfatta")
- **Angolo**: Strategie di comunicazione specifiche per ogni cluster
- **Awareness**: Livelli di consapevolezza del problema (Problem Aware, Solution Aware, Product Aware)

### 1.2 Vantaggi del Nuovo Sistema
- **Maggiore precisione**: Copy mirati per segmenti specifici di pubblico
- **Organizzazione chiara**: Struttura gerarchica facile da navigare
- **Flessibilità**: 3 formati di lunghezza per ogni esigenza
- **Efficienza**: Export selettivo per cluster, angolo o awareness level

## 2. Come Utilizzare il Sistema

### 2.1 Accesso al Tool
1. Accedi alla piattaforma
2. Naviga nella sezione "Tools"
3. Seleziona "Meta Ads Generator"

### 2.2 Configurazione della Generazione
1. **Carica il briefing**: File .docx, .txt o .md con le informazioni sul prodotto/servizio
2. **Seleziona il formato copy**:
   - **Short Form** (400-600 caratteri): Per test rapidi e budget limitati
   - **Medium Form** (800-1000 caratteri): Equilibrio tra narrativa e concisione
   - **Long Form** (1200+ caratteri): Storytelling completo per massima persuasione
3. **Avvia la generazione**: Clicca su "Avvia la generazione"

### 2.3 Navigazione dell'Output
Dopo la generazione, l'output è organizzato in:

#### Selezione Cluster
- Visualizza tutti i cluster identificati
- Clicca su un cluster per vederne gli angoli

#### Selezione Angolo
- Visualizza tutti gli angoli per il cluster selezionato
- Clicca su un angolo per vederne le versioni per awareness

#### Selezione Awareness Level
- **Problem Aware**: PAS completo (Problem-Agitate-Solve)
- **Solution Aware**: Focus sulla differenziazione competitiva
- **Product Aware**: Offerta diretta + prova sociale

### 2.4 Visualizzazione del Copy
Per ogni selezione, vengono mostrati:
- **Primary Text**: Il copy principale
- **Headline**: Titolo (~40 caratteri)
- **Description**: Descrizione (~30 caratteri)

### 2.5 Export del Copy
Puoi esportare il copy in diversi modi:
- **Esporta Cluster**: Tutti gli angoli e awareness levels del cluster
- **Esporta Angolo**: Tutte le awareness levels dell'angolo selezionato
- **Esporta Awareness**: Solo il copy dell'awareness level selezionato

Formati supportati:
- **Markdown** (.md): Per documentazione e editing
- **Text** (.txt): Per uso diretto
- **JSON** (.json): Per integrazioni tecniche

## 3. Formati di Copy

### 3.1 Short Form (400-600 caratteri)
**Ideale per**:
- A/B test iniziali
- Campagne discovery
- Budget ridotti

**Caratteristiche**:
- Hook entro i primi 80 caratteri
- 1 pain point principale + 1 benefit chiave
- CTA diretto senza troppo buildup
- Struttura: Hook → Problem → Solution → CTA

### 3.2 Medium Form (800-1000 caratteri)
**Ideale per**:
- Campagne standard
- Retargeting
- Funnel intermedi

**Caratteristiche**:
- Hook entro i primi 100 caratteri
- 2 pain points + 2 benefits con evidenza sociale
- Storytelling contenuto ma persuasivo
- Struttura: Hook → Problem → Agitate → Solution → Proof → CTA

### 3.3 Long Form (1200+ caratteri)
**Ideale per**:
- Cold audience
- Prodotti complessi
- High-ticket items

**Caratteristiche**:
- Hook entro i primi 125 caratteri per preview mobile
- PAS completo con agitate forte e storytelling immersivo
- Evidenza sociale + autorità + urgenza + meccanismo unico
- Spazio bianco strategico ogni 3-4 righe per leggibilità mobile

## 4. Awareness Levels

### 4.1 Problem Aware
**Quando usarlo**: Il pubblico sa di avere un problema ma non conosce la soluzione

**Approccio**:
- Identifica e descrivi il problema in dettaglio
- Agita il problema mostrando le conseguenze
- Presenta la soluzione in modo chiaro

### 4.2 Solution Aware
**Quando usarlo**: Il pubblico conosce le soluzioni esistenti ma non il tuo prodotto

**Approccio**:
- Concentrati sulla differenziazione competitiva
- Mostra perché la tua soluzione è migliore
- Usa prove sociali e casi studio

### 4.3 Product Aware
**Quando usarlo**: Il pubblico conosce il tuo prodotto ma non ha ancora acquistato

**Approccio**:
- Offerta diretta con benefici chiari
- Prova sociale massiccia
- CTA forte e urgente

## 5. Best Practices

### 5.1 Scelta del Formato
- **Test iniziali**: Usa Short Form per velocità e budget
- **Campagne principali**: Medium Form per equilibrio
- **Cold audience**: Long Form per massima persuasione

### 5.2 Scelta dell'Awareness Level
- **Nuovi prodotti**: Parti da Problem Aware
- **Mercati competitivi**: Usa Solution Aware
- **Retargeting**: Product Aware per conversione

### 5.3 Utilizzo dei Cluster
- **Segmentazione**: Usa cluster diversi per pubblici diversi
- **A/B Testing**: Testa angoli diversi per lo stesso cluster
- **Personalizzazione**: Adatta il tono al cluster specifico

## 6. Troubleshooting

### 6.1 Problemi Comuni

#### Il generatore non produce cluster
**Possibili cause**:
- Briefing troppo breve o non dettagliato
- Informazioni mancanti sul target

**Soluzioni**:
- Aggiungi più dettagli al briefing
- Specifica chiaramente il target audience
- Includi pain points e benefici specifici

#### I copy sono troppo corti/lunghi
**Possibili cause**:
- Formato selezionato non appropriato
- Briefing non coerente con il formato

**Soluzioni**:
- Prova un formato diverso
- Aggiungi più dettagli al briefing
- Rivedi le specifiche di lunghezza

#### La navigazione è confusa
**Possibili cause**:
- Troppi cluster/angoli generati
- Struttura non chiara

**Soluzioni**:
- Usa la funzione di export per salvare i risultati
- Concentrati su un cluster/angolo alla volta
- Fornisci feedback per migliorare la struttura

### 6.2 Errori Tecnici

#### Errore durante la generazione
**Possibili cause**:
- Problemi di connessione
- File di formato non supportato

**Soluzioni**:
- Controlla la connessione internet
- Verifica il formato del file (.docx, .txt, .md)
- Riprova dopo qualche minuto

#### Export non funziona
**Possibili cause**:
- Browser non supportato
- Estensioni del browser che bloccano il download

**Soluzioni**:
- Prova un browser diverso
- Disabilita le estensioni temporaneamente
- Usa la funzione "Copia" invece dell'export

## 7. FAQ

### D: Posso utilizzare il sistema cluster senza feature flag?
R: No, il sistema cluster è attualmente disponibile solo con la feature flag `VITE_FF_USE_CLUSTER_SYSTEM` abilitata. Contatta l'amministratore per abilitarla.

### D: Posso tornare al sistema legacy?
R: Sì, quando la feature flag è disabilitata, il sistema mostra il formato legacy con le 4 varianti di lunghezza.

### D: I formati di copy sono intercambiabili?
R: Sì, puoi generare lo stesso briefing in tutti e 3 i formati e confrontare i risultati.

### D: Posso esportare solo parte dell'output?
R: Sì, puoi esportare un singolo cluster, un singolo angolo, o un singolo awareness level.

### D: Il sistema funziona per tutti i settori?
R: Sì, il sistema è progettato per essere flessibile e adattarsi a diversi settori e tipologie di prodotto.

## 8. Glossario

- **Cluster**: Macro-categoria di target basata su caratteristiche demografiche/psicografiche
- **Angolo**: Strategia di comunicazione specifica per un cluster
- **Awareness Level**: Livello di consapevolezza del problema da parte del pubblico
- **PAS**: Problem-Agitate-Solve, framework di copywriting
- **Hook**: Frase iniziale cattura l'attenzione
- **CTA**: Call-to-Action, invito all'azione
- **Primary Text**: Il copy principale dell'annuncio
- **Headline**: Titolo breve dell'annuncio
- **Description**: Descrizione breve dell'annuncio

## 9. Supporto

Per domande o problemi:
- **Email**: support@example.com
- **Chat**: Disponibile durante l'orario lavorativo
- **Documentazione**: Consulta questa guida e la documentazione tecnica
- **Feedback**: Usa il sistema di feedback per segnalare problemi o suggerire miglioramenti
