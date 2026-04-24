import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

const TEACHER_PIN = "PROF2024";
const INITIAL_TREASURY = 5000000;
const MIN_TREASURY = 500000;
const fmt = (n) => new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n);

const PLACEMENT_OPTIONS = [
  {id:"dat",  icon:"🏦",label:"Dépôt à terme (DAT)",shortLabel:"DAT",  rate:0.015/4, risk:"Nul",   color:"#00d4aa"},
  {id:"opcvm",icon:"📈",label:"OPCVM Monétaire",    shortLabel:"OPCVM",rate:0.025/4, risk:"Faible",color:"#3b82f6"},
  {id:"oblig",icon:"📋",label:"Obligations CT",     shortLabel:"Oblig", rate:0.04/4,  risk:"Moyen", color:"#f59e0b"},
  {id:"cash", icon:"💶",label:"Aucun placement",    shortLabel:"Cash",  rate:0,       risk:"Nul",   color:"#475569"},
];

const COMPANY = {name:"Armor International SA", tag:"Équipements industriels · Lorient, Bretagne"};

const SESSIONS = {
  1:{name:"Session 1 — Fondamentaux",accent:"#00d4aa",rounds:[
    {id:1,title:"Contrat américain",subtitle:"Q1 — Créance export USD",
     context:"Armor vient de livrer une commande de 500 000 $ à un client américain. Paiement attendu dans 90 jours. Quelle couverture adoptez-vous ?",
     exposition:"Créance : +500 000 USD\nÉchéance : 90 jours",ops_net:180000,
     marketData:[["Cours spot","EUR/USD = 1,0850"],["Forward 90j","EUR/USD = 1,0920"],["Taux EUR","3,5 %/an"],["Taux USD","5,2 %/an"],["Put USD","Strike 1,0900 — Prime 2 %"]],
     choices:[{id:"A",icon:"⚡",label:"Aucune couverture",desc:"Vente USD au spot dans 90 jours"},{id:"B",icon:"🔒",label:"Vente à terme (forward)",desc:"500 000 USD à 1,0920 dans 90j"},{id:"C",icon:"🛡️",label:"Option put USD",desc:"Strike 1,0900, prime 2 %"}],
     computeHedgeResult:(c)=>({A:Math.round(500000/1.1050),B:Math.round(500000/1.0920),C:Math.round(500000/1.0900-(500000*0.02/1.092))}[c]),
     computePertinence:(c)=>({A:70,B:100,C:55}[c]),
     realized:"EUR/USD réalisé : 1,1050 — Dollar déprécié",
     explanation:"Forward (B) optimal : 457 875 € vs 452 489 € sans couverture. L'option coûte ~9 158 € de prime. La PIT en action : différentiel de taux EUR/USD favorable au forward.",optimal:"B"},
    {id:2,title:"Matières premières UK",subtitle:"Q2 — Dette import GBP",
     context:"Armor importe de l'acier d'un fournisseur britannique. Facture de 300 000 £ payable dans 60 jours. La livre sterling est volatile.",
     exposition:"Dette : −300 000 GBP\nÉchéance : 60 jours",ops_net:95000,
     marketData:[["Cours spot","EUR/GBP = 0,8650"],["Forward 60j","EUR/GBP = 0,8620"],["Taux EUR","3,5 %/an"],["Taux GBP","5,0 %/an"],["Call GBP","Strike 0,8640 — Prime 1,5 %"]],
     choices:[{id:"A",icon:"⚡",label:"Aucune couverture",desc:"Achat GBP au spot dans 60 jours"},{id:"B",icon:"🔒",label:"Achat à terme (forward)",desc:"300 000 GBP à 0,8620 dans 60j"},{id:"C",icon:"🛡️",label:"Option call GBP",desc:"Strike 0,8640, prime 1,5 %"},{id:"D",icon:"🏦",label:"Marché monétaire",desc:"Emprunt EUR + placement GBP aujourd'hui"}],
     computeHedgeResult:(c)=>({A:-Math.round(300000/0.8580),B:-Math.round(300000/0.8620),C:-Math.round(300000/0.8640+(300000/0.8640)*0.015),D:-Math.round(300000/0.8620)-500}[c]),
     computePertinence:(c)=>({A:55,B:100,C:40,D:85}[c]),
     realized:"EUR/GBP réalisé : 0,8580 — Livre appréciée",
     explanation:"GBP apprécié : achat spot coûte 349 651 € vs forward 348 028 €. Forward (B) optimal. Option (352 424 € avec prime) la plus coûteuse. Marché monétaire (D) quasi-équivalent au forward.",optimal:"B"},
    {id:3,title:"Contrat japonais",subtitle:"Q3 — Créance export JPY",
     context:"Armor signe avec un industriel japonais. Paiement de 80 millions de yens dans 6 mois. Différentiel de taux EUR/JPY exceptionnel.",
     exposition:"Créance : +80 000 000 JPY\nÉchéance : 6 mois",ops_net:220000,
     marketData:[["Cours spot","EUR/JPY = 162,40"],["Forward 6 mois","EUR/JPY = 160,20"],["Taux EUR","3,5 %/an"],["Taux JPY","0,1 %/an"],["Put JPY","Strike 161,00 — Prime 2,5 %"]],
     choices:[{id:"A",icon:"⚡",label:"Aucune couverture",desc:"Vente JPY au spot dans 6 mois"},{id:"B",icon:"🔒",label:"Vente à terme (forward)",desc:"80M JPY à EUR/JPY 160,20"},{id:"C",icon:"🛡️",label:"Option put JPY",desc:"Strike 161,00, prime 2,5 %"}],
     computeHedgeResult:(c)=>{const N=80000000,p=Math.round(N/162.40*0.025);return{A:Math.round(N/168.50),B:Math.round(N/160.20),C:Math.round(N/161.00)-p}[c];},
     computePertinence:(c)=>({A:45,B:100,C:70}[c]),
     realized:"EUR/JPY réalisé : 168,50 — Yen déprécié",
     explanation:"Forward (B) : 499 376 € vs 474 777 € sans couverture. PIT : taux JPY 0,1% vs EUR 3,5% génère un forward EUR/JPY très favorable. Option exercée à 161 donne 484 579 € net de prime.",optimal:"B"},
    {id:4,title:"Choc BCE inattendu",subtitle:"Q4 — Position ouverte en crise",
     context:"⚡ FLASH : La BCE relève ses taux de +50 bp de façon surprise. EUR s'apprécie de +185 pips. Armor détient 1 000 000 USD de créance non couverte.",
     exposition:"Position ouverte : +1 000 000 USD\nÉchéance : 90 jours",ops_net:50000,
     marketData:[["Spot avant","EUR/USD = 1,0850"],["Spot après ⚡","EUR/USD = 1,1050"],["Forward 90j","EUR/USD = 1,1120"],["Volatilité","+35 % (hausse brutale)"],["Put USD","Strike 1,1100 — Prime 3,5 %"]],
     choices:[{id:"A",icon:"💨",label:"Vente spot immédiate",desc:"Cristalliser au nouveau spot 1,1050"},{id:"B",icon:"🔒",label:"Forward au nouveau cours",desc:"Vente à terme à 1,1120"},{id:"C",icon:"🛡️",label:"Option put (cher)",desc:"Strike 1,1100, prime 3,5 %"},{id:"D",icon:"⏳",label:"Attendre un rebond",desc:"Parier sur retournement du dollar"}],
     computeHedgeResult:(c)=>{const N=1000000,p=Math.round(N*0.035/1.1050);return{A:Math.round(N/1.1050),B:Math.round(N/1.1120),C:Math.round(N/1.1100)-p,D:Math.round(N/1.0950)}[c];},
     computePertinence:(c)=>({A:80,B:55,C:40,D:55}[c]),
     realized:"EUR/USD réalisé : 1,0950 — Rebond partiel du dollar",
     explanation:"La vente spot (A, 905 072 €) était la décision la plus prudente face à l'incertitude post-choc. Forward (899 281 €) sous-performe. La volatilité élevée rend l'option (C) très chère.",optimal:"A"},
    {id:5,title:"Portefeuille multi-devises",subtitle:"Q5 — 3 expositions simultanées",
     context:"Ce trimestre, Armor gère trois expositions simultanément. La direction demande une stratégie de couverture globale optimisée.",
     exposition:"• Créance +200 000 USD (3 mois)\n• Dette −150 000 GBP (3 mois)\n• Créance +30 000 000 JPY (3 mois)",ops_net:310000,
     marketData:[["Spot EUR/USD","1,0850"],["Spot EUR/GBP","0,8650"],["Spot EUR/JPY","162,40"],["Fwd USD 3M","1,0900"],["Fwd GBP 3M","0,8620"],["Fwd JPY 3M","161,50"]],
     choices:[{id:"A",icon:"🔒",label:"Tout couvrir en forward",desc:"Forward sur les 3 expositions"},{id:"B",icon:"⚖️",label:"Forward USD+GBP / JPY spot",desc:"Couvrir USD et GBP, laisser JPY ouvert"},{id:"C",icon:"♻️",label:"Netting + forward résiduel",desc:"Compensation USD/GBP, forward sur solde"},{id:"D",icon:"⚡",label:"Aucune couverture",desc:"Tout au spot dans 3 mois"}],
     computeHedgeResult:(c)=>{const uF=Math.round(200000/1.09),uS=Math.round(200000/1.10),gF=-Math.round(150000/0.862),gS=-Math.round(150000/0.855),jF=Math.round(30000000/161.5),jS=Math.round(30000000/159.0);return{A:uF+gF+jF,B:uF+gF+jS,C:Math.round((uF+uS)/2)+gF+jS,D:uS+gS+jS}[c];},
     computePertinence:(c)=>({A:70,B:100,C:85,D:50}[c]),
     realized:"USD 1,1000 | GBP 0,8550 | JPY 159,00",
     explanation:"USD faiblement déprécié → forward optimal. GBP apprécié → forward optimal importateur. JPY apprécié → spot meilleur que forward. Stratégie B (couvrir USD+GBP, laisser JPY ouvert) dominante.",optimal:"B"},
  ]},
  2:{name:"Session 2 — Stratégies Avancées",accent:"#f59e0b",rounds:[
    {id:1,title:"Netting entre filiales",subtitle:"Q6 — Optimisation des flux internes",
     context:"Armor possède 3 filiales (France, UK, Allemagne). La DAF veut centraliser et compenser les flux pour réduire les coûts de change.",
     exposition:"Flux trimestriels :\n→ France → UK : 200 000 GBP\n→ Allemagne → France : 250 000 EUR\n→ UK → Allemagne : 180 000 EUR\n→ France → Allemagne : 150 000 EUR",ops_net:120000,
     marketData:[["Spot EUR/GBP","0,8650"],["Coût transaction","0,30 % par transfert"],["Délai règlement","J+2 par transfert"],["Cash pooling","Autorisé"]],
     choices:[{id:"A",icon:"📤",label:"Règlement brut",desc:"4 transferts individuels sans compensation"},{id:"B",icon:"⚖️",label:"Netting bilatéral",desc:"Compensation deux à deux entre filiales"},{id:"C",icon:"♻️",label:"Netting multilatéral",desc:"Centralisation et compensation globale"},{id:"D",icon:"🛡️",label:"Netting + forward résiduel",desc:"Netting puis couverture du solde"}],
     computeHedgeResult:(c)=>{const g=(200000/0.865)+250000+180000+150000;return Math.round(-g*0.003*({A:1.0,B:0.55,C:0.20,D:0.25}[c]));},
     computePertinence:(c)=>({A:20,B:55,C:100,D:80}[c]),
     realized:"Netting multilatéral : 1 transfert résiduel de 44 000 EUR",
     explanation:"Netting multilatéral (C) réduit 4 transactions à 1 position nette : économie de ~75 % des coûts. Principe du cash pooling notionnel. Le forward résiduel (D) ajoute un coût sans gain significatif.",optimal:"C"},
    {id:2,title:"Opportunité d'arbitrage",subtitle:"Q7 — Parité des taux couverte",
     context:"La salle des marchés d'Armor signale une possible opportunité d'arbitrage EUR/USD. La PIT couverte est-elle vérifiée ?",
     exposition:"Capital disponible : 1 000 000 EUR\nHorizon : 1 an",ops_net:180000,
     marketData:[["Spot EUR/USD","1,0850"],["Forward 1 an","1,0620"],["Taux EUR 1 an","3,50 %"],["Taux USD 1 an","5,20 %"],["Coûts transaction","~0,50 %"]],
     choices:[{id:"A",icon:"💱",label:"Arbitrage EUR vers USD",desc:"Emprunt EUR, placement USD, rapatriement forward"},{id:"B",icon:"💱",label:"Arbitrage USD vers EUR",desc:"Sens inverse de A"},{id:"C",icon:"🔺",label:"Arbitrage triangulaire",desc:"EUR vers USD vers CHF vers EUR"},{id:"D",icon:"🚫",label:"Pas d'arbitrage",desc:"PIT vérifiée — marchés en équilibre"}],
     computeHedgeResult:(c)=>({A:-2300,B:-4100,C:-7800,D:0}[c]),
     computePertinence:(c)=>({A:35,B:25,C:15,D:100}[c]),
     realized:"PIT vérifiée : écart brut 0,4 % < coûts de transaction 0,5 %",
     explanation:"(1+3,5 %) = (1/1,085) x 1,052 x 1,062 = 1,031. Écart 0,4 % inférieur aux coûts (~0,5 %). Aucun arbitrage rentable. Ne pas intervenir (D) est la seule décision rationnelle.",optimal:"D"},
    {id:3,title:"Financement international",subtitle:"Q8 — Lever 2 M EUR sur 3 ans",
     context:"Armor doit financer une nouvelle ligne de production. La DAF compare plusieurs sources de financement international pour minimiser le coût.",
     exposition:"Besoin : 2 000 000 EUR\nDurée : 3 ans\nNotation : BBB+",ops_net:200000,
     marketData:[["Crédit syndiqué EUR","4,80 %/an"],["Euro-obligation","4,20 % + frais 1,50 %"],["USD + swap","5,80 % USD - basis swap 1,20 %"],["Convertible","3,10 % + dilution actionnaires"]],
     choices:[{id:"A",icon:"🏦",label:"Crédit syndiqué",desc:"4,80 % — simple et flexible"},{id:"B",icon:"📋",label:"Euro-obligation",desc:"Taux effectif ~4,72 % (frais inclus)"},{id:"C",icon:"💱",label:"USD + swap de devises",desc:"Taux effectif 4,60 %"},{id:"D",icon:"🔄",label:"Obligation convertible",desc:"3,10 % mais dilution actionnaires"}],
     computeHedgeResult:(c)=>{const b=-Math.round(2000000*0.048/4);return b+({A:0,B:400,C:1000,D:8500}[c]);},
     computePertinence:(c)=>({A:60,B:70,C:100,D:85}[c]),
     realized:"Taux effectifs — A:4,80% | B:4,72% | C:4,60% | D:3,10%",
     explanation:"USD+swap (C) offre le meilleur taux sans dilution (4,60 %). La convertible (D) moins chère (3,10 %) mais dilue les actionnaires. Règle : comparer les taux EFFECTIFS toutes charges comprises.",optimal:"C"},
    {id:4,title:"Investissement au Maroc",subtitle:"Q9 — VAN d'un IDE",
     context:"Armor envisage une unité de production à Casablanca. L'évaluation financière requiert une méthodologie rigoureuse en finance internationale.",
     exposition:"Investissement : 10 000 000 MAD\nFlux annuels : +2 500 000 MAD/an\nHorizon : 5 ans",ops_net:250000,
     marketData:[["Spot EUR/MAD","10,85"],["Inflation MAD","+4,5 %/an"],["Inflation EUR","+2,5 %/an"],["PPA à 5 ans","EUR/MAD = 11,94"],["Taux actuali. MAD","8,0 %"],["Prime risque pays","+2,5 %"]],
     choices:[{id:"A",icon:"📊",label:"VAN en MAD (taux 8 %)",desc:"Calcul en MAD, conversion finale en EUR"},{id:"B",icon:"💶",label:"VAN en EUR via PPA (5,5 %)",desc:"Conversion flux MAD en EUR par PPA"},{id:"C",icon:"❌",label:"VAN en EUR taux 8 %",desc:"Cours spot fixe + taux EUR inadapté"},{id:"D",icon:"🎲",label:"Décision qualitative",desc:"Critères stratégiques sans calcul"}],
     computeHedgeResult:(c)=>({A:85000,B:85000,C:-15000,D:0}[c]),
     computePertinence:(c)=>({A:95,B:100,C:25,D:10}[c]),
     realized:"VAN = +9 953 000 MAD soit +917 800 EUR — Projet rentable",
     explanation:"A et B sont équivalents si la PPA tient. Erreur classique (C) : cours spot fixe + taux EUR incompatible avec des flux en MAD. Règle d'or : taux d'actualisation et flux dans la MÊME devise.",optimal:"B"},
    {id:5,title:"Crise de change finale",subtitle:"Q10 — Pays émergent en crise",
     context:"ALERTE : La devise d'un pays partenaire d'Armor s'effondre de -25 % en 48h. Marchés forward gelés. Décision urgente de la DAF.",
     exposition:"Actifs filiale : 8 000 000 devise locale\nCréance export EUR : +500 000 EUR\nDette locale : -2 000 000 devise locale",ops_net:150000,
     marketData:[["Dépréciation","-25 % en 48h"],["Tendance","Poursuite attendue"],["Marché forward","Gelé temporairement"],["Options","Non disponibles"],["Rapatriement","Possible (partiel)"]],
     choices:[{id:"A",icon:"🏃",label:"Rapatrier la trésorerie",desc:"Sortir les liquidités avant dépréciation supp."},{id:"B",icon:"💱",label:"Rembourser la dette locale",desc:"Solder avant que le coût augmente"},{id:"C",icon:"⚡",label:"Stratégie combinée A+B",desc:"Rapatriement + remboursement anticipé"},{id:"D",icon:"⏳",label:"Attendre la stabilisation",desc:"Parier sur un rebond"}],
     computeHedgeResult:(c)=>({A:200000,B:150000,C:350000,D:-80000}[c]),
     computePertinence:(c)=>({A:70,B:65,C:100,D:35}[c]),
     realized:"La devise a encore chuté de -12 % dans les 5 jours suivants",
     explanation:"C optimal : rapatrier protège les actifs (+200k EUR), rembourser évite une charge croissante (+150k EUR). Total +350k EUR. D cause -80k EUR supplémentaires. Quand la tendance est baissière et les marchés gelés, agir immédiatement.",optimal:"C"},
  ]},
};

const getGameState=async()=>{const{data}=await supabase.from("game_state").select("*").eq("id",1).single();return data;};
const setGameState=async(u)=>{await supabase.from("game_state").update({...u,updated_at:new Date().toISOString()}).eq("id",1);};
const getTeams=async()=>{const{data}=await supabase.from("teams").select("*").order("total",{ascending:false});return data||[];};
const upsertTeam=async(t)=>{await supabase.from("teams").upsert(t);};
const getDecisions=async(s,r)=>{const{data}=await supabase.from("decisions").select("*").eq("session",s).eq("round_index",r);return data||[];};
const submitDecisionDB=async(s,r,tid,c)=>{await supabase.from("decisions").upsert({session:s,round_index:r,team_id:tid,choice:c},{onConflict:"session,round_index,team_id"});};
const getPlacements=async(s,r)=>{const{data}=await supabase.from("placements").select("*").eq("session",s).eq("round_index",r);return data||[];};
const submitPlacementDB=async(s,r,tid,c)=>{await supabase.from("placements").upsert({session:s,round_index:r,team_id:tid,choice:c},{onConflict:"session,round_index,team_id"});};

function MarketTable({data}){return(<div style={{background:"rgba(0,0,0,0.45)",borderRadius:8,padding:"10px 14px",fontFamily:"monospace",fontSize:13}}><div style={{color:"#475569",fontSize:10,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:6}}>Données de marché</div>{data.map(([l,v],i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:i<data.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}><span style={{color:"#94a3b8"}}>{l}</span><span style={{color:"#f0f9ff",fontWeight:600}}>{v}</span></div>))}</div>);}

function TreasuryBar({amount}){const ratio=Math.min(1,Math.max(0,amount/(INITIAL_TREASURY*1.6)));const color=amount<MIN_TREASURY?"#ef4444":amount<INITIAL_TREASURY*0.9?"#f59e0b":"#00d4aa";return(<div><div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:13}}><span style={{color:"#475569"}}>Trésorerie Armor</span><span style={{color,fontWeight:800}}>{fmt(amount)}</span></div><div style={{height:5,background:"rgba(255,255,255,0.08)",borderRadius:3}}><div style={{height:5,width:`${ratio*100}%`,background:color,borderRadius:3,transition:"width 0.6s"}}/></div>{amount<MIN_TREASURY&&<div style={{color:"#ef4444",fontSize:11,marginTop:4}}>Sous le seuil 500 000 EUR — pénalité appliquée</div>}</div>);}

function ScoreBadge({score}){const c=score>=90?"#00d4aa":score>=70?"#f59e0b":"#ef4444";return <span style={{color:c,fontWeight:800,fontSize:16}}>{score}<span style={{fontSize:11}}> pts</span></span>;}

function Leaderboard({teams,session,showTreasury=false,finalMode=false}){
  const sk=`score${session}`;
  let sorted;
  if(finalMode){const n=teams.length||1;const byT=[...teams].sort((a,b)=>(b.treasury||0)-(a.treasury||0));sorted=teams.map(t=>{const r=byT.findIndex(x=>x.id===t.id);const ps=Math.round(((t.score_pertinence||0)/1000)*70);const ts=Math.round(((n-r-1)/Math.max(n-1,1))*30);return{...t,finalScore:ps+ts};}).sort((a,b)=>b.finalScore-a.finalScore);}
  else{sorted=[...teams].sort((a,b)=>(b[sk]||0)-(a[sk]||0));}
  const medals=["🥇","🥈","🥉"];
  return(<div><div style={{color:"#e2e8f0",fontWeight:700,fontSize:14,marginBottom:12}}>🏆 {finalMode?"Classement Final (70% pertinence + 30% trésorerie)":SESSIONS[session]?.name}</div>{sorted.map((t,i)=>(<div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 11px",background:i===0?"rgba(0,212,170,0.1)":"rgba(255,255,255,0.03)",borderRadius:9,border:`1px solid ${i===0?"rgba(0,212,170,0.25)":"rgba(255,255,255,0.05)"}`,marginBottom:5}}><span style={{width:22,fontSize:15}}>{medals[i]||`${i+1}`}</span><span style={{flex:1,color:"#e2e8f0",fontWeight:600,fontSize:13}}>{t.name}</span>{showTreasury&&<span style={{color:"#64748b",fontSize:11}}>{fmt(t.treasury||INITIAL_TREASURY)}</span>}{finalMode?<span style={{color:"#00d4aa",fontWeight:800,fontSize:15}}>{t.finalScore}<span style={{fontSize:11}}> pts</span></span>:<ScoreBadge score={t[sk]||0}/>}</div>))}{sorted.length===0&&<div style={{color:"#334155",textAlign:"center",padding:20,fontSize:13}}>En attente des équipes…</div>}</div>);
}

export default function App(){
  const[view,setView]=useState("landing");
  const[gs,setGs]=useState({phase:"lobby",session:1,round_index:0,round_phase:"waiting"});
  const[teams,setTeams]=useState([]);
  const[myTeam,setMyTeam]=useState(null);
  const[myDecision,setMyDecision]=useState(null);
  const[myPlacement,setMyPlacement]=useState(null);
  const[myRoundScore,setMyRoundScore]=useState(null);
  const[myHedgeResult,setMyHedgeResult]=useState(null);
  const[decisions,setDecisions]=useState([]);
  const[placements,setPlacements]=useState([]);
  const[pinInput,setPinInput]=useState("");
  const[teamNameInput,setTeamNameInput]=useState("");
  const[teamPasswordInput,setTeamPasswordInput]=useState("");
  const[pinErr,setPinErr]=useState("");
  const[teamErr,setTeamErr]=useState("");
  const[loading,setLoading]=useState(false);

  useEffect(()=>{(async()=>{const g=await getGameState(),t=await getTeams();if(g)setGs(g);if(t)setTeams(t);const s=localStorage.getItem("fxmanager_team");if(s){const p=JSON.parse(s);setMyTeam(p);setView("team");}})();},[]);

  useEffect(()=>{
    const ch=supabase.channel("fx-v3")
      .on("postgres_changes",{event:"*",schema:"public",table:"game_state"},async()=>{const g=await getGameState();if(g)setGs(g);})
      .on("postgres_changes",{event:"*",schema:"public",table:"teams"},async()=>{const t=await getTeams();if(t)setTeams(t);})
      .on("postgres_changes",{event:"*",schema:"public",table:"decisions"},async()=>{const g=await getGameState();if(g){const d=await getDecisions(g.session,g.round_index);setDecisions(d);}})
      .on("postgres_changes",{event:"*",schema:"public",table:"placements"},async()=>{const g=await getGameState();if(g){const p=await getPlacements(g.session,g.round_index);setPlacements(p);}})
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[]);

  useEffect(()=>{setMyDecision(null);setMyPlacement(null);setMyRoundScore(null);setMyHedgeResult(null);(async()=>{const d=await getDecisions(gs.session,gs.round_index);setDecisions(d);const p=await getPlacements(gs.session,gs.round_index);setPlacements(p);})();},[gs.round_index,gs.session]);

  useEffect(()=>{if(!myTeam||gs.round_phase!=="deciding")return;const d=decisions.find(x=>x.team_id===myTeam.id);const p=placements.find(x=>x.team_id===myTeam.id);if(d)setMyDecision(d.choice);if(p)setMyPlacement(p.choice);},[decisions,placements,myTeam,gs.round_phase]);

  useEffect(()=>{if(gs.round_phase==="revealed"&&myTeam&&myDecision){const r=SESSIONS[gs.session]?.rounds[gs.round_index];if(r){setMyRoundScore(r.computePertinence(myDecision));setMyHedgeResult(r.computeHedgeResult(myDecision));}}},[gs.round_phase,myDecision,gs.session,gs.round_index,myTeam]);

  const teacherLogin=()=>{if(pinInput===TEACHER_PIN){setView("teacher");setPinErr("");}else setPinErr("Code incorrect");};
  const startSession=async(sn)=>{await setGameState({phase:`session${sn}`,session:sn,round_index:0,round_phase:"waiting"});};
  const launchRound=async()=>{await setGameState({round_phase:"deciding"});};

  const revealRound=async()=>{
    const session=SESSIONS[gs.session],round=session.rounds[gs.round_index];
    const decs=await getDecisions(gs.session,gs.round_index),placs=await getPlacements(gs.session,gs.round_index);
    for(const team of teams){
      const hd=decs.find(d=>d.team_id===team.id),pd=placs.find(p=>p.team_id===team.id);
      const hc=hd?.choice||"A",pc=pd?.choice||"cash";
      const hr=round.computeHedgeResult(hc),ps=round.computePertinence(hc);
      const cT=team.treasury??INITIAL_TREASURY,pb=Math.max(0,cT-MIN_TREASURY);
      const pr=PLACEMENT_OPTIONS.find(p=>p.id===pc)?.rate||0;
      const placR=Math.round(pb*pr),penalty=cT<MIN_TREASURY?Math.round(Math.abs(cT)*0.06/4):0;
      const nT=cT+round.ops_net+hr+placR-penalty;
      const sk=`score${gs.session}`;
      await upsertTeam({...team,[sk]:(team[sk]||0)+ps,total:(team.total||0)+ps,score_pertinence:(team.score_pertinence||0)+ps,treasury:nT,last_placement:pc});
    }
    await setGameState({round_phase:"revealed"});
  };

  const nextRound=async()=>{const isLast=gs.round_index>=SESSIONS[gs.session].rounds.length-1;if(isLast){if(gs.session===1)await setGameState({phase:"between",round_phase:"waiting",round_index:0});else await setGameState({phase:"finished",round_phase:"waiting"});}else{await setGameState({round_index:gs.round_index+1,round_phase:"waiting"});}};

  const resetGame=async()=>{await setGameState({phase:"lobby",session:1,round_index:0,round_phase:"waiting"});await supabase.from("teams").delete().neq("id","");await supabase.from("decisions").delete().neq("id",0);await supabase.from("placements").delete().neq("id",0);setTeams([]);setDecisions([]);setPlacements([]);};

  const registerTeam=async()=>{
    if(!teamNameInput.trim()||!teamPasswordInput.trim()){setTeamErr("Remplissez le nom et le mot de passe.");return;}
    setLoading(true);setTeamErr("");
    const name=teamNameInput.trim(),pwd=teamPasswordInput.trim();
    const ex=teams.find(t=>t.name.toLowerCase()===name.toLowerCase());
    if(ex){if(ex.password!==pwd){setTeamErr("Mot de passe incorrect.");setLoading(false);return;}const me={id:ex.id,name:ex.name};localStorage.setItem("fxmanager_team",JSON.stringify(me));setMyTeam(me);setView("team");setLoading(false);return;}
    const id=`t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,5)}`;
    const me={id,name};
    await upsertTeam({id,name,password:pwd,score1:0,score2:0,total:0,score_pertinence:0,treasury:INITIAL_TREASURY,last_placement:"cash"});
    localStorage.setItem("fxmanager_team",JSON.stringify(me));
    setMyTeam(me);const t=await getTeams();setTeams(t);setView("team");setLoading(false);
  };

  const submitDecision=async(c)=>{if(!myTeam||myDecision)return;setMyDecision(c);await submitDecisionDB(gs.session,gs.round_index,myTeam.id,c);};
  const submitPlacement=async(c)=>{if(!myTeam||myPlacement)return;setMyPlacement(c);await submitPlacementDB(gs.session,gs.round_index,myTeam.id,c);};

  const bg={minHeight:"100vh",background:"#06070f",color:"#e2e8f0",fontFamily:"system-ui,sans-serif",margin:0,padding:0};
  const card=(e={})=>({background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:18,...e});
  const btn=(col="#00d4aa",e={})=>({background:col,color:col==="#00d4aa"?"#06070f":"#fff",border:"none",borderRadius:8,padding:"10px 20px",fontWeight:700,fontSize:14,cursor:"pointer",...e});
  const outBtn=(e={})=>({background:"transparent",color:"#64748b",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"10px 20px",fontWeight:600,fontSize:14,cursor:"pointer",...e});
  const inp={background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"10px 14px",color:"#f1f5f9",fontSize:15,width:"100%",boxSizing:"border-box",outline:"none"};

  const curSession=SESSIONS[gs.session],curRound=curSession?.rounds[gs.round_index],accent=curSession?.accent||"#00d4aa";
  const teamCount=teams.length,decCount=decisions.length,placCount=placements.length;
  const myTeamData=teams.find(t=>t.id===myTeam?.id),myTreasury=myTeamData?.treasury??INITIAL_TREASURY,placBase=Math.max(0,myTreasury-MIN_TREASURY);

  if(view==="landing")return(<div style={{...bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}><div style={{maxWidth:440,width:"100%",textAlign:"center"}}><div style={{width:64,height:64,background:"rgba(0,212,170,0.15)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 16px"}}>💹</div><h1 style={{fontSize:34,fontWeight:800,color:"#f8fafc",margin:"0 0 4px",letterSpacing:"-0.03em"}}>FX Manager</h1><p style={{color:"#64748b",margin:"0 0 2px",fontSize:14,fontWeight:700}}>{COMPANY.name}</p><p style={{color:"#1e293b",margin:"0 0 36px",fontSize:12}}>{COMPANY.tag}</p><div style={{display:"flex",flexDirection:"column",gap:10}}><button style={{...btn(),padding:"14px 24px",fontSize:16,borderRadius:12,width:"100%"}} onClick={()=>setView("team-reg")}>🎓 Rejoindre en équipe</button><button style={{...outBtn(),padding:"14px 24px",fontSize:15,borderRadius:12,width:"100%"}} onClick={()=>setView("teacher-login")}>👨‍🏫 Espace Professeur</button><button style={{...outBtn(),padding:"12px 24px",fontSize:14,borderRadius:12,width:"100%"}} onClick={()=>setView("leaderboard")}>🏆 Classement en direct</button></div><p style={{color:"#0f172a",fontSize:12,marginTop:24}}>IAE Bretagne Sud - Finance Internationale L3</p></div></div>);

  if(view==="teacher-login")return(<div style={{...bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}><div style={{...card(),maxWidth:360,width:"100%"}}><h2 style={{margin:"0 0 20px",fontSize:18,color:"#f1f5f9"}}>🔐 Accès Professeur</h2><input style={inp} type="password" placeholder="Code d'accès" value={pinInput} onChange={e=>setPinInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&teacherLogin()} autoFocus/>{pinErr&&<p style={{color:"#ef4444",fontSize:13,margin:"8px 0 0"}}>{pinErr}</p>}<div style={{display:"flex",gap:10,marginTop:16}}><button style={btn()} onClick={teacherLogin}>Connexion</button><button style={outBtn()} onClick={()=>setView("landing")}>Retour</button></div></div></div>);

  if(view==="team-reg")return(<div style={{...bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}><div style={{...card(),maxWidth:400,width:"100%"}}><div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:32,marginBottom:6}}>💹</div><h2 style={{margin:"0 0 2px",color:"#f1f5f9",fontSize:18}}>FX Manager</h2><p style={{color:"#475569",margin:0,fontSize:12}}>Trésorier de {COMPANY.name}</p></div><div style={{display:"flex",flexDirection:"column",gap:12}}><div><div style={{color:"#475569",fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>Nom de l'équipe</div><input style={inp} placeholder="Ex: Team Alpha, Les Requins..." value={teamNameInput} onChange={e=>setTeamNameInput(e.target.value)} autoFocus/></div><div><div style={{color:"#475569",fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>Mot de passe</div><input style={inp} type="password" placeholder="Choisissez un mot de passe" value={teamPasswordInput} onChange={e=>setTeamPasswordInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&registerTeam()}/></div>{teamErr&&<p style={{color:"#ef4444",fontSize:12,margin:0}}>{teamErr}</p>}<p style={{color:"#1e293b",fontSize:11,margin:0}}>Si votre équipe existe déjà, utilisez le même nom + mot de passe pour vous reconnecter.</p></div><div style={{display:"flex",gap:10,marginTop:16}}><button style={{...btn(),flex:1,opacity:loading?0.6:1}} onClick={registerTeam} disabled={loading}>{loading?"Connexion...":"Rejoindre le jeu"}</button><button style={outBtn()} onClick={()=>setView("landing")}>Retour</button></div></div></div>);

  if(view==="teacher"){
    const phase=gs.phase,rp=gs.round_phase;
    return(<div style={{...bg,paddingBottom:40}}>
      <div style={{background:"rgba(0,0,0,0.6)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span>💹</span><span style={{fontWeight:700,color:"#f1f5f9",fontSize:14}}>{COMPANY.name}</span><span style={{background:"rgba(0,212,170,0.15)",color:"#00d4aa",borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700}}>PROF</span></div>
        <div style={{display:"flex",gap:8}}><button style={{...outBtn(),padding:"5px 12px",fontSize:12}} onClick={()=>setView("leaderboard")}>🏆</button><button style={{...outBtn(),padding:"5px 12px",fontSize:12,color:"#ef4444",borderColor:"rgba(239,68,68,0.25)"}} onClick={resetGame}>↺ Reset</button></div>
      </div>
      <div style={{padding:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,maxWidth:1100,margin:"0 auto"}}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={card()}>
            <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
              {[["Équipes",teamCount,"#00d4aa"],["Couvertures",`${decCount}/${teamCount}`,"#00d4aa"],["Placements",`${placCount}/${teamCount}`,"#3b82f6"],["Round",phase.startsWith("session")?`${gs.round_index+1}/5`:"—","#94a3b8"]].map(([l,v,c])=>(<div key={l} style={{background:"rgba(0,0,0,0.4)",borderRadius:8,padding:"8px 12px",flex:1,minWidth:60}}><div style={{fontSize:9,color:"#475569",textTransform:"uppercase",letterSpacing:"0.1em"}}>{l}</div><div style={{fontSize:17,fontWeight:800,color:c,marginTop:2}}>{v}</div></div>))}
            </div>
            {phase==="lobby"&&<div><p style={{color:"#64748b",fontSize:13,margin:"0 0 8px"}}>Trésorerie initiale : {fmt(INITIAL_TREASURY)} par équipe. Classement final : 70% pertinence + 30% trésorerie.</p><button style={{...btn(),width:"100%",padding:12}} onClick={()=>startSession(1)}>▶ Démarrer Session 1</button></div>}
            {(phase==="session1"||phase==="session2")&&curRound&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {rp==="waiting"&&<button style={{...btn(accent),width:"100%",padding:12}} onClick={launchRound}>▶ Lancer Round {gs.round_index+1} — {curRound.title}</button>}
              {rp==="deciding"&&<><div style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:8,padding:10,fontSize:13,color:"#f59e0b"}}>⏱️ Couvertures : {decCount}/{teamCount} · Placements : {placCount}/{teamCount}</div><button style={{...btn("#f59e0b"),width:"100%",padding:12}} onClick={revealRound}>🔓 Révéler les résultats</button></>}
              {rp==="revealed"&&<><div style={{background:"rgba(0,212,170,0.08)",border:"1px solid rgba(0,212,170,0.2)",borderRadius:8,padding:12}}><div style={{color:"#00d4aa",fontWeight:700,marginBottom:4}}>{curRound.realized}</div><div style={{color:"#64748b",fontSize:12,lineHeight:1.6}}>{curRound.explanation}</div></div><button style={{...btn(accent),width:"100%",padding:12}} onClick={nextRound}>{gs.round_index<4?`▶ Round ${gs.round_index+2}`:phase==="session1"?"✓ Fin Session 1":"🏁 Terminer le jeu"}</button></>}
            </div>}
            {phase==="between"&&<div><div style={{color:"#00d4aa",marginBottom:12,fontSize:14}}>✅ Session 1 terminée. Faites le débrief puis lancez la Session 2.</div><button style={{...btn("#f59e0b"),width:"100%",padding:12}} onClick={()=>startSession(2)}>▶ Démarrer Session 2</button></div>}
            {phase==="finished"&&<div style={{textAlign:"center",padding:16,color:"#00d4aa",fontWeight:700,fontSize:18}}>🏆 Jeu terminé !</div>}
          </div>
          {(rp==="deciding"||rp==="revealed")&&<div style={card()}><div style={{color:"#475569",fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Décisions des équipes</div><div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:260,overflowY:"auto"}}>{teams.map(t=>{const dec=decisions.find(d=>d.team_id===t.id);const plac=placements.find(p=>p.team_id===t.id);const sc=rp==="revealed"&&dec&&curRound?curRound.computePertinence(dec.choice):null;return(<div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 9px",background:"rgba(0,0,0,0.3)",borderRadius:6,fontSize:12}}><span style={{color:"#cbd5e1",flex:1,fontSize:11}}>{t.name}</span><div style={{display:"flex",gap:5,alignItems:"center"}}>{dec?<span style={{background:"rgba(0,212,170,0.15)",color:"#00d4aa",borderRadius:4,padding:"1px 6px",fontWeight:700,fontSize:11}}>H:{dec.choice}</span>:<span style={{color:"#1e293b",fontSize:10}}>...</span>}{plac?<span style={{background:"rgba(59,130,246,0.15)",color:"#3b82f6",borderRadius:4,padding:"1px 6px",fontWeight:700,fontSize:11}}>{PLACEMENT_OPTIONS.find(p=>p.id===plac.choice)?.shortLabel}</span>:<span style={{color:"#1e293b",fontSize:10}}>...</span>}{sc!==null&&<ScoreBadge score={sc}/>}</div></div>);})}</div></div>}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {curRound&&(phase==="session1"||phase==="session2")&&<div style={card()}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}><div><div style={{color:"#334155",fontSize:10,textTransform:"uppercase",marginBottom:2}}>{curSession.name} · Round {gs.round_index+1}/5</div><div style={{color:"#f1f5f9",fontWeight:700,fontSize:15}}>{curRound.title}</div><div style={{color:"#475569",fontSize:12}}>{curRound.subtitle}</div></div><div style={{background:"rgba(0,212,170,0.1)",borderRadius:6,padding:"4px 10px",fontSize:11,color:"#00d4aa",fontWeight:700}}>Flux ops: +{fmt(curRound.ops_net)}</div></div><p style={{color:"#64748b",fontSize:12,margin:"0 0 8px",lineHeight:1.5}}>{curRound.context}</p><div style={{background:"rgba(0,212,170,0.05)",border:"1px solid rgba(0,212,170,0.1)",borderRadius:8,padding:"7px 10px",fontFamily:"monospace",fontSize:12,color:"#94a3b8",whiteSpace:"pre-line",marginBottom:8}}>{curRound.exposition}</div><MarketTable data={curRound.marketData}/></div>}
          <div style={card()}><Leaderboard teams={teams} session={gs.session} showTreasury={rp==="revealed"||phase==="between"||phase==="finished"} finalMode={phase==="finished"}/></div>
        </div>
      </div>
    </div>);
  }

  if(view==="team"&&myTeam){
    const phase=gs.phase,rp=gs.round_phase,ms1=myTeamData?.score1||0,ms2=myTeamData?.score2||0;
    return(<div style={{...bg,paddingBottom:40}}>
      <div style={{background:"rgba(0,0,0,0.6)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
        <div><div style={{fontWeight:700,color:"#f1f5f9",fontSize:13}}>{myTeam.name}</div><div style={{color:"#334155",fontSize:10}}>{COMPANY.name}</div></div>
        <div style={{textAlign:"right"}}><div style={{color:myTreasury<MIN_TREASURY?"#ef4444":myTreasury<INITIAL_TREASURY?"#f59e0b":"#00d4aa",fontWeight:800,fontSize:14}}>{fmt(myTreasury)}</div><div style={{color:"#334155",fontSize:10}}>Trésorerie</div></div>
      </div>
      <div style={{padding:16,maxWidth:600,margin:"0 auto"}}>
        {phase==="lobby"&&<div style={{textAlign:"center",padding:"40px 16px"}}><div style={{fontSize:44,marginBottom:10}}>⏳</div><h2 style={{color:"#e2e8f0",margin:"0 0 6px"}}>En attente du démarrage</h2><p style={{color:"#334155",fontSize:13,marginBottom:20}}>Le professeur va lancer la partie...</p><div style={card({textAlign:"left",marginBottom:12})}><div style={{color:"#00d4aa",fontWeight:700,marginBottom:4,fontSize:14}}>🏢 {COMPANY.name}</div><div style={{color:"#475569",fontSize:12,marginBottom:10}}>{COMPANY.tag}</div><TreasuryBar amount={myTreasury}/><div style={{marginTop:12,padding:"8px 10px",background:"rgba(0,212,170,0.05)",borderRadius:8,fontSize:12,color:"#475569",lineHeight:1.6}}><strong style={{color:"#94a3b8"}}>Mission :</strong> gérer la trésorerie d'Armor sur 10 trimestres. Chaque round = couverture + placement. Classement final : 70% pertinence + 30% trésorerie finale.</div></div><div style={card({textAlign:"left"})}><div style={{color:"#334155",fontSize:11,textTransform:"uppercase",marginBottom:8}}>Équipes connectées ({teamCount})</div>{teams.map(t=><div key={t.id} style={{color:"#64748b",fontSize:13,padding:"2px 0"}}>👥 {t.name}</div>)}</div></div>}

        {(phase==="session1"||phase==="session2")&&rp==="waiting"&&<div style={{textAlign:"center",padding:"40px 16px"}}><div style={{fontSize:36,marginBottom:10}}>⏸️</div><div style={{color:"#475569",fontSize:12,textTransform:"uppercase",marginBottom:4}}>{curSession?.name}</div><h2 style={{color:"#e2e8f0",margin:"0 0 6px"}}>Round {gs.round_index+1}/5</h2><p style={{color:"#334155",fontSize:13,marginBottom:16}}>Le professeur prépare le prochain round...</p><div style={card()}><TreasuryBar amount={myTreasury}/></div></div>}

        {(phase==="session1"||phase==="session2")&&rp==="deciding"&&curRound&&<div>
          <div style={{marginBottom:12}}><div style={{color:"#334155",fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:2}}>{curSession.name} · Round {gs.round_index+1}/5</div><h2 style={{color:"#f1f5f9",margin:"0 0 2px",fontSize:18,fontWeight:800}}>{curRound.title}</h2><div style={{color:"#475569",fontSize:12}}>{curRound.subtitle}</div></div>
          <div style={card({marginBottom:10})}><p style={{color:"#94a3b8",fontSize:13,margin:"0 0 8px",lineHeight:1.5}}>{curRound.context}</p><div style={{background:"rgba(0,212,170,0.05)",border:"1px solid rgba(0,212,170,0.1)",borderRadius:8,padding:"7px 10px",fontFamily:"monospace",fontSize:12,color:"#64748b",whiteSpace:"pre-line",marginBottom:8}}>{curRound.exposition}</div><MarketTable data={curRound.marketData}/><div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:12}}><span style={{color:"#475569"}}>Flux opérationnels ce trimestre</span><span style={{color:"#00d4aa",fontWeight:700}}>+{fmt(curRound.ops_net)}</span></div></div>

          <div style={{color:"#e2e8f0",fontSize:12,fontWeight:600,marginBottom:6}}>① Décision de couverture du risque de change</div>
          {myDecision?(<div style={{...card({background:"rgba(0,212,170,0.06)",borderColor:"rgba(0,212,170,0.2)",textAlign:"center",marginBottom:14})}}><div style={{color:"#00d4aa",fontWeight:700}}>✅ Option {myDecision} — {curRound.choices.find(c=>c.id===myDecision)?.label}</div></div>):(<div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>{curRound.choices.map(c=>(<button key={c.id} onClick={()=>submitDecision(c.id)} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",textAlign:"left",width:"100%"}}><span style={{background:"rgba(0,0,0,0.5)",borderRadius:6,padding:"2px 9px",fontWeight:800,color:accent,fontSize:14,minWidth:26,textAlign:"center"}}>{c.id}</span><div><div style={{fontWeight:700,fontSize:13,color:"#e2e8f0",marginBottom:1}}>{c.icon} {c.label}</div><div style={{color:"#475569",fontSize:12}}>{c.desc}</div></div></button>))}</div>)}

          {myDecision&&<><div style={{color:"#e2e8f0",fontSize:12,fontWeight:600,marginBottom:6}}>② Placement de la trésorerie disponible</div>
          <div style={card({marginBottom:10})}><TreasuryBar amount={myTreasury}/><div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:12}}><span style={{color:"#475569"}}>Montant plaçable (hors réserve 500k EUR)</span><span style={{color:"#3b82f6",fontWeight:700}}>{fmt(placBase)}</span></div></div>
          {myPlacement?(<div style={{...card({background:"rgba(59,130,246,0.07)",borderColor:"rgba(59,130,246,0.2)",textAlign:"center"})}}><div style={{color:"#3b82f6",fontWeight:700}}>{PLACEMENT_OPTIONS.find(p=>p.id===myPlacement)?.icon} {PLACEMENT_OPTIONS.find(p=>p.id===myPlacement)?.label}</div>{placBase>0&&<div style={{color:"#475569",fontSize:12,marginTop:3}}>Rendement estimé : +{fmt(Math.round(placBase*(PLACEMENT_OPTIONS.find(p=>p.id===myPlacement)?.rate||0)))}</div>}</div>):(<div style={{display:"flex",flexDirection:"column",gap:6}}>{PLACEMENT_OPTIONS.map(p=>(<button key={p.id} onClick={()=>submitPlacement(p.id)} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"11px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",width:"100%"}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>{p.icon}</span><div style={{textAlign:"left"}}><div style={{fontWeight:700,fontSize:13,color:"#e2e8f0"}}>{p.label}</div><div style={{color:"#475569",fontSize:11}}>Risque : {p.risk} · {(p.rate*400).toFixed(2)} %/trim.</div></div></div><div style={{textAlign:"right"}}><div style={{color:p.color,fontWeight:700,fontSize:13}}>{p.rate>0?"+"+fmt(Math.round(placBase*p.rate)):"0 EUR"}</div><div style={{color:"#334155",fontSize:10}}>estimé</div></div></button>))}</div>)}
          {myDecision&&myPlacement&&<p style={{color:"#1e293b",fontSize:12,textAlign:"center",marginTop:12}}>✅ Décisions soumises — en attente du professeur...</p>}</>}
        </div>}

        {(phase==="session1"||phase==="session2")&&rp==="revealed"&&curRound&&<div>
          <h2 style={{color:"#f1f5f9",margin:"0 0 12px",fontSize:17}}>📊 Résultats — {curRound.title}</h2>
          <div style={card({marginBottom:10})}><div style={{color:"#475569",fontSize:11,textTransform:"uppercase",marginBottom:10}}>Variation trésorerie ce trimestre</div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:"#475569"}}>+ Flux opérationnels</span><span style={{color:"#64748b",fontWeight:600}}>+{fmt(curRound.ops_net)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:"#475569"}}>{(myHedgeResult||0)>=0?"+ Résultat couverture":"- Coût couverture"}</span><span style={{color:"#00d4aa",fontWeight:600}}>{(myHedgeResult||0)>=0?"+":""}{fmt(myHedgeResult||0)}</span></div>
            {myPlacement&&placBase>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:"#475569"}}>+ Retour placement ({PLACEMENT_OPTIONS.find(p=>p.id===myPlacement)?.shortLabel})</span><span style={{color:"#3b82f6",fontWeight:600}}>+{fmt(Math.round(placBase*(PLACEMENT_OPTIONS.find(p=>p.id===myPlacement)?.rate||0)))}</span></div>}
            <div style={{borderTop:"1px solid rgba(255,255,255,0.08)",marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between"}}><span style={{color:"#e2e8f0",fontWeight:700}}>Nouvelle trésorerie</span><span style={{color:myTreasury>=INITIAL_TREASURY?"#00d4aa":myTreasury<MIN_TREASURY?"#ef4444":"#f59e0b",fontWeight:800,fontSize:16}}>{fmt(myTreasury)}</span></div>
          </div></div>
          {myDecision&&myRoundScore!==null&&<div style={card({background:myRoundScore>=90?"rgba(0,212,170,0.08)":myRoundScore>=70?"rgba(245,158,11,0.08)":"rgba(239,68,68,0.08)",borderColor:myRoundScore>=90?"rgba(0,212,170,0.25)":myRoundScore>=70?"rgba(245,158,11,0.25)":"rgba(239,68,68,0.25)",marginBottom:10})}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><div><div style={{color:"#64748b",fontSize:11}}>Score de pertinence</div><div style={{color:"#e2e8f0",fontWeight:700,fontSize:13}}>{curRound.choices.find(c=>c.id===myDecision)?.icon} Option {myDecision} — {curRound.choices.find(c=>c.id===myDecision)?.label}</div></div><ScoreBadge score={myRoundScore}/></div><div style={{fontSize:12,color:"#475569"}}>{myRoundScore>=90?"🎯 Excellent !":myRoundScore>=70?"👍 Bon choix":myRoundScore>=50?"📚 Acceptable":"❌ Sous-optimal"}{curRound.optimal!==myDecision&&` — Optimal : Option ${curRound.optimal} (${curRound.choices.find(c=>c.id===curRound.optimal)?.label})`}</div></div>}
          <div style={card({background:"rgba(0,0,0,0.4)",marginBottom:10})}><div style={{color:accent,fontWeight:700,marginBottom:4}}>📰 {curRound.realized}</div><div style={{color:"#64748b",fontSize:13,lineHeight:1.7}}>{curRound.explanation}</div></div>
          <div style={card()}><Leaderboard teams={teams} session={gs.session} showTreasury/></div>
          <p style={{color:"#1e293b",fontSize:12,textAlign:"center",marginTop:12}}>En attente du prochain round...</p>
        </div>}

        {phase==="between"&&<div style={{textAlign:"center",padding:"30px 0"}}><div style={{fontSize:40,marginBottom:10}}>☕</div><h2 style={{color:"#e2e8f0",margin:"0 0 4px"}}>Session 1 terminée !</h2><p style={{color:"#334155",fontSize:13,marginBottom:16}}>Débrief en cours avec le professeur...</p><div style={card({marginBottom:14})}><div style={{display:"flex",justifyContent:"space-around"}}>{[["Score pertinence",`${ms1} pts`,"#00d4aa"],["Trésorerie",fmt(myTreasury),"#f59e0b"]].map(([l,v,c])=>(<div key={l}><div style={{color:"#334155",fontSize:11}}>{l}</div><div style={{fontSize:16,fontWeight:800,color:c,marginTop:2}}>{v}</div></div>))}</div></div><div style={card()}><Leaderboard teams={teams} session={1} showTreasury/></div></div>}

        {phase==="finished"&&<div style={{padding:"20px 0"}}><div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:48,marginBottom:8}}>🏆</div><h2 style={{color:"#f1f5f9",margin:"0 0 4px"}}>Jeu terminé !</h2><p style={{color:"#334155",fontSize:13}}>Classement final : 70% pertinence + 30% trésorerie</p></div><div style={card({marginBottom:12})}><div style={{display:"flex",justifyContent:"space-around"}}>{[["S1",`${ms1} pts`,"#00d4aa"],["S2",`${ms2} pts`,"#f59e0b"],["Trésorerie",fmt(myTreasury),"#e2e8f0"]].map(([l,v,c])=>(<div key={l} style={{textAlign:"center"}}><div style={{color:"#334155",fontSize:11}}>{l}</div><div style={{fontSize:15,fontWeight:800,color:c,marginTop:2}}>{v}</div></div>))}</div></div><div style={card()}><Leaderboard teams={teams} session={2} showTreasury finalMode/></div></div>}
      </div>
    </div>);
  }

  if(view==="leaderboard")return(<div style={{...bg,padding:24}}><div style={{maxWidth:560,margin:"0 auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div><span style={{fontSize:18}}>💹</span> <span style={{fontWeight:700,color:"#f1f5f9"}}>FX Manager</span></div><button style={{...outBtn(),padding:"6px 14px",fontSize:12}} onClick={()=>setView("landing")}>← Accueil</button></div><div style={card({marginBottom:12})}><Leaderboard teams={teams} session={gs.phase==="session2"||gs.phase==="finished"?2:1} showTreasury finalMode={gs.phase==="finished"}/></div><p style={{color:"#1e293b",fontSize:12,textAlign:"center"}}>Mis à jour en temps réel</p></div></div>);

  return <div style={{...bg,padding:24,color:"#334155"}}>Chargement...</div>;
}
