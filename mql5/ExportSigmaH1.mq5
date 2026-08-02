//+------------------------------------------------------------------+
//| ExportSigmaH1.mq5                                                 |
//| Dump, par actif, la BANDE DU MILIEU et le SIGMA de Bollinger H1   |
//| À LA CLÔTURE de chaque bougie → CSV dans MQL5/Files/.             |
//| Usage : compiler (MetaEditor F7), glisser sur un graphe, régler   |
//|   les dates, exécuter. Sortie = MQL5/Files/sigma_h1_<SYMBOL>.csv  |
//+------------------------------------------------------------------+
//
// POURQUOI CE SCRIPT EXISTE (2026-08-02)
//   Le scan live n'exporte que `sigma_h1` et `middle_h1` à s0 (bougie EN FORMATION). La valeur à la
//   CLÔTURE n'est nulle part — or c'est elle qu'il faut pour mesurer l'évolution de la moyenne d'une
//   barre à l'autre (cf. DeviationConfig : `MEANSLOPE = ΔM / ATR_P50`).
//   ⚠ Elle EXISTE pourtant déjà dans l'EA : `TopMoversScanner_NEO` calcule `sigma_h1_s1` (v8.39
//     l.955) uniquement pour en tirer un ratio, puis la jette. Et le ratio, lui, est écrit avec
//     `CsvNum(..., 0)` — EN ENTIER — donc reconstruire sigma_s1 = sigma_s0/(1+d/100) perd toute la
//     précision sous 1 %. Mesuré : la reconstruction ne redonne une valeur constante dans l'heure
//     que 9,6 % du temps (US_30). La donnée est produite puis détruite au format.
//   ⇒ Ce script comble l'HISTORIQUE. Le forward est réglé séparément, par l'ajout de la colonne
//     `sigma_h1_s1` / `middle_h1_s1` au scanner (v8.40).
//
// ⚠⚠ LES PARAMÈTRES DOIVENT RESTER IDENTIQUES À CEUX DU SCANNER, sinon les deux sources produisent
//   deux sigma différents sous le même nom — exactement le défaut d'échelle qu'on a passé la journée
//   à corriger ailleurs. Scanner v8.39 : `iBands(sym, PERIOD_H1, 20, 0, 2.0, PRICE_CLOSE)`,
//   sigma = (upper − middle) / dev. Reproduit ici à l'identique, et les inputs sont exposés pour
//   qu'une divergence soit VISIBLE plutôt que silencieuse.
//
// ⭐ MT5 NOMME UNE BOUGIE PAR SON OUVERTURE. La ligne `time=09:00` porte donc les valeurs de la
//   bougie 09:00→10:00, c'est-à-dire celles connues À 10:00. Le script de fusion en tient compte.
//
#property script_show_inputs
#property strict

// Fenêtre. ⭐ Pousser EndTime dans le FUTUR : MT5 exporte jusqu'à la dernière barre réellement
//   disponible, ce qui évite de tronquer le dernier jour (même raison que pour ExportOHLC_M1).
input datetime StartTime  = D'2026.06.19 00:00';
input datetime EndTime    = D'2026.08.10 00:00';
input int      BB_Period  = 20;      // ⚠ = TopMoversScanner_NEO.BB_Period
input double   BB_Dev     = 2.0;     // ⚠ = TopMoversScanner_NEO.BB_Dev

// Les 19 actifs du backtest (= noms MT5 vus dans l'archive `symbol`).
// ⚠ CrudeOIL en casse mixte : c'est le seul symbole du dépôt dans ce cas, et un nom uppercasé
//   ne serait JAMAIS trouvé par CopyRates. Le nom de FICHIER est uppercasé plus bas pour matcher
//   la matrice (même correctif que dans ExportOHLC_M1).
string Symbols[] = {
  "AUDUSD","EURUSD","GBPUSD","USDCAD","USDCHF","USDJPY",
  "BTCUSD","ETHUSD","GOLD","SILVER",
  "US_30","US_500","US_TECH100","GERMANY_40","UK_100",
  "BRENT_OIL","CrudeOIL","GASOLINE","COCOA"
};

void OnStart()
{
  int okCount = 0;
  for(int s = 0; s < ArraySize(Symbols); s++)
  {
    string sym = Symbols[s];

    if(!SymbolSelect(sym, true))
    {
      PrintFormat("SKIP %s : SymbolSelect a échoué (nom inconnu chez le broker ?)", sym);
      continue;
    }

    int h = iBands(sym, PERIOD_H1, BB_Period, 0, BB_Dev, PRICE_CLOSE);
    if(h == INVALID_HANDLE)
    {
      PrintFormat("SKIP %s : iBands INVALID_HANDLE err=%d", sym, GetLastError());
      continue;
    }
    // Laisser l'indicateur se calculer (handle fraîchement créé = buffers pas encore prêts).
    int tries = 0;
    while(BarsCalculated(h) <= 0 && tries < 50) { Sleep(100); tries++; }

    double mid[], up[];
    datetime tm[];
    ArraySetAsSeries(mid, false);      // ordre chronologique croissant
    ArraySetAsSeries(up,  false);
    ArraySetAsSeries(tm,  false);

    int nM = CopyBuffer(h, 0, StartTime, EndTime, mid);
    int nU = CopyBuffer(h, 1, StartTime, EndTime, up);
    int nT = CopyTime(sym, PERIOD_H1, StartTime, EndTime, tm);
    IndicatorRelease(h);

    if(nM <= 0 || nU <= 0 || nT <= 0)
    {
      PrintFormat("SKIP %s : CopyBuffer mid=%d up=%d time=%d err=%d (historique H1 non chargé ? ouvre un graphe H1)",
                  sym, nM, nU, nT, GetLastError());
      continue;
    }
    // ⚠ Les trois tableaux doivent avoir la MÊME longueur — sinon l'appariement time↔valeur est
    //   décalé et le fichier est faux sans que rien ne le signale. On tronque au plus court et on
    //   le DIT, plutôt que d'écrire un fichier silencieusement désaligné.
    int n = MathMin(nT, MathMin(nM, nU));
    if(n != nT || n != nM || n != nU)
      PrintFormat("WARN %s : longueurs inégales (time=%d mid=%d up=%d) → tronqué à %d", sym, nT, nM, nU, n);

    // Nom de fichier UPPERCASE pour matcher la matrice (CrudeOIL → CRUDEOIL).
    string up_sym = sym;
    StringToUpper(up_sym);
    string fname = StringFormat("sigma_h1_%s.csv", up_sym);
    int fh = FileOpen(fname, FILE_WRITE | FILE_TXT | FILE_ANSI);
    if(fh == INVALID_HANDLE)
    {
      PrintFormat("SKIP %s : FileOpen(%s) err=%d", sym, fname, GetLastError());
      continue;
    }
    FileWrite(fh, "time;middle;sigma");
    int written = 0;
    for(int i = 0; i < n; i++)
    {
      if(mid[i] == EMPTY_VALUE || up[i] == EMPTY_VALUE) continue;    // warmup des 20 premières barres
      double sigma = (up[i] - mid[i]) / BB_Dev;
      if(sigma <= 0.0) continue;
      FileWrite(fh, StringFormat("%s;%.5f;%.6f",
                TimeToString(tm[i], TIME_DATE | TIME_MINUTES), mid[i], sigma));
      written++;
    }
    FileClose(fh);
    PrintFormat("OK %s → %s (%d barres H1 sur %d)", sym, fname, written, n);
    okCount++;
  }
  PrintFormat("TERMINÉ : %d/%d actifs exportés. Copier MQL5/Files/sigma_h1_*.csv vers Neo-Backtest/data/sigma/ puis lancer prep/mergeSigmaH1.mjs",
              okCount, ArraySize(Symbols));
}
