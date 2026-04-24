import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

// ══════════════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════════════
const TEACHER_PIN = "PROF2024";

// ══════════════════════════════════════════════════════════════
// DONNÉES DU JEU
// ══════════════════════════════════════════════════════════════
const SESSIONS = {
  1: {
    name: "Session 1 — Fondamentaux",
    accent: "#00d4aa",
    rounds: [
      {
        id: 1, title: "L'exportateur face au dollar", company: "Bretagne Tech SAS",
        context: "Vous venez de décrocher un contrat d'exportation aux États-Unis. En tant que trésorier, vous devez gérer l'exposition au risque de change.",
        exposition: "Créance commerciale : +500 000 USD\nÉchéance : 90 jours",
        marketData: [["Cours spot","EUR/USD = 1,0850"],["Forward 90 jours","EUR/USD = 1,0920"],["Taux d'intérêt €","3,5 % /an"],["Taux d'intérêt $","5,2 % /an"],["Option put USD","Strike 1,0900 — Prime 2 %"]],
        choices: [
          { id:"A", icon:"⚡", label:"Aucune couverture", desc:"Vente des USD au cours spot dans 90 jours" },
          { id:"B", icon:"🔒", label:"Vente à terme (forward)", desc:"Vente de 500 000 USD à 90j au cours 1,0920" },
          { id:"C", icon:"🛡️", label:"Option put USD", desc:"Achat d'un put USD, strike 1,0900, prime 2 %" },
        ],
        computeScore: (choice) => {
          const N=500000, realized=1.1050, prime=(N*0.02)/1.0920;
          const p={A:N/realized, B:N/1.0920, C:N/Math.max(realized,1.0900)-prime};
          const max=Math.max(...Object.values(p));
          return Math.round((p[choice]/max)*100);
        },
        reveal:"EUR/USD réalisé : 1,1050 — Le dollar s'est déprécié",
        explanation:"Le forward à 1,0920 garantissait 457 875 € — meilleur résultat. La prime de l'option (9 177 €) réduisait le gain net. Sans couverture : 452 489 €. Le forward était optimal car il capturait le différentiel de taux favorable.",
        optimal:"B",
      },
      {
        id: 2, title: "L'importateur et la livre sterling", company: "Ouest Auto SAS",
        context: "Vous importez des pièces détachées du Royaume-Uni. Il faut payer votre fournisseur dans 60 jours.",
        exposition: "Dette commerciale : −300 000 GBP\nÉchéance : 60 jours",
        marketData: [["Cours spot","EUR/GBP = 0,8650"],["Forward 60 jours","EUR/GBP = 0,8620"],["Taux d'intérêt €","3,5 % /an"],["Taux d'intérêt £","5,0 % /an"],["Option call GBP","Strike 0,8640 — Prime 1,5 %"]],
        choices: [
          { id:"A", icon:"⚡", label:"Aucune couverture", desc:"Achat GBP au cours spot dans 60 jours" },
          { id:"B", icon:"🔒", label:"Achat à terme (forward)", desc:"Achat de 300 000 GBP à 60j au cours 0,8620" },
          { id:"C", icon:"🛡️", label:"Option call GBP", desc:"Achat d'un call GBP, strike 0,8640, prime 1,5 %" },
          { id:"D", icon:"🏦", label:"Marché monétaire", desc:"Emprunt EUR + placement GBP aujourd'hui" },
        ],
        computeScore: (choice) => {
          const N=300000, realized=0.8580, prime=(N/0.8640)*0.015;
          const c={A:N/realized, B:N/0.8620, C:N/Math.min(realized,0.8640)+prime, D:N/0.8620*1.007};
          const min=Math.min(...Object.values(c));
          return Math.round((min/c[choice])*100);
        },
        reveal:"EUR/GBP réalisé : 0,8580 — La livre s'est dépréciée",
        explanation:"GBP déprécié à 0,8580 → achat GBP moins cher au spot. Sans couverture était optimal pour cet importateur. Le marché monétaire donnait un résultat quasi équivalent au forward.",
        optimal:"A",
      },
      {
        id: 3, title: "Le différentiel de taux et le yen", company: "Loire Industries SAS",
        context: "Contrat majeur décroché au Japon. Le différentiel de taux EUR/JPY est exceptionnel.",
        exposition: "Créance commerciale : +80 000 000 JPY\nÉchéance : 6 mois",
        marketData: [["Cours spot","EUR/JPY = 162,40"],["Forward 6 mois","EUR/JPY = 160,20"],["Taux d'intérêt €","3,5 % /an"],["Taux d'intérêt JPY","0,1 % /an"],["Option put JPY","Strike 161,00 — Prime 2,5 %"]],
        choices: [
          { id:"A", icon:"⚡", label:"Aucune couverture", desc:"Vente JPY au cours spot dans 6 mois" },
          { id:"B", icon:"🔒", label:"Vente à terme (forward)", desc:"Vente à 160,20 dans 6 mois" },
          { id:"C", icon:"🛡️", label:"Option put JPY", desc:"Strike 161,00, prime 2,5 %" },
        ],
        computeScore: (choice) => {
          const N=80000000, realized=168.50, prime=(N/162.40)*0.025;
          const p={A:N/realized, B:N/160.20, C:N/Math.min(realized,161.00)-prime};
          const max=Math.max(...Object.values(p));
          return Math.round((p[choice]/max)*100);
        },
        reveal:"EUR/JPY réalisé : 168,50 — Le yen s'est déprécié",
        explanation:"Le forward à 160,20 donnait 499 376 € vs 474 777 € sans couverture. Le forward capturait le différentiel de taux (3,5% EUR vs 0,1% JPY) — c'est la PIT en action.",
        optimal:"B",
      },
      {
        id: 4, title: "L'annonce surprise de la BCE", company: "Armor Capital SAS",
        context: "⚡ FLASH : La BCE relève ses taux de +50 bp de façon inattendue. L'EUR s'apprécie brutalement de +185 pips.",
        exposition: "Position ouverte : +1 000 000 USD\nÉchéance : 90 jours (non couverte à ce jour)",
        marketData: [["Spot avant annonce","EUR/USD = 1,0850"],["Spot après annonce","EUR/USD = 1,1050 ⚡"],["Forward 90j (nouveau)","EUR/USD = 1,1120"],["Volatilité implicite","+35 % (hausse brutale)"],["Option put USD","Strike 1,1100 — Prime 3,5 %"]],
        choices: [
          { id:"A", icon:"💨", label:"Vente spot immédiate", desc:"Cristalliser les USD au nouveau spot 1,1050" },
          { id:"B", icon:"🔒", label:"Forward au nouveau cours", desc:"Vente à terme à 1,1120" },
          { id:"C", icon:"🛡️", label:"Option put (cher)", desc:"Strike 1,1100, prime 3,5 % (vol élevée)" },
          { id:"D", icon:"⏳", label:"Attendre un rebond", desc:"Parier sur un retournement du dollar" },
        ],
        computeScore: (choice) => {
          const N=1000000, realized=1.0950, prime=(N*0.035)/1.1050;
          const p={A:N/1.1050, B:N/1.1120, C:N/Math.min(realized,1.1100)-prime, D:N/realized};
          const max=Math.max(...Object.values(p));
          return Math.round((p[choice]/max)*100);
        },
        reveal:"EUR/USD réalisé : 1,0950 — Rebond partiel du dollar",
        explanation:"Le dollar a rebondi à 1,0950 → attendre (D) était optimal : 913 242 €. Le forward à 1,1120 était le pire choix. La volatilité élevée rend les options très chères en période de choc.",
        optimal:"D",
      },
      {
        id: 5, title: "Le portefeuille multi-devises", company: "Finistère Group SA",
        context: "La trésorerie gère simultanément trois expositions. Quelle stratégie de couverture globale adopter ?",
        exposition: "• Créance +200 000 USD dans 3 mois\n• Dette −150 000 GBP dans 3 mois\n• Créance +30 000 000 JPY dans 3 mois",
        marketData: [["Spot EUR/USD","1,0850"],["Spot EUR/GBP","0,8650"],["Spot EUR/JPY","162,40"],["Forwards 3 mois","USD 1,0900 | GBP 0,8620 | JPY 161,50"]],
        choices: [
          { id:"A", icon:"🔒", label:"Tout couvrir en forward", desc:"Forward sur les 3 expositions" },
          { id:"B", icon:"⚖️", label:"Couvrir USD et GBP seulement", desc:"Laisser le JPY non couvert" },
          { id:"C", icon:"♻️", label:"Netting USD/GBP + forward résiduel", desc:"Compensation interne, forward sur solde" },
          { id:"D", icon:"⚡", label:"Aucune couverture", desc:"Tout au cours spot dans 3 mois" },
        ],
        computeScore: (choice) => {
          const fU=200000/1.09, sU=200000/1.10;
          const fG=-(150000/0.862), sG=-(150000/0.855);
          const fJ=30000000/161.5, sJ=30000000/159.0;
          const t={A:fU+fG+fJ, B:fU+fG+sJ, C:(fU+sU)/2+fG+sJ, D:sU+sG+sJ};
          const max=Math.max(...Object.values(t));
          const min=Math.min(...Object.values(t));
          const r=max-min; if(r<1) return 75;
          return Math.round(50+50*(t[choice]-min)/r);
        },
        reveal:"Réalisé : EUR/USD 1,1000 | EUR/GBP 0,8550 | EUR/JPY 159,00",
        explanation:"USD se déprécie légèrement (forward USD optimal), GBP s'apprécie (forward GBP optimal), JPY s'apprécie (spot JPY meilleur que forward). Couvrir USD+GBP et laisser JPY ouvert (B) est la stratégie dominante.",
        optimal:"B",
      },
    ]
  },
  2: {
    name: "Session 2 — Stratégies Avancées",
    accent: "#f59e0b",
    rounds: [
      {
        id: 1, title: "Netting multilatéral", company: "Armorique Group SA",
        context: "La direction financière veut optimiser les flux entre ses 3 filiales pour minimiser les coûts de transaction.",
        exposition: "Flux inter-filiales du trimestre :\n→ FR paie UK : 200 000 GBP\n→ DE paie FR : 250 000 €\n→ UK paie DE : 180 000 €\n→ FR paie DE : 150 000 €",
        marketData: [["Cours spot EUR/GBP","0,8650"],["Coût de transaction","0,30 % par transfert"],["Délai de règlement","J+2 par transfert"],["Cash pooling autorisé","Oui"]],
        choices: [
          { id:"A", icon:"📤", label:"Règlement brut", desc:"4 transferts individuels sans compensation" },
          { id:"B", icon:"⚖️", label:"Netting bilatéral", desc:"Compensation deux à deux entre filiales" },
          { id:"C", icon:"♻️", label:"Netting multilatéral complet", desc:"Centralisation et compensation globale" },
          { id:"D", icon:"🛡️", label:"Netting + forward résiduel GBP", desc:"Netting puis couverture de la position nette" },
        ],
        computeScore: (choice) => {
          const coeff={A:1.0, B:0.55, C:0.20, D:0.25};
          const scores={A:20, B:45, C:100, D:80};
          return scores[choice];
        },
        reveal:"Netting multilatéral : 1 seul transfert résiduel de 44 000 €",
        explanation:"Le netting multilatéral réduit 4 transactions à 1 position nette, économisant ~75 % des coûts de change. C'est le principe du cash pooling notionnel.",
        optimal:"C",
      },
      {
        id: 2, title: "Parité des taux d'intérêt couverte", company: "Bretagne Capital SA",
        context: "Votre salle des marchés détecte une potentielle opportunité d'arbitrage. Analysez la PIT couverte sur EUR/USD.",
        exposition: "Capital disponible : 1 000 000 €\nHorizon : 1 an",
        marketData: [["Spot EUR/USD","1,0850"],["Forward 1 an EUR/USD","1,0620"],["Taux € 1 an","3,50 %"],["Taux $ 1 an","5,20 %"],["Spot EUR/CHF","0,9450"],["Taux CHF 1 an","1,20 %"]],
        choices: [
          { id:"A", icon:"💱", label:"Arbitrage EUR → USD", desc:"Emprunter €, placer en $, forward de retour" },
          { id:"B", icon:"💱", label:"Arbitrage EUR → CHF", desc:"Emprunter €, placer en CHF, forward de retour" },
          { id:"C", icon:"🔺", label:"Arbitrage triangulaire", desc:"Circuit EUR → USD → CHF → EUR" },
          { id:"D", icon:"🚫", label:"Aucun arbitrage rentable", desc:"La PIT est vérifiée — marchés en équilibre" },
        ],
        computeScore: (choice) => ({A:35, B:50, C:60, D:100}[choice]),
        reveal:"PIT EUR/USD vérifiée : rendement arbitrage net = −0,23 %",
        explanation:"PIT couverte vérifiée : écart de taux < coûts de transaction (~0,5 %). Aucun arbitrage ne reste profitable après frais. Les marchés sont en quasi-équilibre.",
        optimal:"D",
      },
      {
        id: 3, title: "Le financement international", company: "Côtes d'Armor Industries",
        context: "Votre groupe doit lever 5 M€ pour financer une expansion internationale sur 3 ans.",
        exposition: "Besoin : 5 000 000 €\nDurée : 3 ans\nNotation : BBB+",
        marketData: [["Crédit syndiqué (€)","Taux fixe 4,80 % /an"],["Euro-obligation (€)","Taux fixe 4,20 % + frais émission 1,50 %"],["Emprunt USD + swap","USD 5,80 % + basis swap −1,20 %"],["Obligation convertible (€)","Taux fixe 3,10 % + dilution potentielle"]],
        choices: [
          { id:"A", icon:"🏦", label:"Crédit syndiqué", desc:"4,80 % — simple, rapide, flexible" },
          { id:"B", icon:"📋", label:"Euro-obligation", desc:"4,20 % + 1,50 % frais → taux effectif ~4,72 %" },
          { id:"C", icon:"💱", label:"USD + swap de devises", desc:"5,80 % − 1,20 % = 4,60 % effectif" },
          { id:"D", icon:"🔄", label:"Obligation convertible", desc:"3,10 % — moins cher mais dilution actionnaires" },
        ],
        computeScore: (choice) => ({A:60, B:70, C:100, D:85}[choice]),
        reveal:"Comparatif taux effectifs — A:4,80% | B:4,72% | C:4,60% | D:3,10%",
        explanation:"USD+swap (C) offre le meilleur compromis coût/risque : 4,60 % sans dilution. L'obligation convertible (D) est moins chère mais entraîne une dilution future du capital.",
        optimal:"C",
      },
      {
        id: 4, title: "L'investissement direct étranger", company: "Morbihan Industrie SA",
        context: "Évaluation d'un projet d'implantation industrielle au Maroc. Quelle méthode pour calculer la VAN ?",
        exposition: "Investissement initial : 10 000 000 MAD\nFlux annuels prévus : +2 500 000 MAD/an\nHorizon : 5 ans",
        marketData: [["Cours spot EUR/MAD","10,85"],["Inflation MAD","+4,5 % /an"],["Inflation EUR","+2,5 % /an"],["Cours forward PPA (5 ans)","EUR/MAD ≈ 11,94"],["Taux d'actualisation MAD","8,0 %"],["Prime de risque pays","+2,5 %"]],
        choices: [
          { id:"A", icon:"📊", label:"VAN en MAD (taux 8 %)", desc:"Calcul en devise locale, conversion du résultat final" },
          { id:"B", icon:"💶", label:"VAN en EUR via PPA (taux 5,5 %)", desc:"Conversion des flux MAD→EUR selon PPA prévisionnelle" },
          { id:"C", icon:"❌", label:"VAN en EUR (taux 8 %)", desc:"Conversion au cours spot fixe + taux EUR inadapté" },
          { id:"D", icon:"🎲", label:"Décision qualitative uniquement", desc:"Critères stratégiques, pas de calcul formel" },
        ],
        computeScore: (choice) => ({A:95, B:100, C:25, D:10}[choice]),
        reveal:"VAN MAD = +9 953 000 MAD → +917 800 € au cours spot — Projet rentable",
        explanation:"A et B sont méthodologiquement équivalents si la PPA tient. L'erreur classique (C) : utiliser le cours spot fixe avec un taux € incompatible. Règle d'or : taux d'actualisation et flux dans la même devise.",
        optimal:"B",
      },
      {
        id: 5, title: "La crise de change", company: "Atlantic Export Group",
        context: "⚠️ ALERTE : Crise de change dans un pays émergent partenaire. La devise locale s'effondre de −25 % en 48h.",
        exposition: "• Actifs filiale locale : 8 000 000 devise locale\n• Créance export (€) : +500 000 €\n• Dette import : −2 000 000 devise locale",
        marketData: [["Dépréciation","−25 % en 48h"],["Tendance","Poursuite attendue"],["Marché forward","Gelé temporairement"],["Options de couverture","Non disponibles"],["Contrôle des changes","Partiel"]],
        choices: [
          { id:"A", icon:"🏃", label:"Rapatrier la trésorerie filiale", desc:"Sortir les liquidités avant dépréciation supplémentaire" },
          { id:"B", icon:"💱", label:"Rembourser la dette locale", desc:"Solder la dette avant que son coût n'augmente" },
          { id:"C", icon:"⚡", label:"Stratégie combinée (A + B)", desc:"Rapatriement simultané + remboursement anticipé" },
          { id:"D", icon:"⏳", label:"Attendre la stabilisation", desc:"Ne pas paniquer, parier sur un rebond" },
        ],
        computeScore: (choice) => ({A:70, B:65, C:100, D:35}[choice]),
        reveal:"La devise a encore chuté de −12 % dans les 5 jours suivants",
        explanation:"La stratégie combinée (C) est optimale : rapatrier protège les actifs, rembourser la dette évite une charge croissante. Attendre (D) est la pire stratégie quand la tendance est clairement baissière.",
        optimal:"C",
      },
    ]
  }
};

// ══════════════════════════════════════════════════════════════
// HELPERS SUPABASE
// ══════════════════════════════════════════════════════════════
const getGameState = async () => {
  const { data } = await supabase.from('game_state').select('*').eq('id', 1).single();
  return data;
};

const setGameState = async (updates) => {
  await supabase.from('game_state').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', 1);
};

const getTeams = async () => {
  const { data } = await supabase.from('teams').select('*').order('total', { ascending: false });
  return data || [];
};

const upsertTeam = async (team) => {
  await supabase.from('teams').upsert(team);
};

const getDecisions = async (session, roundIndex) => {
  const { data } = await supabase.from('decisions').select('*').eq('session', session).eq('round_index', roundIndex);
  return data || [];
};

const submitDecisionDB = async (session, roundIndex, teamId, choice) => {
  await supabase.from('decisions').upsert({ session, round_index: roundIndex, team_id: teamId, choice }, { onConflict: 'session,round_index,team_id' });
};

// ══════════════════════════════════════════════════════════════
// SOUS-COMPOSANTS
// ══════════════════════════════════════════════════════════════
function MarketTable({ data }) {
  return (
    <div style={{ background: "rgba(0,0,0,0.45)", borderRadius: 8, padding: "10px 14px", fontFamily: "'Courier New',monospace", fontSize: 13 }}>
      <div style={{ color: "#475569", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Données de marché</div>
      {data.map(([l, v], i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: i < data.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
          <span style={{ color: "#94a3b8" }}>{l}</span>
          <span style={{ color: "#f0f9ff", fontWeight: 600 }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreBadge({ score }) {
  const c = score >= 90 ? "#00d4aa" : score >= 70 ? "#f59e0b" : "#ef4444";
  return <span style={{ color: c, fontWeight: 800, fontSize: 18 }}>{score}<span style={{ fontSize: 12, fontWeight: 600 }}> pts</span></span>;
}

function Leaderboard({ teams, session, mini = false }) {
  const sk = `score${session}`;
  const sorted = [...teams].sort((a, b) => (b[sk] || 0) - (a[sk] || 0));
  const medals = ["🥇", "🥈", "🥉"];

  if (mini) return (
    <div>
      <div style={{ color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Classement</div>
      {sorted.map((t, i) => (
        <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", background: i === 0 ? "rgba(0,212,170,0.08)" : "rgba(255,255,255,0.02)", borderRadius: 6, marginBottom: 3, fontSize: 13 }}>
          <span style={{ color: i === 0 ? "#00d4aa" : "#94a3b8" }}>{medals[i] || `${i + 1}.`} {t.name}</span>
          <ScoreBadge score={t[sk] || 0} />
        </div>
      ))}
      {sorted.length === 0 && <div style={{ color: "#334155", fontSize: 13, padding: "8px 0" }}>Aucune équipe…</div>}
    </div>
  );

  return (
    <div>
      <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 16, marginBottom: 14 }}>🏆 Classement — {SESSIONS[session]?.name || "Global"}</div>
      {sorted.map((t, i) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: i === 0 ? "rgba(0,212,170,0.1)" : "rgba(255,255,255,0.03)", borderRadius: 10, border: `1px solid ${i === 0 ? "rgba(0,212,170,0.25)" : "rgba(255,255,255,0.05)"}`, marginBottom: 6 }}>
          <span style={{ fontSize: 18, width: 28 }}>{medals[i] || `${i + 1}`}</span>
          <span style={{ flex: 1, color: "#e2e8f0", fontWeight: 600 }}>{t.name}</span>
          <ScoreBadge score={t[sk] || 0} />
        </div>
      ))}
      {sorted.length === 0 && <div style={{ color: "#334155", textAlign: "center", padding: 20 }}>En attente des équipes…</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// APP PRINCIPALE
// ══════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView] = useState("landing");
  const [gs, setGs] = useState({ phase: "lobby", session: 1, round_index: 0, round_phase: "waiting" });
  const [teams, setTeams] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [myDecision, setMyDecision] = useState(null);
  const [myRoundScore, setMyRoundScore] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [pinInput, setPinInput] = useState("");
  const [teamNameInput, setTeamNameInput] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [loading, setLoading] = useState(false);

  // Chargement initial
  useEffect(() => {
    const init = async () => {
      const g = await getGameState();
      const t = await getTeams();
      if (g) setGs(g);
      if (t) setTeams(t);
      // Récupérer l'équipe stockée localement
      const storedTeam = localStorage.getItem("fxmanager_team");
      if (storedTeam) {
        const parsed = JSON.parse(storedTeam);
        setMyTeam(parsed);
        setView("team");
      }
    };
    init();
  }, []);

  // Subscriptions Realtime Supabase
  useEffect(() => {
    const channel = supabase.channel('game-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, async () => {
        const g = await getGameState();
        if (g) setGs(g);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, async () => {
        const t = await getTeams();
        if (t) setTeams(t);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decisions' }, async (payload) => {
        const g = await getGameState();
        if (g) {
          const d = await getDecisions(g.session, g.round_index);
          setDecisions(d);
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // Recalcul score quand round révélé
  useEffect(() => {
    if (gs.round_phase === "revealed" && myTeam) {
      const myDec = decisions.find(d => d.team_id === myTeam.id);
      if (myDec) {
        const round = SESSIONS[gs.session]?.rounds[gs.round_index];
        if (round) setMyRoundScore(round.computeScore(myDec.choice));
      }
    }
  }, [gs.round_phase, decisions, myTeam, gs.session, gs.round_index]);

  // Reset décision au changement de round
  useEffect(() => {
    setMyDecision(null);
    setMyRoundScore(null);
  }, [gs.round_index, gs.session]);

  // Charger décisions quand round change
  useEffect(() => {
    const load = async () => {
      const d = await getDecisions(gs.session, gs.round_index);
      setDecisions(d);
    };
    load();
  }, [gs.round_index, gs.session, gs.round_phase]);

  // ─ TEACHER ─────────────────────────────────────────────────
  const teacherLogin = () => {
    if (pinInput === TEACHER_PIN) { setView("teacher"); setPinErr(""); }
    else setPinErr("Code incorrect");
  };

  const startSession = async (sn) => {
    await setGameState({ phase: `session${sn}`, session: sn, round_index: 0, round_phase: "waiting" });
  };

  const launchRound = async () => {
    await setGameState({ round_phase: "deciding" });
  };

  const revealRound = async () => {
    const session = SESSIONS[gs.session];
    const round = session.rounds[gs.round_index];
    const decs = await getDecisions(gs.session, gs.round_index);
    // Calculer et mettre à jour les scores
    for (const dec of decs) {
      const score = round.computeScore(dec.choice);
      const team = teams.find(t => t.id === dec.team_id);
      if (team) {
        const sk = `score${gs.session}`;
        await upsertTeam({
          ...team,
          [sk]: (team[sk] || 0) + score,
          total: (team.total || 0) + score
        });
      }
    }
    await setGameState({ round_phase: "revealed" });
  };

  const nextRound = async () => {
    const session = SESSIONS[gs.session];
    const isLast = gs.round_index >= session.rounds.length - 1;
    if (isLast) {
      if (gs.session === 1) await setGameState({ phase: "between", round_phase: "waiting", round_index: 0 });
      else await setGameState({ phase: "finished", round_phase: "waiting" });
    } else {
      await setGameState({ round_index: gs.round_index + 1, round_phase: "waiting" });
    }
  };

  const resetGame = async () => {
    await setGameState({ phase: "lobby", session: 1, round_index: 0, round_phase: "waiting" });
    await supabase.from('teams').delete().neq('id', '');
    await supabase.from('decisions').delete().neq('id', 0);
    setTeams([]); setDecisions([]);
  };

  // ─ TEAM ────────────────────────────────────────────────────
  const registerTeam = async () => {
    if (!teamNameInput.trim()) return;
    setLoading(true);
    const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    const me = { id, name: teamNameInput.trim() };
    await upsertTeam({ id: me.id, name: me.name, score1: 0, score2: 0, total: 0 });
    localStorage.setItem("fxmanager_team", JSON.stringify(me));
    setMyTeam(me);
    const t = await getTeams();
    setTeams(t);
    setView("team");
    setLoading(false);
  };

  const submitDecision = async (choice) => {
    if (!myTeam || myDecision) return;
    setMyDecision(choice);
    await submitDecisionDB(gs.session, gs.round_index, myTeam.id, choice);
  };

  // ─ STYLES ──────────────────────────────────────────────────
  const bg = { minHeight: "100vh", background: "#06070f", color: "#e2e8f0", fontFamily: "'DM Sans',system-ui,sans-serif", margin: 0, padding: 0 };
  const card = (extra = {}) => ({ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 20, ...extra });
  const btn = (col = "#00d4aa", extra = {}) => ({ background: col, color: col === "#00d4aa" ? "#06070f" : "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", ...extra });
  const outBtn = (extra = {}) => ({ background: "transparent", color: "#64748b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 14, cursor: "pointer", ...extra });
  const inp = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 15, width: "100%", boxSizing: "border-box", outline: "none" };

  const curSession = SESSIONS[gs.session];
  const curRound = curSession?.rounds[gs.round_index];
  const accent = curSession?.accent || "#00d4aa";
  const teamCount = teams.length;
  const decCount = decisions.length;

  // ══════════════════════════════════════════════════════════
  // LANDING
  // ══════════════════════════════════════════════════════════
  if (view === "landing") return (
    <div style={{ ...bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, background: "rgba(0,212,170,0.15)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 16px" }}>💹</div>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: "#f8fafc", margin: "0 0 6px", letterSpacing: "-0.03em" }}>FX Manager</h1>
        <p style={{ color: "#334155", margin: "0 0 40px", fontSize: 15 }}>Simulation de gestion du risque de change · IAE Bretagne Sud</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button style={{ ...btn(), padding: "14px 24px", fontSize: 16, borderRadius: 12, width: "100%" }} onClick={() => setView("team-reg")}>🎓 Rejoindre en équipe</button>
          <button style={{ ...outBtn(), padding: "14px 24px", fontSize: 15, borderRadius: 12, width: "100%" }} onClick={() => setView("teacher-login")}>👨‍🏫 Espace Professeur</button>
          <button style={{ ...outBtn(), padding: "12px 24px", fontSize: 14, borderRadius: 12, width: "100%" }} onClick={() => setView("leaderboard")}>🏆 Classement en direct</button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // TEACHER LOGIN
  // ══════════════════════════════════════════════════════════
  if (view === "teacher-login") return (
    <div style={{ ...bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ ...card(), maxWidth: 360, width: "100%" }}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, color: "#f1f5f9" }}>🔐 Accès Professeur</h2>
        <input style={inp} type="password" placeholder="Code d'accès" value={pinInput} onChange={e => setPinInput(e.target.value)} onKeyDown={e => e.key === "Enter" && teacherLogin()} autoFocus />
        {pinErr && <p style={{ color: "#ef4444", fontSize: 13, margin: "8px 0 0" }}>{pinErr}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button style={btn()} onClick={teacherLogin}>Connexion</button>
          <button style={outBtn()} onClick={() => setView("landing")}>Retour</button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // TEAM REGISTRATION
  // ══════════════════════════════════════════════════════════
  if (view === "team-reg") return (
    <div style={{ ...bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ ...card(), maxWidth: 400, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>💹</div>
        <h2 style={{ margin: "0 0 4px", color: "#f1f5f9" }}>FX Manager</h2>
        <p style={{ color: "#475569", margin: "0 0 24px", fontSize: 14 }}>Entrez le nom de votre équipe</p>
        <input style={{ ...inp, textAlign: "center", fontSize: 16, padding: "12px 14px" }} placeholder="Ex: Team Alpha, Équipe 3…" value={teamNameInput} onChange={e => setTeamNameInput(e.target.value)} onKeyDown={e => e.key === "Enter" && registerTeam()} autoFocus />
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "center" }}>
          <button style={{ ...btn(), opacity: loading ? 0.6 : 1, padding: "11px 28px" }} onClick={registerTeam} disabled={loading}>{loading ? "Connexion…" : "Rejoindre le jeu"}</button>
          <button style={outBtn()} onClick={() => setView("landing")}>Retour</button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // TEACHER DASHBOARD
  // ══════════════════════════════════════════════════════════
  if (view === "teacher") {
    const phase = gs.phase, rp = gs.round_phase;
    return (
      <div style={{ ...bg, paddingBottom: 40 }}>
        <div style={{ background: "rgba(0,0,0,0.6)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span>💹</span><span style={{ fontWeight: 700, color: "#f1f5f9" }}>FX Manager</span>
            <span style={{ background: "rgba(0,212,170,0.15)", color: "#00d4aa", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>PROF</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...outBtn(), padding: "5px 12px", fontSize: 12 }} onClick={() => setView("leaderboard")}>🏆</button>
            <button style={{ ...outBtn(), padding: "5px 12px", fontSize: 12, color: "#ef4444", borderColor: "rgba(239,68,68,0.25)" }} onClick={resetGame}>↺ Reset</button>
          </div>
        </div>

        <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={card()}>
              <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                {[["Équipes", teamCount, "#00d4aa"], ["Décisions", `${decCount}/${teamCount}`, "#f59e0b"], ["Phase", phase, "#94a3b8"], ["Round", phase.startsWith("session") ? `${gs.round_index + 1}/5` : "—", "#94a3b8"]].map(([l, v, c]) => (
                  <div key={l} style={{ background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: "8px 14px", flex: 1, minWidth: 80 }}>
                    <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>{l}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: c, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>

              {phase === "lobby" && (
                <div>
                  <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 12px" }}>Attendez que toutes les équipes soient connectées.</p>
                  <button style={{ ...btn(), width: "100%", padding: 12 }} onClick={() => startSession(1)}>▶ Démarrer Session 1</button>
                </div>
              )}

              {(phase === "session1" || phase === "session2") && curRound && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rp === "waiting" && <button style={{ ...btn(accent), width: "100%", padding: 12 }} onClick={launchRound}>▶ Lancer le Round {gs.round_index + 1} — {curRound.title}</button>}
                  {rp === "deciding" && (
                    <>
                      <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: 10, color: "#f59e0b", fontSize: 13 }}>
                        ⏱️ Délibération… {decCount}/{teamCount} décisions reçues
                      </div>
                      <button style={{ ...btn("#f59e0b"), width: "100%", padding: 12 }} onClick={revealRound}>🔓 Révéler le résultat</button>
                    </>
                  )}
                  {rp === "revealed" && (
                    <>
                      <div style={{ background: "rgba(0,212,170,0.08)", border: "1px solid rgba(0,212,170,0.2)", borderRadius: 8, padding: 12 }}>
                        <div style={{ color: "#00d4aa", fontWeight: 700, marginBottom: 4 }}>{curRound.reveal}</div>
                        <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>{curRound.explanation}</div>
                      </div>
                      <button style={{ ...btn(accent), width: "100%", padding: 12 }} onClick={nextRound}>
                        {gs.round_index < 4 ? `▶ Round ${gs.round_index + 2}` : phase === "session1" ? "✓ Fin Session 1" : "🏁 Terminer"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {phase === "between" && (
                <div>
                  <div style={{ color: "#00d4aa", marginBottom: 12, fontSize: 14 }}>✅ Session 1 terminée.</div>
                  <button style={{ ...btn("#f59e0b"), width: "100%", padding: 12 }} onClick={() => startSession(2)}>▶ Démarrer Session 2</button>
                </div>
              )}
              {phase === "finished" && <div style={{ textAlign: "center", padding: 16, color: "#00d4aa", fontWeight: 700, fontSize: 18 }}>🏆 Jeu terminé !</div>}
            </div>

            {(rp === "deciding" || rp === "revealed") && (
              <div style={card()}>
                <div style={{ color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Décisions des équipes</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 280, overflowY: "auto" }}>
                  {teams.map(t => {
                    const dec = decisions.find(d => d.team_id === t.id);
                    const sc = rp === "revealed" && dec && curRound ? curRound.computeScore(dec.choice) : null;
                    return (
                      <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 6, fontSize: 13 }}>
                        <span style={{ color: "#cbd5e1" }}>{t.name}</span>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {dec ? <span style={{ background: "rgba(0,212,170,0.15)", color: "#00d4aa", borderRadius: 4, padding: "2px 8px", fontWeight: 700, fontSize: 12 }}>{dec.choice}</span> : <span style={{ color: "#1e293b", fontSize: 11 }}>…</span>}
                          {sc !== null && <ScoreBadge score={sc} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {curRound && (phase === "session1" || phase === "session2") && (
              <div style={card()}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>{curRound.title}</div>
                  <span style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{curRound.company}</span>
                </div>
                <div style={{ color: "#64748b", fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>{curRound.context}</div>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "#94a3b8", marginBottom: 10, whiteSpace: "pre-line", background: "rgba(0,0,0,0.3)", padding: 10, borderRadius: 6 }}>{curRound.exposition}</div>
                <MarketTable data={curRound.marketData} />
              </div>
            )}
            <div style={card()}><Leaderboard teams={teams} session={gs.session} /></div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // TEAM VIEW
  // ══════════════════════════════════════════════════════════
  if (view === "team" && myTeam) {
    const phase = gs.phase, rp = gs.round_phase;
    const myTeamData = teams.find(t => t.id === myTeam.id);
    const ms1 = myTeamData?.score1 || 0, ms2 = myTeamData?.score2 || 0;

    return (
      <div style={{ ...bg, paddingBottom: 40 }}>
        <div style={{ background: "rgba(0,0,0,0.6)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>💹</span>
            <span style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 14 }}>{myTeam.name}</span>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
            <span style={{ color: "#334155" }}>S1: <span style={{ color: "#00d4aa", fontWeight: 700 }}>{ms1}</span></span>
            {ms2 > 0 && <span style={{ color: "#334155" }}>S2: <span style={{ color: "#f59e0b", fontWeight: 700 }}>{ms2}</span></span>}
          </div>
        </div>

        <div style={{ padding: 20, maxWidth: 620, margin: "0 auto" }}>
          {phase === "lobby" && (
            <div style={{ textAlign: "center", padding: "50px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
              <h2 style={{ color: "#e2e8f0", margin: "0 0 8px" }}>En attente du démarrage</h2>
              <p style={{ color: "#334155", fontSize: 14 }}>Le professeur va lancer la partie…</p>
              <div style={{ ...card({ marginTop: 24, textAlign: "left" }) }}>
                <div style={{ color: "#334155", fontSize: 11, marginBottom: 8, textTransform: "uppercase" }}>Équipes connectées ({teamCount})</div>
                {teams.map(t => <div key={t.id} style={{ color: "#64748b", fontSize: 13, padding: "3px 0" }}>👥 {t.name}</div>)}
              </div>
            </div>
          )}

          {(phase === "session1" || phase === "session2") && rp === "waiting" && (
            <div style={{ textAlign: "center", padding: "50px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⏸️</div>
              <div style={{ color: "#475569", fontSize: 12, textTransform: "uppercase", marginBottom: 6 }}>{curSession?.name}</div>
              <h2 style={{ color: "#e2e8f0", margin: "0 0 8px" }}>Round {gs.round_index + 1}/5</h2>
              <p style={{ color: "#334155", fontSize: 14 }}>Le professeur va lancer le round…</p>
            </div>
          )}

          {(phase === "session1" || phase === "session2") && rp === "deciding" && curRound && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ color: "#334155", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>{curSession.name} · Round {gs.round_index + 1}/5</div>
                  <h2 style={{ color: "#f1f5f9", margin: 0, fontSize: 19, fontWeight: 800 }}>{curRound.title}</h2>
                </div>
                <span style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{curRound.company}</span>
              </div>

              <div style={card({ marginBottom: 12 })}>
                <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 10px", lineHeight: 1.6 }}>{curRound.context}</p>
                <div style={{ background: "rgba(0,212,170,0.06)", border: "1px solid rgba(0,212,170,0.15)", borderRadius: 8, padding: "8px 12px", fontFamily: "monospace", fontSize: 13, color: "#94a3b8", whiteSpace: "pre-line", marginBottom: 10 }}>{curRound.exposition}</div>
                <MarketTable data={curRound.marketData} />
              </div>

              <div style={{ color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Votre décision</div>

              {myDecision ? (
                <div style={{ ...card({ textAlign: "center", background: "rgba(0,212,170,0.07)", borderColor: "rgba(0,212,170,0.25)" }) }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>✅</div>
                  <div style={{ color: "#00d4aa", fontWeight: 700, fontSize: 16 }}>Option {myDecision} soumise</div>
                  <div style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>{curRound.choices.find(c => c.id === myDecision)?.label}</div>
                  <div style={{ color: "#1e293b", fontSize: 12, marginTop: 8 }}>En attente du résultat…</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {curRound.choices.map(c => (
                    <button key={c.id} onClick={() => submitDecision(c.id)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "13px 15px", display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", textAlign: "left", width: "100%" }}>
                      <span style={{ background: "rgba(0,0,0,0.5)", borderRadius: 6, padding: "3px 10px", fontWeight: 800, color: accent, fontSize: 15, minWidth: 28, textAlign: "center" }}>{c.id}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0", marginBottom: 2 }}>{c.icon} {c.label}</div>
                        <div style={{ color: "#475569", fontSize: 12 }}>{c.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {(phase === "session1" || phase === "session2") && rp === "revealed" && curRound && (
            <div>
              <h2 style={{ color: "#f1f5f9", margin: "0 0 14px", fontSize: 18 }}>Résultats — {curRound.title}</h2>
              {myDecision && myRoundScore !== null && (
                <div style={{ ...card({ background: myRoundScore >= 90 ? "rgba(0,212,170,0.1)" : myRoundScore >= 70 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.08)", borderColor: myRoundScore >= 90 ? "rgba(0,212,170,0.3)" : myRoundScore >= 70 ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.3)", marginBottom: 12 }) }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>Votre choix</div>
                      <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15 }}>{curRound.choices.find(c => c.id === myDecision)?.icon} {curRound.choices.find(c => c.id === myDecision)?.label}</div>
                    </div>
                    <ScoreBadge score={myRoundScore} />
                  </div>
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    {myRoundScore >= 90 ? "🎯 Excellent choix !" : myRoundScore >= 70 ? "👍 Bon choix" : myRoundScore >= 50 ? "📚 Choix acceptable" : "❌ Choix sous-optimal"}
                    {curRound.optimal !== myDecision && ` — Optimal : Option ${curRound.optimal} (${curRound.choices.find(c => c.id === curRound.optimal)?.label})`}
                  </div>
                </div>
              )}
              <div style={{ ...card({ background: "rgba(0,0,0,0.4)", marginBottom: 12 }) }}>
                <div style={{ color: accent, fontWeight: 700, marginBottom: 6 }}>📊 {curRound.reveal}</div>
                <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.7 }}>{curRound.explanation}</div>
              </div>
              <div style={card()}><Leaderboard teams={teams} session={gs.session} mini /></div>
              <p style={{ color: "#1e293b", fontSize: 12, textAlign: "center", marginTop: 14 }}>En attente du prochain round…</p>
            </div>
          )}

          {phase === "between" && (
            <div style={{ textAlign: "center", padding: "50px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>☕</div>
              <h2 style={{ color: "#e2e8f0" }}>Session 1 terminée !</h2>
              <div style={{ ...card({ margin: "20px auto", display: "inline-block", minWidth: 200 }) }}>
                <div style={{ color: "#334155", fontSize: 12, marginBottom: 4 }}>Votre score Session 1</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: "#00d4aa" }}>{ms1} <span style={{ fontSize: 16, color: "#334155" }}>/ 500 pts</span></div>
              </div>
              <p style={{ color: "#334155", fontSize: 14 }}>Débrief en cours…</p>
              <div style={card({ marginTop: 16 })}><Leaderboard teams={teams} session={1} mini /></div>
            </div>
          )}

          {phase === "finished" && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
              <h2 style={{ color: "#f1f5f9", margin: "0 0 20px" }}>Jeu terminé !</h2>
              <div style={card({ marginBottom: 16 })}>
                <div style={{ display: "flex", justifyContent: "space-around" }}>
                  {[["Session 1", ms1, "#00d4aa"], ["Session 2", ms2, "#f59e0b"], ["Total", ms1 + ms2, "#f1f5f9"]].map(([l, v, c]) => (
                    <div key={l}><div style={{ color: "#334155", fontSize: 12 }}>{l}</div><div style={{ fontSize: 28, fontWeight: 800, color: c }}>{v}</div></div>
                  ))}
                </div>
              </div>
              <Leaderboard teams={teams} session={2} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // LEADERBOARD PUBLIC
  // ══════════════════════════════════════════════════════════
  if (view === "leaderboard") return (
    <div style={{ ...bg, padding: 24 }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div><span style={{ fontSize: 20 }}>💹</span> <span style={{ fontWeight: 700, color: "#f1f5f9" }}>FX Manager</span></div>
          <button style={{ ...outBtn({ padding: "6px 14px", fontSize: 12 }) }} onClick={() => setView("landing")}>← Accueil</button>
        </div>
        <div style={card({ marginBottom: 16 })}><Leaderboard teams={teams} session={gs.phase === "session2" || gs.phase === "finished" ? 2 : 1} /></div>
        {gs.phase === "finished" && (
          <div style={card()}>
            <div style={{ color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Score Total</div>
            {[...teams].sort((a, b) => (b.total || 0) - (a.total || 0)).map((t, i) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 7, marginBottom: 5, fontSize: 14 }}>
                <span style={{ color: "#94a3b8" }}>{"🥇🥈🥉"[i] || `${i + 1}.`} {t.name}</span>
                <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{t.total || 0} pts</span>
              </div>
            ))}
          </div>
        )}
        <p style={{ color: "#1e293b", fontSize: 12, textAlign: "center", marginTop: 16 }}>Mis à jour en temps réel</p>
      </div>
    </div>
  );

  return <div style={{ ...bg, padding: 24, color: "#334155" }}>Chargement…</div>;
}
