//+------------------------------------------------------------------+
//| ExportOHLC_M1.mq5                                                 |
//| Dump l'historique M1 (OHLC continu, GAPLESS) des actifs du        |
//| backtest → CSV dans MQL5/Files/, pour un walk TP/SL sans trous.   |
//| Le buffer de snapshots live a des trous (nuits) ; MT5 a tout.     |
//| Usage : compiler (MetaEditor F7), glisser sur un graphe, régler   |
//|   les dates, exécuter. Sortie = MQL5/Files/ohlc_<SYMBOL>_M1.csv   |
//+------------------------------------------------------------------+
#property script_show_inputs
#property strict

// Fenêtre : archive backtest = 07-07 → 07-11. Buffer ± pour que les trades
//   tardifs trouvent leur TP/SL sur les jours suivants.
input datetime StartTime = D'2026.07.06 00:00';
input datetime EndTime   = D'2026.07.14 00:00';

// Les 19 actifs du backtest (= noms MT5 vus dans l'archive `symbol`).
string Symbols[] = {
  "AUDUSD","EURUSD","GBPUSD","USDCAD","USDCHF","USDJPY",
  "BTCUSD","ETHUSD","GOLD","SILVER",
  "US_30","US_500","US_TECH100","GERMANY_40","UK_100",
  "BRENT_OIL","CRUDEOIL","GASOLINE","COCOA"
};

void OnStart()
{
  int okCount = 0;
  for(int s = 0; s < ArraySize(Symbols); s++)
  {
    string sym = Symbols[s];

    // S'assurer que le symbole est chargé (Market Watch) + historique dispo.
    if(!SymbolSelect(sym, true))
    {
      PrintFormat("SKIP %s : SymbolSelect a échoué (nom inconnu chez le broker ?)", sym);
      continue;
    }

    MqlRates rates[];
    ArraySetAsSeries(rates, false);              // ordre chronologique croissant
    int n = CopyRates(sym, PERIOD_M1, StartTime, EndTime, rates);
    if(n <= 0)
    {
      PrintFormat("SKIP %s : CopyRates=%d err=%d (historique M1 non chargé ? ouvre un graphe M1 de ce symbole)", sym, n, GetLastError());
      continue;
    }

    int dg = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
    if(dg <= 0) dg = 5;

    string fname = "ohlc_" + sym + "_M1.csv";
    int fh = FileOpen(fname, FILE_WRITE | FILE_TXT | FILE_ANSI);
    if(fh == INVALID_HANDLE)
    {
      PrintFormat("SKIP %s : FileOpen(%s) err=%d", sym, fname, GetLastError());
      continue;
    }

    FileWrite(fh, "time;open;high;low;close");   // en-tête (une ligne)
    for(int i = 0; i < n; i++)
    {
      string line = TimeToString(rates[i].time, TIME_DATE | TIME_MINUTES) + ";" +
                    DoubleToString(rates[i].open,  dg) + ";" +
                    DoubleToString(rates[i].high,  dg) + ";" +
                    DoubleToString(rates[i].low,   dg) + ";" +
                    DoubleToString(rates[i].close, dg);
      FileWrite(fh, line);
    }
    FileClose(fh);
    okCount++;
    PrintFormat("OK %s -> %d barres M1 (%s)", sym, n, fname);
  }
  PrintFormat("=== TERMINÉ : %d/%d actifs exportés dans MQL5/Files/ ===", okCount, ArraySize(Symbols));
}
//+------------------------------------------------------------------+
