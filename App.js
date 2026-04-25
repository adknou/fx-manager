import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

const TEACHER_PIN = "PROF2024";
const INITIAL_TREASURY = 5000000;
const MIN_TREASURY = 500000;
const ROUND_DURATION = 20 * 60; // 20 minutes en secondes
const fmt = (n) => new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n);

const PLACEMENT_OPTIONS = [
  {id:"none", icon:"💶",label:"Aucun placement",      shortLabel:"Aucun", rate:0,       risk:"Nul",   color:"#475569"},
  {id:"mm",   icon:"🏦",label:"Marché monétaire",     shortLabel:"MM",    rate:0.012,   risk:"Nul",   color:"#00d4aa"},
  {id:"index",icon:"📈",label:"Indice boursier",      shortLabel:"Indice",rate:null,    risk:"Élevé", color:"#f59e0b"},
];

// Séquence prédéfinie des états boursiers : 2 hausses, 3 stables, 5 baisses
const MARKET_STATES = [
  {state:"baisse",label:"📉 Baisse",rate:-0.06,color:"#ef4444"},
  {state:"stable",label:"➡️ Stable",rate:0.005,color:"#94a3b8"},
  {state:"hausse",label:"📈 Hausse",rate:0.04, color:"#00d4aa"},
  {state:"baisse",label:"📉 Baisse",rate:-0.06,color:"#ef4444"},
  {state:"stable",label:"➡️ Stable",rate:0.005,color:"#94a3b8"},
  {state:"baisse",label:"📉 Baisse",rate:-0.06,color:"#ef4444"},
  {state:"hausse",label:"📈 Hausse",rate:0.04, color:"#00d4aa"},
  {state:"stable",label:"➡️ Stable",rate:0.005,color:"#94a3b8"},
  {state:"baisse",label:"📉 Baisse",rate:-0.06,color:"#ef4444"},
];

const COMPANY = {name:"Armor International SA", tag:"Équipements industriels · Lorient, Bretagne"};

const SESSIONS = {
  1:{name:"Session 1 — Fondamentaux",accent:"#00d4aa",rounds:[
    {id:1,title:"Contrat américain",subtitle:"Q1 — Créance export USD",
     context:"Armor vient de livrer une commande à un client américain. Paiement de 500 000 USD attendu dans 90 jours. Date de signature du contrat commercial : aujourd'hui. Vous avez 15 jours pour souscrire une assurance change BPI si vous le souhaitez.",
     exposition:"Créance : +500 000 USD\nÉchéance : 90 jours\nContrat signé : aujourd'hui (BPI ≤ J+15)",
     ops_net:-620000, hasCommercialContract:true, isAO:false, currency:"USD", amount:500000, isExport:true,
     marketData:{
       spotBid:[["Banque Crédit Ouest","1,0842"],["Banque Atlantique","1,0838"]],
       spotAsk:[["Banque Crédit Ouest","1,0858"],["Banque Atlantique","1,0862"]],
       fwdBid90:[["Banque Crédit Ouest","1,0912"],["Banque Atlantique","1,0908"]],
       fwdAsk90:[["Banque Crédit Ouest","1,0928"],["Banque Atlantique","1,0932"]],
       mmBorrow:"3,50 %/an (EUR)",mmLend:"5,20 %/an (USD)",
       bpiContrat:"Cours garanti : 1,0900 — Prime : 1,8 % — Délai max : J+15",
       bpiNego:null,
       escompteClient:null, penaliteClient:null,
       escompteFournisseur:null, penaliteFournisseur:null,
     },
     computeHedgeResult:(instrument,banque,montant)=>{
       const m=Math.min(montant,500000);
       const rates={fwdCO:1.0920,fwdATL:1.0908,mm:1.0915,bpi:1.0900,spot:1.1050,none:1.1050};
       const r={forward_CO:Math.round(m/rates.fwdCO),forward_ATL:Math.round(m/rates.fwdATL),mm:Math.round(m/rates.mm),bpi_contrat:Math.round(m/rates.bpi*(1-0.018)),none:Math.round(m/rates.none)};
       return r[instrument]||Math.round(m/rates.none);
     },
     computePertinence:(instrument,montant)=>{
       if(montant<=0)return 0;
       if(instrument==="bpi_nego")return 0; // impertinent
       if(instrument==="none")return 30;
       if(instrument==="forward_CO"||instrument==="forward_ATL")return 100;
       if(instrument==="mm")return 85;
       if(instrument==="bpi_contrat")return 90;
       return 50;
     },
     realized:"EUR/USD réalisé : 1,1050 — Dollar déprécié",
     explanation:"Forward Crédit Ouest (1,0920) optimal : 457 875 €. BPI contrat quasi-équivalent après prime. Marché monétaire bon mais plus complexe. Sans couverture : 452 489 € — le dollar s'est déprécié, la couverture était justifiée.",
     optimal:"forward_CO"},
    {id:2,title:"Matières premières UK",subtitle:"Q2 — Dette import GBP",
     context:"Armor règle son fournisseur britannique. Facture de 300 000 GBP payable dans 60 jours. Le fournisseur propose un escompte de 0,8% pour paiement immédiat, ou accepte un délai de 90j contre une pénalité de 1,2%.",
     exposition:"Dette : −300 000 GBP\nÉchéance : 60 jours\nContrat signé : il y a 20 jours (BPI hors délai J+15)",
     ops_net:-890000, hasCommercialContract:true, isAO:false, currency:"GBP", amount:300000, isExport:false,
     marketData:{
       spotBid:[["Banque Crédit Ouest","0,8643"],["Banque Atlantique","0,8647"]],
       spotAsk:[["Banque Crédit Ouest","0,8657"],["Banque Atlantique","0,8653"]],
       fwdBid60:[["Banque Crédit Ouest","0,8612"],["Banque Atlantique","0,8616"]],
       fwdAsk60:[["Banque Crédit Ouest","0,8628"],["Banque Atlantique","0,8624"]],
       mmBorrow:"3,50 %/an (EUR)",mmLend:"5,00 %/an (GBP)",
       bpiContrat:"Hors délai — contrat signé il y a 20 jours (max J+15)",
       bpiNego:null,
       escompteFournisseur:"0,8 % pour paiement immédiat",
       penaliteFournisseur:"1,2 % pour paiement à 90j",
       escompteClient:null, penaliteClient:null,
     },
     computeHedgeResult:(instrument,banque,montant)=>{
       const m=Math.min(montant,300000);
       const realized=0.8580;
       const r={
         forward_CO:-Math.round(m/0.8628),forward_ATL:-Math.round(m/0.8624),
         mm:-Math.round(m/0.8628)-500,none:-Math.round(m/realized),
         escompte_fournisseur:-Math.round((m/0.8650)*(1-0.008)),
         penalite_fournisseur:-Math.round((m/0.8580)*(1+0.012)),
       };
       return r[instrument]||(-Math.round(m/realized));
     },
     computePertinence:(instrument,montant)=>{
       if(montant<=0)return 0;
       if(instrument==="bpi_nego"||instrument==="bpi_contrat")return 0;
       if(instrument==="none")return 40;
       if(instrument==="forward_ATL")return 100;
       if(instrument==="forward_CO")return 95;
       if(instrument==="mm")return 85;
       if(instrument==="escompte_fournisseur")return 75;
       if(instrument==="penalite_fournisseur")return 20;
       return 50;
     },
     realized:"EUR/GBP réalisé : 0,8580 — Livre appréciée",
     explanation:"Forward Atlantique (0,8624) optimal : 348 205 €. BPI hors délai (contrat signé il y a 20j). L'escompte fournisseur (paiement immédiat) coûte 2 772 € de remise mais évite le risque de change — pertinent. La pénalité 90j est la pire option.",
     optimal:"forward_ATL"},
    {id:3,title:"Contrat japonais",subtitle:"Q3 — Créance export JPY",
     context:"Armor encaisse 80 000 000 JPY dans 6 mois. Différentiel de taux EUR/JPY exceptionnel. Contrat signé aujourd'hui — BPI disponible.",
     exposition:"Créance : +80 000 000 JPY\nÉchéance : 6 mois\nContrat signé : aujourd'hui (BPI ≤ J+15)",
     ops_net:-780000, hasCommercialContract:true, isAO:false, currency:"JPY", amount:80000000, isExport:true,
     marketData:{
       spotBid:[["Banque Crédit Ouest","162,25"],["Banque Atlantique","162,30"]],
       spotAsk:[["Banque Crédit Ouest","162,55"],["Banque Atlantique","162,50"]],
       fwdBid180:[["Banque Crédit Ouest","160,05"],["Banque Atlantique","160,10"]],
       fwdAsk180:[["Banque Crédit Ouest","160,35"],["Banque Atlantique","160,30"]],
       mmBorrow:"3,50 %/an (EUR)",mmLend:"0,10 %/an (JPY)",
       bpiContrat:"Cours garanti : 160,00 — Prime : 1,5 % — Délai max : J+15",
       bpiNego:null,
       escompteClient:"0,5 % pour paiement à 3 mois (au lieu de 6)",
       penaliteClient:null, escompteFournisseur:null, penaliteFournisseur:null,
     },
     computeHedgeResult:(instrument,banque,montant)=>{
       const m=Math.min(montant,80000000);
       const prime=Math.round(m/162.40*0.015);
       const r={
         forward_CO:Math.round(m/160.35),forward_ATL:Math.round(m/160.30),
         mm:Math.round(m/160.50),bpi_contrat:Math.round(m/160.00)-prime,
         none:Math.round(m/168.50),
         escompte_client:Math.round((m*0.995)/162.40),
       };
       return r[instrument]||Math.round(m/168.50);
     },
     computePertinence:(instrument,montant)=>{
       if(montant<=0)return 0;
       if(instrument==="bpi_nego")return 0;
       if(instrument==="none")return 40;
       if(instrument==="forward_ATL")return 100;
       if(instrument==="forward_CO")return 95;
       if(instrument==="mm")return 60;
       if(instrument==="bpi_contrat")return 85;
       if(instrument==="escompte_client")return 55;
       return 50;
     },
     realized:"EUR/JPY réalisé : 168,50 — Yen déprécié",
     explanation:"Forward Atlantique (160,30) optimal : 499 376 €. PIT en action : taux JPY 0,1% vs EUR 3,5% génère un report favorable. Le marché monétaire est moins attractif car placer en JPY rapporte quasi rien. BPI contrat : 498 000 € net de prime.",
     optimal:"forward_ATL"},
    {id:4,title:"Besoin de liquidité immédiat",subtitle:"Q4 — Swap de change EUR/USD",
     context:"Armor doit régler un fournisseur européen de 2 800 000 € aujourd'hui mais sa trésorerie est basse. Elle détient une créance de 2 000 000 USD encaissable dans 30 jours. La solution optimale est un swap de change : vente spot USD contre EUR aujourd'hui + rachat à terme dans 30 jours.",
     exposition:"Créance : +2 000 000 USD dans 30j\nBesoin : −2 800 000 EUR aujourd'hui",
     ops_net:-2800000, hasCommercialContract:true, isAO:false, currency:"USD", amount:2000000, isExport:true,
     marketData:{
       spotBid:[["Banque Crédit Ouest","1,0845"],["Banque Atlantique","1,0848"]],
       spotAsk:[["Banque Crédit Ouest","1,0855"],["Banque Atlantique","1,0852"]],
       fwdBid30:[["Banque Crédit Ouest","1,0872"],["Banque Atlantique","1,0875"]],
       fwdAsk30:[["Banque Crédit Ouest","1,0882"],["Banque Atlantique","1,0879"]],
       swapChange:"Vente spot 2M USD à 1,0845 → +1 844 191 EUR aujourd'hui\nRachat à terme 30j à 1,0882 → −1 837 898 EUR\nCoût net swap : −6 293 EUR (vs risque change ouvert)",
       mmBorrow:"3,50 %/an (EUR)",mmLend:"5,20 %/an (USD)",
       bpiContrat:"Cours garanti : 1,0860 — Prime : 1,5 %",
       bpiNego:null, escompteClient:null, penaliteClient:null,
       escompteFournisseur:null, penaliteFournisseur:null,
     },
     computeHedgeResult:(instrument,banque,montant)=>{
       const m=Math.min(montant,2000000);
       const r={
         swap_change:Math.round(m/1.0845)-Math.round(m/1.0882)+Math.round(m/1.0875),
         forward_CO:Math.round(m/1.0882),forward_ATL:Math.round(m/1.0879),
         none:Math.round(m/1.1050),bpi_contrat:Math.round(m/1.0860*(1-0.015)),
       };
       return r[instrument]||Math.round(m/1.1050);
     },
     computePertinence:(instrument,montant)=>{
       if(montant<=0)return 0;
       if(instrument==="bpi_nego")return 0;
       if(instrument==="swap_change")return 100;
       if(instrument==="forward_CO"||instrument==="forward_ATL")return 70;
       if(instrument==="mm")return 60;
       if(instrument==="none")return 20;
       return 40;
     },
     realized:"EUR/USD réalisé : 1,1050 — Swap de change optimal",
     explanation:"Le swap de change (100 pts) permet à Armor d'obtenir les EUR immédiatement grâce à la vente spot USD, tout en sécurisant le rachat à terme pour honorer la créance. Coût net : 6 293 € seulement. Le forward simple (70 pts) ne résout pas le besoin de liquidité immédiat.",
     optimal:"swap_change"},
    {id:5,title:"Portefeuille multi-devises",subtitle:"Q5 — 3 expositions simultanées",
     context:"Ce trimestre, Armor gère trois expositions simultanément. Contrats tous signés ce jour — BPI disponible sur chaque exposition.",
     exposition:"• Créance +200 000 USD (3 mois)\n• Dette −150 000 GBP (3 mois)\n• Créance +30 000 000 JPY (3 mois)",
     ops_net:310000, hasCommercialContract:true, isAO:false, currency:"MULTI", amount:null, isExport:true,
     marketData:{
       spotBid:[["Banque Crédit Ouest","USD:1,0842 | GBP:0,8643 | JPY:162,25"],["Banque Atlantique","USD:1,0848 | GBP:0,8647 | JPY:162,30"]],
       spotAsk:[["Banque Crédit Ouest","USD:1,0858 | GBP:0,8657 | JPY:162,55"],["Banque Atlantique","USD:1,0852 | GBP:0,8653 | JPY:162,50"]],
       fwdBid90:[["Banque Crédit Ouest","USD:1,0898 | GBP:0,8612 | JPY:161,40"],["Banque Atlantique","USD:1,0902 | GBP:0,8616 | JPY:161,45"]],
       fwdAsk90:[["Banque Crédit Ouest","USD:1,0918 | GBP:0,8628 | JPY:161,60"],["Banque Atlantique","USD:1,0912 | GBP:0,8624 | JPY:161,55"]],
       mmBorrow:"3,50 %/an (EUR)",mmLend:"USD:5,20% | GBP:5,00% | JPY:0,10%",
       bpiContrat:"Cours garantis : USD 1,0900 | GBP 0,8620 | JPY 161,50 — Prime 1,5 % chaque",
       bpiNego:null, escompteClient:"0,5 % (USD) pour paiement immédiat",
       penaliteClient:null, escompteFournisseur:"0,8 % (GBP) pour paiement immédiat",
       penaliteFournisseur:null,
     },
     computeHedgeResult:(instrument,banque,montant)=>{
       const uF=Math.round(200000/1.0912),gF=-Math.round(150000/0.8624),jF=Math.round(30000000/161.55);
       const uS=Math.round(200000/1.1000),gS=-Math.round(150000/0.8550),jS=Math.round(30000000/159.0);
       const t={
         forward_ATL:uF+gF+jF, forward_CO:Math.round(200000/1.0918)-Math.round(150000/0.8628)+Math.round(30000000/161.60),
         netting:Math.round((uF+uS)/2)+gF+jS,
         none:uS+gS+jS, bpi_contrat:Math.round(200000/1.09)+(-Math.round(150000/0.862))+Math.round(30000000/161.5),
       };
       return t[instrument]||t.none;
     },
     computePertinence:(instrument,montant)=>{
       if(instrument==="bpi_nego")return 0;
       if(instrument==="netting")return 100;
       if(instrument==="forward_ATL")return 95;
       if(instrument==="forward_CO")return 90;
       if(instrument==="bpi_contrat")return 85;
       if(instrument==="none")return 35;
       return 60;
     },
     realized:"USD 1,1000 | GBP 0,8550 | JPY 159,00",
     explanation:"Netting optimal : compensation USD/GBP réduit les coûts de transaction, forward résiduel JPY. Les équipes qui couvrent chaque devise séparément paient des frais inutiles. BPI contrat disponible mais plus coûteuse que le netting.",
     optimal:"netting"},
  ]},
  2:{name:"Session 2 — Stratégies Avancées",accent:"#f59e0b",rounds:[
    {id:1,title:"Netting entre filiales",subtitle:"Q6 — Optimisation des flux internes",
     context:"Armor possède 3 filiales (France, UK, Allemagne). Flux trimestriels à régler. La banque convertit automatiquement toute devise au taux ASK (défavorable). La solution est de centraliser et compenser avant tout transfert.",
     exposition:"France→UK : 200 000 GBP\nAllemagne→France : 250 000 EUR\nUK→Allemagne : 180 000 EUR\nFrance→Allemagne : 150 000 EUR",
     ops_net:120000, hasCommercialContract:false, isAO:false, currency:"MULTI", amount:null, isExport:false,
     marketData:{
       spotBid:[["Banque Crédit Ouest","GBP/EUR:0,8643"],["Banque Atlantique","GBP/EUR:0,8647"]],
       spotAsk:[["Banque Crédit Ouest","GBP/EUR:0,8657"],["Banque Atlantique","GBP/EUR:0,8653"]],
       fwdBid90:[["Banque Crédit Ouest","GBP/EUR:0,8612"],["Banque Atlantique","GBP/EUR:0,8616"]],
       fwdAsk90:[["Banque Crédit Ouest","GBP/EUR:0,8628"],["Banque Atlantique","GBP/EUR:0,8624"]],
       mmBorrow:"3,50 %/an (EUR)",mmLend:"5,00 %/an (GBP)",
       bpiContrat:null, bpiNego:null,
       escompteClient:null, penaliteClient:null, escompteFournisseur:null, penaliteFournisseur:null,
       coutTransaction:"0,30 % par transfert brut",
     },
     computeHedgeResult:(instrument,banque,montant)=>{
       const gross=(200000/0.8650)+250000+180000+150000;
       const coeff={netting_multi:0.20, netting_bilateral:0.55, none:1.0, forward_CO:0.25, forward_ATL:0.25};
       return Math.round(-gross*0.003*(coeff[instrument]||1.0));
     },
     computePertinence:(instrument,montant)=>{
       if(instrument==="bpi_nego"||instrument==="bpi_contrat")return 0;
       if(instrument==="netting_multi")return 100;
       if(instrument==="forward_CO"||instrument==="forward_ATL")return 80;
       if(instrument==="netting_bilateral")return 55;
       if(instrument==="none")return 15;
       return 40;
     },
     realized:"Netting multilatéral : 1 transfert résiduel de 44 000 EUR",
     explanation:"Netting multilatéral optimal : 4 transferts réduits à 1, économie ~75% des coûts. Le forward résiduel sur GBP après netting (80 pts) est une bonne alternative. Les règlements bruts coûtent jusqu'à 4x plus cher.",
     optimal:"netting_multi"},
    {id:2,title:"Appel d'offres international",subtitle:"Q7 — Soumission en USD",
     context:"Armor répond à un appel d'offres d'un donneur d'ordre américain. Le contrat vaudrait 3 000 000 USD si remporté. Résultat de l'AO dans 45 jours. Armor ne sait pas si elle remportera le contrat — elle doit se couvrir contre le risque de change pendant la négociation.",
     exposition:"Exposition potentielle : +3 000 000 USD\nRésultat AO : dans 45 jours\nAucun contrat signé à ce stade",
     ops_net:180000, hasCommercialContract:false, isAO:true, currency:"USD", amount:3000000, isExport:true,
     marketData:{
       spotBid:[["Banque Crédit Ouest","1,0842"],["Banque Atlantique","1,0838"]],
       spotAsk:[["Banque Crédit Ouest","1,0858"],["Banque Atlantique","1,0862"]],
       fwdBid45:[["Banque Crédit Ouest","1,0868"],["Banque Atlantique","1,0864"]],
       fwdAsk45:[["Banque Crédit Ouest","1,0882"],["Banque Atlantique","1,0878"]],
       mmBorrow:"3,50 %/an (EUR)",mmLend:"5,20 %/an (USD)",
       bpiContrat:"Non disponible — aucun contrat signé",
       bpiNego:"Cours garanti : 1,0850 — Prime : 2,2 % — Valable 60 jours\nSi AO perdu : prime partiellement remboursée (70%)",
       escompteClient:null, penaliteClient:null, escompteFournisseur:null, penaliteFournisseur:null,
     },
     computeHedgeResult:(instrument,banque,montant)=>{
       const m=Math.min(montant,3000000);
       const prime=Math.round(m/1.0850*0.022);
       const r={
         bpi_nego:Math.round(m/1.0850)-prime,
         none:Math.round(m/1.0950),
         forward_CO:Math.round(m/1.0882),forward_ATL:Math.round(m/1.0878),
       };
       return r[instrument]||Math.round(m/1.0950);
     },
     computePertinence:(instrument,montant)=>{
       if(montant<=0)return 0;
       if(instrument==="bpi_contrat")return 0;
       if(instrument==="bpi_nego")return 100;
       if(instrument==="none")return 50;
       if(instrument==="forward_CO"||instrument==="forward_ATL")return 40;
       return 30;
     },
     realized:"Armor remporte l'AO — USD réalisé à 1,0950",
     explanation:"BPI négociation (100 pts) : seul instrument adapté à un AO — cours garanti si contrat remporté, prime partiellement remboursée si perdu. Forward (40 pts) : dangereux si AO perdu, Armor serait en position spéculative. Sans couverture (50 pts) : acceptable mais risqué.",
     optimal:"bpi_nego"},
    {id:3,title:"Financement international",subtitle:"Q8 — Swap de devises EUR/USD 3 ans",
     context:"Armor lève 2 000 000 EUR pour financer sa nouvelle ligne de production. Elle peut emprunter moins cher en USD qu'en EUR grâce à sa relation bancaire américaine. Un swap de devises lui permet de bénéficier du taux USD tout en restant en EUR.",
     exposition:"Besoin : 2 000 000 EUR\nDurée : 3 ans\nNotation : BBB+",
     ops_net:200000, hasCommercialContract:false, isAO:false, currency:"USD", amount:2000000, isExport:false,
     marketData:{
       spotBid:[["Banque Crédit Ouest","1,0842"],["Banque Atlantique","1,0838"]],
       spotAsk:[["Banque Crédit Ouest","1,0858"],["Banque Atlantique","1,0862"]],
       fwdBid90:[["Banque Crédit Ouest","1,0898"],["Banque Atlantique","1,0902"]],
       fwdAsk90:[["Banque Crédit Ouest","1,0918"],["Banque Atlantique","1,0912"]],
       mmBorrow:"3,50 %/an (EUR)",mmLend:"5,20 %/an (USD)",
       swapDevises:"Emprunt USD : 4,20 %/an\nSwap EUR/USD 3 ans : basis −1,10 %\nTaux effectif EUR : 3,10 %\nvs Crédit syndiqué direct : 4,80 %/an",
       bpiContrat:null, bpiNego:null,
       creditSyndique:"4,80 %/an fixe EUR",
       euroObligation:"4,20 % + frais émission 1,50 % → effectif 4,72 %",
       convertible:"3,10 % + dilution actionnaires",
       escompteClient:null, penaliteClient:null, escompteFournisseur:null, penaliteFournisseur:null,
     },
     computeHedgeResult:(instrument,banque,montant)=>{
       const m=Math.min(montant,2000000);
       const r={
         swap_devises:-Math.round(m*0.031/4),
         forward_CO:-Math.round(m*0.048/4),
         credit_syndique:-Math.round(m*0.048/4),
         euro_obligation:-Math.round(m*0.0472/4),
         convertible:-Math.round(m*0.031/4)+Math.round(m*0.005),
         none:-Math.round(m*0.048/4),
       };
       return r[instrument]||r.none;
     },
     computePertinence:(instrument,montant)=>{
       if(montant<=0)return 0;
       if(instrument==="bpi_nego"||instrument==="bpi_contrat")return 0;
       if(instrument==="swap_devises")return 100;
       if(instrument==="convertible")return 85;
       if(instrument==="euro_obligation")return 70;
       if(instrument==="credit_syndique"||instrument==="none")return 60;
       return 40;
     },
     realized:"Taux effectifs — Swap devises: 3,10% | Convertible: 3,10%+dilution | Obligation: 4,72% | Syndiqué: 4,80%",
     explanation:"Swap de devises (100 pts) : taux effectif 3,10% sans dilution — le meilleur. La convertible donne le même taux mais dilue les actionnaires. Règle fondamentale : comparer les taux EFFECTIFS toutes charges comprises.",
     optimal:"swap_devises"},
    {id:4,title:"Investissement au Maroc",subtitle:"Q9 — VAN d'un IDE + couverture MAD",
     context:"Armor finalise son projet d'implantation à Casablanca. Elle recevra 2 500 000 MAD/an pendant 5 ans. Comment couvrir ce risque MAD/EUR sur le long terme ? Contrat signé aujourd'hui.",
     exposition:"Flux annuels : +2 500 000 MAD\nHorizon : 5 ans\nContrat signé : aujourd'hui (BPI ≤ J+15)",
     ops_net:250000, hasCommercialContract:true, isAO:false, currency:"MAD", amount:2500000, isExport:true,
     marketData:{
       spotBid:[["Banque Crédit Ouest","10,8320"],["Banque Atlantique","10,8350"]],
       spotAsk:[["Banque Crédit Ouest","10,8680"],["Banque Atlantique","10,8650"]],
       fwdBid365:[["Banque Crédit Ouest","11,1820"],["Banque Atlantique","11,1850"]],
       fwdAsk365:[["Banque Crédit Ouest","11,2180"],["Banque Atlantique","11,2150"]],
       mmBorrow:"3,50 %/an (EUR)",mmLend:"4,50 %/an (MAD)",
       bpiContrat:"Cours garanti : 11,20 — Prime : 2,0 % — Délai max : J+15",
       bpiNego:null,
       escompteClient:"1,0 % pour paiement à 6 mois (au lieu de 12)",
       penaliteClient:null, escompteFournisseur:null, penaliteFournisseur:null,
     },
     computeHedgeResult:(instrument,banque,montant)=>{
       const m=Math.min(montant,2500000);
       const prime=Math.round(m/11.20*0.02);
       const r={
         forward_ATL:Math.round(m/11.2150),forward_CO:Math.round(m/11.2180),
         bpi_contrat:Math.round(m/11.20)-prime,
         mm:Math.round(m/11.25),none:Math.round(m/10.85),
       };
       return r[instrument]||Math.round(m/10.85);
     },
     computePertinence:(instrument,montant)=>{
       if(montant<=0)return 0;
       if(instrument==="bpi_nego")return 0;
       if(instrument==="forward_ATL")return 100;
       if(instrument==="forward_CO")return 95;
       if(instrument==="bpi_contrat")return 90;
       if(instrument==="mm")return 75;
       if(instrument==="none")return 30;
       return 50;
     },
     realized:"EUR/MAD réalisé à 1 an : 11,35 — Dirham déprécié",
     explanation:"Forward Atlantique (100 pts) : 222 948 €/an sécurisé. BPI contrat (90 pts) : 221 726 € net de prime — légèrement inférieur mais garanti sur 5 ans. Sans couverture : 220 264 € — le MAD s'est déprécié, la couverture était justifiée.",
     optimal:"forward_ATL"},
    {id:5,title:"Crise de change finale",subtitle:"Q10 — Pays émergent en crise",
     context:"La devise d'un pays partenaire d'Armor s'effondre de −25 % en 48h. Marchés forward gelés. Armor a des actifs, des créances et des dettes dans cette devise. Décision urgente.",
     exposition:"Actifs filiale : 8 000 000 devise locale\nCréance export EUR : +500 000 EUR\nDette locale : −2 000 000 devise locale",
     ops_net:150000, hasCommercialContract:true, isAO:false, currency:"LOCAL", amount:null, isExport:true,
     marketData:{
       spotBid:[["Banque Crédit Ouest","Marché gelé — cours indicatif −25 %"],["Banque Atlantique","Cours indicatif seulement"]],
       spotAsk:[["Banque Crédit Ouest","Spread très large — +8 %"],["Banque Atlantique","Spread très large — +8 %"]],
       fwdBid90:[["Banque Crédit Ouest","Indisponible"],["Banque Atlantique","Indisponible"]],
       fwdAsk90:[["Banque Crédit Ouest","Indisponible"],["Banque Atlantique","Indisponible"]],
       mmBorrow:"Marché local gelé",mmLend:"Marché local gelé",
       bpiContrat:"Non applicable — devise locale non couverte BPI",
       bpiNego:null,
       escompteClient:"Rapatriement possible à −25 % sur valeur initiale",
       penaliteClient:null,
       escompteFournisseur:"Remboursement anticipé dette locale possible",
       penaliteFournisseur:"Maintien dette — risque de dépréciation supplémentaire",
     },
     computeHedgeResult:(instrument,banque,montant)=>{
       const r={
         rapatriement:200000, remboursement:150000,
         combinee:350000, none:-80000,
         forward_CO:0, forward_ATL:0,
       };
       return r[instrument]||(-80000);
     },
     computePertinence:(instrument,montant)=>{
       if(instrument==="bpi_nego"||instrument==="bpi_contrat")return 0;
       if(instrument==="forward_CO"||instrument==="forward_ATL")return 0;
       if(instrument==="combinee")return 100;
       if(instrument==="rapatriement")return 70;
       if(instrument==="remboursement")return 65;
       if(instrument==="none")return 20;
       return 30;
     },
     realized:"La devise a encore chuté de −12 % dans les 5 jours suivants",
     explanation:"Stratégie combinée (100 pts) : rapatrier (+200k) + rembourser (+150k) = +350k EUR. Forward impertinent (0 pt) : marchés gelés. BPI non applicable. Sans action : −80k EUR supplémentaires. Quand la tendance est clairement baissière, agir immédiatement est optimal.",
     optimal:"combinee"},
  ]},
};

// Instruments disponibles par type de round
const getAvailableInstruments = (round) => {
  const instruments = [];
  if(round.currency !== "LOCAL"){
    instruments.push({id:"none", label:"Aucune couverture", icon:"⚡", group:"Aucune"});
    if(round.currency !== "MULTI" || round.id === 5){
      instruments.push({id:"forward_CO", label:"Forward — Banque Crédit Ouest", icon:"🔒", group:"Forward"});
      instruments.push({id:"forward_ATL", label:"Forward — Banque Atlantique", icon:"🔒", group:"Forward"});
    }
    if(round.id === 1 || round.id === 2 || round.id === 3) instruments.push({id:"mm", label:"Couverture marché monétaire", icon:"🏦", group:"Marché monétaire"});
    if(round.id === 4) instruments.push({id:"swap_change", label:"Swap de change EUR/USD", icon:"🔄", group:"Swap"});
    if(round.id === 5) instruments.push({id:"netting", label:"Netting + forward résiduel", icon:"♻️", group:"Netting"});
    if(round.currency === "MULTI" && round.id !== 5) instruments.push({id:"netting_multi", label:"Netting multilatéral complet", icon:"♻️", group:"Netting"},{id:"netting_bilateral", label:"Netting bilatéral", icon:"⚖️", group:"Netting"});
  }
  if(round.id === 8 || (round.session === 2 && round.id === 3)){
    instruments.push({id:"swap_devises", label:"Swap de devises EUR/USD 3 ans", icon:"💱", group:"Swap"});
    instruments.push({id:"credit_syndique", label:"Crédit syndiqué", icon:"🏦", group:"Financement"});
    instruments.push({id:"euro_obligation", label:"Euro-obligation", icon:"📋", group:"Financement"});
    instruments.push({id:"convertible", label:"Obligation convertible", icon:"🔄", group:"Financement"});
  }
  if(round.escompteFournisseur||round.marketData?.escompteFournisseur) instruments.push({id:"escompte_fournisseur", label:"Paiement anticipé fournisseur", icon:"⚡", group:"Termes commerciaux"});
  if(round.penaliteFournisseur||round.marketData?.penaliteFournisseur) instruments.push({id:"penalite_fournisseur", label:"Paiement différé fournisseur", icon:"⏳", group:"Termes commerciaux"});
  if(round.marketData?.escompteClient) instruments.push({id:"escompte_client", label:"Encaissement anticipé client", icon:"💰", group:"Termes commerciaux"});
  if(round.marketData?.penaliteClient) instruments.push({id:"penalite_client", label:"Encaissement différé client", icon:"⏳", group:"Termes commerciaux"});
  if(round.id === 10 || (round.currency === "LOCAL")){
    instruments.push({id:"rapatriement", label:"Rapatrier la trésorerie filiale", icon:"🏃", group:"Crise"});
    instruments.push({id:"remboursement", label:"Rembourser la dette locale", icon:"💱", group:"Crise"});
    instruments.push({id:"combinee", label:"Stratégie combinée (rapatriement + remboursement)", icon:"⚡", group:"Crise"});
  }
  // BPI toujours proposé, validé côté logique
  instruments.push({id:"bpi_contrat", label:"BPI — Assurance change contrat", icon:"🛡️", group:"BPI"});
  instruments.push({id:"bpi_nego", label:"BPI — Assurance change négociation", icon:"🛡️", group:"BPI"});
  return instruments;
};

const validateInstrument = (instrument, round) => {
  if(instrument === "bpi_nego" && !round.isAO) return {valid:false, reason:"L'assurance change négociation BPI est réservée aux appels d'offres internationaux. Ce round ne comporte pas d'appel d'offres."};
  if(instrument === "bpi_contrat" && !round.hasCommercialContract) return {valid:false, reason:"L'assurance change contrat BPI nécessite un contrat commercial signé. Aucun contrat n'a été signé dans ce round."};
  if(instrument === "bpi_contrat" && round.marketData?.bpiContrat?.includes("hors délai")) return {valid:false, reason:"Délai BPI dépassé : le contrat BPI doit être souscrit au plus tard 15 jours après la signature du contrat commercial."};
  if((instrument === "forward_CO" || instrument === "forward_ATL") && round.marketData?.fwdBid90?.[0]?.[1] === "Indisponible") return {valid:false, reason:"Le marché forward est gelé dans ce contexte de crise. Aucun contrat à terme ne peut être conclu."};
  return {valid:true};
};

// ═══ SUPABASE ═══
const getGameState=async()=>{const{data}=await supabase.from("game_state").select("*").eq("id",1).single();return data;};
const setGameState=async(u)=>{await supabase.from("game_state").update({...u,updated_at:new Date().toISOString()}).eq("id",1);};
const getTeams=async()=>{const{data}=await supabase.from("teams").select("*").order("total",{ascending:false});return data||[];};
const upsertTeam=async(t)=>{await supabase.from("teams").upsert(t);};
const getDecisions=async(s,r)=>{const{data}=await supabase.from("decisions").select("*").eq("session",s).eq("round_index",r);return data||[];};
const submitDecisionDB=async(s,r,tid,payload)=>{await supabase.from("decisions").upsert({session:s,round_index:r,team_id:tid,choice:JSON.stringify(payload)},{onConflict:"session,round_index,team_id"});};
const getPlacements=async(s,r)=>{const{data}=await supabase.from("placements").select("*").eq("session",s).eq("round_index",r);return data||[];};
const submitPlacementDB=async(s,r,tid,c)=>{await supabase.from("placements").upsert({session:s,round_index:r,team_id:tid,choice:c},{onConflict:"session,round_index,team_id"});};

// ═══ COMPOSANTS ═══
function MarketDataPanel({data, round}){
  const rows = [];
  if(data.spotBid) data.spotBid.forEach((r,i)=>rows.push([`Spot BID — ${r[0]}`, r[1]]));
  if(data.spotAsk) data.spotAsk.forEach((r,i)=>rows.push([`Spot ASK — ${r[0]}`, r[1]]));
  if(data.fwdBid90) data.fwdBid90.forEach(r=>rows.push([`Forward BID 90j — ${r[0]}`, r[1]]));
  if(data.fwdAsk90) data.fwdAsk90.forEach(r=>rows.push([`Forward ASK 90j — ${r[0]}`, r[1]]));
  if(data.fwdBid30) data.fwdBid30.forEach(r=>rows.push([`Forward BID 30j — ${r[0]}`, r[1]]));
  if(data.fwdAsk30) data.fwdAsk30.forEach(r=>rows.push([`Forward ASK 30j — ${r[0]}`, r[1]]));
  if(data.fwdBid45) data.fwdBid45.forEach(r=>rows.push([`Forward BID 45j — ${r[0]}`, r[1]]));
  if(data.fwdAsk45) data.fwdAsk45.forEach(r=>rows.push([`Forward ASK 45j — ${r[0]}`, r[1]]));
  if(data.fwdBid60) data.fwdBid60.forEach(r=>rows.push([`Forward BID 60j — ${r[0]}`, r[1]]));
  if(data.fwdAsk60) data.fwdAsk60.forEach(r=>rows.push([`Forward ASK 60j — ${r[0]}`, r[1]]));
  if(data.fwdBid180) data.fwdBid180.forEach(r=>rows.push([`Forward BID 180j — ${r[0]}`, r[1]]));
  if(data.fwdAsk180) data.fwdAsk180.forEach(r=>rows.push([`Forward ASK 180j — ${r[0]}`, r[1]]));
  if(data.fwdBid365) data.fwdBid365.forEach(r=>rows.push([`Forward BID 1 an — ${r[0]}`, r[1]]));
  if(data.fwdAsk365) data.fwdAsk365.forEach(r=>rows.push([`Forward ASK 1 an — ${r[0]}`, r[1]]));
  if(data.mmBorrow) rows.push(["Taux emprunt", data.mmBorrow]);
  if(data.mmLend) rows.push(["Taux prêt", data.mmLend]);
  if(data.swapChange){rows.push(["─── Swap de change ───",""]);}
  if(data.swapChange) data.swapChange.split("\n").forEach(l=>{const p=l.split("→");rows.push([p[0]?.trim()||l, p[1]?.trim()||""]);});
  if(data.swapDevises){rows.push(["─── Swap de devises ───",""]);data.swapDevises.split("\n").forEach(l=>{const p=l.split(":");rows.push([p[0]?.trim()||l, p[1]?.trim()||""]);})}
  if(data.coutTransaction) rows.push(["Coût transaction", data.coutTransaction]);
  if(data.bpiContrat){rows.push(["─── BPI Assurance change contrat ───",""]);rows.push(["Conditions", data.bpiContrat]);}
  if(data.bpiNego){rows.push(["─── BPI Assurance change négociation ───",""]);data.bpiNego.split("\n").forEach(l=>{const p=l.split(":");rows.push([p[0]?.trim()||l, p[1]?.trim()||""])});}
  if(data.escompteFournisseur) rows.push(["Escompte fournisseur", data.escompteFournisseur]);
  if(data.penaliteFournisseur) rows.push(["Pénalité fournisseur", data.penaliteFournisseur]);
  if(data.escompteClient) rows.push(["Escompte client", data.escompteClient]);
  if(data.penaliteClient) rows.push(["Pénalité client", data.penaliteClient]);
  if(data.creditSyndique) rows.push(["Crédit syndiqué", data.creditSyndique]);
  if(data.euroObligation) rows.push(["Euro-obligation", data.euroObligation]);
  if(data.convertible) rows.push(["Obligation convertible", data.convertible]);
  return(
    <div style={{background:"rgba(0,0,0,0.45)",borderRadius:8,padding:"10px 14px",fontFamily:"monospace",fontSize:12}}>
      <div style={{color:"#475569",fontSize:10,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:6}}>Données de marché</div>
      {rows.map(([l,v],i)=>(
        <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",borderBottom:i<rows.length-1?"1px solid rgba(255,255,255,0.04)":"none",opacity:l.includes("───")?0.4:1}}>
          <span style={{color:l.includes("───")?"#334155":"#94a3b8",fontStyle:l.includes("───")?"italic":"normal"}}>{l}</span>
          <span style={{color:"#f0f9ff",fontWeight:600,marginLeft:8,textAlign:"right",maxWidth:"55%"}}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function Timer({startedAt, duration, onExpire}){
  const [remaining, setRemaining] = useState(duration);
  useEffect(()=>{
    if(!startedAt) return;
    const update = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const rem = Math.max(0, duration - elapsed);
      setRemaining(rem);
      if(rem === 0 && onExpire) onExpire();
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [startedAt, duration, onExpire]);
  const mins = Math.floor(remaining/60), secs = remaining%60;
  const isUrgent = remaining < 120;
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 14px",background:isUrgent?"rgba(239,68,68,0.15)":"rgba(0,0,0,0.4)",borderRadius:8,border:`1px solid ${isUrgent?"rgba(239,68,68,0.4)":"rgba(255,255,255,0.08)"}`}}>
      <span style={{fontSize:16}}>⏱️</span>
      <span style={{fontFamily:"monospace",fontWeight:800,fontSize:18,color:isUrgent?"#ef4444":"#e2e8f0"}}>{String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}</span>
    </div>
  );
}

function TreasuryBar({amount}){
  const ratio=Math.min(1,Math.max(0,amount/(INITIAL_TREASURY*1.6)));
  const color=amount<MIN_TREASURY?"#ef4444":amount<INITIAL_TREASURY*0.9?"#f59e0b":"#00d4aa";
  return(<div><div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:13}}><span style={{color:"#475569"}}>Trésorerie Armor</span><span style={{color,fontWeight:800}}>{fmt(amount)}</span></div><div style={{height:5,background:"rgba(255,255,255,0.08)",borderRadius:3}}><div style={{height:5,width:`${ratio*100}%`,background:color,borderRadius:3,transition:"width 0.6s"}}/></div>{amount<MIN_TREASURY&&<div style={{color:"#ef4444",fontSize:11,marginTop:4}}>Sous le seuil 500 000 EUR — pénalité appliquée</div>}</div>);
}

function ScoreBadge({score}){const c=score>=90?"#00d4aa":score>=70?"#f59e0b":"#ef4444";return <span style={{color:c,fontWeight:800,fontSize:16}}>{score}<span style={{fontSize:11}}> pts</span></span>;}

function Leaderboard({teams,session,showTreasury=false,finalMode=false}){
  const sk=`score${session}`;
  let sorted;
  if(finalMode){const n=teams.length||1;const byT=[...teams].sort((a,b)=>(b.treasury||0)-(a.treasury||0));sorted=teams.map(t=>{const r=byT.findIndex(x=>x.id===t.id);const ps=Math.round(((t.score_pertinence||0)/1000)*70);const ts=Math.round(((n-r-1)/Math.max(n-1,1))*30);return{...t,finalScore:ps+ts};}).sort((a,b)=>b.finalScore-a.finalScore);}
  else{sorted=[...teams].sort((a,b)=>(b.total||0)-(a.total||0));}
  const medals=["🥇","🥈","🥉"];
  return(<div><div style={{color:"#e2e8f0",fontWeight:700,fontSize:14,marginBottom:12}}>🏆 {finalMode?"Classement Final (70% pertinence + 30% trésorerie)":"Classement cumulé"}</div>{sorted.map((t,i)=>(<div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 11px",background:i===0?"rgba(0,212,170,0.1)":"rgba(255,255,255,0.03)",borderRadius:9,border:`1px solid ${i===0?"rgba(0,212,170,0.25)":"rgba(255,255,255,0.05)"}`,marginBottom:5}}><span style={{width:22,fontSize:15}}>{medals[i]||`${i+1}`}</span><span style={{flex:1,color:"#e2e8f0",fontWeight:600,fontSize:13}}>{t.name}</span>{showTreasury&&<span style={{color:"#64748b",fontSize:11}}>{fmt(t.treasury||INITIAL_TREASURY)}</span>}{finalMode?<span style={{color:"#00d4aa",fontWeight:800,fontSize:15}}>{t.finalScore}<span style={{fontSize:11}}> pts</span></span>:<span style={{color:"#00d4aa",fontWeight:800,fontSize:14}}>{t.total||0}<span style={{fontSize:11}}> pts</span></span>}</div>))}{sorted.length===0&&<div style={{color:"#334155",textAlign:"center",padding:20,fontSize:13}}>En attente des équipes...</div>}</div>);
}

// ═══ APP ═══
export default function App(){
  const[view,setView]=useState("landing");
  const[gs,setGs]=useState({phase:"lobby",session:1,round_index:0,round_phase:"waiting",started_at:null});
  const[teams,setTeams]=useState([]);
  const[myTeam,setMyTeam]=useState(null);
  const[myDecision,setMyDecision]=useState(null); // {instrument, montant, confirmed}
  const[myPlacement,setMyPlacement]=useState(null);
  const[myRoundScore,setMyRoundScore]=useState(null);
  const[myHedgeResult,setMyHedgeResult]=useState(null);
  const[validationError,setValidationError]=useState(null);
  const[decisions,setDecisions]=useState([]);
  const[placements,setPlacements]=useState([]);
  const[pinInput,setPinInput]=useState("");
  const[teamNameInput,setTeamNameInput]=useState("");
  const[teamPasswordInput,setTeamPasswordInput]=useState("");
  const[pinErr,setPinErr]=useState("");
  const[teamErr,setTeamErr]=useState("");
  const[loading,setLoading]=useState(false);
  const[selectedInstrument,setSelectedInstrument]=useState(null);
  const[montantInput,setMontantInput]=useState("");
  const[pendingPlacement,setPendingPlacement]=useState(null);

  useEffect(()=>{(async()=>{const g=await getGameState(),t=await getTeams();if(g)setGs(g);if(t)setTeams(t);const s=localStorage.getItem("fxmanager_team_v3");if(s){const p=JSON.parse(s);setMyTeam(p);setView("team");}})();},[]);

  useEffect(()=>{
    const ch=supabase.channel("fx-v3-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"game_state"},async()=>{const g=await getGameState();if(g)setGs(g);})
      .on("postgres_changes",{event:"*",schema:"public",table:"teams"},async()=>{const t=await getTeams();if(t)setTeams(t);})
      .on("postgres_changes",{event:"*",schema:"public",table:"decisions"},async()=>{const g=await getGameState();if(g){const d=await getDecisions(g.session,g.round_index);setDecisions(d);}})
      .on("postgres_changes",{event:"*",schema:"public",table:"placements"},async()=>{const g=await getGameState();if(g){const p=await getPlacements(g.session,g.round_index);setPlacements(p);}})
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[]);

  useEffect(()=>{
    setMyDecision(null);setMyPlacement(null);setMyRoundScore(null);setMyHedgeResult(null);
    setSelectedInstrument(null);setMontantInput("");setPendingPlacement(null);setValidationError(null);
    (async()=>{const d=await getDecisions(gs.session,gs.round_index);setDecisions(d);const p=await getPlacements(gs.session,gs.round_index);setPlacements(p);})();
  },[gs.round_index,gs.session]);

  // Reconnexion — restaurer décision si déjà soumise
  useEffect(()=>{
    if(!myTeam||gs.round_phase!=="deciding")return;
    const d=decisions.find(x=>x.team_id===myTeam.id);
    const p=placements.find(x=>x.team_id===myTeam.id);
    if(d){try{const parsed=JSON.parse(d.choice);setMyDecision({...parsed,confirmed:true});}catch(e){setMyDecision({instrument:d.choice,montant:0,confirmed:true});}}
    if(p)setMyPlacement(p.choice);
  },[decisions,placements,myTeam,gs.round_phase]);

  useEffect(()=>{
    if(gs.round_phase==="revealed"&&myTeam&&myDecision?.instrument){
      const r=SESSIONS[gs.session]?.rounds[gs.round_index];
      if(r){
        setMyRoundScore(r.computePertinence(myDecision.instrument,myDecision.montant||0));
        setMyHedgeResult(r.computeHedgeResult(myDecision.instrument,"",myDecision.montant||0));
      }
    }
  },[gs.round_phase,myDecision,gs.session,gs.round_index,myTeam]);

  const teacherLogin=()=>{if(pinInput===TEACHER_PIN){setView("teacher");setPinErr("");}else setPinErr("Code incorrect");};
  const startSession=async(sn)=>{await setGameState({phase:`session${sn}`,session:sn,round_index:0,round_phase:"waiting",started_at:null});};
  const launchRound=async()=>{await setGameState({round_phase:"deciding",started_at:Date.now()});};

  const revealRound=async()=>{
    const session=SESSIONS[gs.session],round=session.rounds[gs.round_index];
    const decs=await getDecisions(gs.session,gs.round_index),placs=await getPlacements(gs.session,gs.round_index);
    // Résultat placement précédent (indice boursier différé)
    const prevMarketState = gs.round_index > 0 ? MARKET_STATES[gs.round_index-1] : null;
    for(const team of teams){
      const hd=decs.find(d=>d.team_id===team.id);
      const pd=placs.find(p=>p.team_id===team.id);
      let payload={instrument:"none",montant:0};
      if(hd){try{payload=JSON.parse(hd.choice);}catch(e){payload={instrument:hd.choice,montant:0};}}
      const pc=pd?.choice||"none";
      const hr=round.computeHedgeResult(payload.instrument,"",payload.montant||0);
      const ps=round.computePertinence(payload.instrument,payload.montant||0);
      const cT=team.treasury??INITIAL_TREASURY;
      const pb=Math.max(0,cT-MIN_TREASURY);
      // Placement MM immédiat
      const mmReturn=team.last_placement==="mm"?Math.round(pb*0.012):0;
      // Placement indice différé (résultat du round précédent)
      const indexReturn=team.last_placement==="index"&&prevMarketState?Math.round(pb*prevMarketState.rate):0;
      const penalty=cT<MIN_TREASURY?Math.round(Math.abs(cT)*0.06/4):0;
      const nT=cT+round.ops_net+hr+mmReturn+indexReturn-penalty;
      const sk=`score${gs.session}`;
      await upsertTeam({...team,[sk]:(team[sk]||0)+ps,total:(team.total||0)+ps,score_pertinence:(team.score_pertinence||0)+ps,treasury:nT,last_placement:pc});
    }
    await setGameState({round_phase:"revealed"});
  };

  const nextRound=async()=>{const isLast=gs.round_index>=SESSIONS[gs.session].rounds.length-1;if(isLast){if(gs.session===1)await setGameState({phase:"between",round_phase:"waiting",round_index:0,started_at:null});else await setGameState({phase:"finished",round_phase:"waiting"});}else{await setGameState({round_index:gs.round_index+1,round_phase:"waiting",started_at:null});}};

  const resetGame=async()=>{await setGameState({phase:"lobby",session:1,round_index:0,round_phase:"waiting",started_at:null});await supabase.from("teams").delete().neq("id","");await supabase.from("decisions").delete().neq("id",0);await supabase.from("placements").delete().neq("id",0);setTeams([]);setDecisions([]);setPlacements([]);};

  const registerTeam=async()=>{
    if(!teamNameInput.trim()||!teamPasswordInput.trim()){setTeamErr("Remplissez le nom et le mot de passe.");return;}
    setLoading(true);setTeamErr("");
    const name=teamNameInput.trim(),pwd=teamPasswordInput.trim();
    const freshTeams=await getTeams();
    const ex=freshTeams.find(t=>t.name.toLowerCase()===name.toLowerCase());
    if(ex){
      if(ex.password!==pwd){setTeamErr("Mot de passe incorrect.");setLoading(false);return;}
      const me={id:ex.id,name:ex.name};
      localStorage.setItem("fxmanager_team_v3",JSON.stringify(me));
      setMyTeam(me);setTeams(freshTeams);setView("team");setLoading(false);return;
    }
    const id=`t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,5)}`;
    const me={id,name};
    await upsertTeam({id,name,password:pwd,score1:0,score2:0,total:0,score_pertinence:0,treasury:INITIAL_TREASURY,last_placement:"none"});
    localStorage.setItem("fxmanager_team_v3",JSON.stringify(me));
    setMyTeam(me);const t=await getTeams();setTeams(t);setView("team");setLoading(false);
  };

  const confirmDecision=async()=>{
    if(!myTeam||!selectedInstrument)return;
    const round=SESSIONS[gs.session]?.rounds[gs.round_index];
    if(!round)return;
    const validation=validateInstrument(selectedInstrument,round);
    if(!validation.valid){setValidationError(validation.reason);return;}
    const montant=parseFloat(montantInput.replace(/\s/g,"").replace(",","."))||0;
    const payload={instrument:selectedInstrument,montant};
    setMyDecision({...payload,confirmed:true});
    await submitDecisionDB(gs.session,gs.round_index,myTeam.id,payload);
    setValidationError(null);
  };

  const confirmPlacement=async()=>{
    if(!myTeam||!pendingPlacement)return;
    setMyPlacement(pendingPlacement);
    await submitPlacementDB(gs.session,gs.round_index,myTeam.id,pendingPlacement);
  };

  const bg={minHeight:"100vh",background:"#06070f",color:"#e2e8f0",fontFamily:"system-ui,sans-serif",margin:0,padding:0};
  const card=(e={})=>({background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:18,...e});
  const btn=(col="#00d4aa",e={})=>({background:col,color:col==="#00d4aa"?"#06070f":"#fff",border:"none",borderRadius:8,padding:"10px 20px",fontWeight:700,fontSize:14,cursor:"pointer",...e});
  const outBtn=(e={})=>({background:"transparent",color:"#64748b",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"10px 20px",fontWeight:600,fontSize:14,cursor:"pointer",...e});
  const inp={background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"10px 14px",color:"#f1f5f9",fontSize:15,width:"100%",boxSizing:"border-box",outline:"none"};

  const curSession=SESSIONS[gs.session],curRound=curSession?.rounds[gs.round_index],accent=curSession?.accent||"#00d4aa";
  const teamCount=teams.length,decCount=decisions.length,placCount=placements.length;
  const myTeamData=teams.find(t=>t.id===myTeam?.id),myTreasury=myTeamData?.treasury??INITIAL_TREASURY;
  const placBase=Math.max(0,myTreasury-MIN_TREASURY);
  const availableInstruments=curRound?getAvailableInstruments(curRound):[];

  // ══ LANDING ══
  if(view==="landing")return(<div style={{...bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}><div style={{maxWidth:440,width:"100%",textAlign:"center"}}><div style={{width:64,height:64,background:"rgba(0,212,170,0.15)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 16px"}}>💹</div><h1 style={{fontSize:34,fontWeight:800,color:"#f8fafc",margin:"0 0 4px",letterSpacing:"-0.03em"}}>FX Manager</h1><p style={{color:"#64748b",margin:"0 0 2px",fontSize:14,fontWeight:700}}>{COMPANY.name}</p><p style={{color:"#1e293b",margin:"0 0 36px",fontSize:12}}>{COMPANY.tag}</p><div style={{display:"flex",flexDirection:"column",gap:10}}><button style={{...btn(),padding:"14px 24px",fontSize:16,borderRadius:12,width:"100%"}} onClick={()=>setView("team-reg")}>🎓 Rejoindre en équipe</button><button style={{...outBtn(),padding:"14px 24px",fontSize:15,borderRadius:12,width:"100%"}} onClick={()=>setView("teacher-login")}>👨‍🏫 Espace Professeur</button><button style={{...outBtn(),padding:"12px 24px",fontSize:14,borderRadius:12,width:"100%"}} onClick={()=>setView("leaderboard")}>🏆 Classement en direct</button></div><p style={{color:"#0f172a",fontSize:12,marginTop:24}}>IAE Bretagne Sud - Finance Internationale L3</p></div></div>);

  // ══ TEACHER LOGIN ══
  if(view==="teacher-login")return(<div style={{...bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}><div style={{...card(),maxWidth:360,width:"100%"}}><h2 style={{margin:"0 0 20px",fontSize:18,color:"#f1f5f9"}}>🔐 Accès Professeur</h2><input style={inp} type="password" placeholder="Code d'accès" value={pinInput} onChange={e=>setPinInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&teacherLogin()} autoFocus/>{pinErr&&<p style={{color:"#ef4444",fontSize:13,margin:"8px 0 0"}}>{pinErr}</p>}<div style={{display:"flex",gap:10,marginTop:16}}><button style={btn()} onClick={teacherLogin}>Connexion</button><button style={outBtn()} onClick={()=>setView("landing")}>Retour</button></div></div></div>);

  // ══ TEAM REG ══
  if(view==="team-reg")return(<div style={{...bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}><div style={{...card(),maxWidth:400,width:"100%"}}><div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:32,marginBottom:6}}>💹</div><h2 style={{margin:"0 0 2px",color:"#f1f5f9",fontSize:18}}>FX Manager</h2><p style={{color:"#475569",margin:0,fontSize:12}}>Trésorier de {COMPANY.name}</p></div><div style={{display:"flex",flexDirection:"column",gap:12}}><div><div style={{color:"#475569",fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>Nom de l'équipe</div><input style={inp} placeholder="Ex: Team Alpha, Les Requins..." value={teamNameInput} onChange={e=>setTeamNameInput(e.target.value)} autoFocus/></div><div><div style={{color:"#475569",fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>Mot de passe</div><input style={inp} type="password" placeholder="Choisissez un mot de passe" value={teamPasswordInput} onChange={e=>setTeamPasswordInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&registerTeam()}/></div>{teamErr&&<p style={{color:"#ef4444",fontSize:12,margin:0}}>{teamErr}</p>}<p style={{color:"#1e293b",fontSize:11,margin:0}}>Si votre équipe existe déjà, utilisez le même nom + mot de passe pour vous reconnecter.</p></div><div style={{display:"flex",gap:10,marginTop:16}}><button style={{...btn(),flex:1,opacity:loading?0.6:1}} onClick={registerTeam} disabled={loading}>{loading?"Connexion...":"Rejoindre le jeu"}</button><button style={outBtn()} onClick={()=>setView("landing")}>Retour</button></div></div></div>);

  // ══ TEACHER ══
  if(view==="teacher"){
    const phase=gs.phase,rp=gs.round_phase;
    const prevMarket=gs.round_index>0?MARKET_STATES[gs.round_index-1]:null;
    return(<div style={{...bg,paddingBottom:40}}>
      <div style={{background:"rgba(0,0,0,0.6)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span>💹</span><span style={{fontWeight:700,color:"#f1f5f9",fontSize:14}}>{COMPANY.name}</span><span style={{background:"rgba(0,212,170,0.15)",color:"#00d4aa",borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700}}>PROF</span></div>
        <div style={{display:"flex",gap:8}}>
          {rp==="deciding"&&gs.started_at&&<Timer startedAt={gs.started_at} duration={ROUND_DURATION} onExpire={()=>{}}/>}
          <button style={{...outBtn(),padding:"5px 12px",fontSize:12}} onClick={()=>setView("leaderboard")}>🏆</button>
          <button style={{...outBtn(),padding:"5px 12px",fontSize:12,color:"#ef4444",borderColor:"rgba(239,68,68,0.25)"}} onClick={resetGame}>↺ Reset</button>
        </div>
      </div>
      <div style={{padding:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,maxWidth:1200,margin:"0 auto"}}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={card()}>
            <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
              {[["Équipes",teamCount,"#00d4aa"],["Décisions",`${decCount}/${teamCount}`,"#00d4aa"],["Placements",`${placCount}/${teamCount}`,"#3b82f6"],["Round",phase.startsWith("session")?`${gs.round_index+1}/5`:"—","#94a3b8"]].map(([l,v,c])=>(<div key={l} style={{background:"rgba(0,0,0,0.4)",borderRadius:8,padding:"8px 12px",flex:1,minWidth:60}}><div style={{fontSize:9,color:"#475569",textTransform:"uppercase",letterSpacing:"0.1em"}}>{l}</div><div style={{fontSize:17,fontWeight:800,color:c,marginTop:2}}>{v}</div></div>))}
            </div>
            {prevMarket&&rp==="revealed"&&<div style={{marginBottom:12,padding:"8px 12px",background:`${prevMarket.color}18`,border:`1px solid ${prevMarket.color}40`,borderRadius:8,fontSize:13}}><span style={{color:prevMarket.color,fontWeight:700}}>{prevMarket.label}</span><span style={{color:"#64748b",marginLeft:8}}>Rendement indice ce round : {(prevMarket.rate*100).toFixed(1)} %</span></div>}
            {phase==="lobby"&&<div><p style={{color:"#64748b",fontSize:13,margin:"0 0 8px"}}>Trésorerie initiale : {fmt(INITIAL_TREASURY)}. Classement final : 70% pertinence + 30% trésorerie.</p><button style={{...btn(),width:"100%",padding:12}} onClick={()=>startSession(1)}>▶ Démarrer Session 1</button></div>}
            {(phase==="session1"||phase==="session2")&&curRound&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {rp==="waiting"&&<button style={{...btn(accent),width:"100%",padding:12}} onClick={launchRound}>▶ Lancer Round {gs.round_index+1} — {curRound.title} (20 min)</button>}
              {rp==="deciding"&&<><div style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:8,padding:10,fontSize:13,color:"#f59e0b"}}>⏱️ Décisions : {decCount}/{teamCount} · Placements : {placCount}/{teamCount}</div><button style={{...btn("#f59e0b"),width:"100%",padding:12}} onClick={revealRound}>🔓 Révéler les résultats</button></>}
              {rp==="revealed"&&<><div style={{background:"rgba(0,212,170,0.08)",border:"1px solid rgba(0,212,170,0.2)",borderRadius:8,padding:12}}><div style={{color:"#00d4aa",fontWeight:700,marginBottom:4}}>{curRound.realized}</div><div style={{color:"#64748b",fontSize:12,lineHeight:1.6}}>{curRound.explanation}</div></div><button style={{...btn(accent),width:"100%",padding:12}} onClick={nextRound}>{gs.round_index<4?`▶ Round ${gs.round_index+2}`:phase==="session1"?"✓ Fin Session 1":"🏁 Terminer le jeu"}</button></>}
            </div>}
            {phase==="between"&&<div><div style={{color:"#00d4aa",marginBottom:12,fontSize:14}}>✅ Session 1 terminée. Faites le débrief puis lancez la Session 2.</div><button style={{...btn("#f59e0b"),width:"100%",padding:12}} onClick={()=>startSession(2)}>▶ Démarrer Session 2</button></div>}
            {phase==="finished"&&<div style={{textAlign:"center",padding:16,color:"#00d4aa",fontWeight:700,fontSize:18}}>🏆 Jeu terminé !</div>}
          </div>
          {(rp==="deciding"||rp==="revealed")&&<div style={card()}><div style={{color:"#475569",fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Décisions des équipes</div><div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:300,overflowY:"auto"}}>{teams.map(t=>{const dec=decisions.find(d=>d.team_id===t.id);let payload={instrument:"—",montant:0};if(dec){try{payload=JSON.parse(dec.choice);}catch(e){payload={instrument:dec.choice,montant:0};}}const plac=placements.find(p=>p.team_id===t.id);const sc=rp==="revealed"&&dec&&curRound?curRound.computePertinence(payload.instrument,payload.montant||0):null;return(<div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 9px",background:"rgba(0,0,0,0.3)",borderRadius:6,fontSize:11}}><span style={{color:"#cbd5e1",flex:1}}>{t.name}</span><div style={{display:"flex",gap:4,alignItems:"center"}}>{dec?<span style={{background:"rgba(0,212,170,0.15)",color:"#00d4aa",borderRadius:4,padding:"1px 6px",fontWeight:700,fontSize:10}}>{payload.instrument} {payload.montant?fmt(payload.montant):""}</span>:<span style={{color:"#1e293b"}}>...</span>}{plac?<span style={{background:"rgba(59,130,246,0.15)",color:"#3b82f6",borderRadius:4,padding:"1px 6px",fontWeight:700,fontSize:10}}>{plac.choice}</span>:<span style={{color:"#1e293b"}}>...</span>}{sc!==null&&<ScoreBadge score={sc}/>}</div></div>);})}</div></div>}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {curRound&&(phase==="session1"||phase==="session2")&&<div style={card()}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}><div><div style={{color:"#334155",fontSize:10,textTransform:"uppercase",marginBottom:2}}>{curSession.name} · Round {gs.round_index+1}/5</div><div style={{color:"#f1f5f9",fontWeight:700,fontSize:15}}>{curRound.title}</div><div style={{color:"#475569",fontSize:12}}>{curRound.subtitle}</div></div><div style={{background:"rgba(0,212,170,0.1)",borderRadius:6,padding:"4px 10px",fontSize:11,color:"#00d4aa",fontWeight:700}}>Flux ops: {curRound.ops_net>0?"+":""}{fmt(curRound.ops_net)}</div></div><p style={{color:"#64748b",fontSize:12,margin:"0 0 8px",lineHeight:1.5}}>{curRound.context}</p><div style={{background:"rgba(0,212,170,0.05)",border:"1px solid rgba(0,212,170,0.1)",borderRadius:8,padding:"7px 10px",fontFamily:"monospace",fontSize:12,color:"#94a3b8",whiteSpace:"pre-line",marginBottom:8}}>{curRound.exposition}</div><MarketDataPanel data={curRound.marketData} round={curRound}/></div>}
          <div style={card()}><Leaderboard teams={teams} session={gs.session} showTreasury={rp==="revealed"||phase==="between"||phase==="finished"} finalMode={phase==="finished"}/></div>
        </div>
      </div>
    </div>);
  }

  // ══ TEAM ══
  if(view==="team"&&myTeam){
    const phase=gs.phase,rp=gs.round_phase;
    const ms1=myTeamData?.score1||0,ms2=myTeamData?.score2||0;
    const groupedInstruments=availableInstruments.reduce((acc,inst)=>{if(!acc[inst.group])acc[inst.group]=[];acc[inst.group].push(inst);return acc;},{});
    return(<div style={{...bg,paddingBottom:40}}>
      <div style={{background:"rgba(0,0,0,0.6)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
        <div><div style={{fontWeight:700,color:"#f1f5f9",fontSize:13}}>{myTeam.name}</div><div style={{color:"#334155",fontSize:10}}>{COMPANY.name}</div></div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {rp==="deciding"&&gs.started_at&&<Timer startedAt={gs.started_at} duration={ROUND_DURATION} onExpire={()=>{if(!myDecision?.confirmed&&selectedInstrument)confirmDecision();}}/>}
          <div style={{textAlign:"right"}}><div style={{color:myTreasury<MIN_TREASURY?"#ef4444":myTreasury<INITIAL_TREASURY?"#f59e0b":"#00d4aa",fontWeight:800,fontSize:14}}>{fmt(myTreasury)}</div><div style={{color:"#334155",fontSize:10}}>Trésorerie</div></div>
        </div>
      </div>
      <div style={{padding:16,maxWidth:640,margin:"0 auto"}}>

        {phase==="lobby"&&<div style={{textAlign:"center",padding:"40px 16px"}}><div style={{fontSize:44,marginBottom:10}}>⏳</div><h2 style={{color:"#e2e8f0",margin:"0 0 6px"}}>En attente du démarrage</h2><p style={{color:"#334155",fontSize:13,marginBottom:20}}>Le professeur va lancer la partie...</p><div style={card({textAlign:"left",marginBottom:12})}><div style={{color:"#00d4aa",fontWeight:700,marginBottom:4,fontSize:14}}>🏢 {COMPANY.name}</div><div style={{color:"#475569",fontSize:12,marginBottom:10}}>{COMPANY.tag}</div><TreasuryBar amount={myTreasury}/><div style={{marginTop:12,padding:"8px 10px",background:"rgba(0,212,170,0.05)",borderRadius:8,fontSize:12,color:"#475569",lineHeight:1.6}}><strong style={{color:"#94a3b8"}}>Mission :</strong> gérer la trésorerie d'Armor sur 10 trimestres. Chaque round = couverture du risque de change + placement. Pas de compte en devises : toute devise est automatiquement convertie en EUR au taux banque. Classement final : 70% pertinence + 30% trésorerie.</div></div><div style={card({textAlign:"left"})}><div style={{color:"#334155",fontSize:11,textTransform:"uppercase",marginBottom:8}}>Équipes connectées ({teamCount})</div>{teams.map(t=><div key={t.id} style={{color:"#64748b",fontSize:13,padding:"2px 0"}}>👥 {t.name}</div>)}</div></div>}

        {(phase==="session1"||phase==="session2")&&rp==="waiting"&&<div style={{textAlign:"center",padding:"40px 16px"}}><div style={{fontSize:36,marginBottom:10}}>⏸️</div><div style={{color:"#475569",fontSize:12,textTransform:"uppercase",marginBottom:4}}>{curSession?.name}</div><h2 style={{color:"#e2e8f0",margin:"0 0 6px"}}>Round {gs.round_index+1}/5</h2><p style={{color:"#334155",fontSize:13,marginBottom:16}}>Le professeur prépare le prochain round...</p><div style={card()}><TreasuryBar amount={myTreasury}/></div></div>}

        {(phase==="session1"||phase==="session2")&&rp==="deciding"&&curRound&&<div>
          <div style={{marginBottom:12}}><div style={{color:"#334155",fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:2}}>{curSession.name} · Round {gs.round_index+1}/5</div><h2 style={{color:"#f1f5f9",margin:"0 0 2px",fontSize:18,fontWeight:800}}>{curRound.title}</h2><div style={{color:"#475569",fontSize:12}}>{curRound.subtitle}</div></div>

          {/* Contexte + données marché */}
          <div style={card({marginBottom:10})}><p style={{color:"#94a3b8",fontSize:13,margin:"0 0 8px",lineHeight:1.5}}>{curRound.context}</p><div style={{background:"rgba(0,212,170,0.05)",border:"1px solid rgba(0,212,170,0.1)",borderRadius:8,padding:"7px 10px",fontFamily:"monospace",fontSize:12,color:"#64748b",whiteSpace:"pre-line",marginBottom:8}}>{curRound.exposition}</div><MarketDataPanel data={curRound.marketData} round={curRound}/><div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:12}}><span style={{color:"#475569"}}>Flux opérationnels ce trimestre</span><span style={{color:curRound.ops_net>0?"#00d4aa":"#f59e0b",fontWeight:700}}>{curRound.ops_net>0?"+":""}{fmt(curRound.ops_net)}</span></div></div>

          {/* STEP 1: Couverture */}
          <div style={{color:"#e2e8f0",fontSize:12,fontWeight:700,marginBottom:8,letterSpacing:"0.05em"}}>① DÉCISION DE COUVERTURE DU RISQUE DE CHANGE</div>
          {myDecision?.confirmed?(
            <div style={{...card({background:"rgba(0,212,170,0.06)",borderColor:"rgba(0,212,170,0.25)",marginBottom:14})}}>
              <div style={{color:"#00d4aa",fontWeight:700,fontSize:14}}>✅ Décision confirmée et verrouillée</div>
              <div style={{color:"#64748b",fontSize:13,marginTop:4}}>Instrument : <strong style={{color:"#e2e8f0"}}>{myDecision.instrument}</strong> · Montant : <strong style={{color:"#e2e8f0"}}>{fmt(myDecision.montant||0)}</strong></div>
            </div>
          ):(
            <div style={card({marginBottom:14})}>
              {/* Sélection instrument */}
              {Object.entries(groupedInstruments).map(([group,insts])=>(
                <div key={group} style={{marginBottom:12}}>
                  <div style={{color:"#334155",fontSize:10,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>{group}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>
                    {insts.map(inst=>(
                      <button key={inst.id} onClick={()=>{setSelectedInstrument(inst.id);setValidationError(null);}} style={{background:selectedInstrument===inst.id?"rgba(0,212,170,0.12)":"rgba(255,255,255,0.02)",border:`1px solid ${selectedInstrument===inst.id?"rgba(0,212,170,0.4)":"rgba(255,255,255,0.07)"}`,borderRadius:8,padding:"9px 12px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",textAlign:"left",width:"100%"}}>
                        <span style={{fontSize:16}}>{inst.icon}</span>
                        <span style={{fontSize:13,color:selectedInstrument===inst.id?"#00d4aa":"#cbd5e1",fontWeight:selectedInstrument===inst.id?700:400}}>{inst.label}</span>
                        {selectedInstrument===inst.id&&<span style={{marginLeft:"auto",color:"#00d4aa"}}>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {/* Saisie montant */}
              {selectedInstrument&&selectedInstrument!=="none"&&selectedInstrument!=="netting"&&selectedInstrument!=="netting_multi"&&selectedInstrument!=="netting_bilateral"&&selectedInstrument!=="combinee"&&selectedInstrument!=="rapatriement"&&selectedInstrument!=="remboursement"&&(
                <div style={{marginTop:12}}>
                  <div style={{color:"#475569",fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>Montant à couvrir ({curRound.currency})</div>
                  <input style={{...inp,fontFamily:"monospace",fontSize:16}} type="text" placeholder={`Ex: ${curRound.amount||500000}`} value={montantInput} onChange={e=>setMontantInput(e.target.value)}/>
                  {curRound.amount&&<div style={{color:"#334155",fontSize:11,marginTop:4}}>Exposition max : {new Intl.NumberFormat("fr-FR").format(curRound.amount)} {curRound.currency}</div>}
                </div>
              )}
              {validationError&&<div style={{marginTop:10,padding:"10px 12px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,color:"#ef4444",fontSize:13}}>{validationError}</div>}
              <button onClick={confirmDecision} disabled={!selectedInstrument} style={{...btn(),width:"100%",padding:12,marginTop:14,opacity:selectedInstrument?1:0.4}}>🔒 Confirmer ma décision de couverture (irréversible)</button>
            </div>
          )}

          {/* STEP 2: Placement */}
          {myDecision?.confirmed&&<>
            <div style={{color:"#e2e8f0",fontSize:12,fontWeight:700,marginBottom:8,letterSpacing:"0.05em"}}>② PLACEMENT DE LA TRÉSORERIE DISPONIBLE</div>
            <div style={card({marginBottom:10})}><TreasuryBar amount={myTreasury}/><div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:12}}><span style={{color:"#475569"}}>Montant plaçable (hors réserve 500k EUR)</span><span style={{color:"#3b82f6",fontWeight:700}}>{fmt(placBase)}</span></div></div>
            {myPlacement?(
              <div style={{...card({background:"rgba(59,130,246,0.07)",borderColor:"rgba(59,130,246,0.25)",textAlign:"center"})}}>
                <div style={{color:"#3b82f6",fontWeight:700,fontSize:14}}>✅ Placement confirmé : {PLACEMENT_OPTIONS.find(p=>p.id===myPlacement)?.label}</div>
                {myPlacement==="index"&&<div style={{color:"#f59e0b",fontSize:12,marginTop:4}}>Résultat connu au prochain round selon l'état du marché</div>}
                {myPlacement==="mm"&&placBase>0&&<div style={{color:"#00d4aa",fontSize:12,marginTop:4}}>Rendement estimé : +{fmt(Math.round(placBase*0.012))}</div>}
              </div>
            ):(
              <div style={card()}>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
                  {PLACEMENT_OPTIONS.map(p=>(
                    <button key={p.id} onClick={()=>setPendingPlacement(p.id)} style={{background:pendingPlacement===p.id?"rgba(59,130,246,0.12)":"rgba(255,255,255,0.02)",border:`1px solid ${pendingPlacement===p.id?"rgba(59,130,246,0.4)":"rgba(255,255,255,0.07)"}`,borderRadius:9,padding:"11px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",width:"100%"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>{p.icon}</span><div style={{textAlign:"left"}}><div style={{fontWeight:700,fontSize:13,color:"#e2e8f0"}}>{p.label}</div><div style={{color:"#475569",fontSize:11}}>Risque : {p.risk}{p.id==="index"?" — Résultat au round suivant":p.id==="mm"?` · ${(p.rate*100).toFixed(1)} %/trim.`:""}</div></div></div>
                      <div style={{textAlign:"right"}}>{p.id==="mm"&&placBase>0&&<div style={{color:p.color,fontWeight:700,fontSize:13}}>+{fmt(Math.round(placBase*p.rate))}</div>}{p.id==="index"&&<div style={{color:"#f59e0b",fontWeight:700,fontSize:13}}>?</div>}{p.id==="none"&&<div style={{color:"#475569",fontSize:13}}>0 EUR</div>}</div>
                    </button>
                  ))}
                </div>
                <button onClick={confirmPlacement} disabled={!pendingPlacement} style={{...btn("#3b82f6"),width:"100%",padding:11,opacity:pendingPlacement?1:0.4}}>🔒 Confirmer le placement (irréversible)</button>
              </div>
            )}
            {myDecision?.confirmed&&myPlacement&&<p style={{color:"#1e293b",fontSize:12,textAlign:"center",marginTop:12}}>✅ Toutes les décisions soumises — en attente du professeur...</p>}
          </>}
        </div>}

        {(phase==="session1"||phase==="session2")&&rp==="revealed"&&curRound&&<div>
          <h2 style={{color:"#f1f5f9",margin:"0 0 12px",fontSize:17}}>📊 Résultats — {curRound.title}</h2>
          <div style={card({marginBottom:10})}><div style={{color:"#475569",fontSize:11,textTransform:"uppercase",marginBottom:10}}>Variation trésorerie ce trimestre</div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:"#475569"}}>Flux opérationnels</span><span style={{color:curRound.ops_net>0?"#64748b":"#f59e0b",fontWeight:600}}>{curRound.ops_net>0?"+":""}{fmt(curRound.ops_net)}</span></div>
            {myHedgeResult!==null&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:"#475569"}}>Résultat couverture ({myDecision?.instrument})</span><span style={{color:(myHedgeResult||0)>=0?"#00d4aa":"#ef4444",fontWeight:600}}>{(myHedgeResult||0)>=0?"+":""}{fmt(myHedgeResult||0)}</span></div>}
            {myPlacement==="mm"&&placBase>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:"#475569"}}>Placement marché monétaire</span><span style={{color:"#3b82f6",fontWeight:600}}>+{fmt(Math.round(placBase*0.012))}</span></div>}
            {myTeamData?.last_placement==="index"&&gs.round_index>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:"#475569"}}>Placement indice (round précédent) — {MARKET_STATES[gs.round_index-1]?.label}</span><span style={{color:MARKET_STATES[gs.round_index-1]?.color,fontWeight:600}}>{MARKET_STATES[gs.round_index-1]?.rate>=0?"+":""}{((MARKET_STATES[gs.round_index-1]?.rate||0)*100).toFixed(1)} %</span></div>}
            <div style={{borderTop:"1px solid rgba(255,255,255,0.08)",marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between"}}><span style={{color:"#e2e8f0",fontWeight:700}}>Nouvelle trésorerie</span><span style={{color:myTreasury>=INITIAL_TREASURY?"#00d4aa":myTreasury<MIN_TREASURY?"#ef4444":"#f59e0b",fontWeight:800,fontSize:16}}>{fmt(myTreasury)}</span></div>
          </div></div>
          {myDecision&&myRoundScore!==null&&<div style={card({background:myRoundScore>=90?"rgba(0,212,170,0.08)":myRoundScore>=70?"rgba(245,158,11,0.08)":myRoundScore>0?"rgba(239,68,68,0.08)":"rgba(100,100,100,0.08)",borderColor:myRoundScore>=90?"rgba(0,212,170,0.25)":myRoundScore>=70?"rgba(245,158,11,0.25)":myRoundScore>0?"rgba(239,68,68,0.25)":"rgba(100,100,100,0.25)",marginBottom:10})}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><div><div style={{color:"#64748b",fontSize:11}}>Score de pertinence</div><div style={{color:"#e2e8f0",fontWeight:700,fontSize:13}}>Instrument : {myDecision.instrument} · {fmt(myDecision.montant||0)}</div></div><ScoreBadge score={myRoundScore}/></div><div style={{fontSize:12,color:"#475569"}}>{myRoundScore===0?"❌ Choix impertinent — voir l'explication ci-dessous":myRoundScore>=90?"🎯 Excellent !":myRoundScore>=70?"👍 Bon choix":myRoundScore>=50?"📚 Acceptable":"⚠️ Sous-optimal"}{myRoundScore>0&&curRound.optimal!==myDecision.instrument&&` — Optimal : ${curRound.optimal}`}</div></div>}
          <div style={card({background:"rgba(0,0,0,0.4)",marginBottom:10})}><div style={{color:accent,fontWeight:700,marginBottom:4}}>📰 {curRound.realized}</div><div style={{color:"#64748b",fontSize:13,lineHeight:1.7}}>{curRound.explanation}</div></div>
          <div style={card()}><Leaderboard teams={teams} session={gs.session} showTreasury/></div>
          <p style={{color:"#1e293b",fontSize:12,textAlign:"center",marginTop:12}}>En attente du prochain round...</p>
        </div>}

        {phase==="between"&&<div style={{textAlign:"center",padding:"30px 0"}}><div style={{fontSize:40,marginBottom:10}}>☕</div><h2 style={{color:"#e2e8f0",margin:"0 0 4px"}}>Session 1 terminée !</h2><p style={{color:"#334155",fontSize:13,marginBottom:16}}>Débrief en cours avec le professeur...</p><div style={card({marginBottom:14})}><div style={{display:"flex",justifyContent:"space-around"}}>{[["Score S1",`${ms1} pts`,"#00d4aa"],["Trésorerie",fmt(myTreasury),"#f59e0b"]].map(([l,v,c])=>(<div key={l}><div style={{color:"#334155",fontSize:11}}>{l}</div><div style={{fontSize:16,fontWeight:800,color:c,marginTop:2}}>{v}</div></div>))}</div></div><div style={card()}><Leaderboard teams={teams} session={1} showTreasury/></div></div>}

        {phase==="finished"&&<div style={{padding:"20px 0"}}><div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:48,marginBottom:8}}>🏆</div><h2 style={{color:"#f1f5f9",margin:"0 0 4px"}}>Jeu terminé !</h2><p style={{color:"#334155",fontSize:13}}>Classement final : 70% pertinence + 30% trésorerie</p></div><div style={card({marginBottom:12})}><div style={{display:"flex",justifyContent:"space-around"}}>{[["S1",`${ms1} pts`,"#00d4aa"],["S2",`${ms2} pts`,"#f59e0b"],["Total",`${ms1+ms2} pts`,"#e2e8f0"],["Trésorerie",fmt(myTreasury),"#3b82f6"]].map(([l,v,c])=>(<div key={l} style={{textAlign:"center"}}><div style={{color:"#334155",fontSize:11}}>{l}</div><div style={{fontSize:14,fontWeight:800,color:c,marginTop:2}}>{v}</div></div>))}</div></div><div style={card()}><Leaderboard teams={teams} session={2} showTreasury finalMode/></div></div>}
      </div>
    </div>);
  }

  // ══ LEADERBOARD PUBLIC ══
  if(view==="leaderboard")return(<div style={{...bg,padding:24}}><div style={{maxWidth:560,margin:"0 auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div><span style={{fontSize:18}}>💹</span> <span style={{fontWeight:700,color:"#f1f5f9"}}>FX Manager</span></div><button style={{...outBtn(),padding:"6px 14px",fontSize:12}} onClick={()=>setView("landing")}>← Accueil</button></div><div style={card({marginBottom:12})}><Leaderboard teams={teams} session={gs.phase==="session2"||gs.phase==="finished"?2:1} showTreasury finalMode={gs.phase==="finished"}/></div><p style={{color:"#1e293b",fontSize:12,textAlign:"center"}}>Mis à jour en temps réel</p></div></div>);

  return <div style={{...bg,padding:24,color:"#334155"}}>Chargement...</div>;
}
